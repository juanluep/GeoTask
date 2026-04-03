/**
 * ============================================================
 * Pantalla Detalle de Tarea — app/tarea/[id].tsx
 * ============================================================
 *
 * Vista de detalle de una tarea con opciones de:
 * - Ver toda la información de la tarea
 * - Marcar como completada
 * - Editar (campos inline)
 * - Eliminar con confirmación
 *
 * La ruta dinámica [id] es una característica de Expo Router:
 * el segmento entre corchetes captura el valor de la URL.
 * Ejemplo: navegar a "/tarea/abc-123" pone "abc-123" en params.id
 *
 * @version 1.0.0
 * ============================================================
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { UrlTile, Marker, Circle } from 'react-native-maps';
import { useTareaStore, useTareaPorId } from '../../src/stores/useTareaStore';
import { useCategoriaStore } from '../../src/stores/useCategoriaStore';
import { Boton } from '../../src/components/ui/Boton';
import { Indicador } from '../../src/components/ui/Indicador';
import { Colores, Espaciado, Radios, Sombras } from '../../src/config/tema';

const TILE_URL = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

export default function PantallaDetalleTarea() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const enrutador = useRouter();

  // Obtenemos la tarea del store usando el selector derivado
  const tarea = useTareaPorId(id);
  const completarTarea = useTareaStore((s) => s.completarTarea);
  const eliminarTarea = useTareaStore((s) => s.eliminarTarea);
  const cargando = useTareaStore((s) => s.cargando);

  const { obtenerCategoriaPorId, cargarCategorias, categorias } = useCategoriaStore();
  const categoria = tarea ? obtenerCategoriaPorId(tarea.categoriaId) : undefined;

  useEffect(() => {
    if (categorias.length === 0) cargarCategorias();
  }, []);

  if (!tarea) {
    return (
      <SafeAreaView style={estilos.contenedor}>
        <Indicador mensaje="Cargando tarea..." />
      </SafeAreaView>
    );
  }

  // ── Formatear fecha para mostrar ────────────
  function formatearFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // ── Texto del radio de proximidad ───────────
  function formatearRadio(metros: number): string {
    return metros >= 1000 ? `${metros / 1000} km` : `${metros} m`;
  }

  // ── Confirmar completar ──────────────────────
  function confirmarCompletar() {
    Alert.alert(
      '¿Tarea completada?',
      `"${tarea.titulo}" se moverá al historial.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          onPress: async () => {
            await completarTarea(tarea.id);
            enrutador.back();
          },
        },
      ]
    );
  }

  // ── Confirmar eliminar ───────────────────────
  function confirmarEliminar() {
    Alert.alert(
      'Eliminar tarea',
      `¿Seguro que quieres eliminar "${tarea.titulo}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            // Navegamos primero para evitar el flash "Cargando tarea..." mientras
            // Zustand actualiza el store tras borrar de SQLite.
            enrutador.back();
            eliminarTarea(tarea.id);
          },
        },
      ]
    );
  }

  const colorPrioridad =
    tarea.prioridad === 'alta'
      ? Colores.error
      : tarea.prioridad === 'media'
      ? Colores.alerta
      : Colores.exito;

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      {/* Cabecera */}
      <View style={estilos.cabecera}>
        <TouchableOpacity onPress={() => enrutador.back()} style={estilos.botonVolver}>
          <Ionicons name="arrow-back" size={24} color={Colores.sobreSuperficie} />
        </TouchableOpacity>
        <Text style={estilos.tituloCabecera}>Detalle</Text>
        {/* Botón eliminar en cabecera */}
        <TouchableOpacity onPress={confirmarEliminar} style={estilos.botonEliminar}>
          <Ionicons name="trash-outline" size={22} color={Colores.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={estilos.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Título y categoría ── */}
        <View style={estilos.seccionTitulo}>
          {categoria && (
            <View style={[estilos.badgeCategoria, { backgroundColor: categoria.color + '20' }]}>
              <MaterialCommunityIcons
                name={categoria.icono as any}
                size={14}
                color={categoria.color}
              />
              <Text style={[estilos.textoCategoria, { color: categoria.color }]}>
                {categoria.nombre}
              </Text>
            </View>
          )}
          <Text style={estilos.titulo}>{tarea.titulo}</Text>
          {tarea.descripcion ? (
            <Text style={estilos.descripcion}>{tarea.descripcion}</Text>
          ) : null}
        </View>

        {/* ── Mapa con la ubicación de la tarea ── */}
        {tarea.latitud !== 0 && tarea.longitud !== 0 ? (
          <MapView
            style={estilos.mapaDetalle}
            initialRegion={{
              latitude: tarea.latitud,
              longitude: tarea.longitud,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }}
            mapType="none"
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <UrlTile urlTemplate={TILE_URL} maximumZ={19} flipY={false} zIndex={0} tileSize={256} />
            {tarea.geocercaActiva && (
              <Circle
                center={{ latitude: tarea.latitud, longitude: tarea.longitud }}
                radius={tarea.radioProximidad}
                fillColor={(categoria?.color ?? Colores.primario) + '20'}
                strokeColor={(categoria?.color ?? Colores.primario) + '60'}
                strokeWidth={1.5}
              />
            )}
            <Marker coordinate={{ latitude: tarea.latitud, longitude: tarea.longitud }}>
              <View style={[estilos.pinDetalle, { backgroundColor: categoria?.color ?? Colores.primario }]}>
                {categoria ? (
                  <MaterialCommunityIcons name={categoria.icono as any} size={14} color={Colores.blanco} />
                ) : (
                  <Ionicons name="location" size={14} color={Colores.blanco} />
                )}
              </View>
            </Marker>
          </MapView>
        ) : (
          <View style={estilos.mapaPlaceholder}>
            <Ionicons name="location-outline" size={32} color={Colores.sobreSuperficieVariante} />
            <Text style={estilos.textoMapa}>Sin coordenadas</Text>
          </View>
        )}

        {/* ── Filas de información ── */}
        <View style={estilos.tarjetaInfo}>
          <FilaInfo
            icono="location-outline"
            etiqueta="Lugar"
            valor={tarea.nombreLugar || 'Sin nombre de lugar'}
            subtexto={tarea.direccion}
          />
          <Separador />
          <FilaInfo
            icono="radio-outline"
            etiqueta="Radio de aviso"
            valor={formatearRadio(tarea.radioProximidad)}
          />
          <Separador />
          <FilaInfo
            icono="flag-outline"
            etiqueta="Prioridad"
            valor={tarea.prioridad.charAt(0).toUpperCase() + tarea.prioridad.slice(1)}
            colorValor={colorPrioridad}
          />
          <Separador />
          <FilaInfo
            icono="calendar-outline"
            etiqueta="Creada"
            valor={formatearFecha(tarea.fechaCreacion)}
          />
          {tarea.fechaLimite && (
            <>
              <Separador />
              <FilaInfo
                icono="time-outline"
                etiqueta="Fecha límite"
                valor={formatearFecha(tarea.fechaLimite)}
                colorValor={Colores.error}
              />
            </>
          )}
          <Separador />
          <FilaInfo
            icono="notifications-outline"
            etiqueta="Geocerca"
            valor={tarea.geocercaActiva ? 'Activa' : 'Pausada'}
            colorValor={tarea.geocercaActiva ? Colores.exito : Colores.sobreSuperficieVariante}
          />
        </View>

        {/* ── Botón completar ── */}
        {!tarea.completada && (
          <Boton
            etiqueta="✓ Marcar como completada"
            alPresionar={confirmarCompletar}
            variante="primario"
            cargando={cargando}
            estilo={{ marginTop: Espaciado.md }}
          />
        )}

        {tarea.completada && (
          <View style={estilos.badgeCompletada}>
            <Ionicons name="checkmark-circle" size={20} color={Colores.exito} />
            <Text style={estilos.textoCompletada}>
              Completada el {formatearFecha(tarea.fechaCompletada!)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Subcomponentes auxiliares ──────────────────

function FilaInfo({
  icono,
  etiqueta,
  valor,
  subtexto,
  colorValor,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  valor: string;
  subtexto?: string;
  colorValor?: string;
}) {
  return (
    <View style={estilosAux.filaInfo}>
      <View style={estilosAux.iconoFila}>
        <Ionicons name={icono} size={18} color={Colores.primario} />
      </View>
      <View style={estilosAux.textosFila}>
        <Text style={estilosAux.etiquetaFila}>{etiqueta}</Text>
        <Text style={[estilosAux.valorFila, colorValor && { color: colorValor }]}>
          {valor}
        </Text>
        {subtexto ? (
          <Text style={estilosAux.subtextoFila}>{subtexto}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Separador() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: Colores.superficieContenedorBaja,
        marginVertical: Espaciado.sm,
      }}
    />
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colores.superficie },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Espaciado.base,
    paddingVertical: Espaciado.md,
    borderBottomWidth: 1,
    borderBottomColor: Colores.superficieContenedorBaja,
  },
  botonVolver: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tituloCabecera: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colores.sobreSuperficie },
  botonEliminar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Espaciado.base, gap: Espaciado.base, paddingBottom: Espaciado.xxxl },
  seccionTitulo: { gap: Espaciado.sm },
  badgeCategoria: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Espaciado.xs,
    paddingHorizontal: Espaciado.md,
    paddingVertical: 4,
    borderRadius: Radios.completo,
  },
  textoCategoria: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  titulo: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colores.sobreSuperficie, lineHeight: 30 },
  descripcion: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colores.sobreSuperficieVariante, lineHeight: 22 },
  mapaDetalle: {
    height: 160,
    borderRadius: Radios.tarjeta,
    overflow: 'hidden',
  },
  pinDetalle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colores.blanco,
    elevation: 3,
  },
  mapaPlaceholder: {
    height: 160,
    backgroundColor: Colores.superficieContenedor,
    borderRadius: Radios.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaciado.sm,
  },
  textoMapa: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colores.sobreSuperficieVariante },
  tarjetaInfo: {
    backgroundColor: Colores.blanco,
    borderRadius: Radios.tarjeta,
    padding: Espaciado.base,
    ...Sombras.sutil,
  },
  badgeCompletada: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaciado.sm,
    padding: Espaciado.base,
    backgroundColor: Colores.exito + '15',
    borderRadius: Radios.tarjeta,
  },
  textoCompletada: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colores.exito },
});

const estilosAux = StyleSheet.create({
  filaInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaciado.md, paddingVertical: Espaciado.xs },
  iconoFila: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colores.primarioContenedor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosFila: { flex: 1 },
  etiquetaFila: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colores.sobreSuperficieVariante },
  valorFila: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colores.sobreSuperficie, marginTop: 2 },
  subtextoFila: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colores.sobreSuperficieVariante, marginTop: 2 },
});
