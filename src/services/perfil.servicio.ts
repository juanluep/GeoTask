/**
 * ============================================================
 * 👤 Servicio de Perfil — perfil.servicio.ts
 * ============================================================
 *
 * Gestiona el perfil del usuario en Supabase:
 * - Leer el perfil desde la tabla `perfiles`
 * - Actualizar nombre
 * - Subir avatar a Supabase Storage (bucket `avatares`)
 *
 * @version 1.0.0
 * ============================================================
 */

import { supabase } from '../config/supabase';
import type { PerfilUsuario } from '../models/usuario.modelo';

/**
 * Obtiene el perfil del usuario autenticado desde Supabase.
 * Devuelve null si el perfil aún no existe (caso raro, el trigger de SQL
 * lo crea automáticamente al registrarse).
 */
export async function obtenerPerfil(userId: string): Promise<PerfilUsuario | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, avatar_url, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    nombre: data.nombre ?? '',
    avatarUrl: data.avatar_url ?? undefined,
    email: '', // se rellena desde supabase.auth.getUser() si se necesita
    fechaRegistro: data.created_at,
  };
}

/**
 * Actualiza el nombre del usuario en la tabla `perfiles` de Supabase.
 * @throws Error si la actualización falla
 */
export async function actualizarNombre(userId: string, nombre: string): Promise<void> {
  const { error } = await supabase
    .from('perfiles')
    .update({ nombre, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error('No se pudo actualizar el nombre: ' + error.message);
}

/**
 * Sube una imagen de avatar al bucket `avatares` de Supabase Storage.
 *
 * Estructura de rutas en el bucket: `{userId}/avatar.jpg`
 * Esto permite que la RLS policy (basada en carpeta = userId) funcione.
 *
 * @param userId  ID del usuario (se usa como nombre de carpeta)
 * @param uriLocal  URI local del fichero en el dispositivo (file:// o content://)
 * @returns URL pública del avatar subido
 */
export async function subirAvatar(userId: string, uriLocal: string): Promise<string> {
  // Leer el fichero como ArrayBuffer para enviarlo a Supabase Storage
  const respuesta = await fetch(uriLocal);
  const blob = await respuesta.blob();

  const ruta = `${userId}/avatar.jpg`;

  const { error } = await supabase.storage
    .from('avatares')
    .upload(ruta, blob, {
      contentType: 'image/jpeg',
      upsert: true, // sobreescribir si ya existe
    });

  if (error) throw new Error('No se pudo subir el avatar: ' + error.message);

  // Obtener la URL pública del avatar subido
  const { data } = supabase.storage.from('avatares').getPublicUrl(ruta);
  return data.publicUrl;
}

/**
 * Actualiza el campo `avatar_url` en la tabla `perfiles`.
 * Se llama después de `subirAvatar` con la URL devuelta.
 */
export async function actualizarAvatarUrl(userId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from('perfiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error('No se pudo actualizar el avatar: ' + error.message);
}
