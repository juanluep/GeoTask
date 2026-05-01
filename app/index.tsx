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

/**
 * Punto de entrada de la app. Decide hacia dónde navegar según:
 * 1. Si el usuario ha visto el onboarding (SecureStore)
 * 2. Si tiene una sesión activa de Supabase (useAuthStore)
 *
 * El orden importa:
 * - _layout.tsx llama a inicializarSesion() ANTES de renderizar hijos,
 *   así que cuando este componente se monta, sessionCargada ya es true.
 */
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../src/stores/useAuthStore';
import { Colores } from '../src/config/tema';

const CLAVE_ONBOARDING = 'onboarding_completado';

export default function PaginaInicial() {
  const { sesion, sessionCargada } = useAuthStore();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    // Solo decidir cuando la sesión ya fue verificada con Supabase
    if (!sessionCargada) return;

    async function decidirDestino() {
      try {
        const onboardingHecho = await SecureStore.getItemAsync(CLAVE_ONBOARDING);

        if (onboardingHecho !== 'true') {
          // Primera vez → mostrar splash y onboarding completo
          setDestino('/(auth)/splash');
          return;
        }

        if (sesion) {
          // Onboarding completo + sesión activa → ir directo a la app
          setDestino('/(tabs)');
        } else {
          // Onboarding hecho pero sin sesión → pantalla de login
          setDestino('/(auth)/login');
        }
      } catch {
        setDestino('/(auth)/splash');
      }
    }

    decidirDestino();
  }, [sessionCargada, sesion]);

  if (destino === null) {
    return (
      <View style={{ flex: 1, backgroundColor: Colores.blanco, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colores.primario} />
      </View>
    );
  }

  return <Redirect href={destino as any} />;
}
