/**
 * ============================================================
 * 🔍 Buscador de Lugares — BuscadorLugares.tsx
 * ============================================================
 *
 * Componente de autocompletado de lugares usando Photon API (OSM).
 * Muestra sugerencias en un dropdown mientras el usuario escribe.
 *
 * Implementa debounce manual (esperar 400ms después de la última tecla)
 * para respetar la política de uso de Photon (máx ~1 req/segundo)
 * y evitar saturar la API con cada pulsación de tecla.
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buscarLugares } from '../../services/lugares.servicio';
import { Colores, Espaciado, Radios, Sombras } from '../../config/tema';
import type { ResultadoBusquedaLugar } from '../../models/ubicacion.modelo';

interface PropiedadesBuscadorLugares {
  /** Texto de placeholder del input */
  marcador?: string;
  /** Callback cuando el usuario selecciona un resultado */
  alSeleccionar: (resultado: ResultadoBusquedaLugar) => void;
  /** Callback cuando el usuario borra el texto (para limpiar la selección en el padre) */
  alLimpiar?: () => void;
  /** Valor inicial (dirección ya seleccionada, puede cambiar después del montaje) */
  valorInicial?: string;
  /** Coordenadas del usuario para sesgar los resultados a su entorno */
  latitud?: number;
  longitud?: number;
}

