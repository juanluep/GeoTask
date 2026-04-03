/**
 * ============================================================
 * 🕐 Servicio de Horarios — horarios.servicio.ts
 * ============================================================
 *
 * Consulta los horarios de apertura de establecimientos usando
 * la Overpass API de OpenStreetMap (100% gratuita, sin API key).
 *
 * ¿Por qué Overpass API?
 * OpenStreetMap contiene datos de horarios (tag "opening_hours") de
 * millones de establecimientos, especialmente en Europa. Overpass API
 * permite consultarlos gratuitamente con una query personalizada.
 *
 * Flujo completo:
 * 1. Al crear una tarea, guardamos el osmId del lugar
 * 2. Antes de enviar una notificación de proximidad, consultamos si está abierto
 * 3. Cacheamos el resultado 7 días en SQLite (los horarios raramente cambian)
 * 4. Si no hay datos OSM, dejamos pasar la notificación (fallback permisivo)
 *
 * Formato opening_hours de OSM (ejemplos):
 * "Mo-Fr 09:00-20:00" → Lunes a viernes de 9 a 20h
 * "Mo-Sa 09:00-21:00; Su 10:00-15:00" → Diferentes horarios por día
 * "24/7" → Abierto siempre
 *
 * @version 1.0.0
 * ============================================================
 */

// ──────────────────────────────────────────────
// ⚙️ SECCIÓN: Configuración
// ──────────────────────────────────────────────

/** Endpoint público de Overpass API. Hay varios mirrors disponibles. */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** TTL de caché en milisegundos: 7 días */
const TTL_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const USER_AGENT = 'GeoTask/1.0 (com.chanlusoft.geotask)';

// ──────────────────────────────────────────────
// 📐 SECCIÓN: Tipos
// ──────────────────────────────────────────────

export interface InfoHorario {
  /** Si está abierto en este momento */
  abierto: boolean;
  /** Hora de cierre del período actual (ej: "19:30") */
  horaCierre?: string;
  /** Cierra en menos de 60 minutos */
  cierraPronto: boolean;
  /** El string raw de opening_hours de OSM */
  horarioRaw?: string;
  /** Si no se encontraron datos de horario */
  sinDatos: boolean;
}

// ──────────────────────────────────────────────
// 🔍 SECCIÓN: Consulta a Overpass API
// ──────────────────────────────────────────────

/**
 * Obtiene el horario de apertura de un lugar dado su OSM ID.
 * Usa caché SQLite con TTL de 7 días.
 *
 * @param osmId - Formato: "node/12345678" o "way/12345678"
 * @param latitud - Para búsqueda por proximidad si no hay osmId exacto
 * @param longitud
 */
export async function obtenerHorario(
  osmId: string | undefined,
  latitud: number,
  longitud: number
): Promise<InfoHorario> {
  // Sin osmId → no podemos consultar, dejamos pasar la notificación
  if (!osmId) {
    return { abierto: true, cierraPronto: false, sinDatos: true };
  }

  // Intentar leer de caché primero
  const cached = await leerCacheHorario(osmId);
  if (cached !== null) {
    return evaluarHorario(cached);
  }

  // Consultar Overpass API
  const horarioRaw = await consultarOverpass(latitud, longitud);

  if (horarioRaw) {
    await guardarCacheHorario(osmId, horarioRaw);
    return evaluarHorario(horarioRaw);
  }

  // Sin datos → fallback permisivo (notificar igualmente)
  return { abierto: true, cierraPronto: false, sinDatos: true };
}

/**
 * Consulta Overpass API para obtener el tag opening_hours de
 * establecimientos cercanos a las coordenadas dadas.
 */
async function consultarOverpass(lat: number, lon: number): Promise<string | null> {
  // Query Overpass QL: busca nodos con opening_hours en un radio de 50m
  const query = `
    [out:json][timeout:10];
    (
      node(around:50,${lat},${lon})["opening_hours"];
      way(around:50,${lat},${lon})["opening_hours"];
    );
    out body 1;
  `;

  try {
    const respuesta = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    const elementos = datos.elements || [];

    if (elementos.length === 0) return null;

    // Tomamos el primer resultado con opening_hours
    const conHorario = elementos.find((e: any) => e.tags?.opening_hours);
    return conHorario?.tags?.opening_hours ?? null;
  } catch (error) {
    console.warn('[horarios] Error consultando Overpass:', error);
    return null;
  }
}

// ──────────────────────────────────────────────
// 🧠 SECCIÓN: Evaluación del horario
// Parser simplificado del formato opening_hours de OSM.
// Para un parser completo existe la librería "opening_hours.js"
// pero añade ~200KB al bundle. Este parser cubre los casos más comunes.
// ──────────────────────────────────────────────

/**
 * Determina si un establecimiento está abierto ahora mismo
 * basándose en su string de opening_hours OSM.
 *
 * Cubre los casos más comunes:
 * - "24/7" → siempre abierto
 * - "Mo-Fr 09:00-20:00" → horario de lunes a viernes
 * - "Mo-Sa 09:00-21:00; Su 10:00-15:00" → horarios múltiples
 */
