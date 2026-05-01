/**
 * ============================================================
 * 📋 Detalle de lista — app/lista/[id].tsx
 * ============================================================
 *
 * Muestra las tareas de una lista compartida en tiempo real.
 * Se suscribe a Supabase Realtime al entrar y cancela la
 * suscripción al salir (cleanup de useEffect).
 *
 * @version 1.0.0
 * ============================================================
 */

import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListaStore } from '../../src/stores/useListaStore';
import { suscribirseACambiosLista } from '../../src/services/listas.servicio';
import type { Tarea } from '../../src/models/tarea.modelo';

export default function PantallaLista() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const enrutador = useRouter();
  const { top } = useSafeAreaInsets();

  const {
    listas,
    tareasLista,
    cargando,
    cargarTareasLista,
    actualizarTareaEnLista,
    eliminarTareaEnLista,
  } = useListaStore();

  const lista = listas.find((l) => l.id === id);

  // Cargar tareas al entrar y suscribirse a Realtime
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      cargarTareasLista(id);

      // Suscripción Realtime: cualquier cambio en las tareas de esta lista
      // se refleja inmediatamente sin necesidad de recargar.
      const cancelar = suscribirseACambiosLista(id, (evento, tarea) => {
        if (evento === 'DELETE') {
          eliminarTareaEnLista(id);
        } else if (tarea) {
          if (evento === 'UPDATE' && tarea.completada) {
            // Mover completadas fuera de la lista visible
            eliminarTareaEnLista(tarea.id);
          } else {
            actualizarTareaEnLista(tarea);
          }
        }
      });

      return cancelar;
    }, [id])
  );

  async function compartirCodigo() {
    if (!lista) return;
    await Share.share({
      message: `Únete a mi lista "${lista.nombre}" en GeoTask con el código: ${lista.codigo.toUpperCase()}`,
    });
  }

  function renderizarTarea({ item }: { item: Tarea }) {
    return (
      <TouchableOpacity
        style={estilos.filaTarea}
        onPress={() => enrutador.push(`/tarea/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={estilos.puntoCategoria} />
        <View style={estilos.infoTarea}>
          <Text style={estilos.tituloTarea} numberOfLines={1}>
            {item.titulo}
          </Text>
          {!!item.direccion && (
            <Text style={estilos.lugarTarea} numberOfLines={1}>
              📍 {item.nombreLugar ?? item.direccion}
            </Text>
          )}
        </View>
        <Text style={estilos.flecha}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={estilos.contenedor}>
      {/* Cabecera */}
      <View style={[estilos.cabecera, { paddingTop: top + 16 }]}>
        <TouchableOpacity onPress={() => enrutador.back()} style={estilos.botonVolver}>
          <Text style={estilos.textoVolver}>← Volver</Text>
        </TouchableOpacity>
        <Text style={estilos.titulo} numberOfLines={1}>
          {lista?.nombre ?? 'Lista'}
        </Text>
        <TouchableOpacity onPress={compartirCodigo} style={estilos.botonCompartir}>
          <Text style={estilos.textoCompartir}>Compartir</Text>
        </TouchableOpacity>
      </View>

      {/* Código de la lista */}
      {lista && (
        <View style={estilos.bannerCodigo}>
          <Text style={estilos.textoCodigo}>
            Código: <Text style={estilos.codigo}>{lista.codigo.toUpperCase()}</Text>
          </Text>
          <Text style={estilos.rolTexto}>Tu rol: {lista.rol ?? 'editor'}</Text>
        </View>
      )}

      {/* Lista de tareas */}
      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#3b82f6" />
      ) : tareasLista.length === 0 ? (
        <View style={estilos.vacios}>
          <Text style={estilos.emptyIcon}>📋</Text>
          <Text style={estilos.emptyTitulo}>Sin tareas pendientes</Text>
          <Text style={estilos.emptySubtitulo}>
            Cualquier miembro puede crear tareas y asignarlas a esta lista.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tareasLista}
          keyExtractor={(item) => item.id}
          renderItem={renderizarTarea}
          contentContainerStyle={estilos.listaPadding}
          ItemSeparatorComponent={() => <View style={estilos.separador} />}
        />
      )}

      {/* Indicador Realtime */}
      <View style={estilos.indicadorRealtime}>
        <View style={estilos.puntoverde} />
        <Text style={estilos.textoRealtime}>Actualización en tiempo real activa</Text>
      </View>
    </View>
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
    flex: 1,
    textAlign: 'center',
  },
  botonCompartir: {
    width: 72,
    alignItems: 'flex-end',
  },
  textoCompartir: {
    fontSize: 14,
    color: '#3b82f6',
    fontFamily: 'Inter_500Medium',
  },
  bannerCodigo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  textoCodigo: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#1d4ed8',
  },
  codigo: {
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  rolTexto: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#3b82f6',
    textTransform: 'capitalize',
  },
  listaPadding: {
    padding: 16,
  },
  filaTarea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  puntoCategoria: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  infoTarea: {
    flex: 1,
    gap: 4,
  },
  tituloTarea: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
  },
  lugarTarea: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
  },
  flecha: {
    fontSize: 20,
    color: '#9ca3af',
  },
  separador: {
    height: 8,
  },
  vacios: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitulo: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtitulo: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  indicadorRealtime: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  puntoverde: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  textoRealtime: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
  },
});
