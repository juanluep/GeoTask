/**
 * ============================================================
 * Modelo de Ubicacion — ubicacion.modelo.ts
 * ============================================================
 *
 * Tipos relacionados con coordenadas geograficas, resultados
 * de busqueda de lugares y estado de la ubicacion del usuario.
 *
 * @version 1.0.0
 * ============================================================
 */

// ──────────────────────────────────────────────
// SECCION: Coordenadas basicas
// ──────────────────────────────────────────────

/** Par de coordenadas geograficas */
export interface Coordenadas {
  latitud: number;
  longitud: number;
}

/** Region del mapa (coordenadas + delta de zoom) */
export interface RegionMapa extends Coordenadas {
  /** Rango de latitud visible (controla el zoom vertical) */
  deltaLatitud: number;
  /** Rango de longitud visible (controla el zoom horizontal) */
  deltaLongitud: number;
}

// ──────────────────────────────────────────────
// SECCION: Resultado de busqueda de lugar
// Estructura que devuelven Nominatim y Photon API
// ──────────────────────────────────────────────

/**
 * Resultado de busqueda de un lugar via Nominatim/Photon.
 * Se usa al crear una tarea para seleccionar la ubicacion objetivo.
 */
export interface ResultadoBusquedaLugar {
  /** ID de OSM del lugar (para consultar horarios con Overpass) */
  osmId: string;

  /** Nombre del establecimiento o lugar */
  nombre: string;

  /** Direccion completa formateada */
  direccionCompleta: string;

  /** Componentes de la direccion por separado */
  componentes: {
    calle?: string;
    numero?: string;
    barrio?: string;
    ciudad?: string;
    codigoPostal?: string;
    pais?: string;
  };

  /** Coordenadas del lugar */
  coordenadas: Coordenadas;

  /** Tipo de lugar segun OSM (ej: 'amenity', 'shop', 'highway') */
  tipo?: string;
}

// ──────────────────────────────────────────────
// SECCION: Estado de ubicacion del usuario
// ──────────────────────────────────────────────

/** Estado de los permisos de ubicacion */
export type EstadoPermisoUbicacion =
  | 'no-solicitado'
  | 'concedido'
  | 'denegado'
  | 'siempre'       // Permiso en segundo plano (necesario para geocercas)
  | 'desconocido';

/** Estado completo de la ubicacion del usuario en la app */
export interface EstadoUbicacion {
  /** Coordenadas actuales del usuario (null si no disponible) */
  coordenadas: Coordenadas | null;

  /** Precision en metros de la ultima lectura GPS */
  precisionMetros?: number;

  /** Velocidad en m/s (para inferir modo de transporte) */
  velocidadMs?: number;

  /** Estado del permiso de ubicacion */
  permiso: EstadoPermisoUbicacion;

  /** Si el GPS esta activamente monitorizando */
  monitorizando: boolean;

  /** Timestamp de la ultima actualizacion (ms desde epoch) */
  ultimaActualizacion?: number;
}
