/**
 * ============================================================
 * 🔔 Servicio de Notificaciones — notificacion.servicio.ts
 * ============================================================
 *
 * Gestiona las notificaciones push LOCALES de GeoTask.
 *
 * "Locales" significa que las genera el propio dispositivo, sin servidor.
 * Las notificaciones push remotas (desde un servidor) son para Fase 5.
 *
 * Flujo de una notificación de proximidad:
 * 1. TaskManager detecta entrada en geocerca (background)
 * 2. Llama a enviarNotificacionProximidad()
 * 3. Verifica cooldown: ¿ya avisamos de esta tarea recientemente?
 * 4. Si no → envía notificación, registra timestamp de último aviso
 * 5. Si sí → silencia (el usuario ya sabe que está cerca)
 *
 * @version 1.0.0
 * ============================================================
 */

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { Tarea } from '../models/tarea.modelo';

// ──────────────────────────────────────────────
// ⚙️ SECCIÓN: Configuración global
// ──────────────────────────────────────────────

/**
 * Tiempo mínimo entre dos notificaciones de la MISMA tarea (en ms).
 * 30 minutos = 1.800.000 ms.
 * Sin cooldown, el usuario recibiría una notificación cada vez que
 * saliera y entrara repetidamente en la geocerca (ej: paseando cerca).
 */
const COOLDOWN_MS = 30 * 60 * 1000;

/** Prefijo para las claves de cooldown en SecureStore */
const PREFIJO_COOLDOWN = 'gt_cooldown_';

// ──────────────────────────────────────────────
// 🏗️ SECCIÓN: Inicialización
// ──────────────────────────────────────────────

/**
 * Configura el comportamiento global de las notificaciones.
 * Debe llamarse una vez al iniciar la app (desde _layout.tsx).
 *
 * setNotificationHandler define QUÉ pasa cuando llega una notificación
 * mientras la app está EN PRIMER PLANO (foreground). Por defecto las apps
 * no muestran notificaciones si están abiertas; aquí le decimos que sí.
 */
export function configurarNotificaciones(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,   // Mostrar banner incluso con la app abierta
      shouldPlaySound: true,   // Reproducir sonido
      shouldSetBadge: false,   // No modificar el badge del ícono (simplifica la lógica)
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Solicita permiso del usuario para enviar notificaciones.
 * @returns true si se concedió el permiso
 */
export async function solicitarPermisoNotificaciones(): Promise<boolean> {
  const { status: estadoActual } = await Notifications.getPermissionsAsync();

  if (estadoActual === 'granted') return true;

  const { status: nuevoEstado } = await Notifications.requestPermissionsAsync();
  return nuevoEstado === 'granted';
}

// ──────────────────────────────────────────────
// 📤 SECCIÓN: Envío de notificaciones
// ──────────────────────────────────────────────

/**
 * Envía una notificación de proximidad para una tarea.
 *
 * Verifica el cooldown antes de enviar para no saturar al usuario.
 * Si la tarea ya recibió una notificación en los últimos 30 minutos,
 * esta función retorna sin hacer nada.
 *
 * @param tarea - La tarea cuya geocerca fue activada
 * @param distanciaMetros - Distancia aproximada al lugar (para el mensaje)
 */
export async function enviarNotificacionProximidad(
  tarea: Tarea,
  distanciaMetros?: number
): Promise<void> {
  // Verificar cooldown: si avisamos recientemente de esta tarea, no volvemos a avisar
  const enCooldown = await verificarCooldown(tarea.id);
  if (enCooldown) {
    console.log(`[notificacion] Cooldown activo para tarea: ${tarea.titulo}`);
    return;
  }

  // Construir el mensaje de la notificación
  const distanciaTexto = distanciaMetros
    ? distanciaMetros >= 1000
      ? `a ${(distanciaMetros / 1000).toFixed(1)} km`
      : `a ${Math.round(distanciaMetros)} metros`
    : 'cerca';

  const cuerpo = tarea.nombreLugar
    ? `Estás ${distanciaTexto} de ${tarea.nombreLugar}`
    : `Estás ${distanciaTexto} — ${tarea.direccion || 'del lugar'}`;

  /**
   * presentNotificationAsync muestra la notificación inmediatamente,
   * sin pasar por el scheduler. Es más robusto que scheduleNotificationAsync
   * con trigger: null, especialmente cuando se llama desde un TaskManager
   * en background o desde nuestro fallback de proximidad por polling.
   */
  await Notifications.presentNotificationAsync({
    title: `📍 ${tarea.titulo}`,
    body: cuerpo,
    // data permite pasar información extra que se recupera al tocar la notificación
    // Úsalo en Fase 5 para navegar directamente al detalle de la tarea
    data: { tareaId: tarea.id, tipo: 'proximidad' },
    sound: true,
  });

  // Registrar el timestamp de este aviso para el cooldown
  await registrarCooldown(tarea.id);

  console.log(`[notificacion] Notificación enviada: ${tarea.titulo}`);
}

/**
 * Envía una notificación de prueba para verificar que el sistema funciona.
 * Útil durante el desarrollo.
 */
export async function enviarNotificacionPrueba(): Promise<void> {
  await Notifications.presentNotificationAsync({
    title: '✅ GeoTask funciona',
    body: 'Las notificaciones de proximidad están configuradas correctamente.',
    data: { tipo: 'prueba' },
  });
}

// ──────────────────────────────────────────────
// ⏱️ SECCIÓN: Sistema de Cooldown
// Usamos SecureStore (almacenamiento cifrado) para persistir los
// timestamps de últimos avisos. Podríamos usar SQLite, pero SecureStore
// es más rápido para lecturas simples clave-valor desde el background.
// ──────────────────────────────────────────────

/**
 * Verifica si una tarea está en período de cooldown.
 * @returns true si NO debemos enviar notificación (cooldown activo)
 */
async function verificarCooldown(tareaId: string): Promise<boolean> {
  try {
    const clave = PREFIJO_COOLDOWN + tareaId;
    const ultimoAvisoStr = await SecureStore.getItemAsync(clave);

    if (!ultimoAvisoStr) return false; // Nunca se ha avisado → sin cooldown

    const ultimoAviso = parseInt(ultimoAvisoStr, 10);
    const ahora = Date.now();

    return ahora - ultimoAviso < COOLDOWN_MS;
  } catch {
    // Si falla la lectura, asumimos que no hay cooldown (mejor avisar de más que de menos)
    return false;
  }
}

/**
 * Registra el timestamp del aviso actual para activar el cooldown.
 */
async function registrarCooldown(tareaId: string): Promise<void> {
  try {
    const clave = PREFIJO_COOLDOWN + tareaId;
    await SecureStore.setItemAsync(clave, Date.now().toString());
  } catch (error) {
    console.warn('[notificacion] Error al registrar cooldown:', error);
  }
}

/**
 * Limpia el cooldown de una tarea (por ejemplo, al reactivarla manualmente).
 */
export async function limpiarCooldown(tareaId: string): Promise<void> {
  try {
    const clave = PREFIJO_COOLDOWN + tareaId;
    await SecureStore.deleteItemAsync(clave);
  } catch {
    // Ignorar errores al limpiar
  }
}
