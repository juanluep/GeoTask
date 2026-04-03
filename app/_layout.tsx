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

import { useEffect, useState } from 'react';
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
import '../global.css';

// ──────────────────────────────────────────────
// ⏸️ Mantener el splash screen nativo visible
// Lo ocultamos manualmente cuando todo esté listo (fuentes + BD).
// Si no hacemos esto, el splash desaparece antes de que la app esté lista
// y el usuario ve un parpadeo de pantalla en blanco.
// ──────────────────────────────────────────────
SplashScreen.preventAutoHideAsync();

export default function LayoutRaiz() {
  // Estado que controla si la app está lista para mostrar contenido
  const [appLista, setAppLista] = useState(false);

  useEffect(() => {
    // Función asíncrona para cargar todos los recursos necesarios antes
    // de mostrar la primera pantalla al usuario
    async function cargarRecursos() {
      try {
        // Cargamos las 4 variantes de la fuente Inter en paralelo con la BD
        // para minimizar el tiempo de espera inicial
        // Configurar notificaciones ANTES de cualquier await largo.
        // setNotificationHandler debe ejecutarse lo antes posible.
        configurarNotificaciones();

        await Promise.all([
          Font.loadAsync({
            Inter_400Regular,
            Inter_500Medium,
            Inter_600SemiBold,
            Inter_700Bold,
          }),
          // Inicializa SQLite: crea las tablas si no existen e inserta
          // las categorías predeterminadas en la primera instalación
          inicializarBaseDatos(),
        ]);

        // Crear la tabla de caché de horarios si no existe.
        // Se hace después de inicializarBaseDatos porque usa la misma BD.
        await inicializarTablaHorarios();

        // Solicitar permiso de notificaciones (no bloquea si se deniega)
        await solicitarPermisoNotificaciones();

        // Registrar geocercas de todas las tareas activas.
        // Si no hay permiso background location, esta función no hace nada
        // (el servicio verifica internamente el permiso).
        await registrarTodasLasGeocercas();
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
    // Cuando la app está lista, ocultamos el splash screen nativo
    // Expo Router espera a que este efecto se ejecute
    if (appLista) {
      SplashScreen.hideAsync();
    }
  }, [appLista]);

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
        {/* Ruta dinámica para el detalle de tarea */}
        <Stack.Screen name="tarea" />
      </Stack>

      {/* Barra de estado del sistema (hora, batería, señal) en modo claro */}
      <StatusBar style="auto" />
    </>
  );
}
