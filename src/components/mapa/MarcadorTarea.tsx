/**
 * ============================================================
 * 📍 Marcador de Tarea — MarcadorTarea.tsx
 * ============================================================
 *
 * Marcador personalizado para el mapa que muestra una tarea.
 * Incluye:
 * - Pin con el color de la categoría
 * - Callout (popup) con título, lugar y botón para ver detalle
 * - Círculo semi-transparente para visualizar el radio de geocerca
 *
 * ¿Por qué marcadores personalizados y no los por defecto?
 * Los marcadores por defecto son siempre rojos/azules. Nuestros marcadores
 * de colores por categoría permiten identificar de un vistazo qué tipo
 * de mandado hay en cada zona (farmacia rosa, banco naranja, etc.)
 *
 * @version 1.0.0
 * ============================================================
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Marker, Callout, Circle } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colores, Radios } from '../../config/tema';
import type { Tarea } from '../../models/tarea.modelo';
import type { Categoria } from '../../models/categoria.modelo';

interface PropiedadesMarcadorTarea {
  tarea: Tarea;
  categoria?: Categoria;
  /** Callback al pulsar "Ver detalle" en el callout */
  alVerDetalle: (tareaId: string) => void;
  /** Si mostrar el círculo de radio de geocerca */
  mostrarRadio?: boolean;
}

export function MarcadorTarea({
  tarea,
  categoria,
  alVerDetalle,
  mostrarRadio = true,
}: PropiedadesMarcadorTarea) {
  const colorCategoria = categoria?.color ?? Colores.primario;
  const iconoCategoria = categoria?.icono ?? 'map-marker';

  // En Android, tracksViewChanges:false desde el inicio puede impedir el render
  // del marcador personalizado. Empezamos en true y lo desactivamos tras el primer frame.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracksViewChanges(false), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* ── Círculo de radio de geocerca ── */}
      {mostrarRadio && tarea.geocercaActiva && (
        <Circle
          center={{ latitude: tarea.latitud, longitude: tarea.longitud }}
          radius={tarea.radioProximidad}
          fillColor={colorCategoria + '18'}   // 18 hex = ~10% opacidad
          strokeColor={colorCategoria + '50'} // 50 hex = ~31% opacidad
          strokeWidth={1.5}
        />
      )}

      {/* ── Marcador pin ── */}
      <Marker
        coordinate={{ latitude: tarea.latitud, longitude: tarea.longitud }}
        // tracksViewChanges empieza en true para garantizar el render inicial en Android,
        // y cambia a false tras 300ms para evitar re-renders innecesarios en cada frame.
        tracksViewChanges={tracksViewChanges}
      >
        {/* Pin personalizado con icono de categoría */}
        <View style={estilos.contenedorPin}>
          <View style={[estilos.pin, { backgroundColor: colorCategoria }]}>
            <MaterialCommunityIcons
              name={iconoCategoria as any}
              size={16}
              color={Colores.blanco}
            />
          </View>
          {/* Triángulo inferior del pin */}
          <View style={[estilos.triangulo, { borderTopColor: colorCategoria }]} />
        </View>

        {/* Callout: popup que aparece al tocar el marcador */}
        <Callout
          tooltip
          onPress={() => alVerDetalle(tarea.id)}
          style={estilos.callout}
        >
          <View style={estilos.contenidoCallout}>
            <Text style={estilos.tituloCallout} numberOfLines={2}>
              {tarea.titulo}
            </Text>
            {tarea.nombreLugar && (
              <Text style={estilos.lugarCallout} numberOfLines={1}>
                {tarea.nombreLugar}
              </Text>
            )}
            <Text style={estilos.radioCallout}>
              Radio: {tarea.radioProximidad >= 1000
                ? `${tarea.radioProximidad / 1000} km`
                : `${tarea.radioProximidad} m`}
            </Text>
            <TouchableOpacity style={estilos.botonDetalle}>
              <Text style={estilos.textoBotonDetalle}>Ver detalle →</Text>
            </TouchableOpacity>
          </View>
        </Callout>
      </Marker>
    </>
  );
}

const estilos = StyleSheet.create({
  // ── Pin ──
  contenedorPin: {
    alignItems: 'center',
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colores.blanco,
    // Sombra del pin sobre el mapa
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  triangulo: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor se aplica dinámicamente con el color de la categoría
    marginTop: -1,
  },
  // ── Callout ──
  callout: {
    width: 200,
  },
  contenidoCallout: {
    backgroundColor: Colores.blanco,
    borderRadius: Radios.tarjeta,
    padding: 12,
    gap: 4,
    // Sombra del callout
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  tituloCallout: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colores.sobreSuperficie,
  },
  lugarCallout: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colores.sobreSuperficieVariante,
  },
  radioCallout: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colores.sobreSuperficieVariante,
  },
  botonDetalle: {
    marginTop: 6,
    backgroundColor: Colores.primarioContenedor,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  textoBotonDetalle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colores.primario,
  },
});
