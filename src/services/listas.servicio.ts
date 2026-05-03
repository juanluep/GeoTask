/**
 * ============================================================
 * 📋 Servicio de Listas Compartidas — listas.servicio.ts
 * ============================================================
 *
 * Gestiona las listas compartidas en Supabase:
 * - Crear, leer y unirse a listas
 * - Suscripción Realtime a cambios de tareas en una lista
 *
 * Una lista compartida es un grupo de tareas que varios usuarios
 * pueden ver y modificar en tiempo real. Cada lista tiene un
 * código de 8 caracteres para compartirla sin revelar emails.
 *
 * @version 1.0.0
 * ============================================================
 */

import { supabase } from '../config/supabase';
import type { Tarea } from '../models/tarea.modelo';

// ──────────────────────────────────────────────
// Tipos para listas compartidas
// ──────────────────────────────────────────────

export interface Lista {
  id: string;
  nombre: string;
  ownerId: string;
  /** Código de 8 caracteres para invitar a otros usuarios */
  codigo: string;
  creadaEn: string;
  /** Rol del usuario actual en esta lista */
  rol?: 'admin' | 'editor' | 'lector';
}

// ──────────────────────────────────────────────
// CRUD de listas
// ──────────────────────────────────────────────

/**
 * Crea una nueva lista compartida.
 * El usuario creador queda automáticamente como miembro 'admin'.
 * @returns La lista creada con su código único
 */
export async function crearLista(nombre: string, userId: string): Promise<Lista> {
  const { data, error } = await supabase
    .from('listas')
    .insert({ nombre, owner_id: userId })
    .select()
    .single();

  if (error) throw new Error('No se pudo crear la lista: ' + error.message);

  // Añadir al creador como miembro 'admin' de la lista
  const { error: errorMiembro } = await supabase.from('miembros_lista').insert({
    lista_id: data.id,
    user_id: userId,
    rol: 'admin',
  });

  if (errorMiembro) {
    console.error('[Supabase] Error al añadir miembro admin a la lista:', errorMiembro);
  }

  return filaALista(data);
}

/**
 * Busca una lista por su código de invitación y une al usuario.
 * @throws Error si el código no existe o el usuario ya pertenece
 */
export async function unirseALista(codigo: string, userId: string): Promise<Lista> {
  // Buscar la lista por código
  const { data: lista, error: errorBusqueda } = await supabase
    .from('listas')
    .select('*')
    .eq('codigo', codigo.trim().toLowerCase())
    .single();

  if (errorBusqueda || !lista) {
    throw new Error('No se encontró ninguna lista con ese código. Comprueba que está bien escrito.');
  }

  // Verificar que el usuario no es ya miembro
  const { data: miembroExistente } = await supabase
    .from('miembros_lista')
    .select('user_id')
    .eq('lista_id', lista.id)
    .eq('user_id', userId)
    .single();

  if (miembroExistente) {
    throw new Error('Ya eres miembro de esta lista.');
  }

  // Unirse como editor
  const { error: errorUnirse } = await supabase.from('miembros_lista').insert({
    lista_id: lista.id,
    user_id: userId,
    rol: 'editor',
  });

  if (errorUnirse) throw new Error('No se pudo unir a la lista: ' + errorUnirse.message);

  return filaALista(lista);
}

/**
 * Obtiene todas las listas en las que participa el usuario (como creador o miembro).
 */
export async function obtenerMisListas(userId: string): Promise<Lista[]> {
  // 1. Buscamos directamente las listas de las que el usuario es dueño (owner)
  const { data: listasPropias, error: errorPropias } = await supabase
    .from('listas')
    .select('*')
    .eq('owner_id', userId);

  if (errorPropias) {
    console.error('[Supabase] Error al buscar listas propias:', errorPropias);
  }

  // 2. Buscamos las listas donde el usuario es miembro invitado
  const { data: membresias, error: errorMembresias } = await supabase
    .from('miembros_lista')
    .select('rol, listas(*)')
    .eq('user_id', userId);

  if (errorMembresias) {
    console.error('[Supabase] Error al buscar membresías:', errorMembresias);
  }

  const listasCombinadas: Lista[] = [];

  // Añadimos primero las listas de las que es dueño (siempre como admin)
  if (listasPropias) {
    listasPropias.forEach((fila) => {
      listasCombinadas.push({ ...filaALista(fila), rol: 'admin' });
    });
  }

  // Añadimos las listas de las que es miembro (si no están ya en la lista)
  if (membresias) {
    membresias.forEach((m) => {
      if (m.listas) {
        const idLista = (m.listas as any).id;
        const yaExiste = listasCombinadas.some((l) => l.id === idLista);
        if (!yaExiste) {
          listasCombinadas.push({
            ...filaALista(m.listas as any),
            rol: m.rol as 'admin' | 'editor' | 'lector',
          });
        }
      }
    });
  }

  console.log(`[Supabase] obtenerMisListas: recuperadas ${listasCombinadas.length} listas en total.`);
  return listasCombinadas;
}

