/**
 * ============================================================
 * Pantalla de Onboarding — onboarding.tsx
 * ============================================================
 *
 * Tutorial inicial que explica el concepto de GeoTask en 3 pasos.
 * Solo se muestra la primera vez que el usuario abre la app.
 *
 * Estructura de cada slide:
 * - Zona superior con ilustración y tarjetas flotantes de categoría
 * - Título grande + descripción con palabras clave coloreadas
 * - Indicadores de paginación (puntos)
 * - Botón "Siguiente" / "Empezar" en el último slide
 * - Link "Saltar" para saltarse el tutorial completo
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Colores, Espaciado, Radios } from '../../src/config/tema';

// Misma clave que usa app/index.tsx para detectar si el onboarding ya se vio
const CLAVE_ONBOARDING = 'onboarding_completado';

// Ancho de la pantalla: lo necesitamos para que cada slide ocupe exactamente
// el 100% del ancho y el scroll horizontal se vea como paginación.
const { width: ANCHO_PANTALLA } = Dimensions.get('window');

// ──────────────────────────────────────────────────────────────────────────────
// SECCION: Tipos e interfaz de datos
// TypeScript nos permite definir la "forma" de los datos con interfaces.
// Esto evita errores: si olvidamos una propiedad, TypeScript nos avisa.
// ──────────────────────────────────────────────────────────────────────────────

interface DatosSlide {
  id: string;
  /** Parte del título en color normal (negro) */
  tituloNormal: string;
  /** Parte del título en color primario (índigo) */
  tituloColoreado: string;
  /** Texto descriptivo del slide */
  descripcion: string;
  /** Palabras dentro de la descripción que se resaltan en color secundario */
  palabrasClave: string[];
  /** Emoji representativo de la ilustración (placeholder) */
  emoji: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// SECCION: Contenido de los slides
// Separamos los DATOS de la PRESENTACIÓN. Así, si queremos cambiar el texto
// de un slide, solo tocamos este array sin tocar el código de render.
// ──────────────────────────────────────────────────────────────────────────────

