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
    return;
  }

  // data.eventType indica si es entrada (ENTER) o salida (EXIT) de la geocerca
  const { eventType, region } = data;

  // Solo procesamos ENTRADAS, no salidas
  if (eventType !== Location.GeofencingEventType.Enter) return;

  console.log(`[geocerca] Entrada detectada en región: ${region.identifier}`);

  try {
    // Buscamos la tarea cuyo ID coincide con el identificador de la región
    // (Al registrar la geocerca, usamos el ID de la tarea como identifier)
    const tareasPendientes = await obtenerTareas(false);
    const tarea = tareasPendientes.find((t) => t.id === region.identifier);

    if (!tarea) {
      console.warn('[geocerca] No se encontró la tarea para la región:', region.identifier);
      return;
    }

    // Solo notificar si la geocerca de la tarea está activa
    if (!tarea.geocercaActiva) return;

    // Si el usuario tiene activada la verificación de horarios,
    // consultamos si el establecimiento está abierto antes de notificar.
    // En background no tenemos acceso al store de Zustand, así que
    // leemos la configuración directamente de SQLite.
    const verificarHorarios = await leerConfiguracion<boolean>('verificarHorarios');
    if (verificarHorarios && tarea.osmId) {
      const horario = await obtenerHorario(tarea.osmId, tarea.latitud, tarea.longitud);
      if (!horario.sinDatos && !horario.abierto) {
        console.log(`[geocerca] No se notifica "${tarea.titulo}" — establecimiento cerrado.`);
        return;
      }
    }

    // Enviar notificación (con verificación de cooldown interna)
    await enviarNotificacionProximidad(tarea);
  } catch (err) {
    console.error('[geocerca] Error al procesar entrada:', err);
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
    // Verificar que tenemos permiso de ubicación en background
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[geocerca] Sin permiso de background location. No se registran geocercas.');
      return;
    }

    // Obtener todas las tareas pendientes con geocerca activa
    const tareas = await obtenerTareas(false);
    const tareasConGeocerca = tareas.filter((t) => t.geocercaActiva);

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

    // Iniciar geofencing. Si ya estaba activo, esto lo reemplaza.
    await Location.startGeofencingAsync(NOMBRE_TAREA_GEOCERCA, regiones);

    console.log(`[geocerca] ${regiones.length} geocercas registradas.`);
  } catch (error) {
    console.error('[geocerca] Error al registrar geocercas:', error);
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
    }
  } catch (error) {
    console.warn('[geocerca] Error al detener geofencing:', error);
  }
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
    notifyOnExit: false,   // No avisar al salir (simplifica el flujo)
  };
}
