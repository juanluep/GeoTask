/**
 * ============================================================
 * 🔄 Servicio de Background Fetch — background.servicio.ts
 * ============================================================
 *
 * Fallback crítico para geocercas cuando la app está CERRADA o en segundo plano.
 *
 * Problema: expo-location geofencing en Expo SDK 52 / New Architecture / Android
 * no es fiable con la app cerrada. El sistema operativo a menudo no dispara
 * los eventos de entrada/salida de geocercas.
 *
 * Solución: expo-background-fetch ejecuta código JS periódicamente (mínimo
 * cada ~15 min en Android, cada ~10 min en iOS) incluso con la app cerrada.
 * En cada ejecución:
 *   1. Obtenemos la ubicación actual
 *   2. Calculamos distancia Haversine a cada tarea pendiente
 *   3. Si estamos dentro del radio → enviamos notificación
 *
 * Limitaciones:
 * - No es instantáneo: puede tardar hasta 15 min en detectar.
 * - El sistema decide cuándo ejecutar (batería, uso, etc.).
 * - Pero es INFINITAMENTE más fiable que depender solo del geofencing nativo.
 *
 * @version 1.0.0
 * ============================================================
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { obtenerTareas } from './basedatos.servicio';
import { enviarNotificacionProximidad } from './notificacion.servicio';
import { registrarDebugLog } from './geocerca.servicio';

// Nombre único de la tarea background
const NOMBRE_TAREA_BACKGROUND = 'GEOTASK_BACKGROUND_FETCH';

/** Factor de margen para el radio de proximidad (90%) */
const FACTOR_MARGEN = 0.9;

/** Cooldown en ms: no notificar la misma tarea dos veces en menos de 30 min */
const COOLDOWN_MS = 30 * 60 * 1000;
const PREFIJO_COOLDOWN = 'gt_cooldown_';

// ──────────────────────────────────────────────
// 📐 Utilidades
// ──────────────────────────────────────────────

function distanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function verificarCooldown(tareaId: string): Promise<boolean> {
  try {
    const clave = PREFIJO_COOLDOWN + tareaId;
    const ultimo = await SecureStore.getItemAsync(clave);
    if (!ultimo) return false;
    return Date.now() - parseInt(ultimo, 10) < COOLDOWN_MS;
  } catch {
    return false;
  }
}

async function registrarCooldown(tareaId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFIJO_COOLDOWN + tareaId, Date.now().toString());
  } catch {
    // Ignorar
  }
}

// ──────────────────────────────────────────────
// 🧠 Tarea Background
// ──────────────────────────────────────────────

TaskManager.defineTask(NOMBRE_TAREA_BACKGROUND, async () => {
  console.log('[background] Ejecutando tarea de background fetch...');
  await registrarDebugLog('Background fetch ejecutado');

  try {
    // 1. Verificar permiso de ubicación
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[background] Sin permiso de ubicación. Abortando.');
      await registrarDebugLog('Background fetch: sin permiso ubicación');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 2. Obtener ubicación actual (baja precisión para ahorrar batería)
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
      mayShowUserSettingsDialog: false,
    });
    const { latitude, longitude } = pos.coords;
    console.log(`[background] Ubicación: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

    // 3. Cargar tareas pendientes
    const tareas = await obtenerTareas(false);
    const pendientes = tareas.filter(
      (t) => !t.completada && t.geocercaActiva && t.latitud !== 0 && t.longitud !== 0
    );

    if (pendientes.length === 0) {
      console.log('[background] Sin tareas pendientes con geocerca.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 4. Evaluar proximidad
    let notificado = false;
    for (const tarea of pendientes) {
      const dist = distanciaMetros(latitude, longitude, tarea.latitud, tarea.longitud);
      const umbral = tarea.radioProximidad * FACTOR_MARGEN;

      if (dist <= umbral) {
        const enCooldown = await verificarCooldown(tarea.id);
        if (!enCooldown) {
          console.log(`[background] DENTRO DEL RADIO: "${tarea.titulo}" (${Math.round(dist)}m)`);
          await enviarNotificacionProximidad(tarea, Math.round(dist));
          await registrarCooldown(tarea.id);
          await registrarDebugLog(`Notificación background: ${tarea.titulo} (${Math.round(dist)}m)`);
          notificado = true;
        } else {
          console.log(`[background] "${tarea.titulo}" en cooldown.`);
        }
      }
    }

    return notificado
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[background] Error en tarea background:', error);
    await registrarDebugLog(`Error background fetch: ${error}`);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ──────────────────────────────────────────────
// 🚀 Registro de la tarea
// ──────────────────────────────────────────────

/**
 * Registra la tarea de background fetch.
 * Se llama desde _layout.tsx al arrancar la app.
 * La tarea persiste entre reinicios de la app.
 */
export async function registrarBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    console.log('[background] Estado de background fetch:', status);

    // Verificar si ya está registrada
    const isRegistered = await TaskManager.isTaskRegisteredAsync(NOMBRE_TAREA_BACKGROUND);
    if (isRegistered) {
      console.log('[background] Tarea ya registrada. No es necesario volver a registrar.');
      return;
    }

    await BackgroundFetch.registerTaskAsync(NOMBRE_TAREA_BACKGROUND, {
      minimumInterval: 15 * 60, // 15 minutos (mínimo efectivo en Android)
      stopOnTerminate: false,   // Seguir ejecutando tras cerrar la app
      startOnBoot: true,        // Reanudar al reiniciar el móvil
    });

    console.log('[background] Tarea de background fetch registrada correctamente.');
    await registrarDebugLog('Background fetch registrado');
  } catch (error) {
    console.error('[background] Error al registrar background fetch:', error);
    await registrarDebugLog(`Error registro background: ${error}`);
  }
}

/**
 * Desregistra la tarea de background fetch.
 * Útil para debugging o si el usuario desactiva geocercas.
 */
export async function desregistrarBackgroundFetch(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(NOMBRE_TAREA_BACKGROUND);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(NOMBRE_TAREA_BACKGROUND);
      console.log('[background] Tarea desregistrada.');
    }
  } catch (error) {
    console.error('[background] Error al desregistrar:', error);
  }
}
