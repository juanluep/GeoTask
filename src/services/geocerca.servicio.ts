/**
 * ============================================================
 * 🗺️ Servicio de Geocercas — geocerca.servicio.ts
 * ============================================================
 *
 * Gestiona el registro y monitorización de geocercas usando expo-location.
 *
 * ¿Qué es una geocerca?
 * Una geocerca es una zona circular invisible definida por:
 * - Un punto central (latitud + longitud)
 * - Un radio en metros
 *
 * El sistema operativo (iOS/Android) monitoriza si el dispositivo entra
 * o sale de esa zona, incluso con la app cerrada o en background.
 * Cuando detecta una entrada, dispara un evento que nuestro TaskManager procesa.
 *
 * Limitaciones importantes:
 * - iOS: máximo ~20 geocercas simultáneas. Si hay más tareas, activamos
 *   las más cercanas al usuario (rotación inteligente — Fase 4).
 * - Android: sin límite oficial, pero la batería se resiente con muchas.
 * - Precisión: ~50-100m dependiendo del hardware y condiciones de señal.
 *
 * @version 1.0.0
 * ============================================================
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { obtenerTareas, leerConfiguracion } from './basedatos.servicio';
import { enviarNotificacionProximidad } from './notificacion.servicio';
import { obtenerHorario } from './horarios.servicio';
import type { Tarea } from '../models/tarea.modelo';

// ──────────────────────────────────────────────
// 📛 SECCIÓN: Nombre de la tarea background
// Este nombre debe ser único en toda la app.
// Lo usamos tanto en defineTask() como en startGeofencingAsync()
// para que ambos hablen del mismo proceso.
// ──────────────────────────────────────────────
export const NOMBRE_TAREA_GEOCERCA = 'GEOTASK_GEOCERCA_MONITOR';

/** Número máximo de geocercas simultáneas (límite de iOS) */
const MAX_GEOCERCAS = 20;

// ──────────────────────────────────────────────
// 🔧 SECCIÓN: Definición de la tarea background
// IMPORTANTE: defineTask debe ejecutarse en el nivel raíz del módulo,
// NO dentro de una función o componente. Expo TaskManager lo registra
// al cargarse el bundle de JavaScript, antes de que React monte.
// ──────────────────────────────────────────────

/**
 * Define la tarea background que procesa las entradas/salidas de geocercas.
 *
 * Esta función se ejecuta en segundo plano cuando el SO detecta que el
 * usuario ha entrado o salido de una geocerca registrada.
 * El contexto de ejecución es limitado (sin UI, sin estado React),
 * pero sí puede hacer fetch, leer SQLite y enviar notificaciones.
 */
TaskManager.defineTask(NOMBRE_TAREA_GEOCERCA, async ({ data, error }: any) => {
  if (error) {
    console.error('[geocerca] Error en tarea background:', error.message);
    await registrarDebugLog(`Error en tarea: ${error.message}`);
    return;
  }

  const { eventType, region } = data;
  const tipoEvento = eventType === Location.GeofencingEventType.Enter ? 'ENTRADA' : 'SALIDA';
  
  console.log(`[geocerca] Evento ${tipoEvento} detectado en región: ${region.identifier}`);
  await registrarDebugLog(`Evento ${tipoEvento}: ${region.identifier}`);

  // Solo procesamos ENTRADAS, no salidas
  if (eventType !== Location.GeofencingEventType.Enter) return;

  try {
    const tareasPendientes = await obtenerTareas(false);
    const tarea = tareasPendientes.find((t) => t.id === region.identifier);

    if (!tarea) {
      console.warn('[geocerca] No se encontró la tarea para la región:', region.identifier);
      await registrarDebugLog(`Tarea no encontrada: ${region.identifier}`);
      return;
    }

    if (!tarea.geocercaActiva) {
      console.log(`[geocerca] Ignorando "${tarea.titulo}" — geocerca desactivada.`);
      return;
    }

    const verificarHorarios = await leerConfiguracion<boolean>('verificarHorarios');
    if (verificarHorarios && tarea.osmId) {
      try {
        const horario = await obtenerHorario(tarea.osmId, tarea.latitud, tarea.longitud);
        if (!horario.sinDatos && !horario.abierto) {
          console.log(`[geocerca] No se notifica "${tarea.titulo}" — establecimiento cerrado.`);
          await registrarDebugLog(`Establecimiento cerrado: ${tarea.titulo}`);
          return;
        }
      } catch (errHorario) {
        // Si la API de horarios falla (sin red, timeout), notificamos igualmente
        console.warn('[geocerca] Error al verificar horario, se notifica de todas formas:', errHorario);
        await registrarDebugLog(`Error horario (notificando igual): ${tarea.titulo}`);
      }
    }

    await enviarNotificacionProximidad(tarea);
    await registrarDebugLog(`Notificación enviada: ${tarea.titulo}`);
  } catch (err) {
    console.error('[geocerca] Error al procesar entrada:', err);
    await registrarDebugLog(`Error procesando entrada: ${err}`);
  }
});

