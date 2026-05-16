/**
 * ============================================================
 * 🔄 Servicio de Sincronización — sincronizacion.servicio.ts
 * ============================================================
 *
 * Implementa la estrategia OFFLINE-FIRST de GeoTask:
 *
 * ESCRITURA:
 *   Local (SQLite) → inmediato, siempre funciona sin conexión
 *   Remoto (Supabase) → tras la escritura local, en segundo plano
 *   Si el remoto falla → la tarea queda con `sincronizado = 0`
 *
 * LECTURA:
 *   Al arrancar la app (si hay sesión), se suben las pendientes
 *   y se descargan los cambios remotos desde la última sync.
 *
 * CONFLICTOS:
 *   Last-write-wins usando `updated_at` de Supabase.
 *   Si el servidor tiene un registro más nuevo → sobrescribe local.
 *   Si el local es más nuevo (editado offline) → el local gana al subir.
 *
 * @version 1.0.0
 * ============================================================
 */

import { supabase } from '../config/supabase';
import {
  obtenerTareasSinSincronizar,
  marcarTareaSincronizada,
  upsertTarea,
  leerConfiguracion,
  guardarConfiguracion,
  obtenerTareas,
} from './basedatos.servicio';
import type { Tarea } from '../models/tarea.modelo';

// Clave en la tabla `configuracion` para guardar el timestamp de la última sync.
// Usamos ISO 8601 para que Supabase (PostgreSQL) lo entienda directamente.
const CLAVE_ULTIMA_SYNC = 'ultima_sincronizacion';

// ──────────────────────────────────────────────
// SECCIÓN: Subir tareas a Supabase
// ──────────────────────────────────────────────

/**
 * Sube una sola tarea a Supabase (upsert = insert or update).
 * Si la tarea ya existe en la nube (mismo id), la sobreescribe.
 * Al terminar con éxito, marca la tarea como sincronizada en SQLite.
 *
 * @param tarea  Objeto Tarea local
 * @param userId ID del usuario autenticado (para `owner_id` en Supabase)
 */
export async function subirTarea(tarea: Tarea, userId: string): Promise<void> {
  const { error } = await supabase.from('tareas').upsert({
    id:               tarea.id,
    owner_id:         userId,
    lista_id:         tarea.listaId ?? null,
    titulo:           tarea.titulo,
    descripcion:      tarea.descripcion ?? '',
    categoria_id:     tarea.categoriaId,
    latitud:          tarea.latitud,
    longitud:         tarea.longitud,
    direccion:        tarea.direccion ?? '',
    nombre_lugar:     tarea.nombreLugar ?? null,
    osm_id:           tarea.osmId ?? null,
    radio_proximidad: tarea.radioProximidad,
    geocerca_activa:  tarea.geocercaActiva,
    completada:       tarea.completada,
    prioridad:        tarea.prioridad,
    fecha_creacion:   tarea.fechaCreacion,
    fecha_completada: tarea.fechaCompletada ?? null,
    fecha_limite:     tarea.fechaLimite ?? null,
    fotos:            tarea.fotos ?? [],
    plantilla_id:     tarea.plantillaId ?? null,
    updated_at:       new Date().toISOString(), // necesario para el filtro de sync incremental
  });

  if (error) {
    console.warn('[sync] Error subiendo tarea', tarea.id, '→', error.message);
    return;
  }

  await marcarTareaSincronizada(tarea.id);
}

/**
 * Elimina una tarea del servidor Supabase.
 * Se llama cuando el usuario borra una tarea localmente.
 * Si falla (sin conexión), la tarea ya no está en SQLite local
 * y quedará huérfana en Supabase hasta la próxima sesión.
 * TODO (Fase futura): tabla `eliminaciones_pendientes` para registrar borrados offline.
 */
export async function eliminarTareaRemota(id: string): Promise<void> {
  const { error } = await supabase.from('tareas').delete().eq('id', id);
  if (error) {
    console.warn('[sync] Error eliminando tarea remota', id, error.message);
  }
}

// ──────────────────────────────────────────────
// SECCIÓN: Sincronización completa al arrancar
// ──────────────────────────────────────────────

/**
 * Sube todas las tareas con `sincronizado = 0` a Supabase.
 * Se llama al arrancar la app si hay sesión activa, para enviar
 * cualquier cambio hecho mientras no había conexión.
 */
