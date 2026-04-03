/**
 * ============================================================
 * 🗄️ Servicio de Base de Datos — basedatos.servicio.ts
 * ============================================================
 *
 * Este servicio gestiona toda la persistencia local de GeoTask
 * usando SQLite a través de expo-sqlite.
 *
 * ¿Por qué SQLite y no AsyncStorage?
 * - AsyncStorage es un almacén clave-valor simple, no relacional.
 * - SQLite permite consultas complejas: filtrar por categoría,
 *   ordenar por distancia, buscar por zona, etc.
 * - SQLite es robusto ante reinicios de app y funciona 100% offline.
 *
 * Estructura de la BD:
 * - tabla `categorias`: categorías para clasificar tareas
 * - tabla `tareas`: las tareas geolocalizadas
 * - tabla `configuracion`: preferencias del usuario (pares clave-valor)
 *
 * @version 1.0.0
 * ============================================================
 */

import * as SQLite from 'expo-sqlite';
import { CATEGORIAS_PREDETERMINADAS } from '../models/categoria.modelo';
import { CONFIGURACION_PREDETERMINADA } from '../models/usuario.modelo';
import type { Tarea, CrearTareaDTO, ActualizarTareaDTO } from '../models/tarea.modelo';
import type { Categoria } from '../models/categoria.modelo';
import type { ConfiguracionUsuario } from '../models/usuario.modelo';

// ──────────────────────────────────────────────
// 🔌 SECCIÓN: Conexión a la base de datos
// expo-sqlite v15 usa una API asíncrona más moderna que las versiones anteriores.
// La base de datos se almacena en el directorio privado de la app
// (no accesible por otras apps por seguridad).
// ──────────────────────────────────────────────

/** Nombre del archivo de base de datos SQLite */
const NOMBRE_BD = 'geotask.db';

/**
 * Instancia global de la base de datos.
 * Se cachea para evitar abrir N conexiones en uso normal.
 * Se resetea automáticamente si la conexión nativa queda inválida
 * (NullPointerException en Android emulador tras Fast Refresh).
 */
let baseDatos: SQLite.SQLiteDatabase | null = null;

/**
 * Obtiene la instancia de la base de datos con auto-recuperación.
 *
 * En el emulador Android, el objeto nativo SQLite puede quedar inválido
 * tras un Fast Refresh (hot reload). Cuando eso ocurre, `prepareAsync`
 * lanza NullPointerException. Esta función resetea la conexión si detecta
 * que la existente está rota, garantizando que siempre se devuelve una
 * conexión válida.
 */
async function obtenerBD(): Promise<SQLite.SQLiteDatabase> {
  if (baseDatos) {
    // Verificamos que la conexión sigue viva con una operación mínima.
    // Si lanza NullPointerException, la descartamos y abrimos una nueva.
    try {
      await baseDatos.getFirstAsync<{ v: number }>('SELECT 1 AS v');
    } catch {
      baseDatos = null;
    }
  }
  if (!baseDatos) {
    baseDatos = await SQLite.openDatabaseAsync(NOMBRE_BD);
  }
  return baseDatos;
}

// ──────────────────────────────────────────────
// 🏗️ SECCIÓN: Inicialización y migraciones
// ──────────────────────────────────────────────

/**
 * Inicializa la base de datos: crea las tablas e inserta datos semilla.
 *
 * Esta función se llama UNA VEZ al arrancar la app (desde _layout.tsx).
 * Usa "IF NOT EXISTS" para que sea idempotente: si la BD ya existe,
 * no falla ni borra datos.
 *
 * Los datos semilla (categorías predeterminadas y configuración inicial)
 * se insertan con "INSERT OR IGNORE" para no duplicarlos en reinicios.
 */
