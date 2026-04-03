/**
 * ============================================================
 * 🔍 Pantalla Buscar — app/(tabs)/buscar.tsx
 * ============================================================
 *
 * Permite al usuario consultar qué tareas tiene pendientes en
 * una zona concreta antes de desplazarse.
 *
 * Flujo:
 * 1. Usuario escribe una zona ("Nervión", "Centro", "Triana")
 * 2. Photon API devuelve sugerencias con sus coordenadas
 * 3. Al seleccionar una zona, filtramos las tareas dentro de ella
 * 4. Se muestran los resultados con filtros adicionales (categoría, estado)
 *
 * APIs utilizadas:
 * - Photon (Komoot): autocompletado de zonas — gratuito, sin API key
 * - Nominatim: geocoding inverso si el usuario toca el mapa
 *
 * @version 4.0.0 (Fase 4)
 * ============================================================
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTareaStore } from '../../src/stores/useTareaStore';
import { useCategoriaStore } from '../../src/stores/useCategoriaStore';
import { useUbicacion } from '../../src/hooks/useUbicacion';
import { buscarLugares } from '../../src/services/lugares.servicio';
import { Colores, Espaciado, Radios, Sombras } from '../../src/config/tema';
import type { ResultadoBusquedaLugar } from '../../src/models/ubicacion.modelo';
import type { Tarea } from '../../src/models/tarea.modelo';
import type { Categoria } from '../../src/models/categoria.modelo';

/** Radio de búsqueda en grados de latitud/longitud (~5km) */
const RADIO_BUSQUEDA_GRADOS = 0.045;

type FiltroEstado = 'todas' | 'pendientes' | 'completadas';

