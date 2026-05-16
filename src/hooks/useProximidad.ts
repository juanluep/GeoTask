/**
 * ============================================================
 * 📍 Hook de Proximidad Manual — useProximidad.ts
 * ============================================================
 *
 * Fallback crítico para cuando el geofencing nativo del SO no
 * funciona (muy común en Expo SDK 52 / New Architecture).
 *
 * Estrategia:
 * 1. Cada 20 segundos obtenemos la ubicación actual del usuario.
 * 2. Calculamos la distancia Haversine a cada tarea pendiente.
 * 3. Si la distancia es MENOR que el radio de la geocerca y la tarea
 *    no está en cooldown → disparamos la notificación manualmente.
 *
 * Este hook se monta en el layout raíz, por lo que funciona mientras
 * la app esté en primer plano o reciente. Es el plan B que garantiza
 * que el usuario reciba avisos cuando pasa cerca de un mandado.
 *
 * Cooldown compartido: usa las mismas claves de SecureStore que
 * notificacion.servicio.ts para no spammear.
 *
 * @version 1.1.0 (Logging de diagnóstico + lectura fresh del store)
 * ============================================================
 */

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useTareaStore } from '../stores/useTareaStore';
import { enviarNotificacionProximidad } from '../services/notificacion.servicio';
import type { Tarea } from '../models/tarea.modelo';

// ──────────────────────────────────────────────
// ⚙️ Configuración
// ──────────────────────────────────────────────

/** Intervalo de sondeo en milisegundos (20 segundos) */
const INTERVALO_MS = 20_000;

/** Margen de seguridad: avisamos si estamos al 90% del radio para no perdernos justo en el límite */
const FACTOR_MARGEN = 0.9;

/** Prefijo de cooldown (mismo que en notificacion.servicio.ts) */
const PREFIJO_COOLDOWN = 'gt_cooldown_';

/** Tiempo mínimo entre dos avisos de la misma tarea (30 min) */
const COOLDOWN_MS = 30 * 60 * 1000;

// ──────────────────────────────────────────────
// 📐 Utilidades
// ──────────────────────────────────────────────

/**
 * Distancia Haversine entre dos coordenadas geográficas.
 * @returns Distancia en metros.
 */
function distanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000; // Radio de la Tierra en metros
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

/** Verifica si una tarea está en cooldown leyendo SecureStore. */
async function verificarCooldown(tareaId: string): Promise<boolean> {
  try {
    const clave = PREFIJO_COOLDOWN + tareaId;
    const ultimoAvisoStr = await SecureStore.getItemAsync(clave);
    if (!ultimoAvisoStr) return false;
    const ultimoAviso = parseInt(ultimoAvisoStr, 10);
    return Date.now() - ultimoAviso < COOLDOWN_MS;
  } catch {
    return false;
  }
}

/** Marca una tarea como avisada recientemente. */
async function registrarCooldown(tareaId: string): Promise<void> {
  try {
    const clave = PREFIJO_COOLDOWN + tareaId;
    await SecureStore.setItemAsync(clave, Date.now().toString());
  } catch {
    // Ignorar
  }
}

// ──────────────────────────────────────────────
// 🧠 Lógica principal
// ──────────────────────────────────────────────

/**
 * Evalúa las tareas pendientes contra la ubicación actual.
 * Si alguna está dentro de su radio (con margen) y no está en cooldown,
 * dispara la notificación de proximidad.
 */
async function evaluarProximidad(
  lat: number,
  lon: number,
  tareas: Tarea[]
): Promise<void> {
  const pendientes = tareas.filter(
    (t) => !t.completada && t.geocercaActiva && t.latitud !== 0 && t.longitud !== 0
  );

  if (pendientes.length === 0) {
    console.log('[useProximidad] Sin tareas pendientes con geocerca activa.');
    return;
  }

  console.log(`[useProximidad] Evaluando ${pendientes.length} tareas contra posición ${lat.toFixed(5)}, ${lon.toFixed(5)}`);

  for (const tarea of pendientes) {
    const dist = distanciaMetros(lat, lon, tarea.latitud, tarea.longitud);
    const umbral = tarea.radioProximidad * FACTOR_MARGEN;

    console.log(`[useProximidad]  → "${tarea.titulo}" | dist=${Math.round(dist)}m | umbral=${Math.round(umbral)}m | coords=${tarea.latitud.toFixed(5)},${tarea.longitud.toFixed(5)}`);

    if (dist <= umbral) {
      const enCooldown = await verificarCooldown(tarea.id);
      if (!enCooldown) {
        console.log(`[useProximidad]  ✓ DENTRO DEL RADIO. Enviando notificación para "${tarea.titulo}"`);
        await enviarNotificacionProximidad(tarea, Math.round(dist));
        await registrarCooldown(tarea.id);
      } else {
        console.log(`[useProximidad]  ✗ En cooldown (30min). No se notifica "${tarea.titulo}"`);
      }
    } else {
      console.log(`[useProximidad]  ✗ Fuera de rango para "${tarea.titulo}"`);
    }
  }
}

// ──────────────────────────────────────────────
// 🪝 Hook
// ──────────────────────────────────────────────

export function useProximidad() {
  // No capturamos tareas en el closure del render.
  // En su lugar, leemos el estado actual del store DENTRO del sondeo.
  // Esto evita que un intervalo "viejo" siga usando un array de tareas vacío
  // o desactualizado si el componente no re-renderiza exactamente al ritmo
  // de los cambios del store.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let activo = true;

    async function sondeo() {
      if (!activo) return;

      try {
        // Leer tareas FRESH desde el store en cada sondeo.
        const tareas = useTareaStore.getState().tareas;

        if (tareas.length === 0) {
          console.log('[useProximidad] Sondeo: no hay tareas en el store.');
          return;
        }

        // Pedir permiso de ubicación si aún no lo tenemos.
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[useProximidad] Permiso de ubicación no concedido. Solicitando...');
          const respuesta = await Location.requestForegroundPermissionsAsync();
          status = respuesta.status;
          if (status !== 'granted') {
            console.log('[useProximidad] Permiso denegado. Abortando sondeo.');
            return;
          }
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
        });

        const { latitude, longitude } = pos.coords;
        console.log(`[useProximidad] Ubicación obtenida: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

        await evaluarProximidad(latitude, longitude, tareas);
      } catch (e) {
        console.warn('[useProximidad] Error en sondeo:', e);
      }
    }

    // Primer sondeo inmediato (tras 3s para no bloquear arranque)
    const timerInicial = setTimeout(sondeo, 3000);

    // Sondeo periódico
    intervalRef.current = setInterval(sondeo, INTERVALO_MS);

    return () => {
      activo = false;
      clearTimeout(timerInicial);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // ← deps vacías: el intervalo nunca se reinicia. Leemos el store dentro.
}
