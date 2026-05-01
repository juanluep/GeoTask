/**
 * ============================================================
 * 🔑 Recuperar contraseña — app/(auth)/recuperar.tsx
 * ============================================================
 *
 * Envía un email de restablecimiento de contraseña usando
 * supabase.auth.resetPasswordForEmail().
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/config/supabase';

export default function PantallaRecuperar() {
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const enrutador = useRouter();
  const { top } = useSafeAreaInsets();

  async function manejarEnviar() {
    if (!email.trim()) {
      Alert.alert('Email requerido', 'Escribe tu dirección de email.');
      return;
    }

    setCargando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'geotask://auth/callback',
    });
    setCargando(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setEnviado(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Cabecera */}
      <View style={[estilos.cabecera, { paddingTop: top + 16 }]}>
        <TouchableOpacity onPress={() => enrutador.back()} style={estilos.botonVolver}>
          <Text style={estilos.textoVolver}>← Volver</Text>
        </TouchableOpacity>
        <Text style={estilos.titulo}>Recuperar contraseña</Text>
        <View style={{ width: 72 }} />
      </View>

      <View style={estilos.cuerpo}>
        {enviado ? (
          // Estado "email enviado"
          <View style={estilos.confirmacion}>
            <Text style={estilos.iconoEnviado}>📧</Text>
            <Text style={estilos.tituloConfirmacion}>Email enviado</Text>
            <Text style={estilos.textoConfirmacion}>
              Revisa tu bandeja de entrada en{' '}
              <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{email}</Text>.{'\n\n'}
              Haz clic en el enlace del email para establecer una nueva contraseña.
            </Text>
            <TouchableOpacity
              style={estilos.botonVolver2}
              onPress={() => enrutador.replace('/(auth)/login')}
            >
              <Text style={estilos.textoBotonVolver2}>Volver al inicio de sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Formulario
          <>
            <Text style={estilos.descripcion}>
              Escribe el email de tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
            </Text>

            <Text style={estilos.etiqueta}>Email</Text>
            <TextInput
              style={estilos.input}
              placeholder="tu@email.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <TouchableOpacity
              style={[estilos.botonEnviar, (!email.trim() || cargando) && estilos.botonDeshabilitado]}
              onPress={manejarEnviar}
              disabled={!email.trim() || cargando}
            >
              {cargando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={estilos.textoBotonEnviar}>Enviar enlace</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  botonVolver: { width: 72 },
  textoVolver: { fontSize: 16, color: '#3b82f6' },
  titulo: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  cuerpo: {
    padding: 24,
    gap: 16,
  },
  descripcion: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    lineHeight: 22,
  },
  etiqueta: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#111827',
  },
  botonEnviar: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDeshabilitado: { opacity: 0.5 },
  textoBotonEnviar: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  // Estado confirmación
  confirmacion: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 40,
  },
  iconoEnviado: { fontSize: 56 },
  tituloConfirmacion: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  textoConfirmacion: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  botonVolver2: {
    marginTop: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  textoBotonVolver2: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