const SLIDES: DatosSlide[] = [
  {
    id: '1',
    tituloNormal: 'Tus tareas, ',
    tituloColoreado: 'en el mapa.',
    descripcion:
      'Crea tareas vinculadas a lugares reales (Supermercado, banco, farmacia...) y nunca olvides un mandado al pasar cerca.',
    palabrasClave: ['Supermercado', 'banco', 'farmacia'],
    emoji: '🗺️',
  },
  {
    id: '2',
    tituloNormal: 'Avisos ',
    tituloColoreado: 'inteligentes.',
    descripcion:
      'GeoTask te avisa automáticamente cuando estés cerca de un lugar con tareas pendientes. Sin abrir la app.',
    palabrasClave: ['cerca', 'tareas pendientes'],
    emoji: '🔔',
  },
  {
    id: '3',
    tituloNormal: 'Organiza ',
    tituloColoreado: 'tu ruta.',
    descripcion:
      'Ve qué mandados tienes en cada zona antes de salir de casa. Sin rodeos innecesarios.',
    palabrasClave: ['mandados', 'cada zona'],
    emoji: '🚀',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE: TextoConPalabrasClave
// Renderiza un párrafo donde ciertas palabras aparecen en color resaltado.
// Técnica: dividir el string con regex y mapear cada segmento a un <Text>.
// React Native permite anidar <Text> dentro de <Text> para estilos inline.
// ──────────────────────────────────────────────────────────────────────────────

function TextoConPalabrasClave({
  texto,
  palabrasClave,
}: {
  texto: string;
  palabrasClave: string[];
}) {
  // Construimos un regex dinámico que captura cualquiera de las palabras clave.
  // El paréntesis de captura () hace que split() incluya los delimitadores en el resultado.
  // Ejemplo: "hola mundo".split(/(mundo)/) → ["hola ", "mundo", ""]
  const regex = new RegExp(`(${palabrasClave.join('|')})`, 'gi');
  const segmentos = texto.split(regex);

  return (
    <Text style={estilos.descripcion}>
      {segmentos.map((segmento, indice) => {
        // Comprobamos si este segmento es una palabra clave (sin distinguir mayúsculas)
        const esClave = palabrasClave.some(
          (p) => p.toLowerCase() === segmento.toLowerCase()
        );
        return (
          <Text
            key={indice}
            style={
              esClave
                ? {
                    color: Colores.secundario,
                    fontFamily: 'Inter_600SemiBold',
                    fontStyle: 'italic',
                  }
                : undefined
            }
          >
            {segmento}
          </Text>
        );
      })}
    </Text>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE: Slide
// Cada "página" del carrusel de onboarding.
// Recibe los datos del slide y su índice (para mostrar tarjetas solo en slide 1).
// ──────────────────────────────────────────────────────────────────────────────

function Slide({ datos, indice }: { datos: DatosSlide; indice: number }) {
  return (
    // El width debe ser exactamente ANCHO_PANTALLA para que el scroll sea perfecto.
    // FlatList con pagingEnabled divide el contenido en "páginas" de ese ancho.
    <View style={[estilos.slide, { width: ANCHO_PANTALLA }]}>
      {/* Zona de ilustración — ocupa la parte superior del slide */}
      <View style={estilos.zonaIlustracion}>
        {/*
          Placeholder de imagen. En producción se reemplaza por:
          <Image source={SLIDES[indice].imagen} style={estilos.imagen} />
          El emoji actúa como representación visual temporal.
        */}
        <View style={estilos.placeholderImagen}>
          <Text style={estilos.emojiIlustracion}>{datos.emoji}</Text>
        </View>

        {/*
          Las tarjetas flotantes solo aparecen en el slide 1 (indice === 0)
          para ilustrar las categorías de tareas del mockup: FARMA, SUPER, BANCO.
          Usamos position: 'absolute' en las tarjetas para "sacarlas del flujo"
          y posicionarlas libremente sobre la imagen.
        */}
        {indice === 0 && (
          <>
            <View style={[estilos.tarjetaFlotante, estilos.flotanteIzquierda]}>
              <Text style={estilos.textoTarjetaFlotante}>💊 FARMA</Text>
            </View>
            <View style={[estilos.tarjetaFlotante, estilos.flotanteDerecha]}>
              <Text style={estilos.textoTarjetaFlotante}>🛒 SUPER</Text>
            </View>
            <View style={[estilos.tarjetaFlotante, estilos.flotanteInferior]}>
              <Text style={estilos.textoTarjetaFlotante}>🏦 BANCO</Text>
            </View>
          </>
        )}
      </View>

      {/* Zona de texto — título + descripción con palabras clave */}
      <View style={estilos.zonaTexto}>
        {/*
          El título tiene dos partes con diferente color, ambas dentro del
          mismo <Text>. Anidar <Text> es la forma idiomática de hacer texto
          "rich" en React Native (no hay <span> como en web).
        */}
        <Text style={estilos.titulo}>
          <Text>{datos.tituloNormal}</Text>
          <Text style={estilos.tituloColoreado}>{datos.tituloColoreado}</Text>
        </Text>

        <TextoConPalabrasClave
          texto={datos.descripcion}
          palabrasClave={datos.palabrasClave}
        />
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: PantallaOnboarding
// ──────────────────────────────────────────────────────────────────────────────

export default function PantallaOnboarding() {
  const enrutador = useRouter();

  // indiceActual guarda qué slide está visible en este momento (0, 1 o 2).
  // Cuando cambia, React re-renderiza los puntos de paginación y el botón.
  const [indiceActual, setIndiceActual] = useState(0);

  // ref a la FlatList para poder llamar scrollToIndex() desde el botón.
  // useRef NO provoca re-renders al cambiar, a diferencia de useState.
  const refLista = useRef<FlatList>(null);

  const esUltimoSlide = indiceActual === SLIDES.length - 1;

  /** Avanza al siguiente slide o navega al login si ya estamos en el último */
  async function manejarSiguiente() {
    if (esUltimoSlide) {
      // Marcamos que el onboarding ya se completó.
      // La próxima vez que el usuario abra la app, app/index.tsx leerá
      // esta clave y saltará directamente a las tabs principales.
      await SecureStore.setItemAsync(CLAVE_ONBOARDING, 'true').catch(() => {});
      // replace() navega sin dejar el onboarding en el historial.
      // Así, el botón "Atrás" en login no regresa al onboarding.
      enrutador.replace('/(auth)/login');
    } else {
      const nuevoIndice = indiceActual + 1;
      setIndiceActual(nuevoIndice);
      // Desplazamos la FlatList programáticamente al nuevo slide
      refLista.current?.scrollToIndex({ index: nuevoIndice, animated: true });
    }
  }

  /** Salta el tutorial completo e ir directamente al login */
  async function manejarSaltar() {
    // También marcamos como completado al saltar, para no volver a mostrarlo
    await SecureStore.setItemAsync(CLAVE_ONBOARDING, 'true').catch(() => {});
    enrutador.replace('/(auth)/login');
  }

  return (
    // SafeAreaView respeta los "notches" y barras del sistema operativo.
    // En iOS evita que el contenido quede bajo la barra de estado o el "notch".
    <SafeAreaView style={estilos.contenedor}>
      {/* Botón "Saltar" — esquina superior derecha */}
      <TouchableOpacity
        onPress={manejarSaltar}
        style={estilos.botonSaltar}
        activeOpacity={0.7}
      >
        <Text style={estilos.textoSaltar}>Saltar</Text>
      </TouchableOpacity>

      {/*
        FlatList con horizontal + pagingEnabled = carrusel tipo "snap".
        scrollEnabled={false} desactiva el scroll con el dedo: el usuario
        navega solo con el botón "Siguiente". Esto da más control al flujo
        de onboarding y evita que se salte pasos por accidente.
      */}
      <FlatList
        ref={refLista}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        renderItem={({ item, index }) => <Slide datos={item} indice={index} />}
      />

      {/* ── Sección inferior: paginación + botón + tagline ──────────────── */}
      <View style={estilos.seccionInferior}>
        {/* Indicadores de paginación: puntos que muestran en qué slide estamos */}
        <View style={estilos.contenedorPuntos}>
          {SLIDES.map((_, indice) => (
            <View
              key={indice}
              style={[
                estilos.punto,
                // El punto activo es más ancho y en color primario (pill shape)
                indice === indiceActual && estilos.puntoActivo,
              ]}
            />
          ))}
        </View>

        {/* Botón principal — cambia de texto en el último slide */}
        <TouchableOpacity
          onPress={manejarSiguiente}
          style={estilos.botonSiguiente}
          activeOpacity={0.85}
        >
          <Text style={estilos.textoBotonSiguiente}>
            {esUltimoSlide ? 'Empezar →' : 'Siguiente →'}
          </Text>
        </TouchableOpacity>

        {/* Tagline de marca — pie de la pantalla */}
        <Text style={estilos.textoPie}>GEOTASK SPATIAL PRODUCTIVITY</Text>
      </View>
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: Colores.blanco,
  },

  // "Saltar" en la parte superior — alineado a la derecha con alignSelf
  botonSaltar: {
    alignSelf: 'flex-end',
    paddingHorizontal: Espaciado.base,
    paddingVertical: Espaciado.sm,
  },
  textoSaltar: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colores.sobreSuperficieVariante,
  },

  // ── Slide ──────────────────────────────────────────────────────────────────
  slide: {
    // flex: 1 hace que el slide ocupe todo el alto disponible entre el botón
    // "Saltar" y la sección inferior.
    flex: 1,
  },
  zonaIlustracion: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // position: 'relative' es el valor por defecto, pero lo hacemos explícito
    // para recordar que las tarjetas flotantes usan position: 'absolute'.
    position: 'relative',
    paddingHorizontal: Espaciado.base,
  },
  placeholderImagen: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    backgroundColor: Colores.superficieContenedorAlta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIlustracion: {
    fontSize: 72,
  },

  // Tarjetas flotantes de categoría (solo slide 1)
  // position: 'absolute' las saca del flujo normal y las posiciona
  // relativas al contenedor padre (zonaIlustracion con position: 'relative').
  tarjetaFlotante: {
    position: 'absolute',
    backgroundColor: Colores.blanco,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  flotanteIzquierda: {
    left: 20,
    top: 20,
  },
  flotanteDerecha: {
    right: 20,
    top: 40,
  },
  flotanteInferior: {
    left: 30,
    bottom: 20,
  },
  textoTarjetaFlotante: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colores.sobreSuperficie,
  },

  // ── Zona de texto ──────────────────────────────────────────────────────────
  zonaTexto: {
    paddingHorizontal: Espaciado.xl,
    paddingBottom: Espaciado.base,
  },
  titulo: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colores.sobreSuperficie,
    lineHeight: 36,
    marginBottom: Espaciado.md,
  },
  tituloColoreado: {
    // Solo sobreescribimos el color; el resto de propiedades (fontSize, fontFamily)
    // se heredan del padre gracias al anidamiento de <Text>.
    color: Colores.primario,
  },
  descripcion: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colores.sobreSuperficieVariante,
    lineHeight: 22,
  },

  // ── Sección inferior ───────────────────────────────────────────────────────
  seccionInferior: {
    paddingHorizontal: Espaciado.xl,
    paddingBottom: Espaciado.xl,
    alignItems: 'center',
    gap: Espaciado.base,
  },

  // Contenedor de puntos de paginación
  contenedorPuntos: {
    flexDirection: 'row',
    gap: 6,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colores.superficieContenedorAlta,
  },
  // El punto activo es una "píldora": más ancho, en color primario.
  // Cambia de forma automáticamente gracias al estado indiceActual.
  puntoActivo: {
    width: 20,
    backgroundColor: Colores.primario,
  },

  // Botón "Siguiente" / "Empezar"
  botonSiguiente: {
    width: '100%',
    height: 52,
    backgroundColor: Colores.primario,
    borderRadius: Radios.boton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSiguiente: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colores.blanco,
  },

  // Tagline de la marca en el pie
  textoPie: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colores.sobreSuperficieVariante,
    letterSpacing: 2,
    opacity: 0.5,
  },
});