export async function sincronizarPendientes(userId: string): Promise<void> {
  try {
    const pendientes = await obtenerTareasSinSincronizar();
    if (pendientes.length === 0) return;

    await Promise.allSettled(
      pendientes.map((tarea) => subirTarea(tarea, userId))
    );
  } catch (e) {
    console.warn('[sync] Error en sincronizarPendientes:', e);
  }
}

/**
 * Descarga de Supabase las tareas que han cambiado desde la última sync.
 * Usa un timestamp incremental para pedir solo los deltas, no todo el historial.
 *
 * Estrategia:
 * 1. Lee `ultima_sincronizacion` de la tabla `configuracion` de SQLite
 * 2. Consulta Supabase: tareas del usuario con updated_at > ultimaSync
 * 3. Hace upsert de cada tarea recibida en SQLite local
 * 4. Actualiza el timestamp de última sync
 */
export async function descargarCambiosRemotos(userId: string): Promise<void> {
  try {
    // Leer timestamp de última sync (null = nunca sincronizado = primer arranque)
    const ultimaSync = await leerConfiguracion<string>(CLAVE_ULTIMA_SYNC);

    // Diagnosticar: cuántas tareas tenemos localmente
    const tareasLocales = await obtenerTareas(false);
    const totalLocales = tareasLocales.length;

    console.log(`[sync] descargarCambiosRemotos | userId=${userId} | ultimaSync=${ultimaSync ?? 'null'} | tareasLocales=${totalLocales}`);

    // Construir la query base
    let query = supabase
      .from('tareas')
      .select('*')
      .eq('owner_id', userId);

    // Estrategia de descarga:
    // - Si nunca sincronizamos (ultimaSync es null) → bajamos TODO.
    // - Si ya sincronizamos pero NO tenemos tareas locales → probablemente
    //   la base local se borró o es una instalación nueva. Forzamos descarga
    //   completa ignorando ultimaSync para recuperar las tareas de la nube.
    // - En otro caso → deltas desde la última sync.
    const forzarCompleto = ultimaSync !== null && totalLocales === 0;

    if (!ultimaSync || forzarCompleto) {
      if (forzarCompleto) {
        console.log('[sync] Forzando descarga COMPLETA (hay ultimaSync pero 0 tareas locales)');
      } else {
        console.log('[sync] Descarga COMPLETA (primer arranque, sin ultimaSync)');
      }
    } else {
      query = query.gt('updated_at', ultimaSync);
      console.log('[sync] Descarga incremental desde', ultimaSync);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[sync] Error descargando cambios remotos:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('[sync] Sin cambios nuevos remotos (data vacío)');
      return;
    }

    console.log(`[sync] Recibidas ${data.length} tareas desde Supabase`);

    // Convertir filas de Supabase (snake_case, timestamps de PG) al modelo Tarea
    for (const fila of data) {
      const tarea: Tarea = {
        id:              fila.id,
        titulo:          fila.titulo,
        descripcion:     fila.descripcion ?? '',
        categoriaId:     fila.categoria_id,
        latitud:         fila.latitud,
        longitud:        fila.longitud,
        direccion:       fila.direccion ?? '',
        nombreLugar:     fila.nombre_lugar ?? undefined,
        osmId:           fila.osm_id ?? undefined,
        radioProximidad: fila.radio_proximidad,
        geocercaActiva:  fila.geocerca_activa,
        completada:      fila.completada,
        prioridad:       fila.prioridad,
        fechaCreacion:   fila.fecha_creacion,
        fechaCompletada: fila.fecha_completada ?? undefined,
        fechaLimite:     fila.fecha_limite ?? undefined,
        fotos:           fila.fotos ?? [],
        plantillaId:     fila.plantilla_id ?? undefined,
        listaId:         fila.lista_id ?? undefined,
        creadoPor:       fila.owner_id,
      };
      await upsertTarea(tarea);
    }

    // Guardar el momento actual como nueva marca de sincronización
    await guardarConfiguracion(CLAVE_ULTIMA_SYNC, new Date().toISOString());
    console.log(`[sync] Sincronización completada. ${data.length} tareas insertadas/actualizadas en SQLite.`);
  } catch (e) {
    console.warn('[sync] Error en descargarCambiosRemotos:', e);
  }
}

/**
 * Sincronización completa: sube pendientes + descarga novedades.
 * Es la función principal que se llama al iniciar la app con sesión.
 */
export async function sincronizarCompleto(userId: string): Promise<void> {
  await sincronizarPendientes(userId);
  await descargarCambiosRemotos(userId);
}
