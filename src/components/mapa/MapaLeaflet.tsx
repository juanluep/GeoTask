/**
 * ============================================================
 * 🗺️ MapaLeaflet — MapaLeaflet.tsx
 * ============================================================
 *
 * Mapa interactivo y mini-mapa usando Leaflet.js dentro de un WebView.
 * Sin dependencias de Google Maps — 100% OpenStreetMap.
 *
 * Exports:
 *  - MapaLeaflet       → mapa principal interactivo (pantalla Mapa)
 *  - MiniMapaLeaflet   → mapa estático pequeño (detalle de tarea)
 *
 * Comunicación React Native ↔ WebView:
 *  - RN → WebView : injectJavaScript() con llamadas a manejarMensaje()
 *  - WebView → RN : window.ReactNativeWebView.postMessage(JSON)
 *
 * @version 1.0.0
 * ============================================================
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Colores } from '../../config/tema';
import { LEAFLET_JS, LEAFLET_CSS } from '../../config/leaflet-bundle';
import type { Tarea } from '../../models/tarea.modelo';
import type { Categoria } from '../../models/categoria.modelo';

// ──────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────

export interface LimitesMapaProps {
  norte: number;
  sur: number;
  este: number;
  oeste: number;
}

interface PropiedadesMapaLeaflet {
  tareas: Tarea[];
  categorias: Categoria[];
  ubicacion?: { latitud: number; longitud: number } | null;
  /** Incrementar este número para disparar "centrar en usuario" */
  comandoCentrar?: number;
  onLongPress?: (lat: number, lon: number) => void;
  onVerDetalle?: (id: string) => void;
  onBoundsChange?: (limites: LimitesMapaProps) => void;
}

interface PropiedadesMiniMapa {
  latitud: number;
  longitud: number;
  color?: string;
  radio?: number;
  geocercaActiva?: boolean;
  estilo?: object;
}

// ──────────────────────────────────────────
// HTML del mapa principal (Leaflet completo)
// ──────────────────────────────────────────

// Este HTML se carga en el WebView. Contiene:
// - Leaflet CSS + JS desde CDN de unpkg (HTTPS, sin API key)
// - Tiles de CartoDB Voyager (estilo OSM libre, sin cabecera User-Agent)
// - Sistema de marcadores personalizados con colores de categoría
// - Círculos semitransparentes para geocercas
// - Long press táctil (timer en touchstart, cancelado en touchmove/touchend)
// - Comunicación bidireccional con React Native via postMessage / injectJavaScript

