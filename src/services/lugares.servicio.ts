/**
 * ============================================================
 * 📍 Servicio de Lugares — lugares.servicio.ts
 * ============================================================
 *
 * Servicio de geocoding y búsqueda de lugares usando APIs gratuitas de OSM.
 *
 * APIs utilizadas (100% gratuitas, sin API key):
 * - Photon (Komoot): autocompletado de lugares. Basado en OSM, muy rápido.
 *   Endpoint: https://photon.komoot.io/api/?q={query}&limit=5&lang=es
 *
 * - Nominatim (OSM): geocoding directo e inverso.
 *   Endpoint inverso: https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json
 *
 * Política de uso responsable:
 * - Máximo 1 solicitud por segundo (debounce en el componente)
 * - User-Agent identificativo obligatorio
 * - No usar para geolocalización masiva o batch
 *
 * @version 1.0.0
 * ============================================================
 */

import type { ResultadoBusquedaLugar } from '../models/ubicacion.modelo';

// User-Agent requerido por la política de Nominatim
// Identifica nuestra app para que puedan contactarnos si hay problemas
const USER_AGENT = 'GeoTask/1.0 (com.chanlusoft.geotask)';

// ──────────────────────────────────────────────
// 🔍 SECCIÓN: Búsqueda de lugares (Photon API)
// Photon es más rápido que Nominatim para autocompletado
// porque tiene sus propios índices optimizados para búsqueda incremental
// ──────────────────────────────────────────────

/**
 * Busca lugares/establecimientos por texto usando la API Photon de Komoot.
 *
 * ¿Por qué Photon y no Nominatim para el autocompletado?
 * Photon está optimizado específicamente para búsqueda incremental (tecla por tecla),
 * con respuestas más rápidas y mejor relevancia para búsquedas cortas.
 * Nominatim es mejor para geocoding preciso de direcciones completas.
 *
 * @param consulta - Texto de búsqueda (ej: "Mercadona Nervión")
 * @param limite - Número máximo de resultados (defecto: 5)
 * @returns Lista de resultados de búsqueda
 */
export async function buscarLugares(
  consulta: string,
  limite: number = 5,
  latitud?: number,
  longitud?: number
): Promise<ResultadoBusquedaLugar[]> {
  if (!consulta.trim() || consulta.length < 2) return [];

  try {
    // Photon solo soporta lang: de, en, fr, it — "es" devuelve 400.
    // Sin lang, devuelve resultados en el idioma local del lugar (comportamiento correcto).
    // lat/lon sesgan los resultados al entorno del usuario (si se proporcionan).
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(consulta)}&limit=${limite}`;
    if (latitud !== undefined && longitud !== undefined) {
      url += `&lat=${latitud}&lon=${longitud}`;
    }

    const respuesta = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });

    if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);

    const datos = await respuesta.json();

    // Photon devuelve GeoJSON FeatureCollection
    // Transformamos al formato interno ResultadoBusquedaLugar
    return (datos.features || []).map(transformarFeaturePhoton);
  } catch (error) {
    console.warn('[lugares.servicio] Error al buscar lugares:', error);
    return [];
  }
}

/**
 * Transforma un feature GeoJSON de Photon al modelo interno.
 */
function transformarFeaturePhoton(feature: any): ResultadoBusquedaLugar {
  const props = feature.properties || {};
  const [longitud, latitud] = feature.geometry?.coordinates || [0, 0];

  // Construimos el nombre legible: "nombre, calle, ciudad"
  const partes: string[] = [];
  if (props.name) partes.push(props.name);
  if (props.street) partes.push(props.street + (props.housenumber ? ` ${props.housenumber}` : ''));
  if (props.city || props.town || props.village) {
    partes.push(props.city || props.town || props.village);
  }

  const nombre = props.name || partes[0] || 'Lugar desconocido';
  const direccionCompleta = partes.join(', ') || nombre;

  return {
    osmId: `${props.osm_type || 'node'}/${props.osm_id || ''}`,
    nombre,
    direccionCompleta,
    componentes: {
      calle: props.street,
      numero: props.housenumber,
      barrio: props.suburb || props.district,
      ciudad: props.city || props.town || props.village,
      codigoPostal: props.postcode,
      pais: props.country,
    },
    coordenadas: { latitud, longitud },
    tipo: props.type || props.osm_type,
  };
}

// ──────────────────────────────────────────────
// 🔄 SECCIÓN: Geocoding inverso (Nominatim)
// Convierte coordenadas (lat, lon) en una dirección legible.
// Se usa cuando el usuario toca el mapa para crear una tarea.
// ──────────────────────────────────────────────

/**
 * Resuelve coordenadas geográficas a una dirección legible.
 *
 * Ejemplo:
 * (37.3861, -5.9945) → "Calle Asunción, 12, Nervión, Sevilla"
 *
 * @param latitud - Latitud del punto
 * @param longitud - Longitud del punto
 * @returns Resultado de búsqueda con dirección, o null si falla
 */
export async function geocodingInverso(
  latitud: number,
  longitud: number
): Promise<ResultadoBusquedaLugar | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json&addressdetails=1`;

    const respuesta = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    if (!datos || datos.error) return null;

    return transformarRespuestaNominatim(datos, latitud, longitud);
  } catch (error) {
    console.warn('[lugares.servicio] Error en geocoding inverso:', error);
    return null;
  }
}

