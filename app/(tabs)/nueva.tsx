/**
 * ============================================================
 * ➕ Pantalla Nueva Tarea — app/(tabs)/nueva.tsx
 * ============================================================
 *
 * Formulario completo para crear una nueva tarea geolocalizada.
 *
 * Campos:
 * 1. Título (obligatorio)
 * 2. Descripción (opcional)
 * 3. Lugar (buscado con Photon/Nominatim — obligatorio)
 * 4. Categoría (selector visual de chips)
 * 5. Radio de geocerca (selector discreto)
 * 6. Prioridad (alta/media/baja)
 * 7. Fecha límite (opcional)
 *
 * Al guardar → crearTarea() en el store → SQLite → navega a Inicio
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useUbicacion } from '../../src/hooks/useUbicacion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTareaStore, useTareaPorId } from '../../src/stores/useTareaStore';
import { useCategoriaStore } from '../../src/stores/useCategoriaStore';
import { EntradaTexto } from '../../src/components/ui/EntradaTexto';
import { Boton } from '../../src/components/ui/Boton';
import { SelectorCategoria } from '../../src/components/tarea/SelectorCategoria';
import { SelectorRadio } from '../../src/components/tarea/SelectorRadio';
import { BuscadorLugares } from '../../src/components/compartido/BuscadorLugares';
import { useListaStore } from '../../src/stores/useListaStore';
import { Colores, Espaciado, Radios } from '../../src/config/tema';
import type { ResultadoBusquedaLugar } from '../../src/models/ubicacion.modelo';
import type { Prioridad } from '../../src/models/tarea.modelo';

const OPCIONES_PRIORIDAD: { valor: Prioridad; etiqueta: string; color: string }[] = [
  { valor: 'alta', etiqueta: '🔴 Alta', color: Colores.error },
  { valor: 'media', etiqueta: '🟡 Media', color: Colores.alerta },
  { valor: 'baja', etiqueta: '🟢 Baja', color: Colores.exito },
];

export default function PantallaNuevaTarea() {
  const enrutador = useRouter();
  // Params disponibles:
  // - lat/lon/nombre/direccion/osmId → desde el mapa (long-press)
  // - editarId → desde la pantalla de detalle (botón editar)
  const params = useLocalSearchParams<{
    lat?: string;
    lon?: string;
    nombre?: string;
    direccion?: string;
    osmId?: string;
    editarId?: string;
  }>();

  const crearTarea = useTareaStore((s) => s.crearTarea);
  const actualizarTarea = useTareaStore((s) => s.actualizarTarea);
  const cargando = useTareaStore((s) => s.cargando);
  const { categorias, cargarCategorias } = useCategoriaStore();
  const { listas } = useListaStore();
  const ubicacion = useUbicacion();

  // Si estamos en modo edición, obtenemos la tarea existente del store.
  // useTareaPorId busca tanto en pendientes como en completadas.
  const tareaAEditar = useTareaPorId(params.editarId ?? '');
  const modoEdicion = !!params.editarId;

  // ── Estado del formulario ──────────────────
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lugarSeleccionado, setLugarSeleccionado] = useState<ResultadoBusquedaLugar | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [radio, setRadio] = useState(500); // 500m por defecto
  const [prioridad, setPrioridad] = useState<Prioridad>('media');
  const [listaSeleccionadaId, setListaSeleccionadaId] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  // resetKey: al incrementar, fuerza que BuscadorLugares se desmonte y remonte,
  // limpiando su estado interno (texto del input de búsqueda).
  const [resetKey, setResetKey] = useState(0);

  // Referencia mutables para acceder a params dentro del useFocusEffect sin ponerlo en dependencias
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // ── Reset al entrar en la pantalla (solo modo creación) ──────────────────
  useFocusEffect(
    useCallback(() => {
      const p = paramsRef.current;
      
      if (!modoEdicion) {
        // Si venimos del mapa con coordenadas pre-rellenadas (long press en POI)
        if (p.lat && p.lon) {
          const nombreLugar = typeof p.nombre === 'string' ? p.nombre : 'Ubicación seleccionada';
          setLugarSeleccionado({
            osmId: typeof p.osmId === 'string' ? p.osmId : '',
            nombre: nombreLugar,
            direccionCompleta: typeof p.direccion === 'string' ? p.direccion : `${p.lat}, ${p.lon}`,
            componentes: {},
            coordenadas: {
              latitud: parseFloat(p.lat as string),
              longitud: parseFloat(p.lon as string),
            },
          });
          
          if (nombreLugar !== 'Ubicación seleccionada') {
            setTitulo(nombreLugar);
          } else {
            setTitulo('');
          }
          
          setDescripcion('');
          setCategoriaId(null);
          setRadio(500);
          setPrioridad('media');
          setListaSeleccionadaId(null);
          setErrores({});
          setResetKey((k) => k + 1);
          
          // Limpiar los params usando setTimeout para evitar colisiones en el ciclo de renderizado.
          // Como params no está en las dependencias de useCallback, esto no causará un bucle infinito ni relanzará el useFocusEffect.
          setTimeout(() => {
            enrutador.setParams({ lat: '', lon: '', nombre: '', direccion: '', osmId: '' });
          }, 0);
          
        } else {
          // Modo creación normal (vía tab bar o botón de añadir puro)
          setTitulo('');
          setDescripcion('');
          setLugarSeleccionado(null);
          setCategoriaId(null);
          setRadio(500);
          setPrioridad('media');
          setListaSeleccionadaId(null);
          setErrores({});
          setResetKey((k) => k + 1);
        }
      }
    }, [modoEdicion])
  );

  useEffect(() => {
    // Cargamos categorías al montar (si no están ya cargadas)
    if (categorias.length === 0) {
      cargarCategorias();
    }
  }, []);

  // ── Pre-rellenar formulario en modo edición ──────────────────────────────
  // Cuando se carga la tarea a editar, copiamos todos sus datos al formulario.
  // La dependencia es tareaAEditar?.id para que solo se ejecute una vez al montar.
  useEffect(() => {
    if (modoEdicion && tareaAEditar) {
      setTitulo(tareaAEditar.titulo);
      setDescripcion(tareaAEditar.descripcion ?? '');
      setCategoriaId(tareaAEditar.categoriaId);
      setRadio(tareaAEditar.radioProximidad);
      setPrioridad(tareaAEditar.prioridad);
      setListaSeleccionadaId(tareaAEditar.listaId ?? null);
      // Reconstruimos un ResultadoBusquedaLugar con los datos de la tarea
      setLugarSeleccionado({
        osmId: tareaAEditar.osmId ?? '',
        nombre: tareaAEditar.nombreLugar ?? 'Ubicación guardada',
        direccionCompleta: tareaAEditar.direccion,
        componentes: {},
        coordenadas: {
          latitud: tareaAEditar.latitud,
          longitud: tareaAEditar.longitud,
        },
      });
    }
  }, [tareaAEditar?.id]);

  // ── Validación del formulario ──────────────
  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (!titulo.trim()) {
      nuevosErrores.titulo = 'El título es obligatorio';
    } else if (titulo.trim().length < 3) {
      nuevosErrores.titulo = 'El título debe tener al menos 3 caracteres';
    }

    if (!lugarSeleccionado) {
      nuevosErrores.lugar = 'Selecciona un lugar para la tarea';
    }

    if (!categoriaId) {
      nuevosErrores.categoria = 'Selecciona una categoría';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  // ── Guardar tarea (creación o edición) ────────────────────────────────────
  async function manejarGuardar() {
    if (!validar() || !lugarSeleccionado) return;

    // Solicitar permiso de ubicación en segundo plano si aún no está concedido.
    // En Android + Expo Go esto no está disponible y puede lanzar excepción → try/catch.
    // En producción (dev build) funcionará correctamente.
    try {
      const { status: statusBg } = await Location.getBackgroundPermissionsAsync();
      if (statusBg !== 'granted') {
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch {
      // Ignoramos: la tarea se crea/actualiza igualmente
    }

    if (modoEdicion && params.editarId) {
      // ── Modo edición: actualizar tarea existente ──
      await actualizarTarea(params.editarId, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId!,
        latitud: lugarSeleccionado.coordenadas.latitud,
        longitud: lugarSeleccionado.coordenadas.longitud,
        direccion: lugarSeleccionado.direccionCompleta,
        nombreLugar: lugarSeleccionado.nombre,
        osmId: lugarSeleccionado.osmId,
        radioProximidad: radio,
        prioridad,
        listaId: listaSeleccionadaId ?? undefined,
      });
      // Volver a la pantalla de detalle de la tarea actualizada
      enrutador.back();
    } else {
      // ── Modo creación: crear nueva tarea ──
      const id = await crearTarea({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId!,
        latitud: lugarSeleccionado.coordenadas.latitud,
        longitud: lugarSeleccionado.coordenadas.longitud,
        direccion: lugarSeleccionado.direccionCompleta,
        nombreLugar: lugarSeleccionado.nombre,
        osmId: lugarSeleccionado.osmId,
        radioProximidad: radio,
        geocercaActiva: true,
        prioridad,
        listaId: listaSeleccionadaId ?? undefined,
      });

      if (id) {
        // Volvemos a la pestaña de inicio
        enrutador.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'No se pudo guardar la tarea. Inténtalo de nuevo.');
      }
    }
  }

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Cabecera — el título cambia según el modo */}
        <View style={estilos.cabecera}>
          <TouchableOpacity onPress={() => enrutador.back()} style={estilos.botonVolver}>
            <Ionicons name="arrow-back" size={24} color={Colores.sobreSuperficie} />
          </TouchableOpacity>
          <Text style={estilos.tituloCabecera}>
            {modoEdicion ? 'Editar tarea' : 'Nueva tarea'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={estilos.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Título */}
          <View style={estilos.campo}>
            <Text style={estilos.etiquetaCampo}>Título *</Text>
            <EntradaTexto
              marcador="¿Qué tienes que hacer?"
              valor={titulo}
              alCambiar={setTitulo}
              icono="create-outline"
              error={errores.titulo}
            />
          </View>

          {/* 2. Descripción */}
          <View style={estilos.campo}>
            <Text style={estilos.etiquetaCampo}>Descripción</Text>
            <EntradaTexto
              marcador="Detalles adicionales (opcional)..."
              valor={descripcion}
              alCambiar={setDescripcion}
              lineas={3}
            />
          </View>

          {/* 3. Lugar */}
          <View style={[estilos.campo, { zIndex: 10 }]}>
            <Text style={estilos.etiquetaCampo}>Lugar *</Text>
            <BuscadorLugares
              key={resetKey}
              marcador="Buscar tienda, banco, farmacia..."
              alSeleccionar={(resultado) => {
                setLugarSeleccionado(resultado);
                setErrores((e) => ({ ...e, lugar: '' }));
              }}
              alLimpiar={() => setLugarSeleccionado(null)}
              valorInicial={lugarSeleccionado?.nombre}
              latitud={lugarSeleccionado?.coordenadas.latitud ?? ubicacion.coordenadas?.latitud}
              longitud={lugarSeleccionado?.coordenadas.longitud ?? ubicacion.coordenadas?.longitud}
            />
            {errores.lugar ? (
              <Text style={estilos.textoError}>{errores.lugar}</Text>
            ) : lugarSeleccionado ? (
              <View style={estilos.lugarSeleccionado}>
                <Ionicons name="checkmark-circle" size={16} color={Colores.exito} />
                <Text style={estilos.textoLugarSeleccionado} numberOfLines={1}>
                  {lugarSeleccionado.direccionCompleta}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 4. Categoría */}
          <View style={estilos.campo}>
            <Text style={estilos.etiquetaCampo}>Categoría *</Text>
            <SelectorCategoria
              categorias={categorias}
              categoriaSeleccionadaId={categoriaId}
              alSeleccionar={(id) => {
                setCategoriaId(id);
                setErrores((e) => ({ ...e, categoria: '' }));
              }}
            />
            {errores.categoria && (
              <Text style={estilos.textoError}>{errores.categoria}</Text>
            )}
          </View>

          {/* 4.5. Lista Compartida */}
          {listas.length > 0 && (
            <View style={estilos.campo}>
              <Text style={estilos.etiquetaCampo}>Lista (Opcional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                <TouchableOpacity
                  onPress={() => setListaSeleccionadaId(null)}
                  style={[estilos.chipPrioridad, { paddingHorizontal: 16 }, listaSeleccionadaId === null && { backgroundColor: Colores.primario + '15', borderColor: Colores.primario }]}
                >
                  <Text style={[estilos.textoChipPrioridad, listaSeleccionadaId === null && { color: Colores.primario, fontFamily: 'Inter_600SemiBold' }]}>Personal</Text>
                </TouchableOpacity>
                {listas.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => setListaSeleccionadaId(l.id)}
                    style={[estilos.chipPrioridad, { paddingHorizontal: 16 }, listaSeleccionadaId === l.id && { backgroundColor: Colores.primario + '15', borderColor: Colores.primario }]}
                  >
                    <Text style={[estilos.textoChipPrioridad, listaSeleccionadaId === l.id && { color: Colores.primario, fontFamily: 'Inter_600SemiBold' }]}>{l.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 5. Radio de geocerca */}
          <View style={estilos.campo}>
            <Text style={estilos.etiquetaCampo}>Radio de aviso</Text>
            <SelectorRadio valorActual={radio} alCambiar={setRadio} />
          </View>

          {/* 6. Prioridad */}
          <View style={estilos.campo}>
            <Text style={estilos.etiquetaCampo}>Prioridad</Text>
            <View style={estilos.filaPrioridad}>
              {OPCIONES_PRIORIDAD.map((opcion) => (
                <TouchableOpacity
                  key={opcion.valor}
                  onPress={() => setPrioridad(opcion.valor)}
                  style={[
                    estilos.chipPrioridad,
                    prioridad === opcion.valor && {
                      backgroundColor: opcion.color + '20',
                      borderColor: opcion.color,
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      estilos.textoChipPrioridad,
                      prioridad === opcion.valor && { color: opcion.color, fontFamily: 'Inter_600SemiBold' },
                    ]}
                  >
                    {opcion.etiqueta}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Botón guardar — el texto cambia según si es creación o edición */}
          <View style={estilos.seccionBoton}>
            <Boton
              etiqueta={modoEdicion ? 'Guardar cambios' : 'Guardar tarea'}
              alPresionar={manejarGuardar}
              cargando={cargando}
              variante="primario"
              estilo={{ width: '100%' }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: Colores.superficie,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Espaciado.base,
    paddingVertical: Espaciado.md,
    borderBottomWidth: 1,
    borderBottomColor: Colores.superficieContenedorBaja,
  },
  botonVolver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloCabecera: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colores.sobreSuperficie,
  },
  scroll: {
    padding: Espaciado.base,
    gap: Espaciado.xl,
    paddingBottom: Espaciado.xxxl,
  },
  campo: {
    gap: Espaciado.sm,
  },
  etiquetaCampo: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colores.sobreSuperficie,
  },
  textoError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.error,
  },
  lugarSeleccionado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaciado.xs,
  },
  textoLugarSeleccionado: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.sobreSuperficieVariante,
    flex: 1,
  },
  filaPrioridad: {
    flexDirection: 'row',
    gap: Espaciado.sm,
  },
  chipPrioridad: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Espaciado.md,
    borderRadius: Radios.boton,
    borderWidth: 1.5,
    borderColor: Colores.superficieContenedorAlta,
    backgroundColor: 'transparent',
  },
  textoChipPrioridad: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colores.sobreSuperficieVariante,
  },
  seccionBoton: {
    marginTop: Espaciado.md,
  },
});