// ──────────────────────────────────────────────
// 🚀 SECCIÓN: Registro de geocercas
// ──────────────────────────────────────────────

/**
 * Registra las geocercas activas de todas las tareas pendientes.
 *
 * Se llama:
 * - Al iniciar la app (desde _layout.tsx)
 * - Después de crear/modificar/eliminar una tarea
 *
 * Estrategia: cancelar todo y re-registrar desde cero.
 * Es más simple y seguro que mantener un diff de cambios.
 */
export async function registrarTodasLasGeocercas(): Promise<void> {
  try {
    // Verificar que tenemos permiso de ubicación en background.
    // Si aún no lo tenemos, intentamos pedirlo directamente (auto-recuperación).
    let { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      try {
        const respuesta = await Location.requestBackgroundPermissionsAsync();
        status = respuesta.status;
      } catch {
        // Algunos dispositivos/entornos (ej. Expo Go) no soportan esta llamada
      }
    }
    if (status !== 'granted') {
      console.warn('[geocerca] Sin permiso de background location. No se registran geocercas.');
      await registrarDebugLog('Sin permiso background location');
      return;
    }

    // Obtener todas las tareas pendientes con geocerca activa
    const tareas = await obtenerTareas(false);
    const tareasConGeocerca = tareas.filter((t) => t.geocercaActiva && t.latitud !== 0 && t.longitud !== 0);

    if (tareasConGeocerca.length === 0) {
      // Si no hay tareas, detener el geofencing si estaba activo
      await detenerGeofencing();
      return;
    }

    // Limitar a MAX_GEOCERCAS (limitación de iOS)
    // TODO (Fase 4): En vez de las primeras N, elegir las N más cercanas al usuario
    const tareasARegistrar = tareasConGeocerca.slice(0, MAX_GEOCERCAS);

    // Convertir tareas a regiones de geocerca
    const regiones: Location.LocationRegion[] = tareasARegistrar.map((tarea) =>
      tareaARegion(tarea)
    );

    // Sanidad: descartar regiones con coordenadas inválidas o radio cero
    const regionesSanas = regiones.filter(
      (r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.radius > 0
    );

    if (regionesSanas.length === 0) {
      console.warn('[geocerca] No hay regiones sanas para registrar.');
      await registrarDebugLog('Sin regiones sanas');
      return;
    }

    // Iniciar geofencing. Si ya estaba activo, esto lo reemplaza.
    try {
      await Location.startGeofencingAsync(NOMBRE_TAREA_GEOCERCA, regionesSanas);
    } catch (startErr) {
      const startMsg = startErr instanceof Error ? startErr.message : String(startErr);
      console.error('[geocerca] startGeofencingAsync falló:', startMsg);
      await registrarDebugLog(`startGeofencingAsync falló: ${startMsg}`);
      return;
    }

    const activo = await Location.hasStartedGeofencingAsync(NOMBRE_TAREA_GEOCERCA);
    const resumen = `${regionesSanas.length} geocercas — monitor ${activo ? 'ACTIVO' : 'INACTIVO'}`;
    console.log(`[geocerca] ${resumen}`);
    await registrarDebugLog(`Registro: ${resumen}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[geocerca] Error al registrar geocercas:', msg);
    await registrarDebugLog(`Error al registrar: ${msg}`);
  }
}

/**
 * Registra la geocerca de una sola tarea (tras crear o actualizar una tarea).
 * Más eficiente que re-registrar todas cuando solo cambia una.
 */
export async function registrarGeocercaTarea(tarea: Tarea): Promise<void> {
  // Re-registramos todo para simplificar la lógica de Fase 1.
  // Optimización posible en Fase 4: añadir solo la región nueva.
  await registrarTodasLasGeocercas();
}

/**
 * Detiene completamente el sistema de geofencing.
 * Útil cuando el usuario desactiva todas las geocercas en Ajustes.
 */
export async function detenerGeofencing(): Promise<void> {
  try {
    const activo = await Location.hasStartedGeofencingAsync(NOMBRE_TAREA_GEOCERCA);
    if (activo) {
      await Location.stopGeofencingAsync(NOMBRE_TAREA_GEOCERCA);
      console.log('[geocerca] Geofencing detenido.');
      await registrarDebugLog('Geofencing detenido manualmente');
    }
  } catch (error) {
    console.warn('[geocerca] Error al detener geofencing:', error);
  }
}

/**
 * Obtiene el estado actual del sistema de geocercas para diagnóstico.
 */
export async function obtenerEstadoGeocercas(): Promise<{
  activo: boolean;
  registradas: number;
  permisoBackground: string;
}> {
  const activo = await Location.hasStartedGeofencingAsync(NOMBRE_TAREA_GEOCERCA);
  const { status } = await Location.getBackgroundPermissionsAsync();
  const tareas = await obtenerTareas(false);
  const registradas = tareas.filter(t => t.geocercaActiva).length;

  return {
    activo,
    registradas: activo ? Math.min(registradas, MAX_GEOCERCAS) : 0,
    permisoBackground: status
  };
}

/**
 * Registra un log de depuración en SecureStore para poder consultarlo desde la UI.
 * Útil para ver qué pasó en background sin tener el cable conectado.
 */
async function registrarDebugLog(mensaje: string): Promise<void> {
  try {
    const logsPrevios = await SecureStore.getItemAsync('gt_debug_logs');
    const logs = logsPrevios ? JSON.parse(logsPrevios) : [];
    const nuevoLog = {
      t: new Date().toISOString(),
      m: mensaje
    };
    // Mantener solo los últimos 20 logs
    const nuevosLogs = [nuevoLog, ...logs].slice(0, 20);
    await SecureStore.setItemAsync('gt_debug_logs', JSON.stringify(nuevosLogs));
  } catch {
    // Ignorar errores de logging
  }
}

/**
 * Lee los logs de depuración acumulados.
 */
export async function obtenerDebugLogs(): Promise<{t: string, m: string}[]> {
  try {
    const logs = await SecureStore.getItemAsync('gt_debug_logs');
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
}

/**
 * Limpia el historial de logs.
 */
export async function limpiarDebugLogs(): Promise<void> {
  await SecureStore.deleteItemAsync('gt_debug_logs');
}

// ──────────────────────────────────────────────
// 🔄 SECCIÓN: Funciones auxiliares
// ──────────────────────────────────────────────

/**
 * Convierte una Tarea al formato LocationRegion que espera expo-location.
 *
 * identifier: usamos el ID de la tarea para poder recuperar la tarea
 * cuando el TaskManager nos avisa de una entrada (ver defineTask arriba).
 */
function tareaARegion(tarea: Tarea): Location.LocationRegion {
  return {
    identifier: tarea.id,  // ← clave: vincula la región con la tarea
    latitude: tarea.latitud,
    longitude: tarea.longitud,
    radius: tarea.radioProximidad,
    notifyOnEnter: true,   // Avisar al entrar en la zona
    notifyOnExit: true,    // Necesario para que Android rastree transiciones correctamente
  };
}