export async function inicializarBaseDatos(): Promise<void> {
  const bd = await obtenerBD();

  // execAsync ejecuta múltiples statements SQL en una sola transacción.
  // Una transacción garantiza que todas las operaciones se completan o
  // ninguna se aplica (evita BD en estado inconsistente si hay un error).
  await bd.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Tabla de categorías (debe crearse ANTES que tareas por la FK)
    CREATE TABLE IF NOT EXISTS categorias (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      icono TEXT NOT NULL,
      color TEXT NOT NULL,
      es_predeterminada INTEGER DEFAULT 0
    );

    -- Tabla principal de tareas geolocalizadas
    CREATE TABLE IF NOT EXISTS tareas (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      categoria_id TEXT,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      direccion TEXT DEFAULT '',
      nombre_lugar TEXT,
      osm_id TEXT,
      radio_proximidad INTEGER DEFAULT 500,
      geocerca_activa INTEGER DEFAULT 1,
      completada INTEGER DEFAULT 0,
      prioridad TEXT DEFAULT 'media',
      fecha_creacion TEXT NOT NULL,
      fecha_completada TEXT,
      fecha_limite TEXT,
      fotos TEXT DEFAULT '[]',
      plantilla_id TEXT,
      lista_id TEXT,
      creado_por TEXT,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );

    -- Tabla de configuración como pares clave-valor
    -- Esta estructura permite añadir nuevas preferencias sin alterar el esquema
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    -- Tabla de plantillas de tareas recurrentes.
    -- Cada fila define una "receta" que genera nuevas tareas automáticamente
    -- al completarse la instancia anterior.
    CREATE TABLE IF NOT EXISTS plantillas_tareas (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      categoria_id TEXT,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      direccion TEXT DEFAULT '',
      nombre_lugar TEXT,
      osm_id TEXT,
      radio_proximidad INTEGER DEFAULT 500,
      prioridad TEXT DEFAULT 'media',
      frecuencia TEXT NOT NULL,
      dias_semana TEXT DEFAULT '[]',
      fecha_creacion TEXT NOT NULL,
      activa INTEGER DEFAULT 1,
      ultima_tarea_id TEXT
    );
  `);

  // Insertar categorías predeterminadas (solo si no existen ya)
  await insertarCategoriasPredeterminadas(bd);

  // Insertar configuración inicial (solo si no existe ya)
  await insertarConfiguracionInicial(bd);

  // Migraciones para instalaciones existentes (añadir columnas nuevas)
  // SQLite no soporta "ADD COLUMN IF NOT EXISTS", así que usamos try/catch
  await ejecutarMigraciones(bd);
}

/**
 * Ejecuta migraciones incrementales para bases de datos existentes.
 * Cada ALTER TABLE usa try/catch: si la columna ya existe, SQLite lanza
 * "duplicate column name" y lo ignoramos silenciosamente.
 */
async function ejecutarMigraciones(bd: SQLite.SQLiteDatabase): Promise<void> {
  // Migración v1.1: añadir plantilla_id a la tabla tareas
  try {
    await bd.execAsync(`ALTER TABLE tareas ADD COLUMN plantilla_id TEXT;`);
  } catch {
    // La columna ya existe → OK
  }
  // Migración v1.2: columnas de fase 5 (listas compartidas)
  try {
    await bd.execAsync(`ALTER TABLE tareas ADD COLUMN lista_id TEXT;`);
  } catch { /* ya existe */ }
  try {
    await bd.execAsync(`ALTER TABLE tareas ADD COLUMN creado_por TEXT;`);
  } catch { /* ya existe */ }
}

/**
 * Inserta las 8 categorías predeterminadas del sistema.
 * Usa INSERT OR IGNORE para no duplicar si ya existen.
 */
async function insertarCategoriasPredeterminadas(
  bd: SQLite.SQLiteDatabase
): Promise<void> {
  for (const categoria of CATEGORIAS_PREDETERMINADAS) {
    await bd.runAsync(
      `INSERT OR IGNORE INTO categorias (id, nombre, icono, color, es_predeterminada)
       VALUES (?, ?, ?, ?, ?)`,
      [
        categoria.id,
        categoria.nombre,
        categoria.icono,
        categoria.color,
        categoria.esPredeterminada ? 1 : 0,
      ]
    );
  }
}

/**
 * Inserta los valores de configuración por defecto.
 * Usa INSERT OR IGNORE para no sobreescribir ajustes que el usuario ya cambió.
 */
async function insertarConfiguracionInicial(
  bd: SQLite.SQLiteDatabase
): Promise<void> {
  const entradas = Object.entries(CONFIGURACION_PREDETERMINADA);
  for (const [clave, valor] of entradas) {
    await bd.runAsync(
      `INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)`,
      [clave, JSON.stringify(valor)]
    );
  }
}

// ──────────────────────────────────────────────
// 📋 SECCIÓN: CRUD de Tareas
// ──────────────────────────────────────────────

/**
 * Obtiene todas las tareas no completadas, ordenadas por fecha de creación.
 * El parámetro `soloCompletadas` permite filtrar tareas del historial.
 */
export async function obtenerTareas(soloCompletadas = false): Promise<Tarea[]> {
  const bd = await obtenerBD();
  const filas = await bd.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tareas WHERE completada = ? ORDER BY fecha_creacion DESC`,
    [soloCompletadas ? 1 : 0]
  );
  return filas.map(filaATarea);
}

