/**
 * ============================================================
 * 🃏 Componente Tarjeta — Tarjeta.tsx
 * ============================================================
 *
 * Contenedor con el estilo de "card" del design system.
 * Radius: 16px (no usar 12px en cards — eso es para botones).
 * Sin bordes — la separación se logra con color tonal.
 *
 * @version 1.0.0
 * ============================================================
 */

import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colores, Radios, Sombras, Espaciado } from '../../config/tema';

interface PropiedadesTarjeta {
  children: React.ReactNode;
  estilo?: ViewStyle;
  /** Si la tarjeta tiene padding interno o no (útil para imágenes full-bleed) */
  conPadding?: boolean;
  /** Elevación visual: 'ninguna' | 'sutil' */
  elevacion?: 'ninguna' | 'sutil';
}

export function Tarjeta({
  children,
  estilo,
  conPadding = true,
  elevacion = 'sutil',
}: PropiedadesTarjeta) {
  return (
    <View
      style={[
        estilos.base,
        conPadding && estilos.conPadding,
        elevacion === 'sutil' && Sombras.sutil,
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    backgroundColor: Colores.blanco,
    borderRadius: Radios.tarjeta,
  },
  conPadding: {
    padding: Espaciado.base,
  },
});
