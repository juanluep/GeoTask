/**
 * ============================================================
 * 📋 Store de Listas Compartidas — useListaStore.ts
 * ============================================================
 *
 * Store global de Zustand para gestionar el estado de las listas
 * compartidas. Sigue el mismo patrón que useTareaStore.
 *
 * @version 1.0.0
 * ============================================================
 */

import { create } from 'zustand';
import {
  crearLista,
  unirseALista,
  obtenerMisListas,
  obtenerTareasLista,
} from '../services/listas.servicio';
import { useAuthStore } from './useAuthStore';
import type { Lista } from '../services/listas.servicio';
import type { Tarea } from '../models/tarea.modelo';

// ──────────────────────────────────────────────
// 📐 Definición del estado
// ──────────────────────────────────────────────

interface EstadoListas {
  // ── Datos ──────────────────────────────────
  /** Listas en las que participa el usuario */
  listas: Lista[];

  /** Tareas de la lista actualmente activa */
  tareasLista: Tarea[];

  /** ID de la lista activa para filtrar tareas en el mapa/lista */
  listaActivaId: string | null;

  // ── Estado de carga ─────────────────────────
  cargando: boolean;
  error: string | null;

  // ── Acciones ────────────────────────────────
  /** Carga todas las listas del usuario desde Supabase */
  cargarListas: () => Promise<void>;

  /** Crea una nueva lista y la añade al estado */
  crearNuevaLista: (nombre: string) => Promise<Lista | null>;

  /** Une al usuario a una lista por código y la añade al estado */
  unirseAListaPorCodigo: (codigo: string) => Promise<Lista | null>;

  /** Carga las tareas de una lista concreta */
  cargarTareasLista: (listaId: string) => Promise<void>;

  /** Activa el filtro por lista (null = ver todas las tareas personales) */
  activarLista: (listaId: string | null) => void;

  /** Añade o actualiza una tarea en tareasLista (llamado desde Realtime) */
  actualizarTareaEnLista: (tarea: Tarea) => void;

  /** Elimina una tarea de tareasLista (llamado desde Realtime DELETE) */
  eliminarTareaEnLista: (tareaId: string) => void;

  limpiarError: () => void;
}

// ──────────────────────────────────────────────
// 🏗️ Creación del store
// ──────────────────────────────────────────────

export const useListaStore = create<EstadoListas>((set, get) => ({
  // ── Estado inicial ──────────────────────────
  listas: [],
  tareasLista: [],
  listaActivaId: null,
  cargando: false,
  error: null,

  // ── Implementación de acciones ──────────────

  cargarListas: async () => {
    const userId = useAuthStore.getState().userId;
    if (!userId) return;

    set({ cargando: true, error: null });
    try {
      const listas = await obtenerMisListas(userId);
      set({ listas, cargando: false });
    } catch {
      set({ error: 'No se pudieron cargar las listas.', cargando: false });
    }
  },

  crearNuevaLista: async (nombre: string) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      set({ error: 'Debes iniciar sesión para crear una lista.' });
      return null;
    }

    set({ cargando: true, error: null });
    try {
      const lista = await crearLista(nombre, userId);
      set((estado) => ({
        listas: [lista, ...estado.listas],
        cargando: false,
      }));
      return lista;
    } catch (e: any) {
      set({ error: e.message ?? 'Error al crear la lista.', cargando: false });
      return null;
    }
  },

  unirseAListaPorCodigo: async (codigo: string) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      set({ error: 'Debes iniciar sesión para unirte a una lista.' });
      return null;
    }

    set({ cargando: true, error: null });
    try {
      const lista = await unirseALista(codigo, userId);
      set((estado) => ({
        listas: [...estado.listas, lista],
        cargando: false,
      }));
      return lista;
    } catch (e: any) {
      set({ error: e.message ?? 'Error al unirse a la lista.', cargando: false });
      return null;
    }
  },

  cargarTareasLista: async (listaId: string) => {
    set({ cargando: true, error: null });
    try {
      const tareasLista = await obtenerTareasLista(listaId);
      set({ tareasLista, cargando: false });
    } catch {
      set({ error: 'Error al cargar las tareas de la lista.', cargando: false });
    }
  },

  activarLista: (listaId: string | null) => {
    set({ listaActivaId: listaId });
    if (!listaId) {
      set({ tareasLista: [] });
    }
  },

  actualizarTareaEnLista: (tarea: Tarea) => {
    set((estado) => {
      const existe = estado.tareasLista.some((t) => t.id === tarea.id);
      if (existe) {
        return { tareasLista: estado.tareasLista.map((t) => (t.id === tarea.id ? tarea : t)) };
      }
      // INSERT: añadir al principio si no está completada
      if (!tarea.completada) {
        return { tareasLista: [tarea, ...estado.tareasLista] };
      }
      return {};
    });
  },

  eliminarTareaEnLista: (tareaId: string) => {
    set((estado) => ({
      tareasLista: estado.tareasLista.filter((t) => t.id !== tareaId),
    }));
  },

  limpiarError: () => set({ error: null }),
}));
