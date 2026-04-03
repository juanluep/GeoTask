/**
 * ============================================================
 * 🔐 Layout de Autenticación — app/(auth)/_layout.tsx
 * ============================================================
 *
 * Layout para el flujo de autenticación inicial:
 * Splash → Onboarding → Login
 *
 * Al ser un Stack sin cabecera, las transiciones entre pantallas
 * son simples deslizamientos horizontales.
 *
 * @version 1.0.0
 * ============================================================
 */

import { Stack } from 'expo-router';

export default function LayoutAuth() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
