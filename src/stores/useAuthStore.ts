/**
 * ============================================================
 * 🔑 Store de Autenticación — useAuthStore.ts
 * ============================================================
 *
 * Store global de Zustand para el estado de sesión del usuario.
 *
 * Distingue tres casos:
 * 1. No autenticado  → sesion: null, sessionCargada: true
 * 2. Invitado        → sesion activa con user.is_anonymous: true
 * 3. Autenticado     → sesion activa con user registrado
 *
 * Ciclo de vida:
 * - _layout.tsx llama a inicializarSesion() al arrancar la app.
 *   Esto recupera la sesión guardada en SecureStore (si existe).
 * - _layout.tsx también llama a escucharCambiosSesion() para que
 *   cualquier cambio posterior (login, logout, token renovado) se
 *   refleje automáticamente en el store.
 *
 * @version 1.0.0
 * ============================================================
 */

import { create } from 'zustand';
import { supabase } from '../config/supabase';
import {
  iniciarSesionConEmail,
  registrarseConEmail,
  iniciarSesionConGoogle,
  iniciarSesionConApple,
  continuarComoInvitado,
  cerrarSesion,
} from '../services/auth.servicio';
import type { Session } from '@supabase/supabase-js';

// ──────────────────────────────────────────────
// Interfaz del estado
// ──────────────────────────────────────────────

interface EstadoAuth {
  // ── Datos ──────────────────────────────────
  /** Sesión activa de Supabase (null = no autenticado) */
  sesion: Session | null;

  /**
   * true cuando la verificación inicial de sesión (getSession) ha terminado.
   * app/index.tsx espera a que sea true antes de decidir la ruta inicial,
   * para evitar el "flash" de redirección incorrecta.
   */
  sessionCargada: boolean;

  /** Si una operación de auth está en progreso (para mostrar spinners) */
  cargando: boolean;

  /** Mensaje de error del último intento fallido */
  error: string | null;

  // ── Valores derivados de sesion (actualizados junto a sesion) ───────────
  /** true si el usuario está autenticado (real o anónimo) */
  estaAutenticado: boolean;

  /** true si la sesión es anónima (is_anonymous: true) */
  esInvitado: boolean;

  /** ID del usuario actual (null si no hay sesión) */
  userId: string | null;

  // ── Acciones ────────────────────────────────
  /**
   * Carga la sesión guardada en SecureStore al arrancar la app.
   * Debe llamarse en el useEffect de inicialización de _layout.tsx ANTES
   * de renderizar las rutas hijas, para que index.tsx ya tenga el estado.
   */
  inicializarSesion: () => Promise<void>;

  /**
   * Suscribe al canal de cambios de sesión de Supabase.
   * Devuelve la función de limpieza (unsubscribe) para useEffect.
   * Cualquier cambio (login, logout, refresh de token) actualiza el store.
   */
  escucharCambiosSesion: () => () => void;

  /** Login con email y contraseña */
  iniciarSesion: (email: string, contrasena: string) => Promise<void>;

  /** Crear cuenta con email, contraseña y nombre */
  registrarse: (email: string, contrasena: string, nombre: string) => Promise<void>;

  /** OAuth con Google (abre navegador del sistema) */
  loginConGoogle: () => Promise<void>;

  /** Sign In with Apple (solo iOS) */
  loginConApple: () => Promise<void>;

  /** Crear sesión anónima */
  continuarComoInvitado: () => Promise<void>;

  /** Cerrar sesión y limpiar estado */
  cerrarSesion: () => Promise<void>;

  /** Limpia el último error */
  limpiarError: () => void;
}

// ──────────────────────────────────────────────
// Creación del store
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Helper interno: sincroniza todos los campos derivados de sesion.
// Los JS getters no funcionan con el spread de Zustand (se congelan como
// valores fijos en el primer set()). Por eso almacenamos los derivados
// como campos normales y los actualizamos siempre que cambia sesion.
// ──────────────────────────────────────────────
function camposDeSesion(sesion: Session | null) {
  return {
    sesion,
    estaAutenticado: sesion !== null,
    esInvitado:      sesion?.user?.is_anonymous === true,
    userId:          sesion?.user?.id ?? null,
  };
}

export const useAuthStore = create<EstadoAuth>((set) => ({
  sesion:          null,
  sessionCargada:  false,
  cargando:        false,
  error:           null,
  estaAutenticado: false,
  esInvitado:      false,
  userId:          null,

  // ── inicializarSesion ──────────────────────
  inicializarSesion: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ ...camposDeSesion(session), sessionCargada: true });
    } catch {
      set({ ...camposDeSesion(null), sessionCargada: true });
    }
  },

  // ── escucharCambiosSesion ──────────────────
  escucharCambiosSesion: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_evento, sesion) => {
        set(camposDeSesion(sesion));
      }
    );
    return () => subscription.unsubscribe();
  },

  // ── iniciarSesion ──────────────────────────
  iniciarSesion: async (email, contrasena) => {
    set({ cargando: true, error: null });
    try {
      await iniciarSesionConEmail(email, contrasena);
      // La sesión se actualiza automáticamente vía onAuthStateChange
      set({ cargando: false });
    } catch (e: any) {
      set({ cargando: false, error: e.message });
    }
  },

  // ── registrarse ────────────────────────────
  registrarse: async (email, contrasena, nombre) => {
    set({ cargando: true, error: null });
    try {
      await registrarseConEmail(email, contrasena, nombre);
      set({ cargando: false });
    } catch (e: any) {
      set({ cargando: false, error: e.message });
    }
  },

  // ── loginConGoogle ─────────────────────────
  loginConGoogle: async () => {
    set({ cargando: true, error: null });
    try {
      await iniciarSesionConGoogle();
      set({ cargando: false });
    } catch (e: any) {
      set({ cargando: false, error: e.message });
    }
  },

  // ── loginConApple ──────────────────────────
  loginConApple: async () => {
    set({ cargando: true, error: null });
    try {
      await iniciarSesionConApple();
      set({ cargando: false });
    } catch (e: any) {
      set({ cargando: false, error: e.message });
    }
  },

  // ── continuarComoInvitado ──────────────────
  continuarComoInvitado: async () => {
    set({ cargando: true, error: null });
    try {
      await continuarComoInvitado();
      set({ cargando: false });
    } catch (e: any) {
      set({ cargando: false, error: e.message });
    }
  },

  // ── cerrarSesion ───────────────────────────
  cerrarSesion: async () => {
    set({ cargando: true, error: null });
    try {
      await cerrarSesion();
      // onAuthStateChange dispara SIGNED_OUT y pone sesion = null
      set({ cargando: false });
    } catch (e: any) {
      set({ cargando: false, error: e.message });
    }
  },

  limpiarError: () => set({ error: null }),
}));
