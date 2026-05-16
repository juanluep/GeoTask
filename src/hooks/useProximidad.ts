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
 * @version 1.0.0
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

  for (const tarea of pendientes) {
    const dist = distanciaMetros(lat, lon, tarea.latitud, tarea.longitud);
    const umbral = tarea.radioProximidad * FACTOR_MARGEN;

    if (dist <= umbral) {
      const enCooldown = await verificarCooldown(tarea.id);
      if (!enCooldown) {
        await enviarNotificacionProximidad(tarea, Math.round(dist));
        await registrarCooldown(tarea.id);
      }
    }
  }
}

// ──────────────────────────────────────────────
// 🪝 Hook
// ──────────────────────────────────────────────

export function useProximidad() {
  const tareas = useTareaStore((s) => s.tareas);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let activo = true;

    async function sondeo() {
      if (!activo) return;

      try {
        // Solo sondeamos si hay tareas pendientes
        if (tareas.length === 0) return;

        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude } = pos.coords;
        await evaluarProximidad(latitude, longitude, tareas);
      } catch (e) {
        // Errores de GPS silenciados para no saturar la consola
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
  }, [tareas]);
}
