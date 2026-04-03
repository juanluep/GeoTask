/**
 * ============================================================
 * ✏️ Componente EntradaTexto — EntradaTexto.tsx
 * ============================================================
 *
 * Input de texto estilizado sin borde (principio "No-Line").
 * El fondo cambia sutilmente al hacer foco para indicar activación.
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  KeyboardTypeOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colores, Espaciado, Radios } from '../../config/tema';

interface PropiedadesEntradaTexto {
  /** Etiqueta visible encima del input */
  etiqueta?: string;
  /** Texto de placeholder */
  marcador?: string;
  /** Valor actual del input */
  valor: string;
  /** Función que se llama al cambiar el texto */
  alCambiar: (texto: string) => void;
  /** Nombre del icono de Ionicons (opcional) */
  icono?: keyof typeof Ionicons.glyphMap;
  /** Tipo de teclado */
  tipoTeclado?: KeyboardTypeOptions;
  /** Si el texto debe estar oculto (contraseñas) */
  esContrasena?: boolean;
  /** Mensaje de error a mostrar debajo del input */
  error?: string;
  /** Número de líneas (para inputs multilínea) */
  lineas?: number;
  estilo?: ViewStyle;
}

export function EntradaTexto({
  etiqueta,
  marcador,
  valor,
  alCambiar,
  icono,
  tipoTeclado = 'default',
  esContrasena = false,
  error,
  lineas = 1,
  estilo,
}: PropiedadesEntradaTexto) {
  // Controlamos el estado de foco para cambiar el fondo del input
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={[estilos.contenedor, estilo]}>
      {/* Etiqueta superior */}
      {etiqueta && (
        <Text style={estilos.etiqueta}>{etiqueta}</Text>
      )}

      {/* Campo de entrada */}
      <View
        style={[
          estilos.campo,
          enfocado && estilos.campoEnfocado,
          error && estilos.campoError,
          lineas > 1 && { height: lineas * 24 + Espaciado.xl },
        ]}
      >
        {icono && (
          <Ionicons
            name={icono}
            size={20}
            color={enfocado ? Colores.primario : Colores.sobreSuperficieVariante}
            style={estilos.iconoCampo}
          />
        )}
        <TextInput
          style={[estilos.input, lineas > 1 && { textAlignVertical: 'top' }]}
          placeholder={marcador}
          placeholderTextColor={Colores.sobreSuperficieVariante}
          value={valor}
          onChangeText={alCambiar}
          keyboardType={tipoTeclado}
          secureTextEntry={esContrasena}
          multiline={lineas > 1}
          numberOfLines={lineas}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
        />
      </View>

      {/* Mensaje de error */}
      {error && (
        <Text style={estilos.textoError}>{error}</Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: Espaciado.xs,
  },
  etiqueta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colores.sobreSuperficieVariante,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colores.superficieContenedor,
    borderRadius: Radios.boton,
    paddingHorizontal: Espaciado.base,
    minHeight: 52,
    // Sin borde (principio "No-Line" del design system)
  },
  campoEnfocado: {
    // Al hacer foco, el fondo se vuelve ligeramente más claro
    // y añadimos el "ghost border" sutil (solo visible para accesibilidad)
    backgroundColor: Colores.superficieContenedorBaja,
    borderWidth: 1,
    borderColor: Colores.primario + '30', // 30 = 19% de opacidad en hex
  },
  campoError: {
    borderWidth: 1,
    borderColor: Colores.error + '50',
  },
  iconoCampo: {
    marginRight: Espaciado.sm,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colores.sobreSuperficie,
  },
  textoError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.error,
  },
});
