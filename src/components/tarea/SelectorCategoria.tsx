/**
 * ============================================================
 * 🏷️ Selector de Categoría — SelectorCategoria.tsx
 * ============================================================
 *
 * Picker visual de categorías con iconos y colores.
 * Muestra un grid de chips de categoría y resalta la seleccionada.
 *
 * @version 1.0.0
 * ============================================================
 */

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colores, Espaciado, Radios } from '../../config/tema';
import type { Categoria } from '../../models/categoria.modelo';

interface PropiedadesSelectorCategoria {
  categorias: Categoria[];
  categoriaSeleccionadaId: string | null;
  alSeleccionar: (categoriaId: string) => void;
}

export function SelectorCategoria({
  categorias,
  categoriaSeleccionadaId,
  alSeleccionar,
}: PropiedadesSelectorCategoria) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.contenedor}
    >
      {categorias.map((categoria) => {
        const seleccionada = categoria.id === categoriaSeleccionadaId;
        return (
          <TouchableOpacity
            key={categoria.id}
            onPress={() => alSeleccionar(categoria.id)}
            style={[
              estilos.chip,
              seleccionada && {
                backgroundColor: categoria.color,
                borderColor: categoria.color,
              },
              !seleccionada && { borderColor: categoria.color + '40' },
            ]}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name={categoria.icono as any}
              size={18}
              color={seleccionada ? Colores.blanco : categoria.color}
            />
            <Text
              style={[
                estilos.textoChip,
                { color: seleccionada ? Colores.blanco : categoria.color },
              ]}
            >
              {categoria.nombre}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    paddingVertical: Espaciado.xs,
    gap: Espaciado.sm,
    paddingHorizontal: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaciado.xs,
    paddingHorizontal: Espaciado.md,
    paddingVertical: Espaciado.sm,
    borderRadius: Radios.completo,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  textoChip: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
});
