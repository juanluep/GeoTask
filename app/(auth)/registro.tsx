/**
 * ============================================================
 * Pantalla de Registro — registro.tsx
 * ============================================================
 *
 * Formulario para crear una cuenta nueva en GeoTask con:
 * - Nombre visible (se guarda en la tabla `perfiles` de Supabase)
 * - Email
 * - Contraseña (mínimo 6 caracteres)
 * - Confirmación de contraseña
 *
 * Al crear la cuenta, Supabase autentica al usuario automáticamente
 * (si "Confirm email" está desactivado en el panel) y el store
 * recibe la sesión vía onAuthStateChange → navega a tabs.
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { Colores, Espaciado, Radios } from '../../src/config/tema';

export default function PantallaRegistro() {
  const enrutador = useRouter();
  const { registrarse, cargando, error, limpiarError, sesion } = useAuthStore();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [contrasenaVisible, setContrasenaVisible] = useState(false);
  const [erroresLocales, setErroresLocales] = useState<Record<string, string>>({});

  // Cuando la sesión aparece (registro exitoso) → navegar a tabs
  useEffect(() => {
    if (sesion) {
      enrutador.replace('/(tabs)');
    }
  }, [sesion]);

  // Mostrar errores de Supabase como Alert
  useEffect(() => {
    if (error) {
      Alert.alert('Error al registrarse', error, [
        { text: 'Entendido', onPress: limpiarError },
      ]);
    }
  }, [error]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!email.trim()) e.email = 'El email es obligatorio';
    if (!contrasena) e.contrasena = 'La contraseña es obligatoria';
    else if (contrasena.length < 6) e.contrasena = 'Mínimo 6 caracteres';
    if (contrasena !== confirmar) e.confirmar = 'Las contraseñas no coinciden';
    setErroresLocales(e);
    return Object.keys(e).length === 0;
  }

  async function manejarRegistro() {
    if (!validar()) return;
    await registrarse(email, contrasena, nombre);
  }

  return (
    <SafeAreaView style={estilos.contenedor}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Cabecera con botón volver */}
        <View style={estilos.cabecera}>
          <TouchableOpacity onPress={() => enrutador.back()} style={estilos.botonVolver}>
            <Ionicons name="arrow-back" size={24} color={Colores.sobreSuperficie} />
          </TouchableOpacity>
          <Text style={estilos.tituloCabecera}>Crear cuenta</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={estilos.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={estilos.subtitulo}>
            Crea tu cuenta y sincroniza tus tareas en todos tus dispositivos.
          </Text>

          {/* Campo Nombre */}
          <View style={estilos.grupo}>
            <Text style={estilos.etiqueta}>Nombre *</Text>
            <View style={[estilos.campoInput, erroresLocales.nombre && estilos.campoError]}>
              <Ionicons name="person-outline" size={20} color={Colores.sobreSuperficieVariante} style={estilos.icono} />
              <TextInput
                style={estilos.input}
                placeholder="Tu nombre"
                placeholderTextColor={Colores.sobreSuperficieVariante}
                value={nombre}
                onChangeText={(t) => { setNombre(t); setErroresLocales((e) => ({ ...e, nombre: '' })); }}
                autoCapitalize="words"
              />
            </View>
            {erroresLocales.nombre ? <Text style={estilos.textoError}>{erroresLocales.nombre}</Text> : null}
          </View>

          {/* Campo Email */}
          <View style={estilos.grupo}>
            <Text style={estilos.etiqueta}>Email *</Text>
            <View style={[estilos.campoInput, erroresLocales.email && estilos.campoError]}>
              <Ionicons name="mail-outline" size={20} color={Colores.sobreSuperficieVariante} style={estilos.icono} />
              <TextInput
                style={estilos.input}
                placeholder="nombre@ejemplo.com"
                placeholderTextColor={Colores.sobreSuperficieVariante}
                value={email}
                onChangeText={(t) => { setEmail(t); setErroresLocales((e) => ({ ...e, email: '' })); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {erroresLocales.email ? <Text style={estilos.textoError}>{erroresLocales.email}</Text> : null}
          </View>

          {/* Campo Contraseña */}
          <View style={estilos.grupo}>
            <Text style={estilos.etiqueta}>Contraseña *</Text>
            <View style={[estilos.campoInput, erroresLocales.contrasena && estilos.campoError]}>
              <Ionicons name="lock-closed-outline" size={20} color={Colores.sobreSuperficieVariante} style={estilos.icono} />
              <TextInput
                style={[estilos.input, { flex: 1 }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colores.sobreSuperficieVariante}
                value={contrasena}
                onChangeText={(t) => { setContrasena(t); setErroresLocales((e) => ({ ...e, contrasena: '' })); }}
                secureTextEntry={!contrasenaVisible}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setContrasenaVisible(!contrasenaVisible)} style={estilos.botonOjo}>
                <Ionicons name={contrasenaVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colores.sobreSuperficieVariante} />
              </TouchableOpacity>
            </View>
            {erroresLocales.contrasena ? <Text style={estilos.textoError}>{erroresLocales.contrasena}</Text> : null}
          </View>

          {/* Confirmar Contraseña */}
          <View style={estilos.grupo}>
            <Text style={estilos.etiqueta}>Confirmar contraseña *</Text>
            <View style={[estilos.campoInput, erroresLocales.confirmar && estilos.campoError]}>
              <Ionicons name="lock-closed-outline" size={20} color={Colores.sobreSuperficieVariante} style={estilos.icono} />
              <TextInput
                style={[estilos.input, { flex: 1 }]}
                placeholder="Repite la contraseña"
                placeholderTextColor={Colores.sobreSuperficieVariante}
                value={confirmar}
                onChangeText={(t) => { setConfirmar(t); setErroresLocales((e) => ({ ...e, confirmar: '' })); }}
                secureTextEntry={!contrasenaVisible}
                autoCapitalize="none"
              />
            </View>
            {erroresLocales.confirmar ? <Text style={estilos.textoError}>{erroresLocales.confirmar}</Text> : null}
          </View>

          {/* Botón Crear cuenta */}
          <TouchableOpacity
            style={[estilos.botonPrimario, cargando && { opacity: 0.7 }]}
            onPress={manejarRegistro}
            disabled={cargando}
            activeOpacity={0.85}
          >
            {cargando
              ? <ActivityIndicator color={Colores.blanco} />
              : <Text style={estilos.textoBoton}>Crear cuenta →</Text>
            }
          </TouchableOpacity>

          <Text style={estilos.textoLegal}>
            Al registrarte aceptas que tus datos se almacenan de forma segura en Supabase
            y se usan exclusivamente para el funcionamiento de GeoTask.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colores.superficie },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Espaciado.base, paddingVertical: Espaciado.md,
  },
  botonVolver: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tituloCabecera: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colores.sobreSuperficie },
  scroll: { padding: Espaciado.xl, gap: Espaciado.base, paddingBottom: Espaciado.xxxl },
  subtitulo: {
    fontFamily: 'Inter_400Regular', fontSize: 14,
    color: Colores.sobreSuperficieVariante, lineHeight: 20, marginBottom: Espaciado.md,
  },
  grupo: { gap: Espaciado.xs },
  etiqueta: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colores.sobreSuperficie },
  campoInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colores.superficieContenedor,
    borderRadius: Radios.boton, paddingHorizontal: Espaciado.base, height: 52,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  campoError: { borderColor: Colores.error },
  icono: { marginRight: Espaciado.sm },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colores.sobreSuperficie },
  botonOjo: { padding: 4 },
  textoError: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colores.error },
  botonPrimario: {
    height: 52, backgroundColor: Colores.primario, borderRadius: Radios.boton,
    alignItems: 'center', justifyContent: 'center', marginTop: Espaciado.md,
  },
  textoBoton: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colores.blanco },
  textoLegal: {
    fontFamily: 'Inter_400Regular', fontSize: 11,
    color: Colores.sobreSuperficieVariante, textAlign: 'center', lineHeight: 16,
    marginTop: Espaciado.md, opacity: 0.7,
  },
});
