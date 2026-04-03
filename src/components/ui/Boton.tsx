/**
 * ============================================================
 * 🔘 Componente Botón — Boton.tsx
 * ============================================================
 *
 * Botón reutilizable con variantes: primario (gradiente índigo),
 * secundario (contorno), fantasma (solo texto).
 *
 * Regla del design system: radius 12px (no 16px) para botones,
 * lo que los hace sentir más "accionables" que los cards.
 *
 * @version 1.0.0
 * ============================================================
 */

import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colores, Espaciado, Radios } from '../../config/tema';

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro';

interface PropiedadesBoton {
  /** Texto visible en el botón */
  etiqueta: string;
  /** Función que se ejecuta al presionar */
  alPresionar: () => void;
  /** Estilo visual del botón */
  variante?: VarianteBoton;
  /** Si está en estado de carga (muestra spinner) */
  cargando?: boolean;
  /** Si el botón está deshabilitado */
  deshabilitado?: boolean;
  /** Estilos adicionales para el contenedor */
  estilo?: ViewStyle;
  /** Tamaño: 'sm' | 'md' | 'lg' */
  tamano?: 'sm' | 'md' | 'lg';
}

export function Boton({
  etiqueta,
  alPresionar,
  variante = 'primario',
  cargando = false,
  deshabilitado = false,
  estilo,
  tamano = 'md',
}: PropiedadesBoton) {
  const estaDeshabilitado = deshabilitado || cargando;

  // El contenido interno (texto o spinner) es igual para todas las variantes
  const contenido = cargando ? (
    <ActivityIndicator
      color={variante === 'primario' ? Colores.blanco : Colores.primario}
      size="small"
    />
  ) : (
    <Text style={[estilos.texto, estilos[`texto_${variante}`], estilos[`texto_${tamano}`]]}>
      {etiqueta}
    </Text>
  );

  // El botón primario usa LinearGradient como fondo
  if (variante === 'primario') {
    return (
      <TouchableOpacity
        onPress={alPresionar}
        disabled={estaDeshabilitado}
        activeOpacity={0.85}
        style={[estilos.base, estilos[`tamano_${tamano}`], estaDeshabilitado && estilos.deshabilitado, estilo]}
      >
        <LinearGradient
          colors={[Colores.primario, Colores.primarioClaro]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radios.boton }]}
        />
        {contenido}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={alPresionar}
      disabled={estaDeshabilitado}
      activeOpacity={0.8}
      style={[
        estilos.base,
        estilos[`tamano_${tamano}`],
        estilos[`variante_${variante}`],
        estaDeshabilitado && estilos.deshabilitado,
        estilo,
      ]}
    >
      {contenido}
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  base: {
    borderRadius: Radios.boton,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Tamaños
  tamano_sm: { height: 36, paddingHorizontal: Espaciado.md },
  tamano_md: { height: 52, paddingHorizontal: Espaciado.xl },
  tamano_lg: { height: 60, paddingHorizontal: Espaciado.xxl },
  // Variantes de fondo
  variante_secundario: {
    borderWidth: 1.5,
    borderColor: Colores.primario,
    backgroundColor: 'transparent',
  },
  variante_fantasma: {
    backgroundColor: 'transparent',
  },
  variante_peligro: {
    backgroundColor: Colores.error,
  },
  // Texto base
  texto: {
    fontFamily: 'Inter_600SemiBold',
  },
  // Texto por variante
  texto_primario: { color: Colores.blanco, fontSize: 16 },
  texto_secundario: { color: Colores.primario, fontSize: 16 },
  texto_fantasma: { color: Colores.primario, fontSize: 16 },
  texto_peligro: { color: Colores.blanco, fontSize: 16 },
  // Texto por tamaño
  texto_sm: { fontSize: 13 },
  texto_md: { fontSize: 16 },
  texto_lg: { fontSize: 18 },
  // Estado deshabilitado
  deshabilitado: { opacity: 0.45 },
} as any);
