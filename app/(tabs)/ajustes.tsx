/**
 * ============================================================
 * Pantalla Ajustes — app/(tabs)/ajustes.tsx
 * ============================================================
 *
 * Preferencias del usuario con persistencia en SQLite.
 * Fase 4: añade sección de exportar datos y estadísticas básicas.
 *
 * @version 3.0.0 (Fase 4)
 * ============================================================
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConfigStore } from '../../src/stores/useConfigStore';
import { SelectorRadio } from '../../src/components/tarea/SelectorRadio';
import { Colores, Espaciado, Radios, Sombras } from '../../src/config/tema';
import type { ModoTransporte } from '../../src/models/usuario.modelo';
import { exportarTareasJSON, exportarTareasCSV } from '../../src/services/exportar.servicio';
import {
  solicitarPermisoCalendario,
  crearEventoTarea,
  eliminarEventoTarea,
} from '../../src/services/calendario.servicio';
import { obtenerEstadisticas, obtenerTareas, type Estadisticas } from '../../src/services/basedatos.servicio';

const MODOS_TRANSPORTE: { valor: ModoTransporte; icono: keyof typeof Ionicons.glyphMap; etiqueta: string }[] = [
  { valor: 'automatico', icono: 'phone-portrait-outline', etiqueta: 'Auto' },
  { valor: 'peatonal', icono: 'walk-outline', etiqueta: 'A pie' },
  { valor: 'bicicleta', icono: 'bicycle-outline', etiqueta: 'Bici' },
  { valor: 'coche', icono: 'car-outline', etiqueta: 'Coche' },
];

export default function PantallaAjustes() {
  const { config, cargarConfiguracion, actualizarPreferencia } = useConfigStore();
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  // Recargar estadísticas cada vez que el usuario vuelve a esta pestaña,
  // para que el contador de pendientes refleje las tareas creadas/completadas recientemente.
  useFocusEffect(useCallback(() => {
    cargarEstadisticas();
  }, [cargarEstadisticas]));

  const cargarEstadisticas = useCallback(async () => {
    try {
      const stats = await obtenerEstadisticas();
      setEstadisticas(stats);
    } catch (error) {
      console.warn('[ajustes] Error cargando estadísticas:', error);
      // Mostrar ceros en lugar de spinner infinito si falla la consulta
      setEstadisticas({ totalCompletadas: 0, completadasEsteMes: 0, pendientes: 0, categoriaMasUsada: null });
    }
  }, []);

  // ── Exportar ──────────────────────────────────

  const handleExportarJSON = useCallback(async () => {
    setExportando(true);
    try {
      await exportarTareasJSON();
    } catch {
      Alert.alert('Error', 'No se pudo exportar las tareas. Inténtalo de nuevo.');
    } finally {
      setExportando(false);
    }
  }, []);

  const handleExportarCSV = useCallback(async () => {
    setExportando(true);
    try {
      await exportarTareasCSV();
    } catch {
      Alert.alert('Error', 'No se pudo exportar las tareas. Inténtalo de nuevo.');
    } finally {
      setExportando(false);
    }
  }, []);

  // ── Calendario ───────────────────────────────

  const handleToggleCalendario = useCallback(async (activar: boolean) => {
    // Guardar la preferencia en el store
    await actualizarPreferencia('sincronizarCalendario', activar);

    if (activar) {
      // Solicitar permiso y sincronizar tareas con fechaLimite existentes
      const permiso = await solicitarPermisoCalendario();
      if (!permiso) {
        await actualizarPreferencia('sincronizarCalendario', false);
        Alert.alert(
          'Permiso denegado',
          'Necesitas conceder acceso al calendario en Ajustes del sistema.'
        );
        return;
      }

      // Crear eventos para todas las tareas pendientes con fecha límite
      const tareasPendientes = await obtenerTareas(false);
      const conFechaLimite = tareasPendientes.filter((t) => t.fechaLimite);
      let creados = 0;
      for (const tarea of conFechaLimite) {
        const eventoId = await crearEventoTarea(
          tarea.id,
          tarea.titulo,
          tarea.fechaLimite!,
          tarea.nombreLugar ?? tarea.direccion
        );
        if (eventoId) creados++;
      }
      if (creados > 0) {
        Alert.alert('Calendario sincronizado', `Se añadieron ${creados} evento(s) al calendario.`);
      }
    } else {
      // Eliminar todos los eventos de calendario asociados a tareas pendientes
      const tareasPendientes = await obtenerTareas(false);
      for (const tarea of tareasPendientes) {
        await eliminarEventoTarea(tarea.id);
      }
    }
  }, [actualizarPreferencia]);

  return (
    <SafeAreaView style={estilos.contenedor} edges={['top']}>
      {/* Cabecera */}
      <View style={estilos.cabecera}>
        <Text style={estilos.tituloCabecera}>Ajustes</Text>
      </View>

      <ScrollView contentContainerStyle={estilos.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Estadísticas ── */}
        <Text style={estilos.tituloSeccion}>Resumen de actividad</Text>
        {estadisticas ? (
          <View style={estilos.tarjeta}>
            <View style={estilos.filaStats}>
              <TarjetaStat
                valor={estadisticas.totalCompletadas}
                etiqueta="Completadas"
                icono="checkmark-circle-outline"
                color={Colores.primario}
              />
              <TarjetaStat
                valor={estadisticas.completadasEsteMes}
                etiqueta="Este mes"
                icono="calendar-outline"
                color="#4CAF50"
              />
              <TarjetaStat
                valor={estadisticas.pendientes}
                etiqueta="Pendientes"
                icono="time-outline"
                color="#FF9800"
              />
            </View>
            {estadisticas.categoriaMasUsada && (
              <View style={estilos.filaCategoriaDestacada}>
                <View style={[estilos.puntoCat, { backgroundColor: estadisticas.categoriaMasUsada.color }]} />
                <Text style={estilos.textoCategoriaDestacada}>
                  Categoría más usada:{' '}
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {estadisticas.categoriaMasUsada.nombre}
                  </Text>
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[estilos.tarjeta, { alignItems: 'center', paddingVertical: Espaciado.xl }]}>
            <ActivityIndicator color={Colores.primario} />
          </View>
        )}

        {/* ── Exportar datos ── */}
        <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Exportar datos</Text>
        <View style={estilos.tarjeta}>
          <Text style={estilos.subtextoAjuste}>
            Guarda una copia de tus tareas para transferirlas a otro dispositivo o hacer una copia de seguridad.
          </Text>
          <View style={estilos.filaExportar}>
            <TouchableOpacity
              style={[estilos.botonExportar, exportando && { opacity: 0.6 }]}
              onPress={handleExportarJSON}
              disabled={exportando}
              activeOpacity={0.75}
            >
              {exportando ? (
                <ActivityIndicator size="small" color={Colores.primario} />
              ) : (
                <Ionicons name="code-download-outline" size={20} color={Colores.primario} />
              )}
              <Text style={estilos.textoBotonExportar}>Exportar JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[estilos.botonExportar, exportando && { opacity: 0.6 }]}
              onPress={handleExportarCSV}
              disabled={exportando}
              activeOpacity={0.75}
            >
              {exportando ? (
                <ActivityIndicator size="small" color={Colores.primario} />
              ) : (
                <Ionicons name="document-text-outline" size={20} color={Colores.primario} />
              )}
              <Text style={estilos.textoBotonExportar}>Exportar CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Geocercas ── */}
        <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Geocercas y avisos</Text>
        <View style={estilos.tarjeta}>
          <View style={estilos.filaAjuste}>
            <Text style={estilos.etiquetaAjuste}>Radio por defecto</Text>
            <Text style={estilos.subtextoAjuste}>Se aplica al crear nuevas tareas</Text>
          </View>
          <SelectorRadio
            valorActual={config.radioPreferido}
            alCambiar={(v) => actualizarPreferencia('radioPreferido', v)}
          />
        </View>

        {/* ── Modo de transporte ── */}
        <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Modo de transporte</Text>
        <View style={estilos.tarjeta}>
          <Text style={estilos.subtextoAjuste}>
            Afecta al radio de aviso dinámico. "Auto" lo detecta por velocidad de movimiento.
          </Text>
          <View style={estilos.filaTransporte}>
            {MODOS_TRANSPORTE.map((modo) => {
              const activo = config.modoTransporte === modo.valor;
              return (
                <TouchableOpacity
                  key={modo.valor}
                  onPress={() => actualizarPreferencia('modoTransporte', modo.valor)}
                  style={[estilos.chipTransporte, activo && estilos.chipTransporteActivo]}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={modo.icono}
                    size={20}
                    color={activo ? Colores.primario : Colores.sobreSuperficieVariante}
                  />
                  <Text style={[estilos.textoChipTransporte, activo && { color: Colores.primario }]}>
                    {modo.etiqueta}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Notificaciones ── */}
        <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Notificaciones</Text>
        <View style={estilos.tarjeta}>
          <FilaSwitch
            etiqueta="Sonido"
            subtexto="Reproducir sonido al llegar cerca de una tarea"
            valor={config.notificacionesSonido}
            alCambiar={(v) => actualizarPreferencia('notificacionesSonido', v)}
          />
          <Separador />
          <FilaSwitch
            etiqueta="Vibración"
            subtexto="Vibrar al recibir alertas de proximidad"
            valor={config.notificacionesVibracion}
            alCambiar={(v) => actualizarPreferencia('notificacionesVibracion', v)}
          />
          <Separador />
          <FilaSwitch
            etiqueta="Verificar horarios"
            subtexto="Solo avisar si el establecimiento está abierto según OSM"
            valor={config.verificarHorarios}
            alCambiar={(v) => actualizarPreferencia('verificarHorarios', v)}
          />
        </View>

        {/* ── Sistema ── */}
        <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Sistema</Text>
        <View style={estilos.tarjeta}>
          <FilaSwitch
            etiqueta="Ahorro de batería"
            subtexto="Reduce la precisión del GPS para consumir menos energía"
            valor={config.ahorroBateria}
            alCambiar={(v) => actualizarPreferencia('ahorroBateria', v)}
          />
          <Separador />
          <FilaSwitch
            etiqueta="Sincronizar calendario"
            subtexto="Añade tareas con fecha límite al calendario del dispositivo"
            valor={config.sincronizarCalendario}
            alCambiar={handleToggleCalendario}
          />
        </View>

        {/* Versión */}
        <Text style={estilos.version}>GeoTask v1.0.0 — Fase 4</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────
// Subcomponentes
// ──────────────────────────────────────────────

function TarjetaStat({
  valor,
  etiqueta,
  icono,
  color,
}: {
  valor: number;
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={estilos.tarjetaStat}>
      <Ionicons name={icono} size={22} color={color} />
      <Text style={[estilos.valorStat, { color }]}>{valor}</Text>
      <Text style={estilos.etiquetaStat}>{etiqueta}</Text>
    </View>
  );
}

function FilaSwitch({
  etiqueta,
  subtexto,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  subtexto?: string;
  valor: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <View style={estilos.filaSwitch}>
      <View style={{ flex: 1 }}>
        <Text style={estilos.etiquetaAjuste}>{etiqueta}</Text>
        {subtexto && <Text style={estilos.subtextoAjuste}>{subtexto}</Text>}
      </View>
      <Switch
        value={valor}
        onValueChange={alCambiar}
        trackColor={{ false: Colores.superficieContenedorAlta, true: Colores.primarioContenedor }}
        thumbColor={valor ? Colores.primario : Colores.sobreSuperficieVariante}
      />
    </View>
  );
}

function Separador() {
  return <View style={{ height: 1, backgroundColor: Colores.superficieContenedorBaja, marginVertical: Espaciado.sm }} />;
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colores.superficie },
  cabecera: { paddingHorizontal: Espaciado.base, paddingTop: Espaciado.md, paddingBottom: Espaciado.sm },
  tituloCabecera: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colores.sobreSuperficie },
  scroll: { padding: Espaciado.base, paddingBottom: Espaciado.xxxl },
  tituloSeccion: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colores.sobreSuperficieVariante, letterSpacing: 0.5, marginBottom: Espaciado.sm, textTransform: 'uppercase' },
  tarjeta: { backgroundColor: Colores.blanco, borderRadius: Radios.tarjeta, padding: Espaciado.base, ...Sombras.sutil, gap: Espaciado.sm },
  filaAjuste: { gap: 2 },
  filaSwitch: { flexDirection: 'row', alignItems: 'center', gap: Espaciado.md },
  etiquetaAjuste: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colores.sobreSuperficie },
  subtextoAjuste: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colores.sobreSuperficieVariante, lineHeight: 17, marginTop: 2 },
  filaTransporte: { flexDirection: 'row', gap: Espaciado.sm },
  chipTransporte: {
    flex: 1, alignItems: 'center', paddingVertical: Espaciado.md, gap: 4,
    borderRadius: Radios.boton, backgroundColor: Colores.superficieContenedor,
  },
  chipTransporteActivo: { backgroundColor: Colores.primarioContenedor },
  textoChipTransporte: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colores.sobreSuperficieVariante },
  // Estadísticas
  filaStats: { flexDirection: 'row', gap: Espaciado.sm },
  tarjetaStat: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: Espaciado.md,
    backgroundColor: Colores.superficieContenedor,
    borderRadius: Radios.boton,
  },
  valorStat: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  etiquetaStat: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colores.sobreSuperficieVariante, textAlign: 'center' },
  filaCategoriaDestacada: { flexDirection: 'row', alignItems: 'center', gap: Espaciado.sm, paddingTop: Espaciado.xs },
  puntoCat: { width: 10, height: 10, borderRadius: 5 },
  textoCategoriaDestacada: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colores.sobreSuperficieVariante },
  // Exportar
  filaExportar: { flexDirection: 'row', gap: Espaciado.sm },
  botonExportar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Espaciado.sm, paddingVertical: Espaciado.md,
    backgroundColor: Colores.primarioContenedor,
    borderRadius: Radios.boton,
  },
  textoBotonExportar: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colores.primario },
  version: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 12, color: Colores.sobreSuperficieVariante, marginTop: Espaciado.xl, opacity: 0.5 },
});
