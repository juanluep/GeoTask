/**
 * ============================================================
 * 📥 Importar Tarea desde Deep Link — app/tarea/importar.tsx
 * ============================================================
 *
 * Esta pantalla se abre automáticamente cuando el usuario toca un
 * enlace geotask://tarea/importar?datos=...
 *
 * Extrae los datos de la tarea desde la URL (codificados en JSON)
 * y muestra una vista previa antes de añadirla a la base de datos local.
 *
 * @version 1.0.0
 * ============================================================
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTareaStore } from '../../src/stores/useTareaStore';
import { Boton } from '../../src/components/ui/Boton';
import { useCategoriaStore } from '../../src/stores/useCategoriaStore';
import { Colores, Espaciado, Radios } from '../../src/config/tema';

export default function PantallaImportarTarea() {
  const params = useLocalSearchParams<{ data?: string; datos?: string }>();
  const enrutador = useRouter();
  const crearTarea = useTareaStore((s) => s.crearTarea);
  const { categorias, cargarCategorias } = useCategoriaStore();
  const [tareaImportada, setTareaImportada] = useState<any>(null);

  useEffect(() => {
    if (categorias.length === 0) cargarCategorias();
  }, []);
  useEffect(() => {
    // Soportamos 'data' (nuevo formato corto) y 'datos' (legado largo)
    const rawData = params.data || params.datos;

    if (rawData) {
      try {
        const decodificado = JSON.parse(decodeURIComponent(rawData));
        
        // Si viene del nuevo formato (data), mapeamos las claves cortas a las largas
        if (params.data) {
          setTareaImportada({
            titulo: decodificado.t,
            descripcion: decodificado.d,
            latitud: decodificado.lat,
            longitud: decodificado.lon,
            direccion: decodificado.dir,
            nombreLugar: decodificado.n,
            radioProximidad: decodificado.r,
            prioridad: decodificado.p,
          });
        } else {
          setTareaImportada(decodificado);
        }
      } catch (error) {
        Alert.alert('Error', 'El enlace de la tarea no es válido o está dañado.', [
          { text: 'Volver', onPress: () => enrutador.replace('/') }
        ]);
      }
    } else {
      enrutador.replace('/');
    }
  }, [params.data, params.datos]);

  async function importar() {
    if (!tareaImportada) return;

    // Asignamos la primera categoría por defecto si no tenemos
    const catId = categorias.length > 0 ? categorias[0].id : '';

    const id = await crearTarea({
      titulo: tareaImportada.titulo,
      descripcion: tareaImportada.descripcion ?? '',
      categoriaId: catId,
      latitud: tareaImportada.latitud,
      longitud: tareaImportada.longitud,
      direccion: tareaImportada.direccion,
      nombreLugar: tareaImportada.nombreLugar,
      radioProximidad: tareaImportada.radioProximidad ?? 500,
      geocercaActiva: true,
      prioridad: tareaImportada.prioridad ?? 'media',
    });

    if (id) {
      Alert.alert('Éxito', 'La tarea se ha importado correctamente.', [
        { text: 'Aceptar', onPress: () => enrutador.replace('/') }
      ]);
    } else {
      Alert.alert('Error', 'No se pudo importar la tarea.');
    }
  }

  if (!tareaImportada) {
    return <View style={estilos.contenedor}><Text>Cargando...</Text></View>;
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      <View style={estilos.cabecera}>
        <Text style={estilos.tituloCabecera}>Importar tarea</Text>
      </View>

      <View style={estilos.tarjeta}>
        <Text style={estilos.etiqueta}>Te han compartido la siguiente tarea:</Text>
        <Text style={estilos.tituloTarea}>{tareaImportada.titulo}</Text>
        
        {tareaImportada.descripcion ? (
          <Text style={estilos.descripcion}>{tareaImportada.descripcion}</Text>
        ) : null}

        <Text style={estilos.lugar}>📍 {tareaImportada.nombreLugar || tareaImportada.direccion}</Text>
        <Text style={estilos.detalle}>Prioridad: {tareaImportada.prioridad}</Text>
        <Text style={estilos.detalle}>Radio: {tareaImportada.radioProximidad}m</Text>

        <View style={estilos.acciones}>
          <TouchableOpacity onPress={() => enrutador.replace('/')} style={estilos.botonCancelar}>
            <Text style={estilos.textoCancelar}>Cancelar</Text>
          </TouchableOpacity>
          <Boton etiqueta="Guardar en mis tareas" alPresionar={importar} variante="primario" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colores.superficie },
  cabecera: {
    padding: Espaciado.base,
    borderBottomWidth: 1,
    borderBottomColor: Colores.superficieContenedorBaja,
    alignItems: 'center',
  },
  tituloCabecera: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colores.sobreSuperficie },
  tarjeta: {
    margin: Espaciado.base,
    padding: Espaciado.xl,
    backgroundColor: Colores.blanco,
    borderRadius: Radios.tarjeta,
    borderWidth: 1,
    borderColor: Colores.superficieContenedorAlta,
    gap: Espaciado.sm,
  },
  etiqueta: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colores.sobreSuperficieVariante, marginBottom: 8 },
  tituloTarea: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colores.sobreSuperficie },
  descripcion: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colores.sobreSuperficie, marginVertical: 4 },
  lugar: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colores.primario, marginTop: 8 },
  detalle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colores.sobreSuperficieVariante },
  acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 24, alignItems: 'center' },
  botonCancelar: { padding: 8 },
  textoCancelar: { fontFamily: 'Inter_500Medium', color: Colores.sobreSuperficieVariante },
});
