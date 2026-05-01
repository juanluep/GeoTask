/**
 * ============================================================
 * 🔐 Servicio de Autenticación — auth.servicio.ts
 * ============================================================
 *
 * Wrappers sobre supabase.auth.* con:
 * - Manejo de errores traducidos al español
 * - Lógica específica de cada proveedor (email, Google, Apple)
 *
 * Este servicio NO gestiona estado (eso lo hace useAuthStore).
 * Solo ejecuta operaciones y devuelve resultados o lanza errores
 * con mensajes legibles para el usuario.
 *
 * @version 1.0.0
 * ============================================================
 */

import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../config/supabase';
import type { Session } from '@supabase/supabase-js';

// Necesario en iOS para que WebBrowser cierre correctamente después del OAuth
WebBrowser.maybeCompleteAuthSession();

// ──────────────────────────────────────────────
// SECCIÓN: Traducciones de errores de Supabase
// Los errores de Supabase vienen en inglés. Este mapa los traduce
// al español para mostrarlos directamente al usuario sin filtrar.
// ──────────────────────────────────────────────

const MENSAJES_ERROR: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu email antes de iniciar sesión.',
  'User already registered': 'Ya existe una cuenta con ese email.',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  'Unable to validate email address: invalid format': 'El formato del email no es válido.',
  'Email rate limit exceeded': 'Demasiados intentos. Espera unos minutos.',
  'Anonymous sign-ins are disabled': 'El modo invitado no está habilitado en este proyecto.',
};

/**
 * Traduce un mensaje de error de Supabase al español.
 * Si no hay traducción conocida, devuelve un mensaje genérico.
 */
function traducirError(mensaje: string): string {
  for (const [ingles, espanol] of Object.entries(MENSAJES_ERROR)) {
    if (mensaje.includes(ingles)) return espanol;
  }
  return __DEV__ ? `Error: ${mensaje}` : 'Ha ocurrido un error. Inténtalo de nuevo.';
}

// ──────────────────────────────────────────────
// SECCIÓN: Autenticación con email y contraseña
// ──────────────────────────────────────────────

/**
 * Inicia sesión con email y contraseña.
 * @returns La sesión activa si el login fue exitoso
 * @throws Error con mensaje en español si falla
 */
export async function iniciarSesionConEmail(
  email: string,
  contrasena: string
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: contrasena,
  });

  if (error) throw new Error(traducirError(error.message));
  if (!data.session) throw new Error('No se pudo obtener la sesión. Inténtalo de nuevo.');
  return data.session;
}

/**
 * Registra una cuenta nueva con email, contraseña y nombre de usuario.
 * Supabase crea el usuario y lo autentica automáticamente (sin email de verificación
 * si está desactivado en el panel de Supabase → Auth → Email → Confirm email).
 * @throws Error con mensaje en español si falla
 */
export async function registrarseConEmail(
  email: string,
  contrasena: string,
  nombre: string
): Promise<Session> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: contrasena,
    options: {
      // El nombre se guarda en raw_user_meta_data y el trigger de SQL
      // lo copia a la tabla `perfiles` automáticamente al crear el usuario.
      data: { nombre },
    },
  });

  if (error) throw new Error(traducirError(error.message));

  // Si Supabase tiene "Confirm email" activado, no devuelve sesión tras el registro.
  // En ese caso informamos al usuario para que revise su correo.
  if (!data.session) {
    throw new Error(
      'Cuenta creada. Revisa tu correo y confirma tu email para iniciar sesión.\n\n' +
      '(Si no quieres confirmación de email, desactívala en Supabase → Authentication → Settings → Enable email confirmations)'
    );
  }

  return data.session;
}

// ──────────────────────────────────────────────
// SECCIÓN: OAuth con Google (vía navegador del sistema)
// ──────────────────────────────────────────────

/**
 * Inicia el flujo OAuth con Google usando el navegador del sistema.
 *
 * Flujo:
 * 1. Pedimos a Supabase la URL de autorización de Google
 * 2. Abrimos esa URL con WebBrowser (el usuario ve la pantalla de login de Google)
 * 3. Google redirige al deeplink de la app (geotask://auth/callback)
 * 4. WebBrowser captura esa redirección y nos devuelve la URL completa
 * 5. Extraemos el código de autorización y lo canjeamos por una sesión
 *
 * Para que el deeplink funcione, el scheme "geotask" debe estar configurado
 * en app.json (ya está: scheme: "geotask").
 *
 * @throws Error si el usuario cancela o si algo falla
 */
