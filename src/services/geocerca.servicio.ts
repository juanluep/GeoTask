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
import * as SecureStore from 'expo-secure-store';
import { obtenerTareas } from './basedatos.servicio';
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

// NOTA: Los defineTask de TaskManager se han movido a src/tasks.ts
// para asegurar que se ejecuten durante la fase de inicialización del bundle,
// antes de que cualquier componente React se monte.
//
// TaskManager.defineTask(NOMBRE_TAREA_GEOCERCA) → src/tasks.ts
// TaskManager.defineTask(NOMBRE_TAREA_FOREGROUND) → src/tasks.ts

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
      timeInterval: 15_000,          // mínimo ~15s entre actualizaciones
      distanceInterval: 0,           // siempre notificar, aunque no se mueva
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'GeoTask vigilando tareas cercanas',
        notificationBody: 'Detectando cuando pasas cerca de lugares con tareas pendientes',
        notificationColor: '#1D4ED8',
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
