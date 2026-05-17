/**
 * ============================================================
 * 🏗️ Definición de Tareas Background — tasks.ts
 * ============================================================
 *
 * Este archivo debe importarse LO ANTES POSIBLE en el entry point
 * de la app (app/_layout.tsx) para que los defineTask() se ejecuten
 * durante la fase de inicialización, ANTES de que cualquier tarea
 * background del SO intente ejecutarse.
 *
 * En Expo SDK 52 / New Architecture, si defineTask() se ejecuta
 * demasiado tarde, el TaskManager nativo puede disparar la tarea
 * antes de que esté registrada, causando:
 *   "Task is not defined. Make sure that TaskManager.defineTask
 *    is called during initialization phase."
 *
 * @version 1.0.0
 * ============================================================
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { obtenerTareas, leerConfiguracion } from './services/basedatos.servicio';
import { enviarNotificacionProximidad } from './services/notificacion.servicio';
import { obtenerHorario } from './services/horarios.servicio';
import { registrarDebugLog } from './services/geocerca.servicio';

// ──────────────────────────────────────────────
// 📛 Constantes
// ──────────────────────────────────────────────

const NOMBRE_TAREA_GEOCERCA = 'GEOTASK_GEOCERCA_MONITOR';
const NOMBRE_TAREA_FOREGROUND = 'GEOTASK_FOREGROUND_LOCATION';
const FACTOR_MARGEN = 0.9;
const COOLDOWN_MS = 30 * 60 * 1000;
const PREFIJO_COOLDOWN = 'gt_cooldown_';

// ──────────────────────────────────────────────
// 📐 Utilidades compartidas
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

// ──────────────────────────────────────────────
// 🗺️ Tarea 1: Geofencing Nativo
// ──────────────────────────────────────────────

TaskManager.defineTask(NOMBRE_TAREA_GEOCERCA, async ({ data, error }: any) => {
  if (error) {
    console.error('[geocerca-bg] Error:', error.message);
    await registrarDebugLog(`Error en tarea: ${error.message}`);
    return;
  }

  const { eventType, region } = data;
  const tipoEvento = eventType === Location.GeofencingEventType.Enter ? 'ENTRADA' : 'SALIDA';

  console.log(`[geocerca-bg] Evento ${tipoEvento}: ${region.identifier}`);
  await registrarDebugLog(`Evento ${tipoEvento}: ${region.identifier}`);

  if (eventType !== Location.GeofencingEventType.Enter) return;

  try {
    const tareasPendientes = await obtenerTareas(false);
    const tarea = tareasPendientes.find((t) => t.id === region.identifier);

    if (!tarea) {
      console.warn('[geocerca-bg] Tarea no encontrada:', region.identifier);
      await registrarDebugLog(`Tarea no encontrada: ${region.identifier}`);
      return;
    }

    if (!tarea.geocercaActiva) {
      console.log(`[geocerca-bg] Geocerca desactivada: ${tarea.titulo}`);
      return;
    }

    const verificarHorarios = await leerConfiguracion<boolean>('verificarHorarios');
    if (verificarHorarios && tarea.osmId) {
      try {
        const horario = await obtenerHorario(tarea.osmId, tarea.latitud, tarea.longitud);
        if (!horario.sinDatos && !horario.abierto) {
          console.log(`[geocerca-bg] Cerrado: ${tarea.titulo}`);
          await registrarDebugLog(`Cerrado: ${tarea.titulo}`);
          return;
        }
      } catch {
        // Notificar igual si falla la API de horarios
      }
    }

    await enviarNotificacionProximidad(tarea);
    await registrarDebugLog(`Notificación enviada: ${tarea.titulo}`);
  } catch (err) {
    console.error('[geocerca-bg] Error:', err);
    await registrarDebugLog(`Error procesando: ${err}`);
  }
});

// ──────────────────────────────────────────────
// 📍 Tarea 2: Foreground Service (ubicaciones)
// ──────────────────────────────────────────────

TaskManager.defineTask(NOMBRE_TAREA_FOREGROUND, async ({ data, error }: any) => {
  console.log('[foreground-bg] TASK EJECUTADA');
  await registrarDebugLog('Foreground task ejecutada');

  if (error) {
    console.error('[foreground-bg] Error:', error.message);
    await registrarDebugLog(`Foreground error: ${error.message}`);
    return;
  }

  const { locations } = data || {};
  if (!locations || locations.length === 0) {
    console.warn('[foreground-bg] Sin locations');
    await registrarDebugLog('Foreground: sin locations');
    return;
  }

  const { latitude, longitude } = locations[0].coords;
  console.log(`[foreground-bg] Loc: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  await registrarDebugLog(`FG loc: ${latitude.toFixed(4)},${longitude.toFixed(4)}`);

  try {
    const tareas = await obtenerTareas(false);
    const pendientes = tareas.filter(
      (t) => !t.completada && t.geocercaActiva && t.latitud !== 0 && t.longitud !== 0
    );

    console.log(`[foreground-bg] Evaluando ${pendientes.length} tareas`);

    for (const tarea of pendientes) {
      const dist = distanciaMetros(latitude, longitude, tarea.latitud, tarea.longitud);
      const umbral = tarea.radioProximidad * FACTOR_MARGEN;

      console.log(`[foreground-bg] → "${tarea.titulo}" d=${Math.round(dist)}m u=${Math.round(umbral)}m`);

      if (dist <= umbral) {
        const enCooldown = await verificarCooldown(tarea.id);
        if (!enCooldown) {
          console.log(`[foreground-bg] ✓ DENTRO: "${tarea.titulo}" (${Math.round(dist)}m)`);
          await enviarNotificacionProximidad(tarea, Math.round(dist));
          await marcarCooldown(tarea.id);
          await registrarDebugLog(`Notif FG: ${tarea.titulo} (${Math.round(dist)}m)`);
        } else {
          console.log(`[foreground-bg] ✗ Cooldown: "${tarea.titulo}"`);
        }
      }
    }
  } catch (err) {
    console.error('[foreground-bg] Error:', err);
    await registrarDebugLog(`Error FG: ${err}`);
  }
});

console.log('[tasks] Tareas background definidas correctamente.');
