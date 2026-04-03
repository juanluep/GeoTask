/**
 * ============================================================
 * 📅 Servicio de Calendario — calendario.servicio.ts
 * ============================================================
 *
 * Sincroniza las tareas con fecha límite al calendario nativo del dispositivo.
 * Usa expo-calendar para crear/eliminar eventos.
 *
 * Estrategia:
 * - Crear un calendario dedicado "GeoTask" en el dispositivo
 * - Al crear/actualizar una tarea con fechaLimite → crear evento
 * - Al completar/eliminar tarea → eliminar evento del calendario
 * - Guardamos el eventId en SQLite para poder eliminarlo después
 *
 * @version 1.0.0
 * ============================================================
 */

import * as Calendar from 'expo-calendar';
import * as SecureStore from 'expo-secure-store';

const CLAVE_CALENDARIO_ID = 'gt_calendar_id';
const NOMBRE_CALENDARIO = 'GeoTask';

// ──────────────────────────────────────────────
// 🔑 SECCIÓN: Permisos y setup
// ──────────────────────────────────────────────

/**
 * Solicita permiso de acceso al calendario.
 * @returns true si se concedió
 */
export async function solicitarPermisoCalendario(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Obtiene el ID del calendario GeoTask, creándolo si no existe.
 * Persistimos el ID en SecureStore para no crear duplicados en cada arranque.
 */
async function obtenerIdCalendario(): Promise<string | null> {
  try {
    // Intentar leer el ID guardado
    const idGuardado = await SecureStore.getItemAsync(CLAVE_CALENDARIO_ID);
    if (idGuardado) {
      // Verificar que el calendario aún existe
      const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      if (calendarios.find((c) => c.id === idGuardado)) {
        return idGuardado;
      }
    }

    // El calendario no existe → crearlo
    return await crearCalendarioGeoTask();
  } catch (error) {
    console.warn('[calendario] Error obteniendo ID:', error);
    return null;
  }
}

/**
 * Crea el calendario "GeoTask" en el dispositivo.
 * En iOS usamos el calendario local por defecto.
 * En Android buscamos el calendario principal de Google si está disponible.
 */
async function crearCalendarioGeoTask(): Promise<string | null> {
  try {
    const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Buscar el origen de calendario apropiado según la plataforma
    const origenLocal = calendarios.find(
      (c) => c.source?.isLocalAccount || c.source?.type === Calendar.SourceType.LOCAL
    );

    const nuevoId = await Calendar.createCalendarAsync({
      title: NOMBRE_CALENDARIO,
      color: '#4648d4', // Color índigo de GeoTask
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: origenLocal?.source?.id,
      source: origenLocal?.source ?? {
        isLocalAccount: true,
        name: NOMBRE_CALENDARIO,
        type: Calendar.SourceType.LOCAL,
      },
      name: 'geotask',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });

    await SecureStore.setItemAsync(CLAVE_CALENDARIO_ID, nuevoId);
    return nuevoId;
  } catch (error) {
    console.warn('[calendario] Error creando calendario:', error);
    return null;
  }
}

// ──────────────────────────────────────────────
// 📅 SECCIÓN: Gestión de eventos
// ──────────────────────────────────────────────

/**
 * Crea un evento en el calendario para una tarea con fecha límite.
 * @returns El ID del evento creado (para guardarlo y poder eliminarlo después)
 */
export async function crearEventoTarea(
  tareaId: string,
  titulo: string,
  fechaLimite: string,
  lugar?: string
): Promise<string | null> {
  try {
    const calendarioId = await obtenerIdCalendario();
    if (!calendarioId) return null;

    const fechaInicio = new Date(fechaLimite);
    const fechaFin = new Date(fechaLimite);
    fechaFin.setHours(fechaFin.getHours() + 1); // Evento de 1 hora

    const eventoId = await Calendar.createEventAsync(calendarioId, {
      title: `📍 ${titulo}`,
      location: lugar,
      startDate: fechaInicio,
      endDate: fechaFin,
      // Recordatorio: 1 hora antes del vencimiento
      alarms: [{ relativeOffset: -60 }],
      notes: `Tarea GeoTask ID: ${tareaId}`,
    });

    // Guardar la relación tareaId → eventoId en SecureStore
    await SecureStore.setItemAsync(`gt_event_${tareaId}`, eventoId);
    return eventoId;
  } catch (error) {
    console.warn('[calendario] Error creando evento:', error);
    return null;
  }
}

/**
 * Elimina el evento del calendario asociado a una tarea.
 */
export async function eliminarEventoTarea(tareaId: string): Promise<void> {
  try {
    const eventoId = await SecureStore.getItemAsync(`gt_event_${tareaId}`);
    if (!eventoId) return;

    await Calendar.deleteEventAsync(eventoId);
    await SecureStore.deleteItemAsync(`gt_event_${tareaId}`);
  } catch (error) {
    console.warn('[calendario] Error eliminando evento:', error);
  }
}
