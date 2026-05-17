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
 *   y se descargan TODAS las tareas del usuario desde Supabase.
 *   GeoTask es una app personal; no habrá miles de tareas, por lo que
 *   descargar todo el historial en cada arranque es barato y MUCHO más
 *   robusto que un sync incremental basado en `updated_at` (que fallaba
 *   silenciosamente en builds de producción por autobackup de Android).
 *
 * CONFLICTOS:
 *   Si una tarea fue editada offline (sincronizado = 0), NO la sobreescribimos
 *   con la versión remota. El local gana. En otro caso, last-write-wins.
 *
 * @version 2.0.0 (Descarga completa robusta, sin updated_at)
 * ============================================================
 */

import { supabase } from '../config/supabase';
import {
  obtenerTareasSinSincronizar,
  marcarTareaSincronizada,
  upsertTarea,
  obtenerTareas,
} from './basedatos.servicio';
import type { Tarea } from '../models/tarea.modelo';

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
  });

  if (error) {
    console.warn('[sync] Error subiendo tarea', tarea.id, '→', error.message);
    return;
  }

  await marcarTareaSincronizada(tarea.id);
}

/**
 * Elimina una tarea del servidor Supabase.
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
 */
export async function sincronizarPendientes(userId: string): Promise<void> {
  try {
    const pendientes = await obtenerTareasSinSincronizar();
    if (pendientes.length === 0) {
      console.log('[sync] sincronizarPendientes: 0 tareas pendientes.');
      return;
    }

    console.log(`[sync] sincronizarPendientes: subiendo ${pendientes.length} tareas...`);
    const resultados = await Promise.allSettled(
      pendientes.map((tarea) => subirTarea(tarea, userId))
    );
    const exitosos = resultados.filter((r) => r.status === 'fulfilled').length;
    console.log(`[sync] sincronizarPendientes: ${exitosos}/${pendientes.length} subidas correctamente.`);
  } catch (e) {
    console.warn('[sync] Error en sincronizarPendientes:', e);
  }
}

/**
 * Descarga de Supabase TODAS las tareas del usuario.
 *
 * Estrategia robusta (v2):
 * 1. Consulta simple: SELECT * FROM tareas WHERE owner_id = userId
 *    Sin filtros de fecha ni de updated_at. Esto evita que un
 *    autobackup de Android restaure un `ultimaSync` corrupto y
 *    haga que el sync incremental devuelva [] silenciosamente.
 * 2. Antes de upsertear una tarea remota, verificamos si existe local
 *    y si tiene `sincronizado = 0` (fue editada offline). Si es así,
 *    NO la sobreescribimos: la versión local es más nueva.
 * 3. Logueamos TODO para poder diagnosticar en builds de producción.
 */
export async function descargarCambiosRemotos(userId: string): Promise<void> {
  try {
    console.log(`[sync] descargarCambiosRemotos | userId=${userId} | modo=DESCARGA_COMPLETA`);

    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('owner_id', userId);

    if (error) {
      console.warn('[sync] Error Supabase al descargar tareas:', error.message, '| code:', error.code);
      return;
    }

    if (!data || data.length === 0) {
      console.log('[sync] Supabase devolvió 0 tareas para este usuario. Revisa RLS o que la tabla tareas tenga datos con owner_id correcto.');
      return;
    }

    console.log(`[sync] Recibidas ${data.length} tareas desde Supabase`);

    // Obtener IDs de tareas locales que fueron editadas offline (sincronizado = 0)
    // para no sobreescribirlas con la versión remota.
    const localesSinSync = await obtenerTareasSinSincronizar();
    const idsLocalesSinSync = new Set(localesSinSync.map((t) => t.id));

    let insertadas = 0;
    let saltadas = 0;

    for (const fila of data) {
      // Si la tarea fue editada localmente sin subir, preservamos la local
      if (idsLocalesSinSync.has(fila.id)) {
        console.log(`[sync] Tarea ${fila.id} tiene cambios locales sin subir. Se preserva la versión local.`);
        saltadas++;
        continue;
      }

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
      insertadas++;
    }

    console.log(`[sync] Sincronización completada. ${insertadas} insertadas/actualizadas, ${saltadas} saltadas (editadas offline).`);
  } catch (e) {
    console.warn('[sync] Error en descargarCambiosRemotos:', e);
  }
}

/**
 * Sincronización completa: sube pendientes + descarga novedades.
 */
export async function sincronizarCompleto(userId: string): Promise<void> {
  await sincronizarPendientes(userId);
  await descargarCambiosRemotos(userId);
}