export async function editarLista(listaId: string, nombre: string): Promise<void> {
  const { error } = await supabase
    .from('listas')
    .update({ nombre })
    .eq('id', listaId);

  if (error) throw new Error('No se pudo editar la lista: ' + error.message);
}

export async function eliminarLista(listaId: string): Promise<void> {
  const { error } = await supabase
    .from('listas')
    .delete()
    .eq('id', listaId);

  if (error) throw new Error('No se pudo eliminar la lista: ' + error.message);
}

export async function abandonarLista(listaId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('miembros_lista')
    .delete()
    .match({ lista_id: listaId, user_id: userId });

  if (error) throw new Error('No se pudo abandonar la lista: ' + error.message);
}

/**
 * Obtiene las tareas que pertenecen a una lista concreta.
 */
export async function obtenerTareasLista(listaId: string): Promise<Tarea[]> {
  const { data, error } = await supabase
    .from('tareas')
    .select('*')
    .eq('lista_id', listaId)
    .eq('completada', false)
    .order('fecha_creacion', { ascending: false });

  if (error || !data) return [];

  return data.map(filaSupabaseATarea);
}

// ──────────────────────────────────────────────
// Realtime
// ──────────────────────────────────────────────

/**
 * Suscribe a los cambios en tiempo real de las tareas de una lista.
 *
 * Supabase Realtime envía un mensaje cada vez que alguien inserta,
 * actualiza o elimina una tarea en esa lista.
 *
 * @param listaId  ID de la lista a escuchar
 * @param onCambio Callback que recibe el tipo de evento y la tarea afectada
 * @returns Función para cancelar la suscripción (llamar en useEffect cleanup)
 */
export function suscribirseACambiosLista(
  listaId: string,
  onCambio: (evento: 'INSERT' | 'UPDATE' | 'DELETE', tarea: Tarea | null) => void
): () => void {
  const canal = supabase
    .channel(`lista-${listaId}`)
    .on(
      'postgres_changes',
      {
        event: '*',       // escucha INSERT, UPDATE y DELETE
        schema: 'public',
        table: 'tareas',
        filter: `lista_id=eq.${listaId}`,
      },
      (payload) => {
        const tarea = payload.new
          ? filaSupabaseATarea(payload.new as any)
          : null;
        onCambio(payload.eventType as any, tarea);
      }
    )
    .subscribe();

  // Devolvemos la función de limpieza
  return () => {
    supabase.removeChannel(canal);
  };
}

// ──────────────────────────────────────────────
// Mappers
// ──────────────────────────────────────────────

function filaALista(fila: Record<string, any>): Lista {
  return {
    id:        fila.id,
    nombre:    fila.nombre,
    ownerId:   fila.owner_id,
    codigo:    fila.codigo,
    creadaEn:  fila.created_at,
  };
}

function filaSupabaseATarea(fila: Record<string, any>): Tarea {
  return {
    id:              fila.id,
    titulo:          fila.titulo,
    descripcion:     fila.descripcion ?? '',
    categoriaId:     fila.categoria_id,
    latitud:         fila.latitud,
    longitud:        fila.longitud,
    direccion:       fila.direccion ?? '',
    nombreLugar:     fila.nombre_lugar ?? undefined,
    osmId:           fila.osm_id ?? undefined,
    radioProximidad: fila.radio_proximidad,
    geocercaActiva:  fila.geocerca_activa,
    completada:      fila.completada,
    prioridad:       fila.prioridad,
    fechaCreacion:   fila.fecha_creacion,
    fechaCompletada: fila.fecha_completada ?? undefined,
    fechaLimite:     fila.fecha_limite ?? undefined,
    fotos:           fila.fotos ?? [],
    plantillaId:     fila.plantilla_id ?? undefined,
    listaId:         fila.lista_id ?? undefined,
    creadoPor:       fila.owner_id,
  };
}
