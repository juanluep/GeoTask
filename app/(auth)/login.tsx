/**
 * ============================================================
 * Pantalla de Login — login.tsx
 * ============================================================
 *
 * Pantalla de autenticación con:
 * - Formulario email + contraseña (campos sin borde, fondo gris suave)
 * - Botón "Iniciar Sesión" en color primario con spinner de carga
 * - Divisor "O CONTINÚA CON" y botones de login social (Google / Apple)
 * - Links "Regístrate" y "Continuar como invitado"
 *
 * NOTA DE FASE: En Fase 1-4 esta pantalla navega directamente a las tabs
 * sin autenticación real (simulamos 800ms de delay con setTimeout).
 * La integración real con Supabase Auth se implementa en Fase 5.
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colores, Espaciado, Radios } from '../../src/config/tema';

export default function PantallaLogin() {
  const enrutador = useRouter();

  // ── Estado del formulario ─────────────────────────────────────────────────
  // Cada campo del formulario tiene su propio estado.
  // React re-renderiza el componente cada vez que alguno cambia,
  // pero solo actualiza los elementos del DOM nativo afectados (es eficiente).
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  // contrasenaVisible alterna entre mostrar "••••••••" o el texto real
  const [contrasenaVisible, setContrasenaVisible] = useState(false);
  // cargando bloquea el botón y muestra un spinner mientras "procesamos" el login
  const [cargando, setCargando] = useState(false);

  // ── Manejadores de eventos ────────────────────────────────────────────────

  /**
   * Inicia sesión con email y contraseña.
   *
   * Por ahora simula un delay de 800ms con setTimeout para que el spinner
   * de carga sea visible y el usuario perciba que "algo está pasando".
   * TODO (Fase 5): Reemplazar setTimeout por llamada real a Supabase:
   *   const { error } = await supabase.auth.signInWithPassword({ email, password })
   */
  async function manejarLogin() {
    setCargando(true);
    // Promise + setTimeout = forma idiomática de "esperar X ms" con async/await
    await new Promise((resolve) => setTimeout(resolve, 800));
    setCargando(false);
    // replace() navega a tabs sin dejar login en el historial
    enrutador.replace('/(tabs)');
  }

  /**
   * Navega a las tabs sin crear cuenta.
   * El modo invitado permite explorar la app pero con funcionalidad limitada.
   * TODO (Fase 5): Crear sesión anónima con Supabase para persistir datos locales.
   */
  function manejarContinuarComoInvitado() {
    enrutador.replace('/(tabs)');
  }

  return (
    // SafeAreaView: respeta el "notch" de iPhone y la barra de estado de Android
    <SafeAreaView style={estilos.contenedor}>
      {/*
        KeyboardAvoidingView: cuando el teclado virtual aparece, empuja el
        contenido hacia arriba para que los inputs no queden tapados.
        - En iOS usamos behavior="padding": añade padding al fondo del contenido.
        - En Android usamos behavior="height": reduce la altura del contenido.
        Platform.OS nos dice en qué sistema operativo estamos ejecutando.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/*
          ScrollView con flexGrow: 1 permite que el contenido sea scrolleable
          si no cabe en pantalla (ej. pantallas pequeñas con teclado abierto).
          keyboardShouldPersistTaps="handled" cierra el teclado al tocar fuera
          de un input pero deja que los botones funcionen sin cerrar primero.
        */}
        <ScrollView
          contentContainerStyle={estilos.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Cabecera: logo pequeño + título + subtítulo ───────────────── */}
          <View style={estilos.cabecera}>
            {/*
              Logo pequeño: tarjeta cuadrada con fondo en primarioContenedor (#e8e8ff).
              Más discreto que el splash — este es un espacio funcional, no de branding.
            */}
            <View style={estilos.tarjetaLogo}>
              <Text style={estilos.textoLogo}>
                <Text style={{ color: Colores.primario }}>Geo</Text>
                <Text style={{ color: Colores.sobreSuperficie }}>Task</Text>
              </Text>
            </View>
            <Text style={estilos.titulo}>Bienvenido a GeoTask</Text>
            <Text style={estilos.subtitulo}>
              Gestiona tus mandados de forma inteligente.
            </Text>
          </View>

          {/* ── Formulario de email y contraseña ─────────────────────────── */}
          <View style={estilos.formulario}>
            {/*
              Campo Email:
              - Sin borde (borderWidth: 0) — diseño "sin bordes" del design system
              - Fondo superficieContenedor (#f0ecff) para distinguirlo del fondo
              - keyboardType="email-address" muestra el teclado optimizado para emails
              - autoCapitalize="none" evita que se escriba con mayúscula al inicio
            */}
            <View style={estilos.campoInput}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={Colores.sobreSuperficieVariante}
                style={estilos.iconoCampo}
              />
              <TextInput
                style={estilos.input}
                placeholder="nombre@ejemplo.com"
                placeholderTextColor={Colores.sobreSuperficieVariante}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/*
              Campo Contraseña:
              - secureTextEntry oculta el texto cuando contrasenaVisible es false
              - El icono del "ojo" al final alterna la visibilidad
              - El TextInput tiene flex: 1 para que ocupe el espacio restante
                después del icono de candado y antes del botón ojo
            */}
            <View style={estilos.campoInput}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={Colores.sobreSuperficieVariante}
                style={estilos.iconoCampo}
              />
              <TextInput
                style={[estilos.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={Colores.sobreSuperficieVariante}
                value={contrasena}
                onChangeText={setContrasena}
                // secureTextEntry: true = muestra puntos en lugar del texto
                secureTextEntry={!contrasenaVisible}
                autoCapitalize="none"
              />
              {/* Botón para mostrar/ocultar la contraseña */}
              <TouchableOpacity
                onPress={() => setContrasenaVisible(!contrasenaVisible)}
                style={estilos.botonOjo}
              >
                <Ionicons
                  name={contrasenaVisible ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Colores.sobreSuperficieVariante}
                />
              </TouchableOpacity>
            </View>

            {/* Link "¿Olvidaste tu contraseña?" — alineado a la derecha */}
            <TouchableOpacity style={estilos.linkOlvideContrasena}>
              <Text style={estilos.textoLinkSecundario}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            {/*
              Botón principal "Iniciar Sesión":
              - disabled={cargando} evita que el usuario lo presione dos veces
              - opacity al 70% cuando está cargando (feedback visual de estado deshabilitado)
              - Muestra ActivityIndicator en lugar del texto durante la carga
            */}
            <TouchableOpacity
              style={[estilos.botonPrimario, cargando && { opacity: 0.7 }]}
              onPress={manejarLogin}
              disabled={cargando}
              activeOpacity={0.85}
            >
              {cargando ? (
                // ActivityIndicator: spinner circular nativo de React Native
                <ActivityIndicator color={Colores.blanco} />
              ) : (
                <Text style={estilos.textoBotonPrimario}>Iniciar Sesión →</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Divisor "O CONTINÚA CON" ─────────────────────────────────── */}
          {/*
            Técnica de divisor con texto centrado:
            flex: 1 en las líneas hace que se estiren para llenar el espacio
            disponible a los lados del texto. Es la solución más limpia en RN.
          */}
          <View style={estilos.divisor}>
            <View style={estilos.lineaDivisor} />
            <Text style={estilos.textoDivisor}>O CONTINÚA CON</Text>
            <View style={estilos.lineaDivisor} />
          </View>

          {/* ── Botones de autenticación social ──────────────────────────── */}
          <View style={estilos.contenedorSocial}>
            {/*
              Botón Google: usa un emoji como placeholder del logo de Google.
              TODO (Fase 5): Integrar con @react-native-google-signin/google-signin
              para mostrar el logo oficial y el flujo OAuth real.
            */}
            <TouchableOpacity style={estilos.botonSocial} activeOpacity={0.8}>
              <Text style={estilos.emojiSocial}>G</Text>
              <Text style={estilos.textoBotonSocial}>Google</Text>
            </TouchableOpacity>

            {/*
              Botón Apple: usa el icono nativo de @expo/vector-icons (Ionicons).
              Solo disponible en iOS. En Android se puede ocultar con Platform.OS.
              TODO (Fase 5): Integrar con expo-apple-authentication.
            */}
            <TouchableOpacity style={estilos.botonSocial} activeOpacity={0.8}>
              <Ionicons
                name="logo-apple"
                size={20}
                color={Colores.sobreSuperficie}
              />
              <Text style={estilos.textoBotonSocial}>Apple</Text>
            </TouchableOpacity>
          </View>

          {/* ── Links inferiores: registro + invitado ────────────────────── */}
          <View style={estilos.linksInferiores}>
            {/* Fila "¿No tienes cuenta? Regístrate" */}
            <View style={estilos.filaRegistro}>
              <Text style={estilos.textoGris}>¿No tienes cuenta? </Text>
              <TouchableOpacity>
                {/* color secundario (#b4136d) para el link de acción afirmativa */}
                <Text style={estilos.textoLinkPrimario}>Regístrate</Text>
              </TouchableOpacity>
            </View>

            {/* Link "Continuar como invitado" — menos prominente que el registro */}
            <TouchableOpacity onPress={manejarContinuarComoInvitado}>
              <Text style={estilos.textoContinuarInvitado}>
                Continuar como invitado
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    // superficie (#fcf8ff): fondo ligeramente lavanda, no blanco puro
    // Esto distingue visualmente la pantalla del blanco de las tarjetas
    backgroundColor: Colores.superficie,
  },
  scroll: {
    // flexGrow: 1 (a diferencia de flex: 1) permite que el contenido sea
    // más alto que el ScrollView si es necesario, habilitando el scroll.
    flexGrow: 1,
    paddingHorizontal: Espaciado.xl,
    paddingTop: Espaciado.xl,
    paddingBottom: Espaciado.xxl,
  },

  // ── Cabecera ───────────────────────────────────────────────────────────────
  cabecera: {
    alignItems: 'center',
    marginBottom: Espaciado.xxl,
  },
  tarjetaLogo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    // primarioContenedor (#e8e8ff): versión muy suave del color primario para fondos
    backgroundColor: Colores.primarioContenedor,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Espaciado.base,
  },
  textoLogo: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  titulo: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colores.sobreSuperficie,
    marginBottom: Espaciado.xs,
  },
  subtitulo: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colores.sobreSuperficieVariante,
    textAlign: 'center',
  },

  // ── Formulario ─────────────────────────────────────────────────────────────
  formulario: {
    // gap: espacio uniforme entre todos los hijos directos del View
    gap: Espaciado.md,
  },
  campoInput: {
    flexDirection: 'row',
    alignItems: 'center',
    // superficieContenedor (#f0ecff): fondo del campo sin borde visible
    // Esta es la técnica "Sin Bordes" del design system de GeoTask
    backgroundColor: Colores.superficieContenedor,
    borderRadius: Radios.boton,
    paddingHorizontal: Espaciado.base,
    height: 52,
  },
  iconoCampo: {
    marginRight: Espaciado.sm,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colores.sobreSuperficie,
  },
  botonOjo: {
    // padding extra para hacer el área táctil más grande (accesibilidad)
    padding: 4,
  },
  linkOlvideContrasena: {
    // alignSelf lo mueve a la derecha dentro del formulario (que es flex column)
    alignSelf: 'flex-end',
  },
  textoLinkSecundario: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colores.primario,
  },
  botonPrimario: {
    height: 52,
    backgroundColor: Colores.primario,
    borderRadius: Radios.boton,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Espaciado.xs,
  },
  textoBotonPrimario: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colores.blanco,
  },

  // ── Divisor ────────────────────────────────────────────────────────────────
  divisor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Espaciado.xl,
    gap: Espaciado.md,
  },
  lineaDivisor: {
    // flex: 1 hace que cada línea se estire para llenar el espacio disponible
    // a los lados del texto "O CONTINÚA CON"
    flex: 1,
    height: 1,
    backgroundColor: Colores.superficieContenedorAlta,
  },
  textoDivisor: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colores.sobreSuperficieVariante,
    letterSpacing: 1.5,
  },

  // ── Botones sociales ───────────────────────────────────────────────────────
  contenedorSocial: {
    flexDirection: 'row',
    gap: Espaciado.md,
  },
  botonSocial: {
    // flex: 1 hace que ambos botones tengan el mismo ancho
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaciado.sm,
    height: 48,
    backgroundColor: Colores.blanco,
    borderRadius: Radios.boton,
    // Usamos borderWidth solo aquí porque es un componente "outline"
    // que necesita distinguirse del fondo blanco de la pantalla
    borderWidth: 1,
    borderColor: Colores.superficieContenedorAlta,
  },
  emojiSocial: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colores.sobreSuperficie,
  },
  textoBotonSocial: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colores.sobreSuperficie,
  },

  // ── Links inferiores ───────────────────────────────────────────────────────
  linksInferiores: {
    alignItems: 'center',
    marginTop: Espaciado.xl,
    gap: Espaciado.md,
  },
  filaRegistro: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textoGris: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colores.sobreSuperficieVariante,
  },
  // Color secundario (#b4136d) para el link de registro: acción destacada
  textoLinkPrimario: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colores.secundario,
  },
  // "Continuar como invitado": menos prominente, es la opción de menor compromiso
  textoContinuarInvitado: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colores.sobreSuperficieVariante,
  },
});
