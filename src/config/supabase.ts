/**
 * ============================================================
 * ☁️ Cliente Supabase — supabase.ts
 * ============================================================
 *
 * Crea y exporta el cliente singleton de Supabase que usa toda la app.
 * "Singleton" significa que solo existe UNA instancia del cliente,
 * compartida por todos los servicios y stores.
 *
 * Problema: expo-secure-store tiene un límite de ~2048 bytes por clave.
 * Los tokens JWT de Supabase suelen superar ese límite.
 * Solución: la clase AlmacenSeguro fragmenta el token en trozos de
 * MAX_CHUNK_SIZE bytes, guardando cada trozo con una clave numerada:
 *   sesion_supabase_0, sesion_supabase_1, sesion_supabase_total …
 *
 * @version 1.0.0
 * ============================================================
 */

import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// Las variables de entorno con prefijo EXPO_PUBLIC_ son accesibles en el
// bundle de la app. Se definen en el fichero .env de la raíz del proyecto.
//
// ⚠️ En builds de EAS la nube no ve el .env local (está en .gitignore).
// Por eso usamos valores hardcodeados como fallback. La anon key es pública
// por diseño (vive en el cliente), así que no hay riesgo de seguridad.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://iydvbkhlzjojsetjukvj.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_VMYfG5lDWKLXnJOdtGxyVg_JOQZK0HA';

// Diagnóstico crítico: saber si estamos usando el fallback o la variable real.
// En builds de EAS si las variables no están configuradas, el fallback debe ser válido.
console.log('[supabase] URL:', SUPABASE_URL);
console.log('[supabase] ANON_KEY source:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'env' : 'fallback');
console.log('[supabase] ANON_KEY prefix:', SUPABASE_ANON_KEY.slice(0, 20) + '...');

// SecureStore acepta hasta ~2048 bytes por clave en Android.
// Usamos 1900 como margen de seguridad frente al límite exacto.
const MAX_CHUNK = 1900;

/**
 * Adaptador de almacenamiento seguro para Supabase.
 *
 * Supabase espera un objeto con la interfaz AsyncStorage de React Native
 * ({ getItem, setItem, removeItem }). Esta clase la implementa usando
 * expo-secure-store con soporte para valores grandes (chunking).
 */
class AlmacenSeguro {
  /**
   * Lee un valor fragmentado reconstruyendo todos sus trozos.
   * Si la clave no existe, devuelve null (Supabase interpreta null como
   * "no hay sesión guardada").
   */
  async getItem(clave: string): Promise<string | null> {
    try {
      const totalStr = await SecureStore.getItemAsync(`${clave}_total`);
      if (!totalStr) return null;

      const total = parseInt(totalStr, 10);
      const trozos: string[] = [];

      for (let i = 0; i < total; i++) {
        const trozo = await SecureStore.getItemAsync(`${clave}_${i}`);
        if (trozo === null) return null; // fragmento perdido → sesión inválida
        trozos.push(trozo);
      }

      return trozos.join('');
    } catch {
      return null;
    }
  }

  /**
   * Guarda un valor dividiéndolo en trozos de MAX_CHUNK bytes.
   * Primero guarda el número total de trozos para poder leerlos después.
   */
  async setItem(clave: string, valor: string): Promise<void> {
    try {
      const trozos: string[] = [];
      for (let i = 0; i < valor.length; i += MAX_CHUNK) {
        trozos.push(valor.slice(i, i + MAX_CHUNK));
      }

      await SecureStore.setItemAsync(`${clave}_total`, String(trozos.length));
      for (let i = 0; i < trozos.length; i++) {
        await SecureStore.setItemAsync(`${clave}_${i}`, trozos[i]);
      }
    } catch {
      // Si SecureStore falla (dispositivo sin hardware seguro), la sesión
      // simplemente no se persiste. La app seguirá funcionando pero pedirá
      // login al reiniciar.
    }
  }

  /** Elimina todos los trozos de una clave. */
  async removeItem(clave: string): Promise<void> {
    try {
      const totalStr = await SecureStore.getItemAsync(`${clave}_total`);
      if (!totalStr) return;
      const total = parseInt(totalStr, 10);
      for (let i = 0; i < total; i++) {
        await SecureStore.deleteItemAsync(`${clave}_${i}`);
      }
      await SecureStore.deleteItemAsync(`${clave}_total`);
    } catch {
      // Ignoramos errores al limpiar
    }
  }
}

/**
 * Cliente Supabase listo para usar en toda la app.
 *
 * Opciones clave:
 * - storage: nuestro adaptador SecureStore (persistencia segura del token)
 * - autoRefreshToken: Supabase renueva el JWT automáticamente antes de caducar
 * - persistSession: guarda la sesión entre reinicios de la app
 * - detectSessionInUrl: false en React Native (no hay URLs de navegador)
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: new AlmacenSeguro(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
