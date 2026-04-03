/**
 * ============================================================
 * 🗄️ Store de Tareas — useTareaStore.ts
 * ============================================================
 *
 * Store global de Zustand para gestionar el estado de las tareas.
 *
 * ¿Qué es Zustand?
 * Una librería de gestión de estado global muy ligera para React.
 * A diferencia de Redux (complejo y verboso), Zustand usa un simple
 * objeto con estado y funciones. Cualquier componente puede suscribirse
 * al store y se re-renderiza SOLO cuando cambia el dato que usa.
 *
 * Flujo de datos:
 * Componente → acción del store → SQLite (persistencia)
 *                              → estado Zustand (UI reactiva)
 *
 * @version 1.0.0
 * ============================================================
 */

import { create } from 'zustand';
import uuid from 'react-native-uuid';
import {
  obtenerTareas,
  crearTarea as crearTareaEnBD,
  actualizarTarea as actualizarTareaEnBD,
  completarTarea as completarTareaEnBD,
  eliminarTarea as eliminarTareaEnBD,
} from '../services/basedatos.servicio';
// Fase 3: re-registramos geocercas cada vez que cambia la lista de tareas activas
import { registrarTodasLasGeocercas } from '../services/geocerca.servicio';
// Fase 4: auto-regeneración de tareas recurrentes al completar
import { usePlantillaStore } from './usePlantillaStore';
import type { Tarea, CrearTareaDTO, ActualizarTareaDTO } from '../models/tarea.modelo';

// ──────────────────────────────────────────────
// 📐 SECCIÓN: Definición del estado del store
// ──────────────────────────────────────────────

interface EstadoTareas {
  // ── Datos ──────────────────────────────────
  /** Lista de tareas pendientes cargadas en memoria */
  tareas: Tarea[];

  /** Lista de tareas completadas (historial) */
  tareasCompletadas: Tarea[];

  /** ID de la tarea actualmente seleccionada/en vista de detalle */
  tareaSeleccionadaId: string | null;

  // ── Estado de carga ─────────────────────────
  /** Si hay una operación asíncrona en curso (para mostrar spinners) */
  cargando: boolean;

  /** Mensaje de error si algo falló */
  error: string | null;

  // ── Filtros activos ─────────────────────────
  /** ID de la categoría por la que filtrar (null = mostrar todas) */
  filtroCategoria: string | null;

  // ── Acciones ────────────────────────────────
  /**
   * Carga todas las tareas pendientes desde SQLite al estado en memoria.
   * Se llama al iniciar la app y después de cualquier modificación.
   */
  cargarTareas: () => Promise<void>;

  /**
   * Carga las tareas completadas (historial).
   * Separada de cargarTareas para no mezclar listas en la UI.
   */
  cargarHistorial: () => Promise<void>;

  /**
   * Crea una nueva tarea en SQLite y la añade al estado local.
   * @returns El ID de la tarea creada
   */
  crearTarea: (datos: CrearTareaDTO) => Promise<string>;

  /**
   * Actualiza campos de una tarea existente en SQLite y en el estado.
   */
  actualizarTarea: (id: string, cambios: ActualizarTareaDTO) => Promise<void>;

  /**
   * Marca una tarea como completada, la mueve al historial.
   */
  completarTarea: (id: string) => Promise<void>;

  /**
   * Elimina permanentemente una tarea de SQLite y del estado.
   */
  eliminarTarea: (id: string) => Promise<void>;

  /** Selecciona una tarea para ver su detalle */
  seleccionarTarea: (id: string | null) => void;

  /** Cambia el filtro de categoría activo */
  cambiarFiltroCategoria: (categoriaId: string | null) => void;

  /** Limpia el error actual */
  limpiarError: () => void;
}

// ──────────────────────────────────────────────
// 🏗️ SECCIÓN: Creación del store
// create() de Zustand recibe una función que devuelve el estado inicial
// y las acciones. "set" actualiza el estado, "get" lee el estado actual.
// ──────────────────────────────────────────────

