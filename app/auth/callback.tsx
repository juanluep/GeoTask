/**
 * ============================================================
 * 🔗 OAuth Callback — app/auth/callback.tsx
 * ============================================================
 *
 * Recibe el redirect de Google OAuth vía deep link.
 *
 * En Android, cuando Supabase redirige a geotask://auth/callback?code=...
 * Expo Router navega a esta pantalla y el `code` llega en los params
 * de la ruta (useLocalSearchParams). Canjeamos el código por sesión
 * aquí mismo.
 *
 * @version 1.2.0
 * ============================================================
 */

import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/config/supabase';

export default function AuthCallback() {
  const enrutador = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const procesando = useRef(false);

  useEffect(() => {
    const code = params.code;
    const error = params.error;

    if (error) {
      enrutador.replace('/(auth)/login');
      return;
    }

    if (!code) return;
    if (procesando.current) return;
    procesando.current = true;

    const paramsOAuth = ['code', 'state', 'session_state', 'scope', 'authuser', 'prompt', 'hd'];
    const queryParts = paramsOAuth
      .filter((k) => params[k] !== undefined)
      .map((k) => `${k}=${encodeURIComponent(params[k]!)}`);

    const urlCompleta = `geotask://auth/callback?${queryParts.join('&')}`;

    supabase.auth
      .exchangeCodeForSession(urlCompleta)
      .then(({ error: errorSesion }) => {
        enrutador.replace(errorSesion ? '/(auth)/login' : '/(tabs)');
      })
      .catch(() => {
        enrutador.replace('/(auth)/login');
      });
  }, [params.code]);

  return (
    <View style={estilos.contenedor}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={estilos.texto}>Completando inicio de sesión...</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    gap: 16,
  },
  texto: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
});