export async function iniciarSesionConGoogle(): Promise<void> {
  // En Android, el redirect de Google llega como intent a la app y Expo Router
  // lo enruta a app/auth/callback.tsx, donde se canjea el código por sesión.
  // No intentamos capturar el resultado aquí — onAuthStateChange lo notificará.
  const urlRedireccion = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: urlRedireccion,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw new Error(traducirError(error.message));
  if (!data.url) throw new Error('No se pudo obtener la URL de autorización de Google.');

  // Abrimos el navegador con Chrome Custom Tabs.
  const resultado = await WebBrowser.openAuthSessionAsync(data.url, urlRedireccion);

  if (resultado.type !== 'success' || !('url' in resultado)) {
    // Usuario canceló o cerró el navegador — no lanzamos error
    return;
  }

  const urlRespuesta = resultado.url;

  // Flujo implícito: Supabase devuelve los tokens directamente en el hash (#)
  // Formato: geotask://auth/callback#access_token=...&refresh_token=...
  if (urlRespuesta.includes('access_token=')) {
    const fragmento = urlRespuesta.includes('#')
      ? urlRespuesta.split('#')[1]
      : urlRespuesta.split('?')[1] ?? '';

    const paramsHash = new URLSearchParams(fragmento);
    const accessToken = paramsHash.get('access_token');
    const refreshToken = paramsHash.get('refresh_token');

    if (!accessToken || !refreshToken) {
      throw new Error('No se pudieron obtener los tokens de sesión de Google.');
    }

    const { error: errorSesion } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (errorSesion) throw new Error(traducirError(errorSesion.message));
    return; // onAuthStateChange actualizará el store
  }

  // Flujo PKCE: Supabase devuelve un código en query params (?code=...)
  if (urlRespuesta.includes('code=')) {
    const { error: errorSesion } = await supabase.auth.exchangeCodeForSession(urlRespuesta);
    if (errorSesion) throw new Error(traducirError(errorSesion.message));
  }
}

// ──────────────────────────────────────────────
// SECCIÓN: Sign In with Apple (solo iOS)
// ──────────────────────────────────────────────

/**
 * Inicia sesión con Apple ID usando expo-apple-authentication.
 *
 * IMPORTANTE: Solo funciona en iOS con una build nativa (no Expo Go).
 * Esta función se importa dinámicamente para que el bundle de Android
 * no incluya el módulo de Apple (que no compila en Android).
 *
 * Requiere:
 * - Cuenta de Apple Developer con "Sign In with Apple" habilitado
 * - Supabase Dashboard → Auth → Providers → Apple configurado
 *
 * @throws Error si el dispositivo no soporta Apple Sign In o si falla
 */
export async function iniciarSesionConApple(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign In with Apple solo está disponible en iPhone/iPad.');
  }

  // Importación dinámica para evitar que Android intente compilar el módulo
  // de Apple (que solo existe en iOS). Si se importara en el top-level,
  // el bundle de Android fallaría con "module not found".
  const AppleAuth = await import('expo-apple-authentication');

  const credencial = await AppleAuth.signInAsync({
    requestedScopes: [
      AppleAuth.AppleAuthenticationScope.FULL_NAME,
      AppleAuth.AppleAuthenticationScope.EMAIL,
    ],
  });

  // Apple devuelve un identityToken (JWT) que Supabase verifica con Apple.
  if (!credencial.identityToken) {
    throw new Error('No se recibió el token de identidad de Apple.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credencial.identityToken,
  });

  if (error) throw new Error(traducirError(error.message));
}

// ──────────────────────────────────────────────
// SECCIÓN: Modo invitado anónimo
// ──────────────────────────────────────────────

/**
 * Crea una sesión anónima en Supabase.
 *
 * El usuario puede usar todas las funciones de la app sin registrarse.
 * Sus tareas se sincronizan con Supabase bajo un user_id anónimo.
 * Más adelante puede "promover" su cuenta vinculando un email/contraseña
 * sin perder sus datos (supabase.auth.updateUser).
 *
 * Requiere activar "Anonymous Sign-ins" en Supabase Dashboard →
 * Authentication → Providers → Anonymous.
 *
 * @throws Error si el modo anónimo no está activado en Supabase
 */
export async function continuarComoInvitado(): Promise<Session> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(traducirError(error.message));
  if (!data.session) throw new Error('No se pudo crear la sesión de invitado.');
  return data.session;
}

// ──────────────────────────────────────────────
// SECCIÓN: Cerrar sesión
// ──────────────────────────────────────────────

/**
 * Cierra la sesión actual y elimina el token guardado en SecureStore.
 * Después de esto, supabase.auth.getSession() devolverá null.
 */
export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(traducirError(error.message));
}
