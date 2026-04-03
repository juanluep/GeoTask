/**
 * ============================================================
 * 🚗 Hook Radio Dinámico — useRadioDinamico.ts
 * ============================================================
 *
 * Calcula el radio óptimo de geocerca según la velocidad del usuario.
 *
 * Lógica:
 * - Velocidad < 2 m/s (~7km/h) → peatón → radio base
 * - Velocidad 2-7 m/s (~7-25km/h) → bicicleta → radio × 1.5
 * - Velocidad > 7 m/s (~25km/h) → coche → radio × 3
 *
 * El ajuste es gradual para evitar oscilaciones cuando el usuario
 * va en transporte público (paradas, semáforos).
 *
 * @version 1.0.0
 * ============================================================
 */

import { useMemo } from 'react';
import { useConfigStore } from '../stores/useConfigStore';

export type ModoDetectado = 'peatonal' | 'bicicleta' | 'coche';

/**
 * Infiere el modo de transporte a partir de la velocidad en m/s.
 */
export function inferirModoTransporte(velocidadMs: number | undefined): ModoDetectado {
  if (!velocidadMs || velocidadMs < 2) return 'peatonal';
  if (velocidadMs < 7) return 'bicicleta';
  return 'coche';
}

/**
 * Calcula el multiplicador de radio para el modo detectado.
 */
export function multiplicadorRadio(modo: ModoDetectado): number {
  switch (modo) {
    case 'peatonal':   return 1.0;
    case 'bicicleta':  return 1.5;
    case 'coche':      return 3.0;
  }
}

/**
 * Hook que devuelve el radio ajustado según la velocidad actual.
 *
 * @param velocidadMs - Velocidad en m/s del hook useUbicacion
 * @param radioBase - Radio configurado en la tarea o en ajustes
 */
export function useRadioDinamico(
  velocidadMs: number | undefined,
  radioBase?: number
) {
  const { config } = useConfigStore();

  return useMemo(() => {
    const base = radioBase ?? config.radioPreferido;

    // Si el usuario fijó manualmente el modo (no automático), no ajustamos
    if (config.modoTransporte !== 'automatico') {
      const modoFijo = config.modoTransporte as ModoDetectado;
      return {
        radioAjustado: Math.round(base * multiplicadorRadio(modoFijo)),
        modoDetectado: modoFijo,
        esAutomatico: false,
      };
    }

    const modoDetectado = inferirModoTransporte(velocidadMs);
    const multiplicador = multiplicadorRadio(modoDetectado);

    return {
      radioAjustado: Math.round(base * multiplicador),
      modoDetectado,
      multiplicador,
      esAutomatico: true,
    };
  }, [velocidadMs, radioBase, config.radioPreferido, config.modoTransporte]);
}
