/**
 * ============================================================
 * 📤 Servicio de Exportación — exportar.servicio.ts
 * ============================================================
 *
 * Exporta e importa tareas en formato JSON o CSV.
 * Usa expo-sharing para compartir el archivo generado.
 * Usa expo-file-system para escribir el archivo temporalmente.
 *
 * @version 1.0.0
 * ============================================================
 */

// expo-file-system v19 movió la API clásica (cacheDirectory, writeAsStringAsync)
// a la sub-ruta "legacy". La ruta principal ahora expone una API orientada a streams.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import uuid from 'react-native-uuid';
import { obtenerTareas, crearTarea } from './basedatos.servicio';
import type { Tarea } from '../models/tarea.modelo';

/** Versión del esquema de exportación — permite detectar archivos incompatibles */
const VERSION_ESQUEMA = '1.0';

// ──────────────────────────────────────────────
// 📤 SECCIÓN: Exportación
// ──────────────────────────────────────────────

/**
 * Exporta todas las tareas (pendientes + completadas) como JSON.
 * El archivo se guarda temporalmente y se comparte con la app que el usuario elija.
 */
export async function exportarTareasJSON(): Promise<void> {
  const [pendientes, completadas] = await Promise.all([
    obtenerTareas(false),
    obtenerTareas(true),
  ]);

  const datos = {
    version: VERSION_ESQUEMA,
    exportadoEn: new Date().toISOString(),
    totalTareas: pendientes.length + completadas.length,
    tareas: [...pendientes, ...completadas],
  };

  const json = JSON.stringify(datos, null, 2);
  const rutaArchivo = `${FileSystem.cacheDirectory}geotask_backup_${Date.now()}.json`;

  await FileSystem.writeAsStringAsync(rutaArchivo, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(rutaArchivo, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar tareas GeoTask',
  });
}

/**
 * Exporta las tareas pendientes como CSV (compatible con Excel/Sheets).
 */
export async function exportarTareasCSV(): Promise<void> {
  const tareas = await obtenerTareas(false);

  // Cabecera CSV
  const cabecera = 'id,titulo,descripcion,direccion,nombreLugar,latitud,longitud,radio,prioridad,fechaCreacion,fechaLimite\n';

  const filas = tareas
    .map((t) =>
      [
        t.id,
        `"${t.titulo.replace(/"/g, '""')}"`,
        `"${(t.descripcion ?? '').replace(/"/g, '""')}"`,
        `"${t.direccion.replace(/"/g, '""')}"`,
        `"${(t.nombreLugar ?? '').replace(/"/g, '""')}"`,
        t.latitud,
        t.longitud,
        t.radioProximidad,
        t.prioridad,
        t.fechaCreacion,
        t.fechaLimite ?? '',
      ].join(',')
    )
    .join('\n');

  const csv = cabecera + filas;
  const rutaArchivo = `${FileSystem.cacheDirectory}geotask_tareas_${Date.now()}.csv`;

  await FileSystem.writeAsStringAsync(rutaArchivo, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(rutaArchivo, {
    mimeType: 'text/csv',
    dialogTitle: 'Exportar tareas como CSV',
  });
}

// ──────────────────────────────────────────────
// 📥 SECCIÓN: Importación
// ──────────────────────────────────────────────

export interface ResultadoImportacion {
  importadas: number;
  errores: number;
  mensajeError?: string;
}

/**
 * Importa tareas desde un archivo JSON previamente exportado por GeoTask.
 * Valida el esquema antes de importar.
 *
 * @param jsonString - Contenido del archivo JSON
 */
export async function importarTareasJSON(jsonString: string): Promise<ResultadoImportacion> {
  try {
    const datos = JSON.parse(jsonString);

    // Validar versión del esquema
    if (!datos.version || !datos.tareas || !Array.isArray(datos.tareas)) {
      return { importadas: 0, errores: 0, mensajeError: 'Formato de archivo no válido.' };
    }

    let importadas = 0;
    let errores = 0;

    for (const tarea of datos.tareas) {
      // Validación mínima de campos obligatorios
      if (!tarea.id || !tarea.titulo || typeof tarea.latitud !== 'number') {
        errores++;
        continue;
      }

      try {
        const nuevoId = uuid.v4() as string; // Nuevo ID para evitar colisiones
        await crearTarea(nuevoId, {
          titulo: tarea.titulo,
          descripcion: tarea.descripcion ?? '',
          categoriaId: tarea.categoriaId ?? 'cat-otros',
          latitud: tarea.latitud,
          longitud: tarea.longitud,
          direccion: tarea.direccion ?? '',
          nombreLugar: tarea.nombreLugar,
          osmId: tarea.osmId,
          radioProximidad: tarea.radioProximidad ?? 500,
          geocercaActiva: true,
          prioridad: tarea.prioridad ?? 'media',
          fechaLimite: tarea.fechaLimite,
        });
        importadas++;
      } catch {
        errores++;
      }
    }

    return { importadas, errores };
  } catch {
    return { importadas: 0, errores: 0, mensajeError: 'Error al parsear el archivo JSON.' };
  }
}
