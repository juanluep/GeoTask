/**
 * ============================================================
 * Store de Plantillas — usePlantillaStore.ts
 * ============================================================
 *
 * Store Zustand para gestionar las plantillas de tareas recurrentes.
 * Se integra con useTareaStore para generar automáticamente la
 * siguiente instancia al completar una tarea recurrente.
 *
 * Flujo completo:
 * 1. El usuario completa una tarea que tiene `plantillaId`.
 * 2. useTareaStore llama a `generarSiguienteInstancia(plantillaId)`.
 * 3. Este store calcula la próxima fecha con `calcularProximaFecha`.
 * 4. Crea la nueva tarea en SQLite y actualiza `ultima_tarea_id`.
 *
 * @version 1.0.0
 * ============================================================
 */

import { create } from 'zustand';
import uuid from 'react-native-uuid';
import {
  obtenerPlantillas,
  crearPlantilla as crearPlantillaEnBD,
  actualizarUltimaTareaPlantilla,
  togglePlantilla as togglePlantillaEnBD,
  eliminarPlantilla as eliminarPlantillaEnBD,
  crearTarea as crearTareaEnBD,
} from '../services/basedatos.servicio';
import {
  calcularProximaFecha,
  type PlantillaTarea,
  type FrecuenciaPlantilla,
} from '../models/plantilla.modelo';

// ──────────────────────────────────────────────
// Tipos del estado del store
// ──────────────────────────────────────────────

interface EstadoPlantillas {
  /** Lista de plantillas activas en memoria */
  plantillas: PlantillaTarea[];

  /** Indica si hay una operación asíncrona en curso */
  cargando: boolean;

  /** Carga todas las plantillas activas desde SQLite */
  cargarPlantillas: () => Promise<void>;

  /**
   * Crea una nueva plantilla y la persiste en SQLite.
   * Devuelve el ID generado para la nueva plantilla.
   */
  crearPlantilla: (
    datos: Omit<PlantillaTarea, 'id' | 'fechaCreacion' | 'activa' | 'ultimaTareaId'>
  ) => Promise<string>;

  /**
   * Genera la siguiente instancia de tarea para una plantilla.
   * Se llama desde useTareaStore al completar una tarea con plantillaId.
   * Devuelve el ID de la nueva tarea, o null si la plantilla está inactiva.
   */
  generarSiguienteInstancia: (plantillaId: string) => Promise<string | null>;

  /** Activa o pausa una plantilla sin eliminarla */
  toggleActiva: (id: string, activa: boolean) => Promise<void>;

  /** Elimina permanentemente una plantilla */
  eliminarPlantilla: (id: string) => Promise<void>;
}

// ──────────────────────────────────────────────
// Creación del store
// ──────────────────────────────────────────────

export const usePlantillaStore = create<EstadoPlantillas>((set, get) => ({
  plantillas: [],
  cargando: false,

  cargarPlantillas: async () => {
    set({ cargando: true });
    try {
      // Obtener solo las plantillas activas de SQLite
      const plantillas = await obtenerPlantillas(true);
      set({ plantillas, cargando: false });
    } catch (error) {
      console.error('[plantillas] Error al cargar plantillas:', error);
      set({ cargando: false });
    }
  },

  crearPlantilla: async (datos) => {
    // El ID se genera aquí, no en la BD, para mantener consistencia
    const nuevoId = uuid.v4() as string;
    await crearPlantillaEnBD(nuevoId, datos);
    // Recargar la lista para reflejar la nueva plantilla en la UI
    await get().cargarPlantillas();
    return nuevoId;
  },

  generarSiguienteInstancia: async (plantillaId: string) => {
    // Buscar la plantilla en memoria (más rápido que ir a SQLite)
    const plantilla = get().plantillas.find((p) => p.id === plantillaId);

    // Si la plantilla no existe o está inactiva, no generar nada
    if (!plantilla || !plantilla.activa) return null;

    try {
      const ahora = new Date();

      // Calcular cuándo debe aparecer la siguiente instancia
      // basándose en la frecuencia y la fecha actual
      const proximaFechaLimite = calcularProximaFecha(plantilla, ahora);

      // Generar un ID único para la nueva tarea
      const nuevoId = uuid.v4() as string;

      // Crear la nueva instancia de tarea copiando los datos de la plantilla
      await crearTareaEnBD(nuevoId, {
        titulo: plantilla.titulo,
        descripcion: plantilla.descripcion,
        categoriaId: plantilla.categoriaId,
        latitud: plantilla.latitud,
        longitud: plantilla.longitud,
        direccion: plantilla.direccion,
        nombreLugar: plantilla.nombreLugar,
        osmId: plantilla.osmId,
        radioProximidad: plantilla.radioProximidad,
        geocercaActiva: true,
        prioridad: plantilla.prioridad,
        fechaLimite: proximaFechaLimite,
      });

      // Registrar en la plantilla cuál es su tarea activa más reciente
      await actualizarUltimaTareaPlantilla(plantillaId, nuevoId);

      console.log(
        `[plantillas] Nueva instancia generada: ${nuevoId} para plantilla ${plantillaId}`
      );
      return nuevoId;
    } catch (error) {
      console.error('[plantillas] Error al generar instancia:', error);
      return null;
    }
  },

  toggleActiva: async (id, activa) => {
    await togglePlantillaEnBD(id, activa);
    // Actualizar el estado en memoria sin recargar toda la lista
    set((estado) => ({
      plantillas: estado.plantillas.map((p) =>
        p.id === id ? { ...p, activa } : p
      ),
    }));
  },

  eliminarPlantilla: async (id) => {
    await eliminarPlantillaEnBD(id);
    // Filtrar la plantilla eliminada del estado en memoria
    set((estado) => ({
      plantillas: estado.plantillas.filter((p) => p.id !== id),
    }));
  },
}));
