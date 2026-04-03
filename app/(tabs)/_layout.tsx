/**
 * ============================================================
 * 📱 Layout de Tabs — app/(tabs)/_layout.tsx
 * ============================================================
 *
 * Define la barra de navegación inferior con 5 pestañas principales.
 * Esta es la pantalla "principal" de la app, visible después del login.
 *
 * Barra de tabs según el diseño UX:
 * 🏠 Home | 🗺️ Mapa | ➕ Nueva | 🔍 Buscar | ⚙️ Ajustes
 *
 * El tab central "Nueva" tiene un tratamiento especial:
 * botón prominente con fondo primario índigo.
 *
 * @version 1.0.0
 * ============================================================
 */

import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colores, Radios } from '../../src/config/tema';

// ──────────────────────────────────────────────
// 🔲 Componente: Botón central personalizado
// El tab "Nueva Tarea" tiene un diseño especial: botón circular
// con fondo degradado índigo, elevado sobre la barra de tabs.
// ──────────────────────────────────────────────
function BotonNuevaTarea({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={estilos.botonNuevo} activeOpacity={0.8}>
      <View style={estilos.circuloBotonNuevo}>
        <Ionicons name="add" size={28} color={Colores.blanco} />
      </View>
    </TouchableOpacity>
  );
}

export default function LayoutTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Colores de la barra inferior
        tabBarActiveTintColor: Colores.primario,
        tabBarInactiveTintColor: Colores.sobreSuperficieVariante,
        tabBarStyle: estilos.barraTabs,
        tabBarLabelStyle: estilos.etiquetaTab,
      }}
    >
      {/* Tab 1: Lista de tareas (pantalla de inicio) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Tab 2: Mapa interactivo */}
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Tab 3: Nueva tarea — botón especial central */}
      <Tabs.Screen
        name="nueva"
        options={{
          title: '',
          tabBarButton: (props) => (
            <BotonNuevaTarea onPress={() => props.onPress?.(props as any)} />
          ),
        }}
      />

      {/* Tab 4: Búsqueda por zona */}
      <Tabs.Screen
        name="buscar"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Tab 5: Ajustes de la app */}
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  barraTabs: {
    backgroundColor: Colores.blanco,
    // Sin borde superior — la separación se consigue con la sombra sutil
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: Colores.sobreSuperficie,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  etiquetaTab: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  botonNuevo: {
    // Centramos el botón verticalmente, sobresale de la barra de tabs
    top: -16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
  },
  circuloBotonNuevo: {
    width: 56,
    height: 56,
    borderRadius: Radios.completo,
    backgroundColor: Colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra del botón flotante
    shadowColor: Colores.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