/**
 * Transforma la respuesta de Nominatim al modelo interno.
 */
function transformarRespuestaNominatim(
  datos: any,
  latitud: number,
  longitud: number
): ResultadoBusquedaLugar {
  const addr = datos.address || {};

  // Construimos la dirección formateada: "Calle X, número, barrio, ciudad"
  const partesDireccion: string[] = [];
  if (addr.road) {
    partesDireccion.push(addr.road + (addr.house_number ? ` ${addr.house_number}` : ''));
  }
  if (addr.suburb || addr.neighbourhood) {
    partesDireccion.push(addr.suburb || addr.neighbourhood);
  }
  if (addr.city || addr.town || addr.village) {
    partesDireccion.push(addr.city || addr.town || addr.village);
  }

  const nombre = datos.name || addr.road || partesDireccion[0] || 'Ubicación seleccionada';
  const direccionCompleta = datos.display_name || partesDireccion.join(', ');

  return {
    osmId: `${datos.osm_type || 'node'}/${datos.osm_id || ''}`,
    nombre,
    direccionCompleta,
    componentes: {
      calle: addr.road,
      numero: addr.house_number,
      barrio: addr.suburb || addr.neighbourhood,
      ciudad: addr.city || addr.town || addr.village,
      codigoPostal: addr.postcode,
      pais: addr.country,
    },
    coordenadas: { latitud, longitud },
    tipo: datos.type,
  };
}

// ──────────────────────────────────────────────
// 🔍 SECCIÓN: Geocoding directo (Nominatim)
// Convierte un texto de dirección en coordenadas.
// Menos usado que el inverso — el inverso es el flujo principal.
// ──────────────────────────────────────────────

/**
 * Convierte una dirección de texto a coordenadas geográficas.
 * @param direccion - Dirección completa (ej: "Calle Sierpes 10, Sevilla")
 */
export async function geocodingDirecto(
  direccion: string
): Promise<ResultadoBusquedaLugar | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(direccion)}&format=json&addressdetails=1&limit=1`;

    const respuesta = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    if (!datos || datos.length === 0) return null;

    const primero = datos[0];
    return transformarRespuestaNominatim(
      primero,
      parseFloat(primero.lat),
      parseFloat(primero.lon)
    );
  } catch (error) {
    console.warn('[lugares.servicio] Error en geocoding directo:', error);
    return null;
  }
}
