/**
 * ============================================================
 * 🗺️ Pantalla Mapa — app/(tabs)/mapa.tsx
 * ============================================================
 *
 * Vista del mapa interactivo con:
 * - Tiles de OpenStreetMap (gratuito, sin API key) via UrlTile
 * - Ubicación del usuario en tiempo real
 * - Marcadores de tareas por color de categoría
 * - Círculos semi-transparentes para visualizar el radio de geocerca
 * - Callout al tocar un marcador con botón "Ver detalle"
 * - Barra de búsqueda superior
 * - Bottom sheet con tareas de la zona visible
 * - Botón para recentrar en la ubicación actual
 *
 * Tiles OSM: https://tile.openstreetmap.org/{z}/{x}/{y}.png
 * Licencia: © OpenStreetMap contributors (ODbL)
 * Uso responsable: max ~1 req/tile, no borrar caché agresivamente
 *
 * @version 3.0.0 (Fase 3 — mapa real)
 * ============================================================
 */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { UrlTile, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTareaStore } from '../../src/stores/useTareaStore';
import { useCategoriaStore } from '../../src/stores/useCategoriaStore';
import { useUbicacion } from '../../src/hooks/useUbicacion';
import { MarcadorTarea } from '../../src/components/mapa/MarcadorTarea';
import { Colores, Espaciado, Radios, Sombras } from '../../src/config/tema';
import { geocodingInverso } from '../../src/services/lugares.servicio';
import type { Tarea } from '../../src/models/tarea.modelo';

const { height: ALTO_PANTALLA } = Dimensions.get('window');

// CartoDB Voyager: estilo similar a OSM pero sin la política de bloqueo por User-Agent.
// OSM bloquea UrlTile porque no puede enviar cabecera User-Agent personalizada.
// CartoDB permite uso libre en apps de desarrollo/producción.
const OSM_TILE_URL = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

