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

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConfigStore } from '../../src/stores/useConfigStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useListaStore } from '../../src/stores/useListaStore';
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
import { obtenerPerfil } from '../../src/services/perfil.servicio';
import type { PerfilUsuario } from '../../src/models/usuario.modelo';
import { 
  obtenerEstadoGeocercas, 
  obtenerDebugLogs, 
  limpiarDebugLogs,
  registrarTodasLasGeocercas 
} from '../../src/services/geocerca.servicio';
import { enviarNotificacionPrueba } from '../../src/services/notificacion.servicio';

const MODOS_TRANSPORTE: { valor: ModoTransporte; icono: keyof typeof Ionicons.glyphMap; etiqueta: string }[] = [
  { valor: 'automatico', icono: 'phone-portrait-outline', etiqueta: 'Auto' },
  { valor: 'peatonal', icono: 'walk-outline', etiqueta: 'A pie' },
  { valor: 'bicicleta', icono: 'bicycle-outline', etiqueta: 'Bici' },
  { valor: 'coche', icono: 'car-outline', etiqueta: 'Coche' },
];

export default function PantallaAjustes() {
  const enrutador = useRouter();
  const { config, cargarConfiguracion, actualizarPreferencia } = useConfigStore();
  const { sesion, esInvitado, cerrarSesion: cerrarSesionAuth } = useAuthStore();
  const { listas, cargarListas } = useListaStore();
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [exportando, setExportando] = useState(false);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  
  // Estado para diagnóstico
  const [estadoGeocercas, setEstadoGeocercas] = useState<{ activo: boolean; registradas: number; permisoBackground: string } | null>(null);
  const [debugLogs, setDebugLogs] = useState<{t: string, m: string}[]>([]);
  const [mostrandoLogs, setMostrandoLogs] = useState(false);

  useEffect(() => {
    cargarConfiguracion();
    // Cargar perfil de Supabase si hay sesión activa
    if (sesion?.user?.id) {
      obtenerPerfil(sesion.user.id).then(setPerfil).catch(() => {});
      cargarListas();
    }
  }, [sesion?.user?.id]);

  const cargarEstadisticas = useCallback(async () => {
    try {
      const stats = await obtenerEstadisticas();
      setEstadisticas(stats);
      
      // También cargar estado de geocercas
      const estado = await obtenerEstadoGeocercas();
      setEstadoGeocercas(estado);
      const logs = await obtenerDebugLogs();
      setDebugLogs(logs);
    } catch (error) {
      console.warn('[ajustes] Error cargando estadísticas:', error);
      // Mostrar ceros en lugar de spinner infinito si falla la consulta
      setEstadisticas({ totalCompletadas: 0, completadasEsteMes: 0, pendientes: 0, categoriaMasUsada: null });
    }
  }, []);

  // Recargar estadísticas cada vez que el usuario vuelve a esta pestaña,
  // para que el contador de pendientes refleje las tareas creadas/completadas recientemente.
  useFocusEffect(useCallback(() => {
    cargarEstadisticas();
  }, [cargarEstadisticas]));

  // ── Cerrar sesión ─────────────────────────────
  const handleCerrarSesion = useCallback(() => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres cerrar sesión? Tus tareas quedan guardadas localmente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await cerrarSesionAuth();
            enrutador.replace('/(auth)/login');
          },
        },
      ]
    );
  }, [cerrarSesionAuth, enrutador]);

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

        {/* ── Cuenta (Fase 5) ── */}
        <Text style={estilos.tituloSeccion}>Cuenta</Text>
        {sesion ? (
          <View style={estilos.tarjeta}>
            {/* Avatar + nombre + email */}
            <View style={estilos.filaCuenta}>
              <View style={estilos.circuloAvatar}>
                {perfil?.avatarUrl
                  ? <Image source={{ uri: perfil.avatarUrl }} style={estilos.imagenAvatar} />
                  : <Ionicons name="person" size={28} color={Colores.primario} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={estilos.nombreCuenta} numberOfLines={1}>
                  {esInvitado ? 'Invitado' : (perfil?.nombre || 'Sin nombre')}
                </Text>
                <Text style={estilos.emailCuenta} numberOfLines={1}>
                  {esInvitado ? 'Sesión anónima' : (sesion.user.email ?? '')}
                </Text>
              </View>
            </View>

            {/* Banner para invitados: invitar a registrarse */}
            {esInvitado && (
              <TouchableOpacity
                style={estilos.bannerInvitado}
                onPress={() => enrutador.push('/(auth)/registro' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={Colores.primario} />
                <Text style={estilos.textoBannerInvitado}>
                  Crea una cuenta para sincronizar tus tareas en todos tus dispositivos
                </Text>
                <Ionicons name="chevron-forward" size={14} color={Colores.primario} />
              </TouchableOpacity>
            )}

            <Separador />
            <TouchableOpacity style={estilos.filaAccion} onPress={handleCerrarSesion} activeOpacity={0.75}>
              <Ionicons name="log-out-outline" size={20} color={Colores.error} />
              <Text style={[estilos.etiquetaAjuste, { color: Colores.error, flex: 1 }]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={estilos.tarjeta}>
            <TouchableOpacity
              style={estilos.filaAccion}
              onPress={() => enrutador.push('/(auth)/login' as any)}
              activeOpacity={0.75}
            >
              <Ionicons name="log-in-outline" size={20} color={Colores.primario} />
              <Text style={[estilos.etiquetaAjuste, { flex: 1 }]}>Iniciar sesión</Text>
              <Ionicons name="chevron-forward" size={16} color={Colores.sobreSuperficieVariante} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Listas compartidas (Fase 5) ── */}
        {sesion && !esInvitado && (
          <>
            <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Listas compartidas</Text>
            <View style={estilos.tarjeta}>
              {/* Botones crear / unirse */}
              <View style={estilos.filaExportar}>
                <TouchableOpacity
                  style={estilos.botonExportar}
                  onPress={() => enrutador.push('/lista/nueva' as any)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colores.primario} />
                  <Text style={estilos.textoBotonExportar}>Crear lista</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={estilos.botonExportar}
                  onPress={() => enrutador.push('/lista/unirse' as any)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="enter-outline" size={20} color={Colores.primario} />
                  <Text style={estilos.textoBotonExportar}>Unirse</Text>
                </TouchableOpacity>
              </View>

              {/* Listado de listas del usuario */}
              {listas.length > 0 && (
                <>
                  <View style={{ height: 1, backgroundColor: Colores.superficieContenedorBaja, marginVertical: Espaciado.xs }} />
                  {listas.map((lista, idx) => (
                    <TouchableOpacity
                      key={lista.id}
                      style={estilos.filaAccion}
                      onPress={() => enrutador.push(`/lista/${lista.id}` as any)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="people-outline" size={20} color={Colores.primario} />
                      <View style={{ flex: 1 }}>
                        <Text style={estilos.etiquetaAjuste} numberOfLines={1}>{lista.nombre}</Text>
                        <Text style={estilos.subtextoAjuste}>
                          Código: {lista.codigo.toUpperCase()} · {lista.rol ?? 'editor'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colores.sobreSuperficieVariante} />
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {listas.length === 0 && (
                <Text style={[estilos.subtextoAjuste, { textAlign: 'center', paddingVertical: Espaciado.sm }]}>
                  Todavía no participas en ninguna lista. Crea una o únete con un código.
                </Text>
              )}
            </View>
          </>
        )}

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

        {/* ── Diagnóstico de Geocercas (Nuevo) ── */}
        <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Diagnóstico del sistema</Text>
        <View style={estilos.tarjeta}>
          <View style={estilos.filaAccion}>
            <Ionicons 
              name={estadoGeocercas?.activo ? "radio-outline" : "alert-circle-outline"} 
              size={20} 
              color={estadoGeocercas?.activo ? Colores.exito : Colores.error} 
            />
            <View style={{ flex: 1 }}>
              <Text style={estilos.etiquetaAjuste}>Estado del monitor</Text>
              <Text style={[estilos.subtextoAjuste, { color: estadoGeocercas?.activo ? Colores.exito : Colores.error }]}>
                {estadoGeocercas?.activo ? `Activo (${estadoGeocercas.registradas} geocercas)` : 'Inactivo (no se detectarán llegadas)'}
              </Text>
            </View>
            <TouchableOpacity 
              style={estilos.botonPequeno} 
              onPress={async () => {
                await registrarTodasLasGeocercas();
                const nuevoEstado = await obtenerEstadoGeocercas();
                setEstadoGeocercas(nuevoEstado);
                Alert.alert('Reiniciado', 'Se ha intentado reiniciar el monitor de geocercas.');
              }}
            >
              <Text style={estilos.textoBotonPequeno}>Reiniciar</Text>
            </TouchableOpacity>
          </View>

          <Separador />

          <View style={estilos.filaAccion}>
            <Ionicons 
              name="location-outline" 
              size={20} 
              color={estadoGeocercas?.permisoBackground === 'granted' ? Colores.exito : Colores.alerta} 
            />
            <View style={{ flex: 1 }}>
              <Text style={estilos.etiquetaAjuste}>Permiso de segundo plano</Text>
              <Text style={estilos.subtextoAjuste}>
                {estadoGeocercas?.permisoBackground === 'granted' 
                  ? 'Concedido (Permitir siempre)' 
                  : 'No configurado correctamente'}
              </Text>
            </View>
          </View>

          <Separador />

          {/* Guía de optimización de batería — causa más frecuente de fallos */}
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={estilos.filaAccion}
              activeOpacity={0.75}
              onPress={() => {
                Alert.alert(
                  'Optimización de batería',
                  'Android puede suspender las geocercas para ahorrar batería.\n\n' +
                  '1. Pulsa "Abrir Ajustes"\n' +
                  '2. Ve a Batería (o Uso de batería)\n' +
                  '3. Busca GeoTask y selecciona "Sin restricciones" o "No optimizar"\n\n' +
                  'En móviles Samsung: Ajustes → Batería → Optimización de batería → Todas las apps → GeoTask → No optimizar',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
                  ]
                );
              }}
            >
              <Ionicons name="battery-charging-outline" size={20} color={Colores.alerta} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.etiquetaAjuste}>Optimización de batería</Text>
                <Text style={estilos.subtextoAjuste}>
                  Si las geocercas no funcionan, desactiva la optimización para esta app
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colores.sobreSuperficieVariante} />
            </TouchableOpacity>
          )}

          {Platform.OS === 'android' && <Separador />}

          <View style={estilos.filaBotonesDebug}>
            <TouchableOpacity
              style={estilos.botonAccionDebug}
              onPress={() => enviarNotificacionPrueba()}
            >
              <Ionicons name="notifications-outline" size={16} color={Colores.primario} />
              <Text style={estilos.textoBotonAccionDebug}>Probar Aviso</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={estilos.botonAccionDebug}
              onPress={() => setMostrandoLogs(!mostrandoLogs)}
            >
              <Ionicons name="list-outline" size={16} color={Colores.primario} />
              <Text style={estilos.textoBotonAccionDebug}>{mostrandoLogs ? 'Ocultar Logs' : 'Ver Logs'}</Text>
            </TouchableOpacity>
          </View>

          {mostrandoLogs && (
            <View style={estilos.contenedorLogs}>
              {debugLogs.length > 0 ? (
                debugLogs.map((log, i) => (
                  <Text key={i} style={estilos.textoLog}>
                    [{log.t.split('T')[1].split('.')[0]}] {log.m}
                  </Text>
                ))
              ) : (
                <Text style={estilos.textoLog}>No hay eventos registrados recientemente.</Text>
              )}
              <TouchableOpacity 
                style={{ marginTop: 8 }} 
                onPress={async () => {
                  await limpiarDebugLogs();
                  setDebugLogs([]);
                }}
              >
                <Text style={[estilos.textoLog, { color: Colores.error, textAlign: 'right' }]}>Limpiar historial</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Acerca de / Tutorial ── */}
        <Text style={[estilos.tituloSeccion, { marginTop: Espaciado.xl }]}>Acerca de</Text>
        <View style={estilos.tarjeta}>
          <TouchableOpacity
            style={estilos.filaAccion}
            activeOpacity={0.75}
            onPress={() => enrutador.push('/(auth)/onboarding' as any)}
          >
            <Ionicons name="book-outline" size={20} color={Colores.primario} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.etiquetaAjuste}>Ver tutorial de introducción</Text>
              <Text style={estilos.subtextoAjuste}>Repasa cómo funciona GeoTask paso a paso</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colores.sobreSuperficieVariante} />
          </TouchableOpacity>
        </View>

        {/* Versión */}
        <Text style={estilos.version}>GeoTask v1.0.0 — Fase 5</Text>
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
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: Espaciado.md },
  // Cuenta
  filaCuenta: { flexDirection: 'row', alignItems: 'center', gap: Espaciado.md, paddingBottom: Espaciado.sm },
  circuloAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colores.primarioContenedor,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  imagenAvatar: { width: 52, height: 52 },
  nombreCuenta: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colores.sobreSuperficie },
  emailCuenta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colores.sobreSuperficieVariante, marginTop: 2 },
  bannerInvitado: {
    flexDirection: 'row', alignItems: 'center', gap: Espaciado.sm,
    backgroundColor: Colores.primarioContenedor,
    borderRadius: Radios.boton, padding: Espaciado.md, marginTop: Espaciado.sm,
  },
  textoBannerInvitado: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13,
    color: Colores.primario, lineHeight: 18,
  },
  // Diagnóstico
  botonPequeno: {
    backgroundColor: Colores.superficieContenedorAlta,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  textoBotonPequeno: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colores.sobreSuperficie,
  },
  filaBotonesDebug: {
    flexDirection: 'row',
    gap: Espaciado.sm,
    marginTop: 4,
  },
  botonAccionDebug: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colores.primarioContenedor,
  },
  textoBotonAccionDebug: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colores.primario,
  },
  contenedorLogs: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  textoLog: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#475569',
    marginBottom: 2,
  },
});
