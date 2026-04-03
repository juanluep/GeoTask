/**
 * ============================================================
 * 🏷️ Store de Categorías — useCategoriaStore.ts
 * ============================================================
 *
 * Store para las categorías disponibles.
 * Se carga una vez al iniciar la app (las categorías no cambian frecuentemente).
 *
 * @version 1.0.0
 * ============================================================
 */

import { create } from 'zustand';
import { obtenerCategorias } from '../services/basedatos.servicio';
import type { Categoria } from '../models/categoria.modelo';

interface EstadoCategorias {
  categorias: Categoria[];
  cargando: boolean;
  cargarCategorias: () => Promise<void>;
  /** Devuelve una categoría por ID (para resolver nombres en la UI) */
  obtenerCategoriaPorId: (id: string) => Categoria | undefined;
}

export const useCategoriaStore = create<EstadoCategorias>((set, get) => ({
  categorias: [],
  cargando: false,

  cargarCategorias: async () => {
    set({ cargando: true });
    try {
      const categorias = await obtenerCategorias();
      set({ categorias, cargando: false });
    } catch {
      set({ cargando: false });
    }
  },

  obtenerCategoriaPorId: (id: string) => {
    return get().categorias.find((c) => c.id === id);
  },
}));
