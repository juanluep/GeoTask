/**
 * ============================================================
 * Pantalla Splash — splash.tsx
 * ============================================================
 *
 * Pantalla de bienvenida animada que se muestra al abrir la app.
 * Diferente al splash screen NATIVO (que controla el sistema operativo),
 * este es nuestro splash screen de React Native con animaciones propias.
 *
 * Flujo:
 * 1. Se muestra durante ~2.8 segundos con animaciones de entrada
 * 2. Navega automáticamente al onboarding (primera vez) o al login
 *
 * @version 1.0.0
 * ============================================================
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colores, Tipografia, Espaciado } from '../../src/config/tema';

// Obtenemos el ancho y alto de la pantalla del dispositivo actual.
// Esto permite que el diseño se adapte a cualquier tamaño de pantalla.
const { width: ANCHO_PANTALLA, height: ALTO_PANTALLA } = Dimensions.get('window');

export default function PantallaSplash() {
  const enrutador = useRouter();

  // ── Referencias para animaciones ──────────────────────────────────────────
  // Animated.Value es un contenedor especial de React Native que puede
  // animar propiedades de UI sin pasar por el hilo de JavaScript en cada frame.
  // El número inicial (0 u 0.8) es el valor de arranque de la animación.
  const opacidadLogo = useRef(new Animated.Value(0)).current;
  const escalaLogo = useRef(new Animated.Value(0.8)).current;
  const opacidadTexto = useRef(new Animated.Value(0)).current;
  const opacidadInferior = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── Secuencia de animaciones de entrada ───────────────────────────────
    // Animated.sequence: ejecuta las animaciones una TRAS otra (en cadena).
    // Animated.parallel: ejecuta varias animaciones AL MISMO TIEMPO.
    // Animated.delay: introduce una pausa sin hacer nada visible.
    // Esta combinación crea el efecto: logo aparece → texto aparece → pie aparece.
    Animated.sequence([
      // Paso 1: El logo aparece con fade (0→1) y scale spring (0.8→1)
      // Los dos corren en paralelo para que el efecto sea simultáneo.
      Animated.parallel([
        Animated.timing(opacidadLogo, {
          toValue: 1,
          duration: 600,
          // useNativeDriver: true significa que la animación corre en el hilo
          // nativo del sistema operativo, no en JS. Esto la hace mucho más
          // fluida, especialmente en dispositivos lentos.
          useNativeDriver: true,
        }),
        Animated.spring(escalaLogo, {
          toValue: 1,
          // tension: controla la "fuerza del resorte" (más alto = más rápido)
          // friction: controla el "amortiguamiento" (más alto = menos rebote)
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Pequeña pausa de 200ms para que el logo se asiente antes del texto
      Animated.delay(200),
      // Paso 2: El nombre y subtítulo aparecen con fade suave
      Animated.timing(opacidadTexto, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Paso 3: El pie de página con el tagline aparece al final
      Animated.timing(opacidadInferior, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // ── Navegación automática después de 2.8 segundos ─────────────────────
    // setTimeout ejecuta la función de navegación después del tiempo indicado.
    // enrutador.replace() navega SIN agregar al historial, así el usuario no
    // puede regresar al splash presionando el botón "Atrás".
    //
    // TODO (Fase 5): Verificar con expo-secure-store si el usuario ya completó
    // el onboarding. Si sí → navegar a /(auth)/login. Si no → onboarding.
    const temporizador = setTimeout(() => {
      enrutador.replace('/(auth)/onboarding');
    }, 2800);

    // Función de limpieza: si el componente se desmonta antes de que el
    // temporizador termine (ej. el usuario navega manualmente), cancelamos
    // el timeout para evitar un error de "navegar desde componente desmontado".
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <LinearGradient
      // Gradiente de tres puntos: azul oscuro → índigo primario → índigo claro
      // Esto crea el fondo "digital" premium del mockup.
      colors={['#3730a3', Colores.primario, '#6063ee']}
      start={{ x: 0, y: 0 }}   // El gradiente empieza en la esquina superior-izquierda
      end={{ x: 1, y: 1 }}     // y termina en la esquina inferior-derecha (diagonal)
      style={estilos.contenedor}
    >
      {/* ── Sección central: Logo + Nombre + Spinner ───────────────────── */}
      <View style={estilos.seccionCentral}>
        {/*
          Animated.View envuelve la tarjeta del logo para que pueda animarse.
          Le pasamos la opacidad y la escala como parte del array transform.
          transform es un array porque se pueden encadenar múltiples transformaciones:
          [{scale: 1.2}, {rotate: '45deg'}, {translateX: 10}]
        */}
        <Animated.View
          style={[
            estilos.tarjetaLogo,
            {
              opacity: opacidadLogo,
              transform: [{ scale: escalaLogo }],
            },
          ]}
        >
          {/*
            Placeholder del logo. En producción se reemplaza por:
            <Image source={require('../../assets/logo.png')} style={...} />
            Usamos texto coloreado como representación visual temporal.
          */}
          <Text style={estilos.textoLogoPlaceholder}>
            <Text style={{ color: Colores.primario }}>Geo</Text>
            <Text style={{ color: Colores.sobreSuperficie }}>Task</Text>
          </Text>
        </Animated.View>

        {/* Nombre y subtítulo — envueltos en Animated.View para el fade */}
        <Animated.View style={{ opacity: opacidadTexto, alignItems: 'center' }}>
          <Text style={estilos.nombreApp}>GeoTask</Text>
          <Text style={estilos.subtitulo}>Tareas inteligentes por proximidad</Text>
        </Animated.View>

        {/* ActivityIndicator es el spinner circular nativo de React Native.
            Aparece junto con el texto para indicar que la app está cargando. */}
        <Animated.View style={{ opacity: opacidadTexto, marginTop: Espaciado.xl }}>
          <ActivityIndicator
            size="small"
            color="rgba(255,255,255,0.6)"
          />
        </Animated.View>
      </View>

      {/* ── Pie de página: tagline de la marca ───────────────────────────── */}
      {/* El tagline "SPATIAL PRODUCTIVITY" aparece al final con su propio fade */}
      <Animated.View style={[estilos.piePagina, { opacity: opacidadInferior }]}>
        <View style={estilos.lineaDivisoria} />
        <Text style={estilos.tagline}>SPATIAL PRODUCTIVITY</Text>
        <View style={estilos.lineaDivisoria} />
      </Animated.View>
    </LinearGradient>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
// StyleSheet.create() compila los estilos una sola vez al cargar el módulo,
// a diferencia de objetos literales que se crean en cada render. Más eficiente.
const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seccionCentral: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // gap es el espacio entre hijos directos del View (como gap de CSS Flexbox)
    gap: Espaciado.xl,
  },
  tarjetaLogo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: Colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra que da profundidad a la tarjeta sobre el gradiente
    // En Android usamos "elevation"; en iOS los 4 valores shadowXxx
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  textoLogoPlaceholder: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  nombreApp: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: Colores.blanco,
    // letterSpacing negativo aprieta las letras para un look "display" premium
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    // rgba permite color blanco con transparencia (0.75 = 75% opaco)
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    marginTop: Espaciado.xs,
  },
  piePagina: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Espaciado.xxl,
    gap: Espaciado.md,
  },
  lineaDivisoria: {
    height: 1,
    width: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tagline: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255, 255, 255, 0.5)',
    // letterSpacing positivo grande = estilo "CAPS ESPACIADAS" muy de moda
    letterSpacing: 3,
  },
});
