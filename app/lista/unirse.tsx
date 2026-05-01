/**
 * ============================================================
 * 🔗 Unirse a lista — app/lista/unirse.tsx
 * ============================================================
 *
 * Pantalla para unirse a una lista compartida introduciendo
 * su código de 8 caracteres.
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
import { useListaStore } from '../../src/stores/useListaStore';

export default function PantallaUnirseALista() {
  const [codigo, setCodigo] = useState('');
  const { unirseAListaPorCodigo, cargando } = useListaStore();
  const enrutador = useRouter();
  const { top } = useSafeAreaInsets();

  async function manejarUnirse() {
    if (codigo.trim().length < 8) {
      Alert.alert('Código inválido', 'El código debe tener 8 caracteres.');
      return;
    }

    const lista = await unirseAListaPorCodigo(codigo.trim());

    if (lista) {
      Alert.alert(
        '¡Bienvenido!',
        `Te has unido a la lista "${lista.nombre}". Ya puedes ver y editar sus tareas.`,
        [{ text: 'Ver lista', onPress: () => enrutador.replace(`/lista/${lista.id}`) }]
      );
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
        <Text style={estilos.titulo}>Unirse a lista</Text>
        <View style={{ width: 72 }} />
      </View>

      {/* Formulario */}
      <View style={estilos.formulario}>
        <Text style={estilos.etiqueta}>Código de invitación</Text>
        <TextInput
          style={estilos.inputCodigo}
          placeholder="XXXXXXXX"
          placeholderTextColor="#9ca3af"
          value={codigo}
          onChangeText={(v) => setCodigo(v.toUpperCase())}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType="default"
          autoFocus
        />

        <Text style={estilos.descripcion}>
          Pide el código de 8 caracteres a quien haya creado la lista. Una vez dentro, podrás ver y
          editar sus tareas en tiempo real.
        </Text>

        <TouchableOpacity
          style={[
            estilos.botonUnirse,
            (codigo.trim().length < 8 || cargando) && estilos.botonDeshabilitado,
          ]}
          onPress={manejarUnirse}
          disabled={codigo.trim().length < 8 || cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.textoBoton}>Unirse</Text>
          )}
        </TouchableOpacity>
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
  botonVolver: {
    width: 72,
  },
  textoVolver: {
    fontSize: 16,
    color: '#3b82f6',
  },
  titulo: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  formulario: {
    padding: 24,
    gap: 16,
  },
  etiqueta: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  inputCodigo: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 6,
  },
  descripcion: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    lineHeight: 20,
  },
  botonUnirse: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
  textoBoton: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
