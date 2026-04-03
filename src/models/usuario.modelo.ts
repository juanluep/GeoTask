/**
 * ============================================================
 * Modelo de Usuario — usuario.modelo.ts
 * ============================================================
 *
 * Preferencias del usuario almacenadas localmente en SQLite.
 * En la Fase 5 se anadira el perfil remoto (Supabase Auth).
 *
 * @version 1.0.0
 * ============================================================
 */

// ──────────────────────────────────────────────
// SECCION: Configuracion del usuario
// ──────────────────────────────────────────────

/** Modos de transporte disponibles para el radio dinamico */
export type ModoTransporte = 'peatonal' | 'bicicleta' | 'coche' | 'automatico';

/**
 * Preferencias y configuracion del usuario.
 * Se persiste en la tabla `configuracion` de SQLite como pares clave-valor.
 */
export interface ConfiguracionUsuario {
  /**
   * Radio de geocerca por defecto en metros.
   * El usuario puede cambiarlo por tarea, pero este es el valor inicial.
   * Sugerido: 500m para uso general
   */
  radioPreferido: number;

  /**
   * Modo de transporte para el radio dinamico.
   * 'automatico': la app infiere el modo por la velocidad de movimiento.
   */
  modoTransporte: ModoTransporte;

  /** Si las notificaciones de proximidad reproducen sonido */
  notificacionesSonido: boolean;

  /** Si las notificaciones activan la vibracion */
  notificacionesVibracion: boolean;

  /** Si la app usa tema oscuro */
  temaOscuro: boolean;

  /**
   * Si la app consulta Overpass API antes de notificar.
   * Cuando esta activo, solo avisa si el establecimiento esta abierto.
   */
  verificarHorarios: boolean;

  /**
   * Modo de ahorro de bateria.
   * Reduce la frecuencia de actualizaciones GPS a costa de menor precision.
   */
  ahorroBateria: boolean;

  /**
   * Si las tareas con fecha limite se sincronizan al calendario nativo.
   * Requiere permiso de acceso al calendario.
   */
  sincronizarCalendario: boolean;
}

/** Valores por defecto de la configuracion del usuario */
export const CONFIGURACION_PREDETERMINADA: ConfiguracionUsuario = {
  radioPreferido: 500,
  modoTransporte: 'automatico',
  notificacionesSonido: true,
  notificacionesVibracion: true,
  temaOscuro: false,
  verificarHorarios: false,
  ahorroBateria: false,
  sincronizarCalendario: false,
};

// ──────────────────────────────────────────────
// SECCION: Perfil de usuario (Fase 5 — Supabase)
// Definido aqui para que la arquitectura este preparada,
// aunque no se usa hasta la Fase 5 del desarrollo.
// ──────────────────────────────────────────────

/**
 * Perfil del usuario autenticado (Fase 5 — Supabase Auth).
 * En Fases 1-4, el usuario es siempre "invitado" (sin cuenta).
 */
export interface PerfilUsuario {
  id: string;
  email: string;
  nombre?: string;
  avatarUrl?: string;
  /** Fecha de registro en ISO 8601 */
  fechaRegistro: string;
}
