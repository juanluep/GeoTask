/**
 * ============================================================
 * 🗺️ MapaLeaflet — MapaLeaflet.tsx
 * ============================================================
 *
 * Mapa interactivo con Leaflet.js en un WebView.
 * 100 % OpenStreetMap, sin Google Maps.
 *
 * Mejoras v7:
 *  - El WebView ya NO se desmonta ni recrea cuando cambian las tareas.
 *  - Las dimensiones son 100% vía CSS puro (como MiniMapaLeaflet).
 *  - Las tareas y el centrado se inyectan dinámicamente vía JS.
 *  - Soluciona el problema de la pantalla gris (mapa no cargado).
 *
 * @version 7.0.0
 * ============================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Colores } from '../../config/tema';
import { LEAFLET_JS, LEAFLET_CSS } from '../../config/leaflet-bundle';
import type { Tarea } from '../../models/tarea.modelo';
import type { Categoria } from '../../models/categoria.modelo';

// ──────────────────────────────────────────
// Tipos públicos
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
  comandoCentrar?: number;
  comandoCentrarCoords?: { lat: number; lon: number; id: number } | null;
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

interface TareaParaMapa {
  id: string;
  latitud: number;
  longitud: number;
  titulo: string;
  nombreLugar: string | null;
  color: string;
  radioProximidad: number;
  geocercaActiva: boolean;
}

// ──────────────────────────────────────────
// Generador de HTML Estático
// ──────────────────────────────────────────

function buildMapaHTML(lat: number, lon: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <style>
${LEAFLET_CSS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#e8e0d8}
#mapa{width:100%;height:100%}
.pin-wrapper{display:flex;flex-direction:column;align-items:center}
.pin-circulo{width:32px;height:32px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.pin-triangulo{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid;margin-top:-1px}
.punto-usuario{width:14px;height:14px;border-radius:50%;background:#4648d4;border:2.5px solid white;box-shadow:0 0 0 5px rgba(70,72,212,.18)}
.leaflet-control-attribution{display:none!important}
.leaflet-popup-content-wrapper{border-radius:12px;padding:0;box-shadow:0 4px 20px rgba(0,0,0,.15)}
.leaflet-popup-content{margin:0}
.leaflet-popup-tip-container{display:none}
.popup{padding:12px 14px;min-width:160px;max-width:220px}
.popup-titulo{font:600 14px sans-serif;color:#1c1b1f;margin-bottom:4px;word-break:break-word}
.popup-lugar{font:12px sans-serif;color:#49454f;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.popup-btn{display:block;width:100%;padding:6px 0;border:none;border-radius:8px;font:600 12px sans-serif;color:#4648d4;background:#e8e8f8;cursor:pointer;text-align:center}
.leaflet-control-zoom a{border-radius:8px!important;border:none!important;box-shadow:0 2px 8px rgba(0,0,0,.12)!important;margin-bottom:3px!important}
  </style>
</head>
<body>
<div id="mapa"></div>
<script>
window.onerror = function(msg, url, line) {
  if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({tipo: 'error', msg: msg + ' at line ' + line}));
};

${LEAFLET_JS}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function enviar(d){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d))}
function verDetalle(id){enviar({tipo:'verDetalle',id:id})}

var mapa = L.map('mapa',{zoomControl:true,attributionControl:false}).setView([${lat},${lon}],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{subdomains:['a','b','c'],maxZoom:19}).addTo(mapa);

function notificarBounds() {
  try {
    var b = mapa.getBounds();
    enviar({tipo:'boundsChange',norte:b.getNorth(),sur:b.getSouth(),este:b.getEast(),oeste:b.getWest()});
  } catch(e) {}
}

mapa.on('moveend', notificarBounds);

// Polling de tamaño: Soluciona el bug de Android donde el WebView se inicializa con 0x0
var intentos = 0;
var interval = setInterval(function() {
  mapa.invalidateSize(false);
  var s = mapa.getSize();
  if (s && s.x > 0 && s.y > 0) {
    notificarBounds();
    intentos++;
    if (intentos > 8) clearInterval(interval);
  }
}, 500);

// Resize observer para Leaflet para cuando el WebView cambia de tamaño real
window.addEventListener('resize', function() {
  mapa.invalidateSize(false);
  notificarBounds();
});

function crearIcono(color){
  return L.divIcon({className:'',
    html:'<div class="pin-wrapper"><div class="pin-circulo" style="background:'+color+'"></div><div class="pin-triangulo" style="border-top-color:'+color+'"></div></div>',
    iconSize:[32,40],iconAnchor:[16,40],popupAnchor:[0,-42]});
}

// Capa para marcadores (agrupa todos para poder borrarlos fácilmente)
var capaMarcadores = L.featureGroup().addTo(mapa);

function renderizarTareas(tareas) {
  capaMarcadores.clearLayers();
  tareas.forEach(function(t){
    var color = t.color || '#4648d4';
    var m = L.marker([t.latitud,t.longitud],{icon:crearIcono(color)}).addTo(capaMarcadores);
    var html = '<div class="popup"><div class="popup-titulo">'+esc(t.titulo)+'</div>'
      +(t.nombreLugar?'<div class="popup-lugar">'+esc(t.nombreLugar)+'</div>':'')
      +'<button class="popup-btn" onclick="verDetalle(\\''+t.id+'\\')">Ver detalle →</button></div>';
    m.bindPopup(L.popup({closeButton:false}).setContent(html));
    if(t.geocercaActiva) {
      L.circle([t.latitud,t.longitud],{radius:t.radioProximidad,fillColor:color,fillOpacity:.08,color:color,opacity:.4,weight:1.5}).addTo(capaMarcadores);
    }
  });
}

var marcadorUsuario=null;
function actualizarUsuario(lat,lon){
  if(marcadorUsuario)mapa.removeLayer(marcadorUsuario);
  marcadorUsuario=L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="punto-usuario"></div>',iconSize:[14,14],iconAnchor:[7,7]}),zIndexOffset:-100}).addTo(mapa);
}

var touchTimer=null,touchMovido=false;
mapa.getContainer().addEventListener('touchstart',function(e){
  touchMovido=false;
  touchTimer=setTimeout(function(){
    if(!touchMovido&&e.touches.length===1){
      var t=e.touches[0];
      var rect=mapa.getContainer().getBoundingClientRect();
      var ll=mapa.containerPointToLatLng(L.point(t.clientX-rect.left,t.clientY-rect.top));
      enviar({tipo:'longPress',lat:ll.lat,lon:ll.lng});
    }
  },600);
},{passive:true});
mapa.getContainer().addEventListener('touchmove',function(){touchMovido=true;clearTimeout(touchTimer);},{passive:true});
mapa.getContainer().addEventListener('touchend',function(){clearTimeout(touchTimer);},{passive:true});

function manejarMensaje(e){
  try{
    var d=JSON.parse(e.data);
    if(d.tipo==='centrar') mapa.setView([d.lat,d.lon],d.zoom||mapa.getZoom(),{animate:true});
    else if(d.tipo==='ubicacionUsuario') actualizarUsuario(d.lat,d.lon);
    else if(d.tipo==='actualizarTareas') renderizarTareas(d.tareas);
    else if(d.tipo==='fixHeight') {
      document.body.style.width = d.w + 'px';
      document.body.style.height = d.h + 'px';
      document.getElementById('mapa').style.width = d.w + 'px';
      document.getElementById('mapa').style.height = d.h + 'px';
      mapa.invalidateSize(false);
      notificarBounds();
    }
  }catch(err){}
}
document.addEventListener('message',manejarMensaje);
window.addEventListener('message',manejarMensaje);

setTimeout(function(){
  mapa.invalidateSize(false);
  notificarBounds();
},300);
</script>
</body>
</html>`;
}

// ──────────────────────────────────────────
// Componente: Mapa principal
// ──────────────────────────────────────────

export function MapaLeaflet({
  tareas,
  categorias,
  ubicacion,
  comandoCentrar,
  comandoCentrarCoords,
  onLongPress,
  onVerDetalle,
  onBoundsChange,
}: PropiedadesMapaLeaflet) {
  const refWebView = useRef<WebView>(null);
  const webViewListo = useRef(false);
  const primerCentradoHecho = useRef(false);

  // Dimensiones reales del contenedor nativo (de onLayout)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      const w = Math.round(width);
      const h = Math.round(height);
      setDims((prev) => (prev?.w === w && prev?.h === h ? prev : { w, h }));
    }
  }

  // ── Enriquecer tareas ─────────────────────────────────────────
  const tareasMapa = useMemo<TareaParaMapa[]>(
    () =>
      tareas.map((t) => {
        const cat = categorias.find((c) => c.id === t.categoriaId);
        return {
          id: t.id,
          latitud: t.latitud,
          longitud: t.longitud,
          titulo: t.titulo,
          nombreLugar: t.nombreLugar ?? null,
          color: cat?.color ?? Colores.primario,
          radioProximidad: t.radioProximidad,
          geocercaActiva: t.geocercaActiva,
        };
      }),
    [tareas, categorias]
  );

  // ── Centro inicial ────────────────────────────────────────────
  const centroRef = useRef({ lat: 37.3891, lon: -5.9845 }); // Sevilla por defecto, o la ubicación inicial
  const tieneUbicacionInicial = useRef(false);
  if (!tieneUbicacionInicial.current && ubicacion) {
    centroRef.current = { lat: ubicacion.latitud, lon: ubicacion.longitud };
    tieneUbicacionInicial.current = true;
  }

  // ── HTML Estático (solo se regenera si cambia la ubicación inicial de montaje) ──
  const htmlMapa = useMemo(
    () => buildMapaHTML(centroRef.current.lat, centroRef.current.lon),
    []
  );

  // ── Inyector genérico ─────────────────────────────────────────
  function inyectar(obj: object) {
    if (!webViewListo.current) return;
    const json = JSON.stringify(JSON.stringify(obj));
    refWebView.current?.injectJavaScript(`manejarMensaje({data:${json}});true;`);
  }

  // ── Actualizaciones dinámicas ─────────────────────────────────
  
  // 1. Cuando cargan o cambian las tareas, inyectarlas
  useEffect(() => {
    inyectar({ tipo: 'actualizarTareas', tareas: tareasMapa });
  }, [tareasMapa]);

  // 2. Cuando cambia la ubicación del usuario, inyectarla
  useEffect(() => {
    if (ubicacion) {
      inyectar({ tipo: 'ubicacionUsuario', lat: ubicacion.latitud, lon: ubicacion.longitud });
      // Centrar automáticamente la primera vez que se recibe ubicación
      if (!primerCentradoHecho.current && webViewListo.current) {
        inyectar({ tipo: 'centrar', lat: ubicacion.latitud, lon: ubicacion.longitud, zoom: 16 });
        primerCentradoHecho.current = true;
      }
    }
  }, [ubicacion]);

  // 3. Cuando el usuario pulsa "recentrar"
  useEffect(() => {
    if (ubicacion && comandoCentrar) {
      inyectar({ tipo: 'centrar', lat: ubicacion.latitud, lon: ubicacion.longitud, zoom: 16 });
    }
  }, [comandoCentrar]);

  // 4. Mover mapa a coordenadas arbitrarias
  useEffect(() => {
    if (comandoCentrarCoords && webViewListo.current) {
      refWebView.current?.injectJavaScript(`mapa.flyTo([${comandoCentrarCoords.lat}, ${comandoCentrarCoords.lon}], 16, { animate: true, duration: 1.2 });true;`);
    }
  }, [comandoCentrarCoords]);

  // 5. Cuando cambian las dimensiones del layout (plan B de Android)
  useEffect(() => {
    if (dims) {
      inyectar({ tipo: 'fixHeight', w: dims.w, h: dims.h });
    }
  }, [dims]);

  // ── Mensajes WebView → RN ─────────────────────────────────────
  function manejarMensaje(event: WebViewMessageEvent) {
    try {
      const d = JSON.parse(event.nativeEvent.data);
      switch (d.tipo) {
        case 'boundsChange':
          onBoundsChange?.({ norte: d.norte, sur: d.sur, este: d.este, oeste: d.oeste });
          break;
        case 'longPress':
          onLongPress?.(d.lat, d.lon);
          break;
        case 'verDetalle':
          onVerDetalle?.(d.id);
          break;
        case 'error':
          console.warn('[Leaflet WebView Error]:', d.msg);
          break;
      }
    } catch (_) {}
  }

  function onWebViewLoad() {
    webViewListo.current = true;
    
    // Inyectar el tamaño si ya lo tenemos
    if (dims) {
      inyectar({ tipo: 'fixHeight', w: dims.w, h: dims.h });
    }
    
    // Inyectamos las tareas y la ubicación iniciales
    inyectar({ tipo: 'actualizarTareas', tareas: tareasMapa });
    if (ubicacion) {
      inyectar({ tipo: 'ubicacionUsuario', lat: ubicacion.latitud, lon: ubicacion.longitud });
      if (!primerCentradoHecho.current) {
        inyectar({ tipo: 'centrar', lat: ubicacion.latitud, lon: ubicacion.longitud, zoom: 16 });
        primerCentradoHecho.current = true;
      }
    }
  }

  return (
    <View style={estilos.contenedor} onLayout={onLayout}>
      <WebView
        ref={refWebView}
        style={estilos.webview}
        source={{ html: htmlMapa, baseUrl: 'https://localhost/' }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        scrollEnabled={false}
        onMessage={manejarMensaje}
        onLoad={onWebViewLoad}
      />
    </View>
  );
}

// ──────────────────────────────────────────
// Componente: Mini mapa estático (detalle)
// ──────────────────────────────────────────

function generarHTMLMiniMapa(
  lat: number, lon: number, color: string,
  radio?: number, geocercaActiva?: boolean
): string {
  const circulo = geocercaActiva && radio
    ? `L.circle([${lat},${lon}],{radius:${radio},fillColor:'${color}',fillOpacity:.1,color:'${color}',opacity:.5,weight:1.5}).addTo(mapa);`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <style>${LEAFLET_CSS}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;overflow:hidden}
    #mapa{height:100%}
    .pin{width:28px;height:28px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)}
    .leaflet-control-attribution{display:none!important}
  </style>
</head>
<body>
<div id="mapa"></div>
<script>
${LEAFLET_JS}
var mapa=L.map('mapa',{zoomControl:false,attributionControl:false,dragging:false,touchZoom:false,doubleClickZoom:false,scrollWheelZoom:false,keyboard:false}).setView([${lat},${lon}],16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{subdomains:['a','b','c'],maxZoom:19}).addTo(mapa);
${circulo}
L.marker([${lat},${lon}],{icon:L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(mapa);
setTimeout(function() { mapa.invalidateSize(false); }, 300);
</script>
</body>
</html>`;
}

export function MiniMapaLeaflet({
  latitud, longitud, color = Colores.primario,
  radio, geocercaActiva, estilo,
}: PropiedadesMiniMapa) {
  return (
    <WebView
      style={[estilos.miniMapa, estilo]}
      source={{ html: generarHTMLMiniMapa(latitud, longitud, color, radio, geocercaActiva), baseUrl: 'https://localhost/' }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      mixedContentMode="always"
      scrollEnabled={false}
    />
  );
}

// ──────────────────────────────────────────
// Estilos
// ──────────────────────────────────────────

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  miniMapa: { flex: 1, backgroundColor: 'transparent' },
});

