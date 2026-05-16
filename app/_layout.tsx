/**
 * ============================================================
 * 🏠 Layout Raíz — app/_layout.tsx
 * ============================================================
 *
 * Este es el punto de entrada de toda la navegación en Expo Router.
 * Expo Router usa un sistema de "file-based routing" similar a Next.js:
 * cada archivo en la carpeta `app/` se convierte automáticamente en una ruta.
 *
 * Responsabilidades de este archivo:
 * 1. Cargar las fuentes tipográficas (Inter) antes de mostrar nada
 * 2. Inicializar la base de datos SQLite
 * 3. Controlar el splash screen nativo (ocultarlo cuando todo esté listo)
 * 4. Decidir si el usuario ve el flujo de autenticación o las tabs principales
 * 5. (Fase 3) Configurar notificaciones y registrar geocercas al arrancar
 *
 * ¿Qué es un "layout" en Expo Router?
 * Un _layout.tsx define la estructura "envolvente" de un grupo de pantallas.
 * El layout raíz envuelve TODA la app, por eso es el lugar ideal para
 * inicializaciones globales.
 *
 * @version 1.0.0
 * ============================================================
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { inicializarBaseDatos } from '../src/services/basedatos.servicio';
import { configurarNotificaciones, solicitarPermisoNotificaciones } from '../src/services/notificacion.servicio';
import { registrarTodasLasGeocercas } from '../src/services/geocerca.servicio';
import { inicializarTablaHorarios } from '../src/services/horarios.servicio';
import * as Location from 'expo-location';
import { useAuthStore } from '../src/stores/useAuthStore';
import { sincronizarCompleto } from '../src/services/sincronizacion.servicio';
import { useTareaStore } from '../src/stores/useTareaStore';
import { useProximidad } from '../src/hooks/useProximidad';
import '../global.css';

// ──────────────────────────────────────────────
// ⏸️ Mantener el splash screen nativo visible
// Lo ocultamos manualmente cuando todo esté listo (fuentes + BD).
// Si no hacemos esto, el splash desaparece antes de que la app esté lista
// y el usuario ve un parpadeo de pantalla en blanco.
// ──────────────────────────────────────────────
SplashScreen.preventAutoHideAsync();

export default function LayoutRaiz() {
  const [appLista, setAppLista] = useState(false);
  // Guardamos el estado anterior de AppState para detectar solo la transición
  // background → active (no queremos sincronizar si la app ya estaba activa).
  const estadoAppAnterior = useRef<AppStateStatus>(AppState.currentState);

  // Fallback de proximidad por polling: calcula distancias manualmente cada 20s.
  // Es el plan B cuando el geofencing nativo del SO no funciona (muy común).
  useProximidad();

  useEffect(() => {
    async function cargarRecursos() {
      try {
        configurarNotificaciones();

        await Promise.all([
          Font.loadAsync({
            Inter_400Regular,
            Inter_500Medium,
            Inter_600SemiBold,
            Inter_700Bold,
          }),
          inicializarBaseDatos(),
        ]);

        await inicializarTablaHorarios();
        // Los permisos de ubicación y geocercas se piden en un useEffect
        // separado DESPUÉS de que la app se haya renderizado, para que el
        // usuario vea la UI antes del diálogo de permisos.

        // Fase 5: recuperar la sesión de Supabase guardada en SecureStore.
        // Esto debe hacerse ANTES de que index.tsx se renderice, para que
        // sessionCargada sea true cuando index.tsx lee el store.
        await useAuthStore.getState().inicializarSesion();

        // Si hay sesión activa, sincronizar tareas pendientes y descargar novedades.
        // Se hace en segundo plano para no retrasar el arranque, pero cuando
        // termina recargamos el store para que la UI refleje las tareas descargadas.
        const userId = useAuthStore.getState().userId;
        if (userId) {
          sincronizarCompleto(userId)
            .then(() => useTareaStore.getState().cargarTareas())
            .catch(() => {});
        }
      } catch (error) {
        // En producción, aquí registraríamos el error en un servicio
        // como Sentry. Por ahora solo lo logueamos.
        console.warn('Error cargando recursos iniciales:', error);
      } finally {
        // Independientemente de si hubo error, marcamos la app como lista
        // para que el usuario pueda usar la aplicación
        setAppLista(true);
      }
    }

    cargarRecursos();
  }, []);

  useEffect(() => {
    if (appLista) {
      SplashScreen.hideAsync();
    }
  }, [appLista]);

  // ── Solicitud de permisos al arrancar ─────────────────────────────
  // Este efecto se dispara cuando la app ya está lista para mostrarse.
  // Pide permisos de notificación y ubicación en secuencia, y registra
  // geocercas solo cuando el usuario ha concedido el permiso background.
  useEffect(() => {
    if (!appLista) return;

    async function pedirPermisosYRegistrar() {
      try {
        // 1. Notificaciones push locales
        await solicitarPermisoNotificaciones();

        // 2. Ubicación en primer plano (imprescindible para el mapa y useProximidad)
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          console.log('[layout] Permiso de ubicación (primer plano) denegado.');
          return;
        }

        // 3. Ubicación en segundo plano (necesario SOLO para geocercas nativas del SO)
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status === 'granted') {
          await registrarTodasLasGeocercas();
          console.log('[layout] Geocercas nativas registradas.');
        } else {
          console.log('[layout] Permiso background denegado. Activo fallback useProximidad.');
        }
      } catch (e) {
        console.warn('[layout] Error solicitando permisos:', e);
      }
    }

    // Pequeño retraso para que el usuario vea la pantalla principal
    // antes de que aparezca el diálogo de permisos.
    const timer = setTimeout(pedirPermisosYRegistrar, 1500);
    return () => clearTimeout(timer);
  }, [appLista]);

  // Fase 5: suscribirse a cambios de sesión de Supabase mientras la app esté viva.
  // onAuthStateChange notifica login, logout y refresh de token automáticamente.
  useEffect(() => {
    const desuscribir = useAuthStore.getState().escucharCambiosSesion();
    return desuscribir;
  }, []);

  // Sincronizar cuando la app vuelve al primer plano.
  //
  // ¿Por qué es necesario esto?
  // La sync inicial (arriba) ocurre una sola vez al arrancar. Si el usuario
  // tiene dos dispositivos con la misma cuenta y crea una tarea en el dispositivo A,
  // el dispositivo B no se entera hasta que se reinicia... a menos que hagamos
  // esta sync adicional cada vez que B vuelve al primer plano.
  //
  // AppState.currentState puede ser:
  //   'active'     → la app está en pantalla (primer plano)
  //   'background' → la app está en segundo plano (minimizada)
  //   'inactive'   → transición (solo en iOS, p.ej. al recibir una llamada)
  useEffect(() => {
    const suscripcion = AppState.addEventListener(
      'change',
      async (nuevoEstado: AppStateStatus) => {
        // Solo actuamos cuando la app pasa de background/inactive → active
        const vuelveAlPrimerPlano =
          estadoAppAnterior.current !== 'active' && nuevoEstado === 'active';

        estadoAppAnterior.current = nuevoEstado;

        if (vuelveAlPrimerPlano) {
          // Re-registrar geocercas siempre: Android puede haberlas eliminado
          // mientras la app estaba en segundo plano (Doze mode, reinicio, etc.)
          registrarTodasLasGeocercas().catch(() => {});

          const userId = useAuthStore.getState().userId;
          if (userId) {
            sincronizarCompleto(userId)
              .then(() => useTareaStore.getState().cargarTareas())
              .catch(() => {});
          }
        }
      }
    );

    // Al desmontar el layout (raramente ocurre), limpiamos la suscripción
    return () => suscripcion.remove();
  }, []);

  // Mientras cargamos recursos, no renderizamos nada
  // (el splash screen nativo está visible en este momento)
  if (!appLista) {
    return null;
  }

  return (
    <>
      {/*
        Stack es el navegador principal de Expo Router.
        headerShown: false → ocultamos la cabecera nativa en todas las pantallas
        porque cada pantalla tiene su propia cabecera personalizada.
      */}
      <Stack screenOptions={{ headerShown: false }}>
        {/*
          Grupo de pantallas de autenticación.
          El nombre entre paréntesis "(auth)" es un "route group" de Expo Router:
          agrupa rutas sin añadir ese segmento a la URL de navegación.
        */}
        <Stack.Screen name="(auth)" />

        {/*
          Grupo de pantallas principales (con barra de tabs).
          Solo accesible después de completar el onboarding/login.
        */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tarea" />
        {/* Ruta para listas compartidas (Fase 5) */}
        <Stack.Screen name="lista" />
        {/* Ruta de callback OAuth — recibe el redirect de Google */}
        <Stack.Screen name="auth" />
      </Stack>

      {/* Barra de estado del sistema (hora, batería, señal) en modo claro */}
      <StatusBar style="auto" />
    </>
  );
}
