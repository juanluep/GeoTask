/**
 * ============================================================
 * Modelo de Tarea — tarea.modelo.ts
 * ============================================================
 *
 * Define la estructura de datos de una Tarea geolocalizada.
 * Una Tarea es el concepto central de GeoTask: un "mandado"
 * o accion pendiente vinculada a una ubicacion geografica.
 *
 * @version 1.0.0
 * ============================================================
 */
import type { Categoria } from './categoria.modelo';

// ──────────────────────────────────────────────
// SECCION: Tipos auxiliares
// ──────────────────────────────────────────────

/** Niveles de prioridad de una tarea */
export type Prioridad = 'alta' | 'media' | 'baja';

/** Estado de apertura de un establecimiento (resultado de Overpass API) */
export type EstadoApertura = 'abierto' | 'cerrado' | 'cierra-pronto' | 'desconocido';

// ──────────────────────────────────────────────
// SECCION: Interfaz principal Tarea
// ──────────────────────────────────────────────

/**
 * Representa un mandado o accion pendiente geolocalizada.
 * Cada tarea genera una geocerca en el dispositivo que
 * dispara una notificacion push cuando el usuario se acerca.
 */
export interface Tarea {
  /** Identificador unico (UUID v4) */
  id: string;

  /** Titulo corto del mandado (ej: "Comprar leche") */
  titulo: string;

  /** Descripcion detallada, instrucciones especificas */
  descripcion: string;

  /** ID de la categoria a la que pertenece esta tarea */
  categoriaId: string;

  // ── Datos de ubicacion ──────────────────────
  /** Latitud de la ubicacion objetivo */
  latitud: number;

  /** Longitud de la ubicacion objetivo */
  longitud: number;

  /** Direccion legible (calle y numero, resuelta por Nominatim) */
  direccion: string;

  /** Nombre del establecimiento (ej: "Mercadona Nervion Plaza") */
  nombreLugar?: string;

  /**
   * ID de OpenStreetMap para este lugar.
   * Se usa con la Overpass API para consultar horarios de apertura.
   * Formato: "node/12345678" o "way/12345678"
   */
  osmId?: string;

  // ── Configuracion de geocerca ───────────────
  /**
   * Radio de la geocerca en metros.
   * Valores tipicos: 200m (peaton), 500m (defecto), 1000m (coche)
   * iOS limita a ~20 geocercas simultaneas activas.
   */
  radioProximidad: number;

  /**
   * Indica si la geocerca esta activa para esta tarea.
   * El usuario puede desactivarla temporalmente sin eliminar la tarea.
   */
  geocercaActiva: boolean;

  // ── Estado ──────────────────────────────────
  /** Si el mandado ya fue realizado */
  completada: boolean;

  /** Prioridad subjetiva del usuario */
  prioridad: Prioridad;

  // ── Metadatos ────────────────────────────────
  /** Fecha de creacion en formato ISO 8601 */
  fechaCreacion: string;

  /** Fecha de completado (solo si completada === true) */
  fechaCompletada?: string;

  /** Fecha limite opcional (ej: "entregar antes del martes") */
  fechaLimite?: string;

  /** Rutas locales de las fotos adjuntas (maximo 3) */
  fotos?: string[];

  // ── Plantillas recurrentes ───────────────────
  /**
   * ID de la plantilla que generó esta tarea.
   * Cuando se completa la tarea, el store genera automáticamente
   * la siguiente instancia usando la plantilla referenciada.
   */
  plantillaId?: string;

  // ── Fase futura: listas compartidas ─────────
  /** ID de la lista compartida (Fase 5 — Supabase) */
  listaId?: string;

  /** ID del usuario creador (Fase 5 — Supabase Auth) */
  creadoPor?: string;
}

// ──────────────────────────────────────────────
// SECCION: Tarea con datos relacionados
// Version "enriquecida" de Tarea que incluye datos calculados
// y la categoria resuelta (para mostrar en la UI sin joins adicionales)
// ──────────────────────────────────────────────

/**
 * Tarea con datos adicionales calculados en tiempo de ejecucion.
 * No se persiste en BD — se calcula al leer las tareas.
 */
export interface TareaConExtras extends Tarea {
  /** Categoria resuelta (join con tabla categorias) */
  categoria?: Categoria;

  /** Distancia al usuario en metros (calculada con la ubicacion actual) */
  distanciaMetros?: number;

  /** Estado de apertura del establecimiento (consultado a Overpass API) */
  estadoApertura?: EstadoApertura;

  /** Hora de cierre proximo (ej: "19:30") */
  horaCierre?: string;
}

// ──────────────────────────────────────────────
// SECCION: DTO para crear/actualizar tareas
// ──────────────────────────────────────────────

/**
 * Datos necesarios para crear una nueva tarea.
 * Omite los campos que se generan automaticamente (id, fechaCreacion, etc.)
 */
export type CrearTareaDTO = Omit<Tarea,
  'id' | 'fechaCreacion' | 'fechaCompletada' | 'completada'
>;

/** Datos para actualizar una tarea existente (todos los campos son opcionales) */
export type ActualizarTareaDTO = Partial<Omit<Tarea, 'id' | 'fechaCreacion'>>;
