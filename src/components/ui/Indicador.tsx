/**
 * ============================================================
 * ⏳ Componente Indicador — Indicador.tsx
 * ============================================================
 *
 * Spinner de carga con variantes: inline (pequeño, dentro de listas)
 * y pantalla completa (overlay semitransparente).
 *
 * @version 1.0.0
 * ============================================================
 */

import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colores, Espaciado } from '../../config/tema';

interface PropiedadesIndicador {
  /** Tipo de visualización */
  variante?: 'inline' | 'pantalla-completa';
  /** Mensaje opcional debajo del spinner */
  mensaje?: string;
}

export function Indicador({
  variante = 'inline',
  mensaje,
}: PropiedadesIndicador) {
  if (variante === 'pantalla-completa') {
    return (
      <View style={estilos.overlay}>
        <View style={estilos.tarjetaSpinner}>
          <ActivityIndicator size="large" color={Colores.primario} />
          {mensaje && <Text style={estilos.mensaje}>{mensaje}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={estilos.inline}>
      <ActivityIndicator size="small" color={Colores.primario} />
      {mensaje && <Text style={estilos.mensajeInline}>{mensaje}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  tarjetaSpinner: {
    backgroundColor: Colores.blanco,
    borderRadius: 16,
    padding: Espaciado.xxl,
    alignItems: 'center',
    gap: Espaciado.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Espaciado.xl,
    gap: Espaciado.sm,
  },
  mensaje: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colores.sobreSuperficieVariante,
    textAlign: 'center',
  },
  mensajeInline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colores.sobreSuperficieVariante,
  },
});