function evaluarHorario(horarioRaw: string): InfoHorario {
  const ahora = new Date();
  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();
  const minutosActuales = hora * 60 + minutos;

  // Caso especial: siempre abierto
  if (horarioRaw.trim() === '24/7') {
    return { abierto: true, cierraPronto: false, sinDatos: false, horarioRaw };
  }

  // Mapa de días de la semana OSM → índice JS (0=domingo)
  const diasOSM: Record<string, number> = {
    Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6,
  };
  const diaActual = ahora.getDay();

  // Dividir por punto y coma para múltiples períodos
  const periodos = horarioRaw.split(';').map((s) => s.trim());

  for (const periodo of periodos) {
    // Intentar extraer días y horas: "Mo-Fr 09:00-20:00"
    const match = periodo.match(
      /^([A-Za-z,\-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/
    );
    if (!match) continue;

    const [, diasStr, horaInicio, horaFin] = match;

    // Verificar si el día actual está en el rango de días
    if (!diaEnRango(diaActual, diasStr, diasOSM)) continue;

    // Convertir horas a minutos para comparar
    const [hInicio, mInicio] = horaInicio.split(':').map(Number);
    const [hFin, mFin] = horaFin.split(':').map(Number);
    const minutosInicio = hInicio * 60 + mInicio;
    const minutosFin = hFin * 60 + mFin;

    if (minutosActuales >= minutosInicio && minutosActuales < minutosFin) {
      const minutosParaCierre = minutosFin - minutosActuales;
      const horaCierre = `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;
      return {
        abierto: true,
        cierraPronto: minutosParaCierre <= 60,
        horaCierre,
        sinDatos: false,
        horarioRaw,
      };
    }
  }

  // No coincide con ningún período → cerrado
  return { abierto: false, cierraPronto: false, sinDatos: false, horarioRaw };
}

/** Verifica si un día de la semana está dentro de un rango OSM (ej: "Mo-Fr") */
function diaEnRango(
  diaActual: number,
  diasStr: string,
  diasOSM: Record<string, number>
): boolean {
  // Separar por coma para días individuales: "Mo,We,Fr"
  const partes = diasStr.split(',');
  for (const parte of partes) {
    const rango = parte.trim();
    if (rango.includes('-')) {
      const [inicio, fin] = rango.split('-');
      const idxInicio = diasOSM[inicio];
      const idxFin = diasOSM[fin];
      if (idxInicio !== undefined && idxFin !== undefined) {
        if (idxInicio <= idxFin) {
          if (diaActual >= idxInicio && diaActual <= idxFin) return true;
        } else {
          // Rango que cruza el domingo (ej: Sa-Mo)
          if (diaActual >= idxInicio || diaActual <= idxFin) return true;
        }
      }
    } else {
      if (diasOSM[rango] === diaActual) return true;
    }
  }
  return false;
}

// ──────────────────────────────────────────────
// 💾 SECCIÓN: Caché en SQLite
// Guardamos los resultados de Overpass en SQLite con un TTL de 7 días.
// Los horarios de establecimientos raramente cambian, así que 7 días
// es un buen equilibrio entre frescura y número de peticiones a la API.
// ──────────────────────────────────────────────

import * as SQLite from 'expo-sqlite';

async function obtenerBD(): Promise<SQLite.SQLiteDatabase> {
  return SQLite.openDatabaseAsync('geotask.db');
}

/** Asegura que la tabla de caché existe */
export async function inicializarTablaHorarios(): Promise<void> {
  const bd = await obtenerBD();
  await bd.execAsync(`
    CREATE TABLE IF NOT EXISTS horarios_cache (
      osm_id TEXT PRIMARY KEY,
      horario_raw TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);
}

async function leerCacheHorario(osmId: string): Promise<string | null> {
  try {
    const bd = await obtenerBD();
    const fila = await bd.getFirstAsync<{ horario_raw: string; timestamp: number }>(
      'SELECT horario_raw, timestamp FROM horarios_cache WHERE osm_id = ?',
      [osmId]
    );
    if (!fila) return null;
    // Verificar TTL: si el cache tiene más de 7 días, ignorarlo
    if (Date.now() - fila.timestamp > TTL_CACHE_MS) {
      await bd.runAsync('DELETE FROM horarios_cache WHERE osm_id = ?', [osmId]);
      return null;
    }
    return fila.horario_raw;
  } catch {
    return null;
  }
}

async function guardarCacheHorario(osmId: string, horarioRaw: string): Promise<void> {
  try {
    const bd = await obtenerBD();
    await bd.runAsync(
      'INSERT OR REPLACE INTO horarios_cache (osm_id, horario_raw, timestamp) VALUES (?, ?, ?)',
      [osmId, horarioRaw, Date.now()]
    );
  } catch (error) {
    console.warn('[horarios] Error guardando caché:', error);
  }
}
