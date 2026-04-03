/**
 * ============================================================
 * 🔀 Redirección inicial — app/index.tsx
 * ============================================================
 *
 * Esta pantalla es el punto de entrada de Expo Router.
 * Su única función es redirigir al usuario al flujo correcto:
 * - Si es la primera vez → flujo de onboarding (auth/splash)
 * - Si ya tiene sesión → pantallas principales (tabs)
 *
 * En Fase 1 siempre redirige al splash (no hay sesión persistente aún).
 *
 * @version 1.0.0
 * ============================================================
 */

import { Redirect } from 'expo-router';

export default function PaginaInicial() {
  // TODO (Fase 5): Verificar si hay sesión activa en expo-secure-store
  // y redirigir a (tabs) si existe token válido.
  // Por ahora siempre empieza por el flujo de autenticación.
  return <Redirect href="/(auth)/splash" />;
}