/**
 * Obtiene una tarea por su ID.
 * Devuelve null si no existe.
 */
export async function obtenerTareaPorId(id: string): Promise<Tarea | null> {
  const bd = await obtenerBD();
  const fila = await bd.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM tareas WHERE id = ?`,
    [id]
  );
  if (!fila) return null;
  return filaATarea(fila);
}

/**
 * Crea una nueva tarea en la base de datos.
 * El ID se genera fuera de esta función (en el store) usando react-native-uuid.
 */
export async function crearTarea(id: string, datos: CrearTareaDTO): Promise<void> {
  const bd = await obtenerBD();
  const ahora = new Date().toISOString();

  await bd.runAsync(
    `INSERT INTO tareas (
      id, titulo, descripcion, categoria_id,
      latitud, longitud, direccion, nombre_lugar, osm_id,
      radio_proximidad, geocerca_activa,
      completada, prioridad,
      fecha_creacion, fecha_limite, fotos, plantilla_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      id,
      datos.titulo,
      datos.descripcion,
      datos.categoriaId,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.nombreLugar ?? null,
      datos.osmId ?? null,
      datos.radioProximidad,
      datos.geocercaActiva ? 1 : 0,
      datos.prioridad,
      ahora,
      datos.fechaLimite ?? null,
      JSON.stringify(datos.fotos ?? []),
      datos.plantillaId ?? null,
    ]
  );
}

/**
 * Actualiza campos específicos de una tarea existente.
 * Solo actualiza los campos proporcionados, el resto no se toca.
 */
export async function actualizarTarea(
  id: string,
  cambios: ActualizarTareaDTO
): Promise<void> {
  const bd = await obtenerBD();

  // Construimos dinámicamente la query SQL con solo los campos a actualizar.
  // Esto evita sobreescribir accidentalmente campos no modificados.
  const columnas: string[] = [];
  const valores: (string | number | null)[] = [];

  const mapaColumnas: Record<string, string> = {
    titulo: 'titulo',
    descripcion: 'descripcion',
    categoriaId: 'categoria_id',
    latitud: 'latitud',
    longitud: 'longitud',
    direccion: 'direccion',
    nombreLugar: 'nombre_lugar',
    osmId: 'osm_id',
    radioProximidad: 'radio_proximidad',
    geocercaActiva: 'geocerca_activa',
    completada: 'completada',
    prioridad: 'prioridad',
    fechaCompletada: 'fecha_completada',
    fechaLimite: 'fecha_limite',
    fotos: 'fotos',
    plantillaId: 'plantilla_id',
  };

  for (const [clave, columna] of Object.entries(mapaColumnas)) {
    if (clave in cambios) {
      columnas.push(`${columna} = ?`);
      const valor = cambios[clave as keyof ActualizarTareaDTO];
      if (typeof valor === 'boolean') {
        valores.push(valor ? 1 : 0);
      } else if (Array.isArray(valor)) {
        valores.push(JSON.stringify(valor));
      } else {
        valores.push(valor ?? null);
      }
    }
  }

  if (columnas.length === 0) return; // Nada que actualizar

  valores.push(id); // Para el WHERE id = ?
  await bd.runAsync(
    `UPDATE tareas SET ${columnas.join(', ')} WHERE id = ?`,
    valores
  );
}

