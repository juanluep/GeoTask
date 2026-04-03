/**
 * ============================================================
 * 🔐 Pantalla de Permisos — PantallaPermisos.tsx
 * ============================================================
 *
 * UI explicativa para solicitar permisos de ubicación.
 * Mostrada cuando el usuario intenta activar geocercas sin
 * tener el permiso de background location concedido.
 *
 * Buenas prácticas de permisos en mobile:
 * 1. Explicar ANTES de pedir el permiso (así el usuario entiende por qué)
 * 2. Pedir el permiso foreground primero, background después
 * 3. Si se deniega, explicar cómo habilitarlo manualmente en Ajustes del SO
 *
 * @version 1.0.0
 * ============================================================
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colores, Espaciado, Radios } from '../../config/tema';

interface PropiedadesPantallaPermisos {
  /** Tipo de permiso a explicar */
  tipo: 'ubicacion-foreground' | 'ubicacion-background' | 'notificaciones';
  /** Callback al pulsar el botón de conceder */
  alConceder: () => void;
  /** Callback al pulsar "Ahora no" */
  alRechazar?: () => void;
}

const CONTENIDO_PERMISOS = {
  'ubicacion-foreground': {
    icono: 'location' as const,
    titulo: 'Necesitamos tu ubicación',
    descripcion:
      'GeoTask usa tu ubicación para mostrarte las tareas cercanas en el mapa y calcular distancias en tiempo real.',
    motivos: [
      'Ver tareas cercanas ordenadas por distancia',
      'Mostrar tu posición en el mapa',
      'Calcular la distancia a cada lugar',
    ],
    botonConceder: 'Conceder permiso de ubicación',
  },
  'ubicacion-background': {
    icono: 'navigate' as const,
    titulo: 'Ubicación en segundo plano',
    descripcion:
      'Para que las geocercas funcionen con la app cerrada, necesitamos acceder a tu ubicación en todo momento.',
    motivos: [
      'Detectar cuando te acercas a un lugar con tareas',
      'Enviar avisos aunque la app esté cerrada',
      'No consumir batería innecesariamente (usamos geofencing nativo)',
    ],
    botonConceder: 'Permitir "Siempre"',
  },
  'notificaciones': {
    icono: 'notifications' as const,
    titulo: 'Activa las notificaciones',
    descripcion:
      'Las notificaciones push son la forma en que GeoTask te avisa cuando estás cerca de un lugar con tareas pendientes.',
    motivos: [
      'Recibir avisos de proximidad instantáneos',
      'No perderte ningún mandado',
      'Puedes configurar sonido y vibración en Ajustes',
    ],
    botonConceder: 'Activar notificaciones',
  },
};

export function PantallaPermisos({
  tipo,
  alConceder,
  alRechazar,
}: PropiedadesPantallaPermisos) {
  const contenido = CONTENIDO_PERMISOS[tipo];

  return (
    <View style={estilos.contenedor}>
      {/* Icono grande */}
      <View style={estilos.circuloIcono}>
        <Ionicons name={contenido.icono} size={48} color={Colores.primario} />
      </View>

      {/* Título y descripción */}
      <Text style={estilos.titulo}>{contenido.titulo}</Text>
      <Text style={estilos.descripcion}>{contenido.descripcion}</Text>

      {/* Lista de motivos */}
      <View style={estilos.listaMotivos}>
        {contenido.motivos.map((motivo, i) => (
          <View key={i} style={estilos.filaMotivo}>
            <Ionicons name="checkmark-circle" size={18} color={Colores.exito} />
            <Text style={estilos.textoMotivo}>{motivo}</Text>
          </View>
        ))}
      </View>

      {/* Botones */}
      <TouchableOpacity style={estilos.botonConceder} onPress={alConceder} activeOpacity={0.85}>
        <Text style={estilos.textoBotonConceder}>{contenido.botonConceder}</Text>
      </TouchableOpacity>

      {alRechazar && (
        <TouchableOpacity onPress={alRechazar} style={estilos.botonRechazar}>
          <Text style={estilos.textoBotonRechazar}>Ahora no</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    padding: Espaciado.xl,
    gap: Espaciado.base,
  },
  circuloIcono: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colores.primarioContenedor,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Espaciado.sm,
  },
  titulo: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colores.sobreSuperficie,
    textAlign: 'center',
  },
  descripcion: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colores.sobreSuperficieVariante,
    textAlign: 'center',
    lineHeight: 22,
  },
  listaMotivos: {
    alignSelf: 'stretch',
    gap: Espaciado.sm,
    backgroundColor: Colores.superficieContenedor,
    borderRadius: Radios.tarjeta,
    padding: Espaciado.base,
    marginTop: Espaciado.sm,
  },
  filaMotivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaciado.sm,
  },
  textoMotivo: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colores.sobreSuperficie,
    flex: 1,
  },
  botonConceder: {
    width: '100%',
    height: 52,
    backgroundColor: Colores.primario,
    borderRadius: Radios.boton,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Espaciado.md,
  },
  textoBotonConceder: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colores.blanco,
  },
  botonRechazar: {
    paddingVertical: Espaciado.sm,
  },
  textoBotonRechazar: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colores.sobreSuperficieVariante,
  },
});
