/**
 * ============================================================
 * 🔗 Servicio de Compartir — compartir.servicio.ts
 * ============================================================
 * 
 * Gestiona la generación de enlaces y mensajes para compartir 
 * tareas y listas, optimizando el tamaño y la compatibilidad.
 * 
 * Estrategia:
 * 1. Usar claves cortas para reducir el tamaño de la URL.
 * 2. Usar un prefijo https:// para asegurar que sea clicable en apps de mensajería.
 * 
 * @version 1.1.0
 * ============================================================
 */

import { Share } from 'react-native';
import type { Tarea } from '../models/tarea.modelo';
import type { Lista } from './listas.servicio';

/** Mapeo de claves largas a cortas para reducir tamaño de URL */
const MAPA_CLAVES = {
  titulo: 't',
  descripcion: 'd',
  latitud: 'lat',
  longitud: 'lon',
  direccion: 'dir',
  nombreLugar: 'n',
  radioProximidad: 'r',
  prioridad: 'p',
};

/** Dominio profesional con soporte de Universal Links / App Links */
const DOMINIO_BASE = 'https://geotask.chanlu.es';

/**
 * Genera y lanza el diálogo de compartir para una tarea.
 */
export async function compartirTarea(tarea: Tarea) {
  try {
    const lugar = tarea.nombreLugar || tarea.direccion || 'Ubicación seleccionada';
    const prioridadEmoji = { alta: '🔴', media: '🟡', baja: '🟢' }[tarea.prioridad];
    
    // 1. Crear objeto con claves cortas (Compresión)
    const datosCortos: any = {
      t: tarea.titulo,
      lat: tarea.latitud,
      lon: tarea.longitud,
    };
    
    if (tarea.descripcion) datosCortos.d = tarea.descripcion;
    if (tarea.direccion) datosCortos.dir = tarea.direccion;
    if (tarea.nombreLugar) datosCortos.n = tarea.nombreLugar;
    if (tarea.radioProximidad !== 500) datosCortos.r = tarea.radioProximidad;
    if (tarea.prioridad !== 'media') datosCortos.p = tarea.prioridad;

    // 2. Convertir a string y codificar
    const dataEncoded = encodeURIComponent(JSON.stringify(datosCortos));
    
    // 3. Generar enlace Universal Link (Ruta limpia /task/)
    const url = `${DOMINIO_BASE}/task/${dataEncoded}`;

    // 4. Lanzar Share
    await Share.share({
      title: tarea.titulo,
      message: 
        `📋 ${tarea.titulo}\n` +
        `📍 ${lugar}\n` +
        `${tarea.descripcion ? `📝 ${tarea.descripcion}\n` : ''}` +
        `${prioridadEmoji} Prioridad ${tarea.prioridad}\n\n` +
        `Ver en GeoTask:\n${url}`,
    });
  } catch (error) {
    console.error('[compartir] Error al compartir tarea:', error);
  }
}

/**
 * Genera y lanza el diálogo de compartir para invitar a una lista.
 */
export async function compartirLista(lista: Lista) {
  try {
    const codigo = lista.codigo.toUpperCase();
    const url = `${DOMINIO_BASE}/join/${codigo}`;

    await Share.share({
      title: `Lista: ${lista.nombre}`,
      message: 
        `👋 ¡Hola! Únete a mi lista "${lista.nombre}" en GeoTask.\n\n` +
        `Código de acceso: ${codigo}\n\n` +
        `Enlace directo:\n${url}`,
    });
  } catch (error) {
    console.error('[compartir] Error al compartir lista:', error);
  }
}