/**
 * Marca una tarea como completada y registra la fecha de completado.
 */
export async function completarTarea(id: string): Promise<void> {
  const ahora = new Date().toISOString();
  await actualizarTarea(id, { completada: true, fechaCompletada: ahora });
}

/**
 * Elimina permanentemente una tarea de la base de datos.
 * También debería desactivar su geocerca (lo hace el store).
 */
export async function eliminarTarea(id: string): Promise<void> {
  const bd = await obtenerBD();
  await bd.runAsync(`DELETE FROM tareas WHERE id = ?`, [id]);
}

// ──────────────────────────────────────────────
// 🏷️ SECCIÓN: Lectura de Categorías
// ──────────────────────────────────────────────

/** Obtiene todas las categorías disponibles (predeterminadas + personalizadas) */
export async function obtenerCategorias(): Promise<Categoria[]> {
  const bd = await obtenerBD();
  const filas = await bd.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM categorias ORDER BY es_predeterminada DESC, nombre ASC`
  );
  return filas.map(filaACategoria);
}

// ──────────────────────────────────────────────
// ⚙️ SECCIÓN: Configuración del Usuario
// ──────────────────────────────────────────────

/** Lee un valor de configuración por su clave */
export async function leerConfiguracion<T>(clave: string): Promise<T | null> {
  const bd = await obtenerBD();
  const fila = await bd.getFirstAsync<{ valor: string }>(
    `SELECT valor FROM configuracion WHERE clave = ?`,
    [clave]
  );
  if (!fila) return null;
  return JSON.parse(fila.valor) as T;
}

/** Guarda o actualiza un valor de configuración */
export async function guardarConfiguracion(
  clave: string,
  valor: unknown
): Promise<void> {
  const bd = await obtenerBD();
  await bd.runAsync(
    `INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`,
    [clave, JSON.stringify(valor)]
  );
}

// ──────────────────────────────────────────────
// 🔄 SECCIÓN: Funciones auxiliares (mappers)
// Convierten filas de SQLite (con nombres en snake_case) a
// objetos TypeScript (con nombres en camelCase del modelo)
// ──────────────────────────────────────────────

/** Convierte una fila de la tabla `tareas` al modelo TypeScript Tarea */
function filaATarea(fila: Record<string, unknown>): Tarea {
  return {
    id: fila.id as string,
    titulo: fila.titulo as string,
    descripcion: (fila.descripcion as string) ?? '',
    categoriaId: (fila.categoria_id as string) ?? '',
    latitud: fila.latitud as number,
    longitud: fila.longitud as number,
    direccion: (fila.direccion as string) ?? '',
    nombreLugar: (fila.nombre_lugar as string) ?? undefined,
    osmId: (fila.osm_id as string) ?? undefined,
    radioProximidad: fila.radio_proximidad as number,
    geocercaActiva: (fila.geocerca_activa as number) === 1,
    completada: (fila.completada as number) === 1,
    prioridad: (fila.prioridad as 'alta' | 'media' | 'baja') ?? 'media',
    fechaCreacion: fila.fecha_creacion as string,
    fechaCompletada: (fila.fecha_completada as string) ?? undefined,
    fechaLimite: (fila.fecha_limite as string) ?? undefined,
    fotos: JSON.parse((fila.fotos as string) ?? '[]'),
    plantillaId: (fila.plantilla_id as string) ?? undefined,
    listaId: (fila.lista_id as string) ?? undefined,
    creadoPor: (fila.creado_por as string) ?? undefined,
  };
}

/** Convierte una fila de la tabla `categorias` al modelo TypeScript Categoria */
function filaACategoria(fila: Record<string, unknown>): Categoria {
  return {
    id: fila.id as string,
    nombre: fila.nombre as string,
    icono: fila.icono as string,
    color: fila.color as string,
    esPredeterminada: (fila.es_predeterminada as number) === 1,
  };
}

// ──────────────────────────────────────────────
// 📊 SECCIÓN: Estadísticas
// ──────────────────────────────────────────────

export interface Estadisticas {
  /** Total de tareas completadas (historial completo) */
  totalCompletadas: number;
  /** Tareas completadas en el mes actual */
  completadasEsteMes: number;
  /** Número de tareas pendientes activas */
  pendientes: number;
  /** Categoría más usada entre las tareas pendientes (id + nombre + color) */
  categoriaMasUsada: { nombre: string; color: string } | null;
}

/**
 * Calcula estadísticas de uso de la app consultando SQLite.
 * Se usa en la pantalla de Ajustes para mostrar el resumen de actividad.
 */
export async function obtenerEstadisticas(): Promise<Estadisticas> {
  const bd = await obtenerBD();

  // Total de tareas completadas
  const filaTotalComp = await bd.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM tareas WHERE completada = 1`
  );

  // Completadas este mes
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const filaMes = await bd.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM tareas WHERE completada = 1 AND fecha_completada >= ?`,
    [inicioMes.toISOString()]
  );

  // Tareas pendientes
  const filaPendientes = await bd.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM tareas WHERE completada = 0`
  );

  // Categoría más usada en tareas pendientes
  const filaCategoria = await bd.getFirstAsync<{ nombre: string; color: string; total: number }>(
    `SELECT c.nombre, c.color, COUNT(t.id) AS total
     FROM tareas t
     JOIN categorias c ON t.categoria_id = c.id
     WHERE t.completada = 0
     GROUP BY t.categoria_id
     ORDER BY total DESC
     LIMIT 1`
  );

  return {
    totalCompletadas: filaTotalComp?.total ?? 0,
    completadasEsteMes: filaMes?.total ?? 0,
    pendientes: filaPendientes?.total ?? 0,
    categoriaMasUsada: filaCategoria
      ? { nombre: filaCategoria.nombre, color: filaCategoria.color }
      : null,
  };
}