/** Región inicial centrada en España (se actualizará con la ubicación real) */
const REGION_INICIAL: Region = {
  latitude: 40.4168,
  longitude: -3.7038,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function PantallaMapa() {
  const enrutador = useRouter();
  const refMapa = useRef<MapView>(null);

  // ── Datos ──────────────────────────────────
  const { tareas, cargarTareas } = useTareaStore();
  const { categorias, cargarCategorias } = useCategoriaStore();
  const ubicacion = useUbicacion();

  // ── Estado local ───────────────────────────
  const [regionVisible, setRegionVisible] = useState<Region>(REGION_INICIAL);
  const [tareasMapa, setTareasMapa] = useState<Tarea[]>([]);
  const [geocodificando, setGeocodificando] = useState(false);

  useEffect(() => {
    cargarTareas();
    cargarCategorias();
  }, []);

  // Actualizar lista de tareas en el mapa cuando cambian las tareas
  useEffect(() => {
    // Solo mostrar tareas que tienen coordenadas válidas
    const conCoordenadas = tareas.filter(
      (t) => t.latitud !== 0 && t.longitud !== 0
    );
    setTareasMapa(conCoordenadas);
  }, [tareas]);

  // Cuando obtenemos la ubicación del usuario, centramos el mapa en ella
  useEffect(() => {
    if (ubicacion.coordenadas && refMapa.current) {
      refMapa.current.animateToRegion(
        {
          latitude: ubicacion.coordenadas.latitud,
          longitude: ubicacion.coordenadas.longitud,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800 // duración de la animación en ms
      );
    }
  }, [ubicacion.coordenadas]);

  /** Recentra el mapa en la ubicación actual del usuario */
  function centrarEnUsuario() {
    if (!ubicacion.coordenadas) return;
    refMapa.current?.animateToRegion(
      {
        latitude: ubicacion.coordenadas.latitud,
        longitude: ubicacion.coordenadas.longitud,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  }

  /** Calcula las tareas visibles en la región actual del mapa */
  function calcularTareasEnZona(region: Region): Tarea[] {
    return tareasMapa.filter((t) => {
      const dentroLat =
        Math.abs(t.latitud - region.latitude) < region.latitudeDelta;
      const dentroLon =
        Math.abs(t.longitud - region.longitude) < region.longitudeDelta;
      return dentroLat && dentroLon;
    });
  }

  /**
   * Al mantener pulsado el mapa, hace geocoding inverso de las coordenadas
   * y abre el formulario de nueva tarea con la ubicación pre-rellenada.
   */
  async function manejarLongPress(evento: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) {
    if (geocodificando) return;
    setGeocodificando(true);
    const { latitude, longitude } = evento.nativeEvent.coordinate;
    const resultado = await geocodingInverso(latitude, longitude);
    setGeocodificando(false);
    enrutador.push({
      pathname: '/(tabs)/nueva',
      params: {
        lat: String(latitude),
        lon: String(longitude),
        nombre: resultado?.nombre ?? 'Ubicación seleccionada',
        direccion: resultado?.direccionCompleta ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        osmId: resultado?.osmId ?? '',
      },
    });
  }

  const tareasEnZona = calcularTareasEnZona(regionVisible);

  return (
    <View style={estilos.contenedor}>
      {/* ── MapView principal ── */}
      <MapView
        ref={refMapa}
        style={StyleSheet.absoluteFillObject}
        initialRegion={REGION_INICIAL}
        // showsUserLocation: muestra el punto azul de ubicación del usuario
        // usando la localización del sistema (más eficiente que un marcador propio)
        showsUserLocation={ubicacion.disponible}
        showsMyLocationButton={false} // Usamos nuestro propio botón de recentrar
        // onRegionChangeComplete: se llama cuando el usuario para de mover el mapa
        // Calculamos las tareas en zona aquí (no en onRegionChange para mejor rendimiento)
        onRegionChangeComplete={(region) => setRegionVisible(region)}
        onLongPress={manejarLongPress}
        mapType="none" // "none" = sin mapa base (cargamos nuestros tiles OSM)
        // rotateEnabled: false simplifica la orientación del mapa para el usuario
        rotateEnabled={false}
      >
        {/*
          UrlTile carga los tiles de imagen del mapa desde OpenStreetMap.
          zIndex: 0 → los tiles van debajo de los marcadores.
          maximumZ: 19 → zoom máximo soportado por OSM (evita pedir tiles inexistentes).
          flipY: false → las coordenadas Y de OSM no están invertidas (estándar TMS).
        */}
        <UrlTile
          urlTemplate={OSM_TILE_URL}
          maximumZ={19}
          flipY={false}
          zIndex={0}
          // tileSize: los tiles OSM son 256x256 píxeles
          tileSize={256}
        />

        {/* Marcadores de tareas */}
        {tareasMapa.map((tarea) => (
          <MarcadorTarea
            key={tarea.id}
            tarea={tarea}
            categoria={categorias.find((c) => c.id === tarea.categoriaId)}
            mostrarRadio={true}
            alVerDetalle={(id) => enrutador.push(`/tarea/${id}`)}
          />
        ))}
      </MapView>

      {/* ── Cabecera flotante sobre el mapa ── */}
      <SafeAreaView style={estilos.cabeceraFlotante} edges={['top']}>
        <View style={estilos.filaCabecera}>
          <Text style={estilos.logoMapa}>
            <Text style={{ color: Colores.primario }}>●</Text> GeoTask
          </Text>
          <TouchableOpacity style={estilos.botonCabecera}>
            <Ionicons name="notifications-outline" size={20} color={Colores.sobreSuperficie} />
          </TouchableOpacity>
        </View>

        {/* Barra de búsqueda (decorativa en Fase 3 — funcional en Fase 4) */}
        <TouchableOpacity
          style={estilos.barraBusqueda}
          onPress={() => enrutador.push('/(tabs)/buscar')}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={18} color={Colores.sobreSuperficieVariante} />
          <Text style={estilos.placeholderBusqueda}>Buscar zona o tarea...</Text>
          <View style={estilos.botonFiltroMapa}>
            <Ionicons name="options-outline" size={18} color={Colores.primario} />
          </View>
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Indicador de geocodificación al hacer long-press ── */}
      {geocodificando && (
        <View style={estilos.bannerGeocodificando}>
          <ActivityIndicator size="small" color={Colores.primario} />
          <Text style={estilos.textoBannerGeo}>Obteniendo dirección...</Text>
        </View>
      )}

      {/* ── Botón recentrar en ubicación ── */}
      <TouchableOpacity
        style={[
          estilos.botonRecentrar,
          !ubicacion.disponible && { opacity: 0.5 },
        ]}
        onPress={centrarEnUsuario}
        disabled={!ubicacion.disponible}
      >
        <Ionicons name="locate" size={22} color={Colores.primario} />
      </TouchableOpacity>

      {/* ── Bottom sheet: tareas en la zona visible ── */}
      <View style={estilos.bottomSheet}>
        <View style={estilos.asaBottomSheet} />

        <View style={estilos.cabeceraSheet}>
          <View>
            <Text style={estilos.tituloSheet}>
              {tareasEnZona.length === 0
                ? 'Sin tareas en esta zona'
                : `${tareasEnZona.length} ${tareasEnZona.length === 1 ? 'tarea' : 'tareas'} en esta zona`}
            </Text>
            <Text style={estilos.subtituloSheet}>
              Radio visible: ~{Math.round(regionVisible.latitudeDelta * 111)}km • Mantén pulsado el mapa para añadir
            </Text>
          </View>
          {tareasEnZona.length > 0 && (
            <Text style={estilos.badgeZona}>ZONA</Text>
          )}
        </View>

        {/* Lista horizontal de tarjetas */}
        {tareasEnZona.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.listaHorizontal}
          >
            {tareasEnZona.slice(0, 6).map((tarea) => {
              const cat = categorias.find((c) => c.id === tarea.categoriaId);
              return (
                <TouchableOpacity
                  key={tarea.id}
                  style={estilos.tarjetaHorizontal}
                  onPress={() => enrutador.push(`/tarea/${tarea.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={[estilos.iconoTarjetaH, { backgroundColor: (cat?.color ?? Colores.primario) + '20' }]}>
                    {cat ? (
                      <MaterialCommunityIcons name={cat.icono as any} size={18} color={cat.color} />
                    ) : (
                      <Ionicons name="location" size={18} color={Colores.primario} />
                    )}
                  </View>
                  <Text style={estilos.tituloTarjetaH} numberOfLines={2}>{tarea.titulo}</Text>
                  {tarea.nombreLugar && (
                    <Text style={estilos.lugarTarjetaH} numberOfLines={1}>{tarea.nombreLugar}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <TouchableOpacity
            style={estilos.botonNuevaEnZona}
            onPress={() => enrutador.push('/(tabs)/nueva')}
          >
            <Ionicons name="add" size={18} color={Colores.primario} />
            <Text style={estilos.textoNuevaEnZona}>Añadir tarea aquí</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  // ── Cabecera flotante ──
  cabeceraFlotante: {
    paddingHorizontal: Espaciado.base,
    gap: Espaciado.sm,
  },
  filaCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Espaciado.sm,
  },
  logoMapa: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colores.blanco,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  botonCabecera: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    ...Sombras.sutil,
  },
  barraBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colores.blanco,
    borderRadius: Radios.boton,
    paddingHorizontal: Espaciado.base,
    height: 48,
    gap: Espaciado.sm,
    ...Sombras.sutil,
  },
  placeholderBusqueda: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colores.sobreSuperficieVariante,
  },
  botonFiltroMapa: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colores.primarioContenedor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Banner geocodificando ──
  bannerGeocodificando: {
    position: 'absolute',
    top: 160,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaciado.sm,
    backgroundColor: Colores.blanco,
    borderRadius: Radios.boton,
    paddingHorizontal: Espaciado.base,
    paddingVertical: Espaciado.sm,
    ...Sombras.sutil,
  },
  textoBannerGeo: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colores.sobreSuperficie,
  },
  // ── Botón recentrar ──
  botonRecentrar: {
    position: 'absolute',
    right: Espaciado.base,
    bottom: 220,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    ...Sombras.sutil,
  },
  // ── Bottom Sheet ──
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colores.blanco,
    borderTopLeftRadius: Radios.modal,
    borderTopRightRadius: Radios.modal,
    paddingHorizontal: Espaciado.base,
    paddingBottom: Espaciado.xxl,
    paddingTop: Espaciado.md,
    ...Sombras.modal,
  },
  asaBottomSheet: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colores.superficieContenedorAlta,
    alignSelf: 'center',
    marginBottom: Espaciado.base,
  },
  cabeceraSheet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Espaciado.base,
  },
  tituloSheet: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: Colores.sobreSuperficie,
  },
  subtituloSheet: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.sobreSuperficieVariante,
    marginTop: 2,
  },
  badgeZona: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colores.secundario,
    letterSpacing: 1,
  },
  // ── Lista horizontal ──
  listaHorizontal: {
    gap: Espaciado.md,
    paddingBottom: Espaciado.xs,
  },
  tarjetaHorizontal: {
    width: 140,
    backgroundColor: Colores.superficie,
    borderRadius: Radios.tarjeta,
    padding: Espaciado.md,
    gap: Espaciado.xs,
  },
  iconoTarjetaH: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloTarjetaH: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colores.sobreSuperficie,
    lineHeight: 18,
  },
  lugarTarjetaH: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colores.sobreSuperficieVariante,
  },
  botonNuevaEnZona: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaciado.sm,
    paddingVertical: Espaciado.md,
    backgroundColor: Colores.primarioContenedor,
    borderRadius: Radios.boton,
  },
  textoNuevaEnZona: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colores.primario,
  },
});
