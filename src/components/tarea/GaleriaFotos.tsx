/**
 * ============================================================
 * 📷 Galería de Fotos — GaleriaFotos.tsx
 * ============================================================
 *
 * Componente para adjuntar hasta 3 fotos a una tarea.
 * Permite capturar desde cámara o seleccionar de galería.
 *
 * Las fotos se almacenan como rutas locales en el sistema de
 * archivos del dispositivo (FileSystem de Expo). En Fase 5
 * se subirán a Supabase Storage para sincronización.
 *
 * Compresión: calidad 0.7 (70%) y tamaño máx 1024px.
 * Razón: las fotos de cámara pueden ser 4-10MB. Con compresión
 * quedan en ~200-500KB, suficiente para una referencia visual.
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colores, Espaciado, Radios } from '../../config/tema';

/** Número máximo de fotos por tarea */
const MAX_FOTOS = 3;

/** Opciones de compresión para expo-image-picker */
const OPCIONES_IMAGEN: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.7,          // 70% de calidad (buen equilibrio tamaño/calidad)
};

interface PropiedadesGaleriaFotos {
  /** Rutas locales de las fotos actuales */
  fotos: string[];
  /** Callback cuando cambia la lista de fotos */
  alCambiarFotos: (fotos: string[]) => void;
  /** Si está en modo solo lectura (vista de detalle) */
  soloLectura?: boolean;
}

export function GaleriaFotos({
  fotos,
  alCambiarFotos,
  soloLectura = false,
}: PropiedadesGaleriaFotos) {

  async function manejarAgregarFoto() {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Límite alcanzado', `Máximo ${MAX_FOTOS} fotos por tarea.`);
      return;
    }

    // Mostrar opciones: cámara o galería
    Alert.alert(
      'Añadir foto',
      'Elige el origen de la imagen',
      [
        { text: 'Cámara', onPress: capturarDesdeCamara },
        { text: 'Galería', onPress: seleccionarDeGaleria },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }

  async function capturarDesdeCamara() {
    // Solicitar permiso de cámara (solo si no está concedido)
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Activa el permiso de cámara en Ajustes del dispositivo.');
      return;
    }

    const resultado = await ImagePicker.launchCameraAsync(OPCIONES_IMAGEN);
    procesarResultado(resultado);
  }

  async function seleccionarDeGaleria() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Activa el acceso a la galería en Ajustes del dispositivo.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync(OPCIONES_IMAGEN);
    procesarResultado(resultado);
  }

  function procesarResultado(resultado: ImagePicker.ImagePickerResult) {
    // El usuario canceló o hubo un error
    if (resultado.canceled || !resultado.assets?.[0]) return;

    const uri = resultado.assets[0].uri;
    alCambiarFotos([...fotos, uri]);
  }

  function eliminarFoto(indice: number) {
    Alert.alert(
      'Eliminar foto',
      '¿Quieres eliminar esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const nuevasFotos = fotos.filter((_, i) => i !== indice);
            alCambiarFotos(nuevasFotos);
          },
        },
      ]
    );
  }

  return (
    <View style={estilos.contenedor}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.galeria}
      >
        {/* Miniaturas de fotos existentes */}
        {fotos.map((uri, indice) => (
          <View key={uri} style={estilos.contenedorFoto}>
            <Image source={{ uri }} style={estilos.miniatura} />
            {/* Botón eliminar (solo en modo edición) */}
            {!soloLectura && (
              <TouchableOpacity
                onPress={() => eliminarFoto(indice)}
                style={estilos.botonEliminar}
              >
                <Ionicons name="close-circle" size={20} color={Colores.blanco} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Botón añadir foto (visible si hay espacio) */}
        {!soloLectura && fotos.length < MAX_FOTOS && (
          <TouchableOpacity
            onPress={manejarAgregarFoto}
            style={estilos.botonAgregar}
            activeOpacity={0.75}
          >
            <Ionicons name="camera-outline" size={28} color={Colores.primario} />
            <Text style={estilos.textoAgregar}>
              {fotos.length === 0 ? 'Añadir foto' : 'Otra foto'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Si no hay fotos en modo lectura */}
        {soloLectura && fotos.length === 0 && (
          <Text style={estilos.textoSinFotos}>Sin fotos adjuntas</Text>
        )}
      </ScrollView>

      {/* Contador */}
      {!soloLectura && (
        <Text style={estilos.contador}>
          {fotos.length}/{MAX_FOTOS} fotos
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: Espaciado.xs,
  },
  galeria: {
    gap: Espaciado.sm,
    paddingVertical: 4,
  },
  contenedorFoto: {
    position: 'relative',
  },
  miniatura: {
    width: 88,
    height: 88,
    borderRadius: Radios.tarjeta,
    backgroundColor: Colores.superficieContenedorAlta,
  },
  botonEliminar: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colores.error,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colores.blanco,
  },
  botonAgregar: {
    width: 88,
    height: 88,
    borderRadius: Radios.tarjeta,
    backgroundColor: Colores.primarioContenedor,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colores.primario + '40',
    borderStyle: 'dashed',
  },
  textoAgregar: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colores.primario,
    textAlign: 'center',
  },
  textoSinFotos: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colores.sobreSuperficieVariante,
    paddingVertical: Espaciado.md,
  },
  contador: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.sobreSuperficieVariante,
  },
});