export function BuscadorLugares({
  marcador = 'Buscar lugar o dirección...',
  alSeleccionar,
  alLimpiar,
  valorInicial = '',
  latitud,
  longitud,
}: PropiedadesBuscadorLugares) {
  const [texto, setTexto] = useState(valorInicial);
  const [resultados, setResultados] = useState<ResultadoBusquedaLugar[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);

  // Referencia al temporizador de debounce.
  // useRef persiste entre renders sin causar re-renders (a diferencia de useState).
  const temporizadorDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flag para detectar cuándo el cambio de texto viene de una selección del usuario
  // (no de teclear manualmente). Si es `true`, saltamos la búsqueda del debounce
  // para evitar que el dropdown reaparezca justo después de seleccionar un resultado.
  const textoEsSeleccion = useRef(false);

  // Cuando valorInicial cambia desde fuera (ej: mapa→nueva rellena la ubicación
  // después del montaje via useEffect), actualizamos el texto interno si está vacío.
  useEffect(() => {
    if (valorInicial && !texto) {
      setTexto(valorInicial);
    }
  }, [valorInicial]);

  useEffect(() => {
    // Cancelamos el temporizador anterior cada vez que cambia el texto
    if (temporizadorDebounce.current) {
      clearTimeout(temporizadorDebounce.current);
    }

    if (texto.length < 2) {
      setResultados([]);
      setMostrarResultados(false);
      setBusquedaRealizada(false);
      return;
    }

    // Creamos un nuevo temporizador: la búsqueda se lanza solo si el usuario
    // deja de escribir durante 400ms (debounce)
    temporizadorDebounce.current = setTimeout(async () => {
      // Si el cambio de texto vino de una selección (manejarSeleccion),
      // no lanzamos otra búsqueda: eso reabrirÍa el dropdown innecesariamente.
      if (textoEsSeleccion.current) {
        textoEsSeleccion.current = false;
        return;
      }
      setCargando(true);
      setBusquedaRealizada(false);
      const lugares = await buscarLugares(texto, 5, latitud, longitud);
      setResultados(lugares);
      setMostrarResultados(lugares.length > 0);
      setBusquedaRealizada(true);
      setCargando(false);
    }, 400);

    // Limpieza: cancelar el temporizador si el componente se desmonta
    return () => {
      if (temporizadorDebounce.current) {
        clearTimeout(temporizadorDebounce.current);
      }
    };
  }, [texto]);

  function manejarSeleccion(resultado: ResultadoBusquedaLugar) {
    // Marcamos que el próximo cambio de `texto` es programático (no del usuario).
    // Esto evita que el debounce lance una nueva búsqueda y reabre el dropdown.
    textoEsSeleccion.current = true;
    setTexto(resultado.nombre);
    setResultados([]);
    setMostrarResultados(false);
    setBusquedaRealizada(false);
    alSeleccionar(resultado);
  }

  function limpiarBusqueda() {
    setTexto('');
    setResultados([]);
    setMostrarResultados(false);
    setBusquedaRealizada(false);
    // Notificar al padre para que también limpie la selección
    alLimpiar?.();
  }

  return (
    <View style={estilos.contenedor}>
      {/* Campo de búsqueda */}
      <View style={estilos.campoInput}>
        <Ionicons
          name="search-outline"
          size={20}
          color={Colores.sobreSuperficieVariante}
          style={estilos.iconoBusqueda}
        />
        <TextInput
          style={estilos.input}
          value={texto}
          onChangeText={setTexto}
          placeholder={marcador}
          placeholderTextColor={Colores.sobreSuperficieVariante}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {/* Indicador de carga o botón limpiar */}
        {cargando ? (
          <ActivityIndicator size="small" color={Colores.primario} style={{ marginRight: Espaciado.sm }} />
        ) : texto.length > 0 ? (
          <TouchableOpacity onPress={limpiarBusqueda} style={estilos.botonLimpiar}>
            <Ionicons name="close-circle" size={18} color={Colores.sobreSuperficieVariante} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Mensaje sin resultados */}
      {busquedaRealizada && !cargando && resultados.length === 0 && texto.length >= 2 && (
        <View style={estilos.dropdown}>
          <View style={estilos.filaResultado}>
            <Text style={estilos.direccionResultado}>Sin resultados para "{texto}"</Text>
          </View>
        </View>
      )}

      {/* Dropdown de resultados */}
      {mostrarResultados && (
        <View style={estilos.dropdown}>
          <FlatList
            data={resultados}
            keyExtractor={(item, index) => `${item.osmId}-${index}`}
            scrollEnabled={false}
            keyboardShouldPersistTaps="always"
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() => manejarSeleccion(item)}
                style={[
                  estilos.filaResultado,
                  index < resultados.length - 1 && estilos.separadorResultado,
                ]}
                activeOpacity={0.7}
              >
                <View style={estilos.iconoResultado}>
                  <Ionicons name="location-outline" size={16} color={Colores.primario} />
                </View>
                <View style={estilos.textoResultado}>
                  <Text style={estilos.nombreResultado} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                  <Text style={estilos.direccionResultado} numberOfLines={1}>
                    {item.componentes.barrio
                      ? `${item.componentes.barrio}, `
                      : ''}
                    {item.componentes.ciudad || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    position: 'relative',
    zIndex: 10, // Asegura que el dropdown quede por encima de otros elementos
  },
  campoInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colores.superficieContenedor,
    borderRadius: Radios.boton,
    paddingHorizontal: Espaciado.base,
    height: 52,
  },
  iconoBusqueda: {
    marginRight: Espaciado.sm,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colores.sobreSuperficie,
  },
  botonLimpiar: {
    padding: 4,
  },
  // ── Dropdown ──
  dropdown: {
    position: 'absolute',
    top: 56, // Justo debajo del input
    left: 0,
    right: 0,
    backgroundColor: Colores.blanco,
    borderRadius: Radios.tarjeta,
    ...Sombras.modal,
    overflow: 'hidden',
  },
  filaResultado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Espaciado.base,
    paddingVertical: Espaciado.md,
    gap: Espaciado.md,
  },
  separadorResultado: {
    borderBottomWidth: 1,
    borderBottomColor: Colores.superficieContenedorBaja,
  },
  iconoResultado: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colores.primarioContenedor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoResultado: {
    flex: 1,
  },
  nombreResultado: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colores.sobreSuperficie,
  },
  direccionResultado: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.sobreSuperficieVariante,
    marginTop: 2,
  },
});