export default function PantallaBuscar() {
  const enrutador = useRouter();
  const { tareas, tareasCompletadas, cargarTareas, cargarHistorial } = useTareaStore();
  const { categorias, cargarCategorias } = useCategoriaStore();
  const ubicacion = useUbicacion();

  // ── Estado de búsqueda ─────────────────────
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<ResultadoBusquedaLugar[]>([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<ResultadoBusquedaLugar | null>(null);
  const [buscando, setBuscando] = useState(false);

  // ── Filtros ────────────────────────────────
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('pendientes');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cargarTareas();
    cargarHistorial();
    cargarCategorias();
  }, []);

  // Debounce de 400ms para la búsqueda de zonas
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (textoBusqueda.length < 2) {
      setSugerencias([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      const resultados = await buscarLugares(
        textoBusqueda,
        5,
        ubicacion.coordenadas?.latitud,
        ubicacion.coordenadas?.longitud
      );
      setSugerencias(resultados);
      setBuscando(false);
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [textoBusqueda]);

  function seleccionarZona(zona: ResultadoBusquedaLugar) {
    setZonaSeleccionada(zona);
    setTextoBusqueda(zona.nombre);
    setSugerencias([]);
  }

  function limpiarBusqueda() {
    setTextoBusqueda('');
    setSugerencias([]);
    setZonaSeleccionada(null);
  }

  // ── Filtrado de tareas por zona ────────────
  function tareaEnZona(tarea: Tarea, zona: ResultadoBusquedaLugar): boolean {
    return (
      Math.abs(tarea.latitud - zona.coordenadas.latitud) < RADIO_BUSQUEDA_GRADOS &&
      Math.abs(tarea.longitud - zona.coordenadas.longitud) < RADIO_BUSQUEDA_GRADOS
    );
  }

  // Combinar todas las tareas según el filtro de estado
  const todasLasTareas =
    filtroEstado === 'pendientes'
      ? tareas
      : filtroEstado === 'completadas'
      ? tareasCompletadas
      : [...tareas, ...tareasCompletadas];

  // Aplicar filtros
  const tareasFiltradas = todasLasTareas.filter((t) => {
    if (zonaSeleccionada && !tareaEnZona(t, zonaSeleccionada)) return false;
    if (filtroCategoria && t.categoriaId !== filtroCategoria) return false;
    return true;
  });

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      {/* Cabecera */}
      <View style={estilos.cabecera}>
        <Text style={estilos.tituloCabecera}>Buscar por zona</Text>
      </View>

      {/* Barra de búsqueda */}
      <View style={[estilos.contenedorBusqueda, { zIndex: 20 }]}>
        <View style={estilos.campoBusqueda}>
          <Ionicons name="search-outline" size={20} color={Colores.sobreSuperficieVariante} />
          <TextInput
            style={estilos.inputBusqueda}
            value={textoBusqueda}
            onChangeText={setTextoBusqueda}
            placeholder="¿Qué zona quieres consultar?"
            placeholderTextColor={Colores.sobreSuperficieVariante}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {buscando && <ActivityIndicator size="small" color={Colores.primario} />}
          {textoBusqueda.length > 0 && !buscando && (
            <TouchableOpacity onPress={limpiarBusqueda}>
              <Ionicons name="close-circle" size={18} color={Colores.sobreSuperficieVariante} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown de sugerencias */}
        {sugerencias.length > 0 && (
          <View style={estilos.dropdown}>
            {sugerencias.map((s, i) => (
              <TouchableOpacity
                key={`${s.osmId}-${i}`}
                style={[estilos.filaSugerencia, i < sugerencias.length - 1 && estilos.separador]}
                onPress={() => seleccionarZona(s)}
                activeOpacity={0.7}
              >
                <View style={estilos.iconoSugerencia}>
                  <Ionicons name="location-outline" size={16} color={Colores.primario} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nombreSugerencia} numberOfLines={1}>{s.nombre}</Text>
                  <Text style={estilos.ciudadSugerencia} numberOfLines={1}>
                    {[s.componentes.barrio, s.componentes.ciudad].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Badge de zona seleccionada */}
      {zonaSeleccionada && (
        <View style={estilos.badgeZona}>
          <Ionicons name="location" size={14} color={Colores.primario} />
          <Text style={estilos.textoBadgeZona} numberOfLines={1}>
            {zonaSeleccionada.nombre} · radio ~5km
          </Text>
          <TouchableOpacity onPress={limpiarBusqueda}>
            <Ionicons name="close" size={16} color={Colores.sobreSuperficieVariante} />
          </TouchableOpacity>
        </View>
      )}

      {/* Filtros de categoría */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.chipsFiltro}
        style={{ maxHeight: 48, marginTop: Espaciado.sm }}
      >
        <TouchableOpacity
          style={[estilos.chip, !filtroCategoria && estilos.chipActivo]}
          onPress={() => setFiltroCategoria(null)}
        >
          <Text style={[estilos.textoChip, !filtroCategoria && estilos.textoChipActivo]}>Todas</Text>
        </TouchableOpacity>
        {categorias.map((cat) => {
          const activa = filtroCategoria === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[estilos.chip, activa && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => setFiltroCategoria(activa ? null : cat.id)}
            >
              <Text style={[estilos.textoChip, activa && { color: Colores.blanco }]}>{cat.nombre}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filtro de estado */}
      <View style={estilos.filtroEstado}>
        {(['pendientes', 'completadas', 'todas'] as FiltroEstado[]).map((estado) => (
          <TouchableOpacity
            key={estado}
            style={[estilos.chipEstado, filtroEstado === estado && estilos.chipEstadoActivo]}
            onPress={() => setFiltroEstado(estado)}
          >
            <Text style={[estilos.textoChipEstado, filtroEstado === estado && estilos.textoChipEstadoActivo]}>
              {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Resultados */}
      {tareasFiltradas.length === 0 ? (
        zonaSeleccionada
          ? <EstadoSinResultados zona={zonaSeleccionada.nombre} />
          : <EstadoVacio />
      ) : (
        <FlatList
          data={tareasFiltradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={estilos.listaContenido}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={estilos.contador}>
              {zonaSeleccionada
                ? `${tareasFiltradas.length} ${tareasFiltradas.length === 1 ? 'tarea' : 'tareas'} en esta zona`
                : `${tareasFiltradas.length} ${tareasFiltradas.length === 1 ? 'tarea' : 'tareas'} en total`}
            </Text>
          }
          renderItem={({ item }) => {
            const cat = categorias.find((c) => c.id === item.categoriaId);
            return (
              <FilaResultado
                tarea={item}
                categoria={cat}
                onPresionar={() => enrutador.push(`/tarea/${item.id}`)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Subcomponentes ────────────────────────────

function FilaResultado({
  tarea,
  categoria,
  onPresionar,
}: {
  tarea: Tarea;
  categoria?: Categoria;
  onPresionar: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPresionar} style={estilos.filaResultado} activeOpacity={0.8}>
      <View style={[estilos.iconoResultado, { backgroundColor: (categoria?.color ?? Colores.primario) + '20' }]}>
        {categoria ? (
          <MaterialCommunityIcons name={categoria.icono as any} size={20} color={categoria.color} />
        ) : (
          <Ionicons name="location-outline" size={20} color={Colores.primario} />
        )}
      </View>
      <View style={estilos.infoResultado}>
        <Text style={estilos.tituloResultado} numberOfLines={1}>{tarea.titulo}</Text>
        <Text style={estilos.lugarResultado} numberOfLines={1}>{tarea.nombreLugar || tarea.direccion}</Text>
        {tarea.completada && (
          <Text style={estilos.badgeCompletada}>✓ Completada</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colores.sobreSuperficieVariante} />
    </TouchableOpacity>
  );
}

function EstadoVacio() {
  return (
    <View style={estilos.estadoCentral}>
      <Text style={{ fontSize: 48 }}>📋</Text>
      <Text style={estilos.tituloEstado}>Sin tareas</Text>
      <Text style={estilos.subtituloEstado}>
        No tienes tareas en este estado. Busca una zona para filtrar por ubicación.
      </Text>
    </View>
  );
}

function EstadoSinResultados({ zona }: { zona: string }) {
  return (
    <View style={estilos.estadoCentral}>
      <Text style={{ fontSize: 48 }}>📭</Text>
      <Text style={estilos.tituloEstado}>Sin tareas en {zona}</Text>
      <Text style={estilos.subtituloEstado}>No tienes mandados pendientes en esta zona.</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colores.superficie },
  cabecera: { paddingHorizontal: Espaciado.base, paddingTop: Espaciado.md, paddingBottom: Espaciado.sm },
  tituloCabecera: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colores.sobreSuperficie },
  // Búsqueda
  contenedorBusqueda: { paddingHorizontal: Espaciado.base, position: 'relative' },
  campoBusqueda: {
    flexDirection: 'row', alignItems: 'center', gap: Espaciado.sm,
    backgroundColor: Colores.blanco, borderRadius: Radios.boton,
    paddingHorizontal: Espaciado.base, height: 52, ...Sombras.sutil,
  },
  inputBusqueda: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colores.sobreSuperficie },
  dropdown: {
    position: 'absolute', top: 56, left: Espaciado.base, right: Espaciado.base,
    backgroundColor: Colores.blanco, borderRadius: Radios.tarjeta, ...Sombras.modal, overflow: 'hidden',
  },
  filaSugerencia: {
    flexDirection: 'row', alignItems: 'center', gap: Espaciado.md,
    paddingHorizontal: Espaciado.base, paddingVertical: Espaciado.md,
  },
  separador: { borderBottomWidth: 1, borderBottomColor: Colores.superficieContenedorBaja },
  iconoSugerencia: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colores.primarioContenedor, alignItems: 'center', justifyContent: 'center',
  },
  nombreSugerencia: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colores.sobreSuperficie },
  ciudadSugerencia: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colores.sobreSuperficieVariante },
  // Badge zona
  badgeZona: {
    flexDirection: 'row', alignItems: 'center', gap: Espaciado.xs,
    marginHorizontal: Espaciado.base, marginTop: Espaciado.sm,
    backgroundColor: Colores.primarioContenedor, borderRadius: Radios.completo,
    paddingHorizontal: Espaciado.md, paddingVertical: Espaciado.xs,
  },
  textoBadgeZona: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colores.primario, flex: 1 },
  // Filtros
  chipsFiltro: { paddingHorizontal: Espaciado.base, gap: Espaciado.sm, alignItems: 'center' },
  chip: {
    paddingHorizontal: Espaciado.base, paddingVertical: Espaciado.sm,
    borderRadius: Radios.completo, backgroundColor: Colores.blanco,
    borderWidth: 1, borderColor: Colores.superficieContenedorAlta,
  },
  chipActivo: { backgroundColor: Colores.primario, borderColor: Colores.primario },
  textoChip: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colores.sobreSuperficieVariante },
  textoChipActivo: { color: Colores.blanco },
  filtroEstado: { flexDirection: 'row', paddingHorizontal: Espaciado.base, gap: Espaciado.sm, marginTop: Espaciado.sm },
  chipEstado: {
    paddingHorizontal: Espaciado.md, paddingVertical: 6,
    borderRadius: Radios.completo, backgroundColor: Colores.superficieContenedor,
  },
  chipEstadoActivo: { backgroundColor: Colores.sobreSuperficie },
  textoChipEstado: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colores.sobreSuperficieVariante },
  textoChipEstadoActivo: { color: Colores.blanco },
  // Resultados
  listaContenido: { padding: Espaciado.base, gap: Espaciado.md, paddingBottom: Espaciado.xxxl },
  contador: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colores.sobreSuperficieVariante, marginBottom: Espaciado.xs },
  filaResultado: {
    flexDirection: 'row', alignItems: 'center', gap: Espaciado.md,
    backgroundColor: Colores.blanco, borderRadius: Radios.tarjeta,
    padding: Espaciado.base, ...Sombras.sutil,
  },
  iconoResultado: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoResultado: { flex: 1, gap: 2 },
  tituloResultado: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colores.sobreSuperficie },
  lugarResultado: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colores.sobreSuperficieVariante },
  badgeCompletada: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colores.exito },
  // Estados
  estadoCentral: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Espaciado.xxl, gap: Espaciado.md },
  tituloEstado: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colores.sobreSuperficie, textAlign: 'center' },
  subtituloEstado: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colores.sobreSuperficieVariante, textAlign: 'center', lineHeight: 20 },
});
