/**
 * ============================================================
 * 📍 Hook de Ubicación — useUbicacion.ts
 * ============================================================
 *
 * Hook personalizado que gestiona la ubicación del usuario en tiempo real.
 *
 * ¿Por qué un hook y no un store?
 * La ubicación cambia constantemente y solo la necesitan los componentes
 * que están activos en pantalla (mapa, detalle de tarea). Un store global
 * de ubicación causaría re-renders innecesarios en toda la app.
 * El hook se suscribe mientras el componente está montado y se limpia solo.
 *
 * Flujo:
 * 1. Solicitar permiso de ubicación foreground (mientras la app está activa)
 * 2. Obtener posición inicial rápida (caché)
 * 3. Iniciar watchPosition para actualizaciones continuas
 * 4. Al desmontar → parar el watcher (evitar memory leaks)
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import type { EstadoUbicacion, Coordenadas } from '../models/ubicacion.modelo';

// ──────────────────────────────────────────────
// ⚙️ SECCIÓN: Configuración de precisión
// Location.Accuracy tiene 6 niveles. Balanced es el mejor compromiso:
// - Usa WiFi + cell towers además del GPS
// - Precisión ~100m (suficiente para geocercas de 200m+)
// - Mucho menos consumo de batería que Highest (GPS puro)
// ──────────────────────────────────────────────
const PRECISION_UBICACION = Location.Accuracy.Balanced;

/** Distancia mínima de movimiento (metros) para disparar una actualización */
const DISTANCIA_MINIMA_METROS = 10;

export function useUbicacion() {
  const [estado, setEstado] = useState<EstadoUbicacion>({
    coordenadas: null,
    permiso: 'no-solicitado',
    monitorizando: false,
  });

  // Referencia al "watcher" de ubicación.
  // Lo guardamos en useRef para poder cancelarlo al desmontar el componente.
  // Si usáramos una variable normal, se perdería entre renders.
  const refWatcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    iniciarMonitorizacion();

    // Función de limpieza: se ejecuta cuando el componente que usa este hook
    // se desmonta. Cancela el watcher para evitar memory leaks y consumo innecesario.
    return () => {
      if (refWatcher.current) {
        refWatcher.current.remove();
        refWatcher.current = null;
      }
    };
  }, []);

  async function iniciarMonitorizacion() {
    try {
      // Solicitar permiso de ubicación foreground (mientras la app está activa)
      // El permiso background se solicita por separado, solo cuando el usuario
      // quiere activar geocercas (para no asustarle con todos los permisos de golpe)
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setEstado((prev) => ({ ...prev, permiso: 'denegado' }));
        return;
      }

      setEstado((prev) => ({ ...prev, permiso: 'concedido', monitorizando: true }));

      // Obtener posición inicial rápida usando la caché del sistema.
      // maxAge: 30000ms → acepta posiciones de hasta 30s de antigüedad.
      // Esto evita esperar al GPS frío al abrir la app.
      const posicionInicial = await Location.getCurrentPositionAsync({
        accuracy: PRECISION_UBICACION,
      });

      actualizarCoordenadas(posicionInicial);

      // Iniciar monitorización continua.
      // watchPositionAsync devuelve una suscripción que hay que cancelar manualmente.
      refWatcher.current = await Location.watchPositionAsync(
        {
          accuracy: PRECISION_UBICACION,
          distanceInterval: DISTANCIA_MINIMA_METROS,
          // timeInterval: 5000, // También podemos limitar por tiempo (ms)
        },
        actualizarCoordenadas
      );
    } catch (error) {
      console.warn('[useUbicacion] Error al iniciar monitorización:', error);
      setEstado((prev) => ({ ...prev, permiso: 'desconocido', monitorizando: false }));
    }
  }

  /** Procesa una nueva posición GPS y actualiza el estado */
  function actualizarCoordenadas(posicion: Location.LocationObject) {
    setEstado((prev) => ({
      ...prev,
      coordenadas: {
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
      },
      precisionMetros: posicion.coords.accuracy ?? undefined,
      velocidadMs: posicion.coords.speed ?? undefined,
      ultimaActualizacion: posicion.timestamp,
    }));
  }

  /**
   * Solicita el permiso de ubicación en SEGUNDO PLANO.
   * Necesario para que las geocercas funcionen con la app cerrada.
   * Se llama solo cuando el usuario activa explícitamente las geocercas.
   * @returns true si se concedió el permiso background
   */
  async function solicitarPermisoBackground(): Promise<boolean> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      const concedido = status === 'granted';
      setEstado((prev) => ({ ...prev, permiso: concedido ? 'siempre' : prev.permiso }));
      return concedido;
    } catch {
      return false;
    }
  }

  return {
    ...estado,
    solicitarPermisoBackground,
    /** Alias conveniente para saber si hay coordenadas disponibles */
    disponible: estado.coordenadas !== null,
  };
}