// ──────────────────────────────────────────────
// SECCIÓN: CRUD de Plantillas de Tareas
//
// Las plantillas son "recetas" de tareas recurrentes.
// Cada vez que se completa una tarea vinculada a una plantilla,
// el store genera automáticamente la siguiente instancia.
// ──────────────────────────────────────────────

import type { PlantillaTarea, FrecuenciaPlantilla } from '../models/plantilla.modelo';

/**
 * Obtiene todas las plantillas de la base de datos.
 * Por defecto solo devuelve las activas; pasar `false` para obtener todas.
 */
export async function obtenerPlantillas(soloActivas = true): Promise<PlantillaTarea[]> {
  const bd = await obtenerBD();
  const filas = await bd.getAllAsync<Record<string, unknown>>(
    soloActivas
      ? `SELECT * FROM plantillas_tareas WHERE activa = 1 ORDER BY fecha_creacion DESC`
      : `SELECT * FROM plantillas_tareas ORDER BY fecha_creacion DESC`
  );
  return filas.map(filaAPlantilla);
}

/**
 * Inserta una nueva plantilla en la base de datos.
 * El ID se genera fuera (en el store) con react-native-uuid.
 * La fecha de creación se asigna automáticamente al momento de la llamada.
 */
export async function crearPlantilla(
  id: string,
  datos: Omit<PlantillaTarea, 'id' | 'fechaCreacion' | 'activa' | 'ultimaTareaId'>
): Promise<void> {
  const bd = await obtenerBD();
  const ahora = new Date().toISOString();
  await bd.runAsync(
    `INSERT INTO plantillas_tareas (
      id, titulo, descripcion, categoria_id, latitud, longitud, direccion,
      nombre_lugar, osm_id, radio_proximidad, prioridad, frecuencia,
      dias_semana, fecha_creacion, activa, ultima_tarea_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
    [
      id,
      datos.titulo,
      datos.descripcion,
      datos.categoriaId,
      datos.latitud,
      datos.longitud,
      datos.direccion,
      datos.nombreLugar ?? null,
      datos.osmId ?? null,
      datos.radioProximidad,
      datos.prioridad,
      datos.frecuencia,
      // diasSemana se serializa como JSON para almacenar el array en SQLite
      JSON.stringify(datos.diasSemana ?? []),
      ahora,
    ]
  );
}

/**
 * Actualiza el campo `ultima_tarea_id` de una plantilla.
 * Se llama cada vez que se genera una nueva instancia de tarea,
 * para llevar registro de cuál es la tarea activa más reciente.
 */
export async function actualizarUltimaTareaPlantilla(
  plantillaId: string,
  tareaId: string
): Promise<void> {
  const bd = await obtenerBD();
  await bd.runAsync(
    `UPDATE plantillas_tareas SET ultima_tarea_id = ? WHERE id = ?`,
    [tareaId, plantillaId]
  );
}

/**
 * Activa o desactiva una plantilla sin eliminarla.
 * Una plantilla inactiva no genera nuevas instancias al completar tareas.
 */
export async function togglePlantilla(id: string, activa: boolean): Promise<void> {
  const bd = await obtenerBD();
  // SQLite no tiene tipo BOOLEAN: usamos 1 (activa) y 0 (inactiva)
  await bd.runAsync(
    `UPDATE plantillas_tareas SET activa = ? WHERE id = ?`,
    [activa ? 1 : 0, id]
  );
}

/**
 * Elimina permanentemente una plantilla.
 * Las tareas ya generadas por ella NO se eliminan (solo se pierde la recurrencia).
 */
export async function eliminarPlantilla(id: string): Promise<void> {
  const bd = await obtenerBD();
  await bd.runAsync(`DELETE FROM plantillas_tareas WHERE id = ?`, [id]);
}

/**
 * Mapper: convierte una fila de la tabla `plantillas_tareas`
 * al modelo TypeScript PlantillaTarea (snake_case → camelCase).
 */
function filaAPlantilla(fila: Record<string, unknown>): PlantillaTarea {
  return {
    id: fila.id as string,
    titulo: fila.titulo as string,
    descripcion: (fila.descripcion as string) ?? '',
    categoriaId: (fila.categoria_id as string) ?? '',
    latitud: fila.latitud as number,
    longitud: fila.longitud as number,
    direccion: (fila.direccion as string) ?? '',
    nombreLugar: (fila.nombre_lugar as string) ?? undefined,
    osmId: (fila.osm_id as string) ?? undefined,
    radioProximidad: fila.radio_proximidad as number,
    prioridad: (fila.prioridad as 'alta' | 'media' | 'baja') ?? 'media',
    frecuencia: fila.frecuencia as FrecuenciaPlantilla,
    // Deserializar el array de días guardado como JSON en SQLite
    diasSemana: JSON.parse((fila.dias_semana as string) ?? '[]'),
    fechaCreacion: fila.fecha_creacion as string,
    activa: (fila.activa as number) === 1,
    ultimaTareaId: (fila.ultima_tarea_id as string) ?? undefined,
  };
}