export const useTareaStore = create<EstadoTareas>((set, get) => ({
  // ── Estado inicial ──────────────────────────
  tareas: [],
  tareasCompletadas: [],
  tareaSeleccionadaId: null,
  cargando: false,
  error: null,
  filtroCategoria: null,

  // ── Implementación de acciones ──────────────

  cargarTareas: async () => {
    set({ cargando: true, error: null });
    try {
      // Obtenemos solo las tareas pendientes (completada = false)
      const tareas = await obtenerTareas(false);
      set({ tareas, cargando: false });
    } catch (error) {
      set({
        error: 'No se pudieron cargar las tareas. Intenta de nuevo.',
        cargando: false,
      });
    }
  },

  cargarHistorial: async () => {
    set({ cargando: true });
    try {
      const tareasCompletadas = await obtenerTareas(true);
      set({ tareasCompletadas, cargando: false });
    } catch (error) {
      set({ error: 'Error al cargar el historial.', cargando: false });
    }
  },

  crearTarea: async (datos: CrearTareaDTO) => {
    // Generamos un UUID v4 único para la nueva tarea.
    // Lo generamos aquí (en el store) y no en el servicio de BD
    // para poder devolver el ID inmediatamente al componente.
    const nuevoId = uuid.v4() as string;

    set({ cargando: true, error: null });
    try {
      await crearTareaEnBD(nuevoId, datos);

      // Añadimos la tarea al estado local sin necesidad de recargar toda la lista.
      // Esto hace la UI más rápida (actualización optimista).
      const nuevaTarea: Tarea = {
        id: nuevoId,
        ...datos,
        completada: false,
        fechaCreacion: new Date().toISOString(),
      };
      set((estado) => ({
        tareas: [nuevaTarea, ...estado.tareas],
        cargando: false,
      }));

      // Fase 3: re-registrar geocercas para incluir la nueva tarea
      registrarTodasLasGeocercas().catch(() => {});
      return nuevoId;
    } catch (error) {
      console.error('[useTareaStore] Error al crear tarea:', error);
      set({ error: 'Error al crear la tarea.', cargando: false });
      return '';
    }
  },

  actualizarTarea: async (id: string, cambios: ActualizarTareaDTO) => {
    set({ cargando: true, error: null });
    try {
      await actualizarTareaEnBD(id, cambios);

      // Actualizamos solo la tarea afectada en el array (inmutable con map)
      set((estado) => ({
        tareas: estado.tareas.map((t) =>
          t.id === id ? { ...t, ...cambios } : t
        ),
        cargando: false,
      }));
    } catch (error) {
      set({ error: 'Error al actualizar la tarea.', cargando: false });
    }
  },

  completarTarea: async (id: string) => {
    set({ error: null });
    try {
      await completarTareaEnBD(id);

      // Movemos la tarea de "pendientes" a "completadas" en el estado local
      const tareaCompletada = get().tareas.find((t) => t.id === id);
      if (tareaCompletada) {
        const ahora = new Date().toISOString();
        const tareaActualizada = { ...tareaCompletada, completada: true, fechaCompletada: ahora };

        set((estado) => ({
          tareas: estado.tareas.filter((t) => t.id !== id),
          tareasCompletadas: [tareaActualizada, ...estado.tareasCompletadas],
        }));
        // Fase 3: quitar la geocerca de la tarea completada
        registrarTodasLasGeocercas().catch(() => {});

        // Fase 4: si la tarea pertenece a una plantilla recurrente,
        // generar automáticamente la siguiente instancia
        if (tareaCompletada.plantillaId) {
          const nuevaTareaId = await usePlantillaStore
            .getState()
            .generarSiguienteInstancia(tareaCompletada.plantillaId);
          if (nuevaTareaId) {
            // Recargar la lista para mostrar la nueva instancia generada
            await get().cargarTareas();
          }
        }
      }
    } catch (error) {
      set({ error: 'Error al completar la tarea.' });
    }
  },

  eliminarTarea: async (id: string) => {
    set({ error: null });
    try {
      await eliminarTareaEnBD(id);

      // Eliminamos del array de pendientes Y del historial (por si acaso)
      set((estado) => ({
        tareas: estado.tareas.filter((t) => t.id !== id),
        tareasCompletadas: estado.tareasCompletadas.filter((t) => t.id !== id),
      }));
      // Fase 3: quitar la geocerca de la tarea eliminada
      registrarTodasLasGeocercas().catch(() => {});
    } catch (error) {
      set({ error: 'Error al eliminar la tarea.' });
    }
  },

  seleccionarTarea: (id: string | null) => {
    set({ tareaSeleccionadaId: id });
  },

  cambiarFiltroCategoria: (categoriaId: string | null) => {
    set({ filtroCategoria: categoriaId });
  },

  limpiarError: () => {
    set({ error: null });
  },
}));

// ──────────────────────────────────────────────
// 🔧 SECCIÓN: Selectores derivados
// Los selectores calculan valores derivados del estado sin duplicar datos.
// Se definen fuera del store para reutilizarlos en múltiples componentes.
// ──────────────────────────────────────────────

/**
 * Devuelve las tareas filtradas por la categoría activa.
 * Si no hay filtro activo, devuelve todas las tareas.
 */
export function useTareasFiltradas() {
  const tareas = useTareaStore((s) => s.tareas);
  const filtroCategoria = useTareaStore((s) => s.filtroCategoria);

  if (!filtroCategoria) return tareas;
  return tareas.filter((t) => t.categoriaId === filtroCategoria);
}

/**
 * Devuelve una tarea específica por su ID.
 * Busca tanto en pendientes como en completadas.
 */
export function useTareaPorId(id: string): Tarea | undefined {
  const tareas = useTareaStore((s) => s.tareas);
  const completadas = useTareaStore((s) => s.tareasCompletadas);
  return tareas.find((t) => t.id === id) ?? completadas.find((t) => t.id === id);
}
