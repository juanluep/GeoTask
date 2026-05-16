/**
 * ============================================================
 * Pantalla Inicio — app/(tabs)/index.tsx
 * ============================================================
 *
 * Pantalla principal conectada al store Zustand.
 * Muestra las tareas reales de SQLite con filtros funcionales.
 *
 * @version 2.0.0 (Fase 2 — datos reales)
 * ============================================================
 */

import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTareaStore, useTareasFiltradas } from '../../src/stores/useTareaStore';
import { useCategoriaStore } from '../../src/stores/useCategoriaStore';
import { useListaStore } from '../../src/stores/useListaStore';
import { Indicador } from '../../src/components/ui/Indicador';
import { Colores, Espaciado, Radios, Sombras } from '../../src/config/tema';
import type { Tarea } from '../../src/models/tarea.modelo';
import type { Categoria } from '../../src/models/categoria.modelo';

export default function PantallaInicio() {
  const enrutador = useRouter();
  const { cargarTareas, completarTarea, cargando, filtroCategoria, cambiarFiltroCategoria } = useTareaStore();
  const tareasFiltradas = useTareasFiltradas();
  const { categorias, cargarCategorias } = useCategoriaStore();
  const { listas, tareasLista, listaActivaId, activarLista, cargarListas, cargarTareasLista, cargando: cargandoListas } = useListaStore();

  // Cargamos datos al montar la pantalla
  useEffect(() => {
    cargarTareas();
    cargarCategorias();
    cargarListas();
  }, []);

  // Cuando se activa una lista, cargar sus tareas
  useEffect(() => {
    if (listaActivaId) {
      cargarTareasLista(listaActivaId);
    }
  }, [listaActivaId]);

  // Las tareas a mostrar dependen de si hay lista activa
  const tareasActuales = listaActivaId ? tareasLista : tareasFiltradas;

  // Estado de carga: si estamos en una lista compartida, usamos el cargando del
  // store de listas; si no, el del store de tareas. Esto evita que al entrar
  // en una lista se muestre "Sin tareas" mientras carga, o que se quede
  // en "Cargando" indefinidamente si el store principal se bloquea.
  const estaCargando = listaActivaId ? cargandoListas : cargando;

  const recargar = useCallback(() => {
    if (listaActivaId) {
      cargarTareasLista(listaActivaId);
    } else {
      cargarTareas();
    }
  }, [listaActivaId]);

  function manejarCompletar(tarea: Tarea) {
    Alert.alert(
      '¿Completada?',
      `¿Marcar "${tarea.titulo}" como completada?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí', onPress: () => completarTarea(tarea.id) },
      ]
    );
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      {/* Cabecera */}
      <View style={estilos.cabecera}>
        <View>
          <Text style={estilos.saludo}>HOLA</Text>
          <Text style={estilos.nombreApp}>GeoTask</Text>
        </View>
        <View style={estilos.iconosCabecera}>
          {/* La campanilla abrirá el centro de notificaciones en una versión futura.
              Por ahora muestra una breve explicación al usuario. */}
          <TouchableOpacity
            style={estilos.botonIcono}
            onPress={() =>
              Alert.alert(
                'Centro de notificaciones',
                'Aquí verás el historial de alertas de proximidad cuando estés cerca de un lugar con tareas pendientes.\n\nEsta función estará disponible en la Fase 3.',
                [{ text: 'Entendido' }]
              )
            }
          >
            <Ionicons name="notifications-outline" size={22} color={Colores.sobreSuperficie} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner de resumen */}
      <View style={estilos.bannerResumen}>
        <View>
          <Text style={estilos.numeroBanner}>
            {tareasActuales.length} {tareasActuales.length === 1 ? 'tarea' : 'tareas'}
          </Text>
          <Text style={estilos.subtextoBanner}>
            {listaActivaId ? listas.find((l) => l.id === listaActivaId)?.nombre ?? 'lista' : 'pendientes'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => enrutador.push('/(tabs)/nueva')}
          style={estilos.botonNuevaRapida}
        >
          <Ionicons name="add" size={20} color={Colores.primario} />
          <Text style={estilos.textoNuevaRapida}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Contenedor de Filtros (Altura estable) */}
      <View style={estilos.seccionFiltros}>
        {!listaActivaId && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.contenedorChipsFiltro}
            style={{ marginTop: Espaciado.sm }}
          >
            {/* Chip "Todas" */}
            <TouchableOpacity
              style={[estilos.chipFiltro, !filtroCategoria && estilos.chipFiltroActivo]}
              onPress={() => cambiarFiltroCategoria(null)}
            >
              <Text style={[estilos.textoChipFiltro, !filtroCategoria && estilos.textoChipFiltroActivo]}>
                Todas
              </Text>
            </TouchableOpacity>

            {/* Chips de categorías */}
            {categorias.map((cat) => {
              const activa = filtroCategoria === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[estilos.chipFiltro, activa && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => cambiarFiltroCategoria(activa ? null : cat.id)}
                >
                  <Text style={[estilos.textoChipFiltro, activa && { color: Colores.blanco }]}>
                    {cat.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Chips de filtro por lista compartida */}
        {listas.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.contenedorChipsFiltro}
            style={{ marginTop: Espaciado.xs }}
          >
            {/* Chip "Mis tareas" */}
            <TouchableOpacity
              style={[estilos.chipLista, !listaActivaId && estilos.chipListaActivo]}
              onPress={() => activarLista(null)}
            >
              <Ionicons
                name="person-outline"
                size={12}
                color={!listaActivaId ? Colores.blanco : Colores.sobreSuperficieVariante}
              />
              <Text style={[estilos.textoChipLista, !listaActivaId && estilos.textoChipListaActivo]}>
                Mis tareas
              </Text>
            </TouchableOpacity>

            {listas.map((lista) => {
              const activa = listaActivaId === lista.id;
              return (
                <TouchableOpacity
                  key={lista.id}
                  style={[estilos.chipLista, activa && estilos.chipListaActivo]}
                  onPress={() => activarLista(activa ? null : lista.id)}
                >
                  <Ionicons
                    name="people-outline"
                    size={12}
                    color={activa ? Colores.blanco : Colores.sobreSuperficieVariante}
                  />
                  <Text style={[estilos.textoChipLista, activa && estilos.textoChipListaActivo]}>
                    {lista.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Lista de tareas */}
      {estaCargando && tareasActuales.length === 0 ? (
        <Indicador mensaje="Cargando tareas..." />
      ) : tareasActuales.length === 0 ? (
        <EstadoVacio onCrear={() => enrutador.push('/(tabs)/nueva')} />
      ) : (
        <FlatList
          data={tareasActuales}
          keyExtractor={(item) => item.id}
          contentContainerStyle={estilos.listaContenido}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={estaCargando} onRefresh={recargar} tintColor={Colores.primario} />
          }
          renderItem={({ item }) => (
            <TarjetaTarea
              tarea={item}
              categoria={categorias.find((c) => c.id === item.categoriaId)}
              onPresionar={() => enrutador.push(`/tarea/${item.id}`)}
              onCompletar={() => manejarCompletar(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Subcomponente: Tarjeta de tarea ───────────

function TarjetaTarea({
  tarea,
  categoria,
  onPresionar,
  onCompletar,
}: {
  tarea: Tarea;
  categoria?: Categoria;
  onPresionar: () => void;
  onCompletar: () => void;
}) {
  const colorPrioridad =
    tarea.prioridad === 'alta' ? Colores.error : tarea.prioridad === 'baja' ? Colores.exito : Colores.alerta;

  return (
    <TouchableOpacity onPress={onPresionar} style={estilos.tarjeta} activeOpacity={0.8}>
      <View style={estilos.filaTarjeta}>
        {/* Icono de categoría */}
        <View style={[estilos.iconoCategoria, { backgroundColor: (categoria?.color ?? Colores.primario) + '20' }]}>
          {categoria ? (
            <MaterialCommunityIcons name={categoria.icono as any} size={20} color={categoria.color} />
          ) : (
            <Ionicons name="location-outline" size={20} color={Colores.primario} />
          )}
        </View>

        {/* Contenido */}
        <View style={estilos.contenidoTarjeta}>
          <Text style={estilos.tituloTarjeta} numberOfLines={1}>{tarea.titulo}</Text>
          {tarea.nombreLugar ? (
            <Text style={estilos.lugarTarjeta} numberOfLines={1}>{tarea.nombreLugar}</Text>
          ) : (
            <Text style={estilos.lugarTarjeta} numberOfLines={1}>{tarea.direccion}</Text>
          )}
          {/* Chips: categoría y prioridad */}
          <View style={estilos.chipsRow}>
            {categoria && (
              <View style={[estilos.chipPequeno, { backgroundColor: categoria.color + '15' }]}>
                <Text style={[estilos.textoChipPequeno, { color: categoria.color }]}>{categoria.nombre}</Text>
              </View>
            )}
            {tarea.prioridad === 'alta' && (
              <View style={[estilos.chipPequeno, { backgroundColor: colorPrioridad + '15' }]}>
                <Text style={[estilos.textoChipPequeno, { color: colorPrioridad }]}>Urgente</Text>
              </View>
            )}
          </View>
        </View>

        {/* Botón completar */}
        <TouchableOpacity onPress={onCompletar} style={estilos.botonCompletar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={estilos.circuloCompletar}>
            <Ionicons name="checkmark" size={16} color={Colores.sobreSuperficieVariante} />
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Estado vacío ──────────────────────────────

function EstadoVacio({ onCrear }: { onCrear: () => void }) {
  return (
    <View style={estilos.estadoVacio}>
      <Text style={estilos.emojiVacio}>📋</Text>
      <Text style={estilos.tituloVacio}>Sin tareas pendientes</Text>
      <Text style={estilos.subtituloVacio}>
        Crea tu primera tarea geolocalizada para empezar.
      </Text>
      <TouchableOpacity onPress={onCrear} style={estilos.botonCrear}>
        <Ionicons name="add" size={20} color={Colores.blanco} />
        <Text style={estilos.textoBotonCrear}>Crear tarea</Text>
      </TouchableOpacity>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colores.superficie },
  // Cabecera
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Espaciado.base,
    paddingTop: Espaciado.md,
    paddingBottom: Espaciado.sm,
  },
  saludo: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colores.sobreSuperficieVariante, letterSpacing: 1.5 },
  nombreApp: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colores.sobreSuperficie },
  iconosCabecera: { flexDirection: 'row', gap: Espaciado.xs },
  botonIcono: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colores.blanco,
    alignItems: 'center', justifyContent: 'center',
    ...Sombras.sutil,
  },
  // Banner
  bannerResumen: {
    marginHorizontal: Espaciado.base,
    marginTop: Espaciado.md,
    padding: Espaciado.base,
    backgroundColor: Colores.primarioContenedor,
    borderRadius: Radios.tarjeta,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  numeroBanner: { fontFamily: 'Inter_700Bold', fontSize: 26, color: Colores.primario },
  subtextoBanner: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colores.sobreSuperficieVariante },
  botonNuevaRapida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Espaciado.md,
    paddingVertical: Espaciado.sm,
    backgroundColor: Colores.blanco,
    borderRadius: Radios.completo,
  },
  textoNuevaRapida: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colores.primario },
  // Filtros
  seccionFiltros: {
    minHeight: 100, // Garantiza que el espacio sea fijo aunque falte una fila
    justifyContent: 'center',
  },
  contenedorChipsFiltro: {
    paddingHorizontal: Espaciado.base,
    paddingVertical: Espaciado.xs,
    gap: Espaciado.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipFiltro: {
    paddingHorizontal: Espaciado.base,
    paddingVertical: 8,
    borderRadius: Radios.completo,
    backgroundColor: Colores.blanco,
    borderWidth: 1,
    borderColor: Colores.superficieContenedorAlta,
    justifyContent: 'center',
  },
  chipFiltroActivo: { backgroundColor: Colores.primario, borderColor: Colores.primario },
  textoChipFiltro: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colores.sobreSuperficieVariante },
  textoChipFiltroActivo: { color: Colores.blanco },
  // Chips de listas compartidas
  chipLista: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Espaciado.base,
    paddingVertical: 8,
    borderRadius: Radios.completo,
    backgroundColor: Colores.blanco,
    borderWidth: 1,
    borderColor: '#dbeafe',
    justifyContent: 'center',
  },
  chipListaActivo: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  textoChipLista: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colores.sobreSuperficieVariante },
  textoChipListaActivo: { color: Colores.blanco },
  // Lista
  listaContenido: { padding: Espaciado.base, gap: Espaciado.md, paddingBottom: Espaciado.xxxl },
  // Tarjeta tarea
  tarjeta: {
    backgroundColor: Colores.blanco,
    borderRadius: Radios.tarjeta,
    padding: Espaciado.base,
    ...Sombras.sutil,
  },
  filaTarjeta: { flexDirection: 'row', alignItems: 'center', gap: Espaciado.md },
  iconoCategoria: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contenidoTarjeta: { flex: 1, gap: 4 },
  tituloTarjeta: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colores.sobreSuperficie },
  lugarTarjeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colores.sobreSuperficieVariante },
  chipsRow: { flexDirection: 'row', gap: Espaciado.xs, marginTop: 2 },
  chipPequeno: { paddingHorizontal: Espaciado.sm, paddingVertical: 2, borderRadius: Radios.completo },
  textoChipPequeno: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  botonCompletar: { padding: 4 },
  circuloCompletar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: Colores.superficieContenedorAlta,
    alignItems: 'center', justifyContent: 'center',
  },
  // Estado vacío
  estadoVacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Espaciado.xxl, gap: Espaciado.md },
  emojiVacio: { fontSize: 56 },
  tituloVacio: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colores.sobreSuperficie, textAlign: 'center' },
  subtituloVacio: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colores.sobreSuperficieVariante, textAlign: 'center', lineHeight: 20 },
  botonCrear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaciado.sm,
    backgroundColor: Colores.primario,
    paddingHorizontal: Espaciado.xl,
    paddingVertical: Espaciado.md,
    borderRadius: Radios.boton,
    marginTop: Espaciado.sm,
  },
  textoBotonCrear: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colores.blanco },
});
