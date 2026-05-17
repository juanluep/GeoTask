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

/** Nombre de la tarea de foreground service (actualizaciones de ubicación en background) */
const NOMBRE_TAREA_FOREGROUND = 'GEOTASK_FOREGROUND_LOCATION';

/** Número máximo de geocercas simultáneas (límite de iOS) */
const MAX_GEOCERCAS = 20;

/** Factor de margen para el radio de proximidad (90%) */
const FACTOR_MARGEN = 0.9;

/** Cooldown en ms: no notificar la misma tarea dos veces en menos de 30 min */
const COOLDOWN_MS = 30 * 60 * 1000;
const PREFIJO_COOLDOWN = 'gt_cooldown_';

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
// 📍 SECCIÓN: Foreground Service (actualizaciones de ubicación)
// Fallback principal para Android cuando la app está cerrada.
// Mantiene una notificación persistente y recibe ubicaciones cada ~20s.
// ──────────────────────────────────────────────

function distanciaMetros(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function verificarCooldown(tareaId: string): Promise<boolean> {
  try {
    const ultimo = await SecureStore.getItemAsync(PREFIJO_COOLDOWN + tareaId);
    if (!ultimo) return false;
    return Date.now() - parseInt(ultimo, 10) < COOLDOWN_MS;
  } catch { return false; }
}

async function marcarCooldown(tareaId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFIJO_COOLDOWN + tareaId, Date.now().toString());
  } catch { /* ignorar */ }
}

TaskManager.defineTask(NOMBRE_TAREA_FOREGROUND, async ({ data, error }: any) => {
  if (error) {
    console.error('[foreground] Error:', error.message);
    await registrarDebugLog(`Foreground error: ${error.message}`);
    return;
  }

  const { locations } = data;
  if (!locations || locations.length === 0) return;

  const { latitude, longitude } = locations[0].coords;
  console.log(`[foreground] Ubicación: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

  try {
    const tareas = await obtenerTareas(false);
    const pendientes = tareas.filter(
      (t) => !t.completada && t.geocercaActiva && t.latitud !== 0 && t.longitud !== 0
    );

    for (const tarea of pendientes) {
      const dist = distanciaMetros(latitude, longitude, tarea.latitud, tarea.longitud);
      const umbral = tarea.radioProximidad * FACTOR_MARGEN;

      if (dist <= umbral) {
        const enCooldown = await verificarCooldown(tarea.id);
        if (!enCooldown) {
          console.log(`[foreground] DENTRO DEL RADIO: "${tarea.titulo}" (${Math.round(dist)}m)`);
          await enviarNotificacionProximidad(tarea, Math.round(dist));
          await marcarCooldown(tarea.id);
          await registrarDebugLog(`Notif foreground: ${tarea.titulo} (${Math.round(dist)}m)`);
        }
      }
    }
  } catch (err) {
    console.error('[foreground] Error evaluando proximidad:', err);
    await registrarDebugLog(`Error foreground eval: ${err}`);
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
/** Flag para evitar spammear la consola con el mismo mensaje de permiso */
let permisoAvisado = false;

export async function registrarTodasLasGeocercas(): Promise<void> {
  try {
    // Verificar que tenemos permiso de ubicación en background.
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      if (!permisoAvisado) {
        console.log('[geocerca] Sin permiso de background location. No se registran geocercas (fallback useProximidad activo).');
        permisoAvisado = true;
      }
      await registrarDebugLog('Sin permiso background location');
      return;
    }
    permisoAvisado = false;

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
      console.log('[geocerca] No hay regiones sanas para registrar.');
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

// ──────────────────────────────────────────────
// 🔔 SECCIÓN: Foreground Service (Android)
// Mantiene una notificación persistente y recibe ubicaciones cada ~20s.
// Es el mecanismo PRINCIPAL para detectar proximidad en background.
// ──────────────────────────────────────────────

/**
 * Inicia el foreground service de actualizaciones de ubicación.
 * Muestra una notificación persistente al usuario.
 * Se llama desde _layout.tsx al arrancar si hay sesión y permisos.
 */
export async function iniciarServicioForeground(): Promise<void> {
  try {
    // Verificar que no está ya iniciado
    const yaActivo = await Location.hasStartedLocationUpdatesAsync(NOMBRE_TAREA_FOREGROUND);
    if (yaActivo) {
      console.log('[foreground] Servicio ya activo. No se reinicia.');
      return;
    }

    // Verificar permisos
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      console.log('[foreground] Sin permiso background. No se inicia servicio.');
      await registrarDebugLog('Foreground: sin permiso background');
      return;
    }

    await Location.startLocationUpdatesAsync(NOMBRE_TAREA_FOREGROUND, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 20_000,          // mínimo ~20s entre actualizaciones
      distanceInterval: 0,            // siempre notificar, aunque no se mueva
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'GeoTask vigilando tareas cercanas',
        notificationBody: 'Detectando cuando pasas cerca de lugares con tareas pendientes',
        notificationColor: '#1d4ed8',
      },
    });

    console.log('[foreground] Servicio iniciado correctamente.');
    await registrarDebugLog('Foreground service iniciado');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[foreground] Error al iniciar servicio:', msg);
    await registrarDebugLog(`Error iniciar foreground: ${msg}`);
  }
}

/**
 * Detiene el foreground service.
 */
export async function detenerServicioForeground(): Promise<void> {
  try {
    const activo = await Location.hasStartedLocationUpdatesAsync(NOMBRE_TAREA_FOREGROUND);
    if (activo) {
      await Location.stopLocationUpdatesAsync(NOMBRE_TAREA_FOREGROUND);
      console.log('[foreground] Servicio detenido.');
      await registrarDebugLog('Foreground service detenido');
    }
  } catch (error) {
    console.warn('[foreground] Error al detener servicio:', error);
  }
}

/**
 * Devuelve true si el foreground service está activo.
 */
export async function estaServicioForegroundActivo(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(NOMBRE_TAREA_FOREGROUND);
  } catch {
    return false;
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
export async function registrarDebugLog(mensaje: string): Promise<void> {
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
