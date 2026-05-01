/**
 * ============================================================
 * ➕ Crear nueva lista — app/lista/nueva.tsx
 * ============================================================
 *
 * Pantalla para crear una lista compartida.
 * El usuario introduce un nombre y la app genera un código
 * único de 8 caracteres que puede compartir con otros.
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
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListaStore } from '../../src/stores/useListaStore';

export default function PantallaCrearLista() {
  const [nombre, setNombre] = useState('');
  const { crearNuevaLista, cargando } = useListaStore();
  const enrutador = useRouter();
  const { top } = useSafeAreaInsets();

  async function manejarCrear() {
    if (!nombre.trim()) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para la lista.');
      return;
    }

    const lista = await crearNuevaLista(nombre.trim());

    if (lista) {
      Alert.alert(
        'Lista creada',
        `El código para invitar a otros es:\n\n${lista.codigo.toUpperCase()}\n\n¿Quieres compartirlo ahora?`,
        [
          {
            text: 'Compartir',
            onPress: () =>
              Share.share({
                message: `Únete a mi lista "${lista.nombre}" en GeoTask con el código: ${lista.codigo.toUpperCase()}`,
              }),
          },
          {
            text: 'Ahora no',
            style: 'cancel',
            onPress: () => enrutador.back(),
          },
        ]
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
        <Text style={estilos.titulo}>Nueva lista</Text>
        <View style={{ width: 72 }} />
      </View>

      {/* Formulario */}
      <View style={estilos.formulario}>
        <Text style={estilos.etiqueta}>Nombre de la lista</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ej: Lista familiar, Trabajo..."
          placeholderTextColor="#9ca3af"
          value={nombre}
          onChangeText={setNombre}
          maxLength={60}
          autoFocus
        />

        <Text style={estilos.descripcion}>
          Al crear la lista se generará un código de 8 caracteres. Compártelo con quien quieras para
          que pueda ver y editar las tareas en tiempo real.
        </Text>

        <TouchableOpacity
          style={[estilos.botonCrear, (!nombre.trim() || cargando) && estilos.botonDeshabilitado]}
          onPress={manejarCrear}
          disabled={!nombre.trim() || cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.textoBoton}>Crear lista</Text>
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
  descripcion: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    lineHeight: 20,
  },
  botonCrear: {
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
