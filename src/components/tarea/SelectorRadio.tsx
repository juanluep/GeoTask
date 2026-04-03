/**
 * ============================================================
 * 📏 Selector de Radio — SelectorRadio.tsx
 * ============================================================
 *
 * Slider para seleccionar el radio de la geocerca en metros.
 * Rango: 100m a 2000m. Valores predefinidos: 200, 500, 1000, 2000.
 *
 * Usamos botones discretos en lugar de un slider continuo porque:
 * 1. Los sliders nativos tienen diferencias de comportamiento iOS/Android
 * 2. Los valores discretos son más fáciles de entender para el usuario
 * 3. Evitamos añadir la dependencia @react-native-community/slider en Fase 1
 *
 * @version 1.0.0
 * ============================================================
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colores, Espaciado, Radios } from '../../config/tema';

const OPCIONES_RADIO = [
  { valor: 100, etiqueta: '100m', descripcion: 'Muy cerca' },
  { valor: 200, etiqueta: '200m', descripcion: 'A pie' },
  { valor: 500, etiqueta: '500m', descripcion: 'Recomendado' },
  { valor: 1000, etiqueta: '1km', descripcion: 'Zona amplia' },
  { valor: 2000, etiqueta: '2km', descripcion: 'En coche' },
];

interface PropiedadesSelectorRadio {
  valorActual: number;
  alCambiar: (valor: number) => void;
}

export function SelectorRadio({ valorActual, alCambiar }: PropiedadesSelectorRadio) {
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaOpciones}>
        {OPCIONES_RADIO.map((opcion) => {
          const seleccionada = opcion.valor === valorActual;
          return (
            <TouchableOpacity
              key={opcion.valor}
              onPress={() => alCambiar(opcion.valor)}
              style={[estilos.opcion, seleccionada && estilos.opcionSeleccionada]}
              activeOpacity={0.75}
            >
              <Text style={[estilos.etiquetaOpcion, seleccionada && estilos.textoSeleccionado]}>
                {opcion.etiqueta}
              </Text>
              {seleccionada && (
                <Text
                  style={estilos.descripcionOpcion}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {opcion.descripcion}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={estilos.textoAyuda}>
        Recibirás una notificación cuando estés a {valorActual >= 1000 ? `${valorActual / 1000}km` : `${valorActual}m`} del lugar.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: Espaciado.sm,
  },
  filaOpciones: {
    flexDirection: 'row',
    gap: Espaciado.xs,
  },
  opcion: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Espaciado.sm,
    borderRadius: Radios.boton,
    backgroundColor: Colores.superficieContenedor,
    minHeight: 44,
  },
  opcionSeleccionada: {
    backgroundColor: Colores.primarioContenedor,
  },
  etiquetaOpcion: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colores.sobreSuperficieVariante,
  },
  textoSeleccionado: {
    color: Colores.primario,
  },
  descripcionOpcion: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colores.primario,
    marginTop: 2,
  },
  textoAyuda: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.sobreSuperficieVariante,
    textAlign: 'center',
  },
});
