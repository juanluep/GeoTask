/**
 * ============================================================
 * ⚙️ Store de Configuración — useConfigStore.ts
 * ============================================================
 *
 * Store global para las preferencias del usuario.
 * Se sincroniza con la tabla `configuracion` de SQLite.
 *
 * @version 1.0.0
 * ============================================================
 */

import { create } from 'zustand';
import { leerConfiguracion, guardarConfiguracion } from '../services/basedatos.servicio';
import {
  type ConfiguracionUsuario,
  type ModoTransporte,
  CONFIGURACION_PREDETERMINADA,
} from '../models/usuario.modelo';

import { registrarTodasLasGeocercas } from '../services/geocerca.servicio';

interface EstadoConfiguracion {
  config: ConfiguracionUsuario;
  cargando: boolean;

  /** Carga la configuración desde SQLite al iniciar la app */
  cargarConfiguracion: () => Promise<void>;

  /** Actualiza una preferencia específica y la persiste en SQLite */
  actualizarPreferencia: <K extends keyof ConfiguracionUsuario>(
    clave: K,
    valor: ConfiguracionUsuario[K]
  ) => Promise<void>;
}

export const useConfigStore = create<EstadoConfiguracion>((set, get) => ({
  config: CONFIGURACION_PREDETERMINADA,
  cargando: false,

  cargarConfiguracion: async () => {
    set({ cargando: true });
    try {
      // Leemos cada clave de configuración desde SQLite
      const claves = Object.keys(CONFIGURACION_PREDETERMINADA) as (keyof ConfiguracionUsuario)[];
      const configCargada = { ...CONFIGURACION_PREDETERMINADA };

      for (const clave of claves) {
        const valor = await leerConfiguracion<ConfiguracionUsuario[typeof clave]>(clave);
        if (valor !== null) {
          (configCargada as any)[clave] = valor;
        }
      }

      set({ config: configCargada, cargando: false });
    } catch {
      set({ cargando: false });
    }
  },

  actualizarPreferencia: async (clave, valor) => {
    // Actualización optimista: actualizamos el estado local inmediatamente
    // y luego persistimos en SQLite en segundo plano
    set((estado) => ({
      config: { ...estado.config, [clave]: valor },
    }));
    await guardarConfiguracion(clave as string, valor);

    // Si cambiamos el radio por defecto o la verificación de horarios,
    // refrescamos las geocercas registradas.
    if (clave === 'radioPreferido' || clave === 'verificarHorarios' || clave === 'ahorroBateria') {
      registrarTodasLasGeocercas().catch(() => {});
    }
  },
}));