// Leaflet está embebido directamente en el HTML (sin CDN, sin assets nativos).
// Esto garantiza que funcione en cualquier configuración de Android WebView,
// sin necesidad de internet para cargar la librería del mapa.
function buildMapaHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <style>${LEAFLET_CSS}</style>
  <script>${LEAFLET_JS}<\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#e8e0d8}
    #mapa{width:100%;height:100%;background:#e8e0d8}
    .pin-wrapper{display:flex;flex-direction:column;align-items:center}
    .pin-circulo{width:32px;height:32px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)}
    .pin-triangulo{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid;margin-top:-1px}
    .usuario-punto{width:14px;height:14px;border-radius:50%;background:#4648d4;border:2.5px solid white;box-shadow:0 0 0 5px rgba(70,72,212,0.18)}
    .leaflet-control-attribution{display:none!important}
    .leaflet-popup-content-wrapper{border-radius:12px;padding:0;box-shadow:0 4px 20px rgba(0,0,0,0.15)}
    .leaflet-popup-content{margin:0}
    .leaflet-popup-tip-container{display:none}
    .popup-box{padding:12px 14px;min-width:160px;max-width:220px}
    .popup-titulo{font-family:sans-serif;font-size:14px;font-weight:600;color:#1c1b1f;margin-bottom:4px;word-break:break-word}
    .popup-lugar{font-family:sans-serif;font-size:12px;color:#49454f;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .popup-btn{display:block;width:100%;padding:6px 0;border:none;border-radius:8px;font-family:sans-serif;font-size:12px;font-weight:600;color:#4648d4;background:#e8e8f8;cursor:pointer;text-align:center}
    .leaflet-control-zoom a{border-radius:8px!important;border:none!important;box-shadow:0 2px 8px rgba(0,0,0,0.12)!important;margin-bottom:3px!important;font-size:16px!important}
  </style>
</head>
<body>
<div id="mapa"></div>
<script>
  // ── Helpers ──────────────────────────────────────────────────
  var mapa = null;
  var marcadores = {}, circulos = {}, marcadorUsuario = null;
  var pendientes = []; // Mensajes de RN recibidos antes de que el mapa esté listo

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function enviar(datos) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(datos));
    }
  }

  // ── Inicialización defensiva ──────────────────────────────────
  // El WebView puede recibir el HTML antes de que React Native
  // haya terminado su layout pass. En ese caso window.innerHeight = 0
  // y Leaflet se inicializaría con tamaño cero (sin tiles, sin controles).
  // Solución: no inicializar hasta que el viewport tenga dimensiones reales,
  // forzando el tamaño del contenedor por JS antes de crear el mapa.

  function inicializar() {
    if (mapa) return; // Ya inicializado

    var w = window.innerWidth;
    var h = window.innerHeight;

    // Si el viewport aún no tiene tamaño, esperar al resize
    if (h < 10 || w < 10) return;

    // Fijar tamaño del contenedor explícitamente por JS (no depender de CSS %)
    var el = document.getElementById('mapa');
    el.style.width  = w + 'px';
    el.style.height = h + 'px';

    mapa = L.map('mapa', { zoomControl: true, attributionControl: false })
            .setView([40.4168, -3.7038], 14);

    L.tileLayer('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mapa);

    // Reportar bounds al moverse
    mapa.on('moveend', function() {
      var b = mapa.getBounds();
      enviar({ tipo: 'boundsChange', norte: b.getNorth(), sur: b.getSouth(), este: b.getEast(), oeste: b.getWest() });
    });

    // Long press táctil
    var touchTimer = null, touchMovido = false;
    mapa.getContainer().addEventListener('touchstart', function(e) {
      touchMovido = false;
      touchTimer = setTimeout(function() {
        if (!touchMovido && e.touches.length === 1) {
          var t = e.touches[0];
          var rect = mapa.getContainer().getBoundingClientRect();
          var ll = mapa.containerPointToLatLng(L.point(t.clientX - rect.left, t.clientY - rect.top));
          enviar({ tipo: 'longPress', lat: ll.lat, lon: ll.lng });
        }
      }, 600);
    }, { passive: true });
    mapa.getContainer().addEventListener('touchmove', function() { touchMovido = true; clearTimeout(touchTimer); }, { passive: true });
    mapa.getContainer().addEventListener('touchend', function() { clearTimeout(touchTimer); }, { passive: true });

    // Procesar mensajes que llegaron antes de que el mapa estuviera listo
    pendientes.forEach(procesarMensaje);
    pendientes = [];

    // Notificar a RN que el mapa está listo con los bounds iniciales
    var b = mapa.getBounds();
    enviar({ tipo: 'listo', norte: b.getNorth(), sur: b.getSouth(), este: b.getEast(), oeste: b.getWest() });
  }

  // ── Operaciones sobre el mapa (seguras aunque mapa sea null) ──

  function crearIconoTarea(color) {
    return L.divIcon({
      className: '',
      html: '<div class="pin-wrapper"><div class="pin-circulo" style="background:' + color + '"></div><div class="pin-triangulo" style="border-top-color:' + color + '"></div></div>',
      iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -42]
    });
  }

  function actualizarTareas(tareas) {
    if (!mapa) return;
    Object.values(marcadores).forEach(function(m) { mapa.removeLayer(m); });
    Object.values(circulos).forEach(function(c) { mapa.removeLayer(c); });
    marcadores = {}; circulos = {};
    tareas.forEach(function(t) {
      var color = t.color || '#4648d4';
      var m = L.marker([t.latitud, t.longitud], { icon: crearIconoTarea(color) }).addTo(mapa);
      var popup = '<div class="popup-box"><div class="popup-titulo">' + esc(t.titulo) + '</div>' +
        (t.nombreLugar ? '<div class="popup-lugar">' + esc(t.nombreLugar) + '</div>' : '') +
        '<button class="popup-btn" onclick="verDetalle(\'' + t.id + '\')">Ver detalle \u2192</button></div>';
      m.bindPopup(L.popup({ closeButton: false }).setContent(popup));
      marcadores[t.id] = m;
      if (t.geocercaActiva) {
        circulos[t.id] = L.circle([t.latitud, t.longitud], { radius: t.radioProximidad, fillColor: color, fillOpacity: 0.08, color: color, opacity: 0.4, weight: 1.5 }).addTo(mapa);
      }
    });
  }

  function actualizarUsuario(lat, lon) {
    if (!mapa) return;
    if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
    marcadorUsuario = L.marker([lat, lon], {
      icon: L.divIcon({ className: '', html: '<div class="usuario-punto"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
      zIndexOffset: -100
    }).addTo(mapa);
  }

  function verDetalle(id) { enviar({ tipo: 'verDetalle', id: id }); }

  function procesarMensaje(d) {
    if (!d) return;
    if (d.tipo === 'actualizarTareas') actualizarTareas(d.tareas || []);
    else if (d.tipo === 'centrar' && mapa) mapa.setView([d.lat, d.lon], d.zoom || mapa.getZoom(), { animate: true });
    else if (d.tipo === 'ubicacionUsuario') actualizarUsuario(d.lat, d.lon);
  }

  function manejarMensaje(e) {
    try {
      var d = JSON.parse(e.data);
      if (!mapa) { pendientes.push(d); return; }
      procesarMensaje(d);
    } catch(err) {}
  }
  document.addEventListener('message', manejarMensaje);
  window.addEventListener('message', manejarMensaje);

  // Cuando el viewport cambia de tamaño (RN layout completado):
  // si Leaflet aún no se inicializó, intentar ahora; si ya lo hizo, invalidar.
  window.addEventListener('resize', function() {
    if (!mapa) {
      inicializar();
    } else {
      var el = document.getElementById('mapa');
      el.style.width  = window.innerWidth  + 'px';
      el.style.height = window.innerHeight + 'px';
      mapa.invalidateSize(false);
    }
  });

  // Primer intento inmediato (si el layout ya está listo)
  inicializar();
  // Intentos de respaldo a 100ms, 400ms, 1s por si el resize llega tarde
  setTimeout(inicializar, 100);
  setTimeout(inicializar, 400);
  setTimeout(inicializar, 1000);
<\/script>
</body>
</html>`; }

const HTML_MAPA = buildMapaHTML();

// ──────────────────────────────────────────
// Componente: Mapa principal interactivo
// ──────────────────────────────────────────

export function MapaLeaflet({
  tareas,
  categorias,
  ubicacion,
  comandoCentrar,
  onLongPress,
  onVerDetalle,
  onBoundsChange,
}: PropiedadesMapaLeaflet) {
  const refWebView = useRef<WebView>(null);
  // Flag para saber si el WebView ya ha terminado de cargar Leaflet
  const webViewListo = useRef(false);

  // Serializa las tareas en el formato que entiende el WebView
  function prepararTareas() {
    return tareas.map((t) => {
      const cat = categorias.find((c) => c.id === t.categoriaId);
      return {
        id: t.id,
        latitud: t.latitud,
        longitud: t.longitud,
        titulo: t.titulo,
        nombreLugar: t.nombreLugar ?? null,
        color: cat?.color ?? Colores.primario,
        geocercaActiva: t.geocercaActiva,
        radioProximidad: t.radioProximidad,
      };
    });
  }

  // Inyecta un mensaje en el WebView llamando a manejarMensaje()
  function inyectar(obj: object) {
    const json = JSON.stringify(JSON.stringify(obj));
    refWebView.current?.injectJavaScript(`manejarMensaje({data:${json}});true;`);
  }

  // Cuando cambian las tareas o categorías → actualizar marcadores
  useEffect(() => {
    if (!webViewListo.current) return;
    inyectar({ tipo: 'actualizarTareas', tareas: prepararTareas() });
  }, [tareas, categorias]);

  // Cuando cambia la ubicación del usuario → actualizar punto azul
  useEffect(() => {
    if (!webViewListo.current || !ubicacion) return;
    inyectar({ tipo: 'ubicacionUsuario', lat: ubicacion.latitud, lon: ubicacion.longitud });
  }, [ubicacion]);

  // Cuando el padre incrementa comandoCentrar → animar hacia la ubicación actual
  useEffect(() => {
    if (!webViewListo.current || !ubicacion || !comandoCentrar) return;
    inyectar({ tipo: 'centrar', lat: ubicacion.latitud, lon: ubicacion.longitud, zoom: 16 });
  }, [comandoCentrar]);

  function manejarMensaje(event: WebViewMessageEvent) {
    try {
      const datos = JSON.parse(event.nativeEvent.data);

      switch (datos.tipo) {
        case 'listo':
          webViewListo.current = true;
          // Propagar bounds iniciales al padre (para poblar el bottom sheet)
          if (datos.norte != null) {
            onBoundsChange?.({
              norte: datos.norte, sur: datos.sur,
              este: datos.este, oeste: datos.oeste,
            });
          }
          // Centrar en el usuario si ya tenemos ubicación
          if (ubicacion) {
            inyectar({ tipo: 'centrar', lat: ubicacion.latitud, lon: ubicacion.longitud, zoom: 15 });
            inyectar({ tipo: 'ubicacionUsuario', lat: ubicacion.latitud, lon: ubicacion.longitud });
          }
          // Enviar tareas actuales
          inyectar({ tipo: 'actualizarTareas', tareas: prepararTareas() });
          break;

        case 'longPress':
          onLongPress?.(datos.lat, datos.lon);
          break;

        case 'verDetalle':
          onVerDetalle?.(datos.id);
          break;

        case 'boundsChange':
          onBoundsChange?.({
            norte: datos.norte,
            sur: datos.sur,
            este: datos.este,
            oeste: datos.oeste,
          });
          break;
      }
    } catch (e) {}
  }

  // Dimensiones explícitas en pixels: Android WebView necesita saber su tamaño
  // real antes de inicializar Leaflet. Con absoluteFillObject solo, el WebView
  // puede recibir el tamaño demasiado tarde y Leaflet se inicia con 0px (sin tiles).
  const { width: sw, height: sh } = Dimensions.get('window');
  const estiloWebView = { position: 'absolute' as const, top: 0, left: 0, width: sw, height: sh };

  return (
    <WebView
      ref={refWebView}
      style={estiloWebView}
      // baseUrl es necesario en Android: sin él el origen es null y Android WebView
      // bloquea las peticiones de red (tiles de CartoDB no cargan).
      source={{ html: HTML_MAPA, baseUrl: 'https://localhost/' }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      onMessage={manejarMensaje}
      scrollEnabled={false}
      mixedContentMode="always"
      onLoad={() => {
        // Segundo invalidateSize por si React Native terminó el layout después de que
        // el WebView cargara el HTML.
        setTimeout(() => {
          refWebView.current?.injectJavaScript('mapa.invalidateSize(false);true;');
        }, 150);
      }}
    />
  );
}

// ──────────────────────────────────────────
// HTML del mini mapa (estático, detalle)
// ──────────────────────────────────────────

function generarHTMLMiniMapa(
  lat: number,
  lon: number,
  color: string,
  radio?: number,
  geocercaActiva?: boolean
): string {
  const circulo =
    geocercaActiva && radio
      ? `L.circle([${lat},${lon}],{radius:${radio},fillColor:'${color}',fillOpacity:0.1,color:'${color}',opacity:0.5,weight:1.5}).addTo(mapa);`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <style>${LEAFLET_CSS}</style>
  <script>${LEAFLET_JS}<\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;overflow:hidden;background:#e8e0d8}
    #mapa{height:100%}
    .pin{width:28px;height:28px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
    .leaflet-control-attribution{display:none!important}
  </style>
</head>
<body>
<div id="mapa"></div>
<script>
  var mapa = L.map('mapa', {
    zoomControl: false, attributionControl: false,
    dragging: false, touchZoom: false,
    doubleClickZoom: false, scrollWheelZoom: false, keyboard: false
  }).setView([${lat}, ${lon}], 16);
  L.tileLayer('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapa);
  ${circulo}
  L.marker([${lat}, ${lon}], {
    icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [28, 28], iconAnchor: [14, 14] })
  }).addTo(mapa);
<\/script>
</body>
</html>`;
}

// ──────────────────────────────────────────
// Componente: Mini mapa estático
// ──────────────────────────────────────────

export function MiniMapaLeaflet({
  latitud,
  longitud,
  color = Colores.primario,
  radio,
  geocercaActiva,
  estilo,
}: PropiedadesMiniMapa) {
  return (
    <WebView
      style={[estilos.miniMapa, estilo]}
      source={{ html: generarHTMLMiniMapa(latitud, longitud, color, radio, geocercaActiva), baseUrl: 'https://localhost/' }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      scrollEnabled={false}
      mixedContentMode="always"
    />
  );
}

const estilos = StyleSheet.create({
  miniMapa: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
