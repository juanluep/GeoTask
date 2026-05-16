/**
 * ============================================================
 * 🎨 Generador de Assets Visuales — scripts/generar-iconos.js
 * ============================================================
 *
 * Genera los iconos y splash screens de GeoTask a partir de SVGs
 * limpios y escalables, exportándolos a PNG en las resoluciones
 * exactas que requieren iOS, Android y Expo.
 *
 * Ejecutar: node scripts/generar-iconos.js
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ──────────────────────────────────────────────
// 🎨 Paleta de colores (consiste con tema.ts)
// ──────────────────────────────────────────────
const COLOR_PRIMARIO = '#1d4ed8';   // Azul índigo
const COLOR_CLARO    = '#60a5fa';   // Acento claro
const BLANCO         = '#ffffff';

// ──────────────────────────────────────────────
// 📐 SVGs base
// ──────────────────────────────────────────────

/**
 * Icono principal (1024×1024)
 * Fondo cuadrado con esquinas redondeadas estilo iOS,
 * con un map-pin flat y un checkmark en el centro.
 */
function svgIconoPrincipal(size = 1024) {
  const pinPath = `
    M ${size * 0.5} ${size * 0.22}
    C ${size * 0.30} ${size * 0.22} ${size * 0.15} ${size * 0.37} ${size * 0.15} ${size * 0.52}
    C ${size * 0.15} ${size * 0.72} ${size * 0.5} ${size * 0.88} ${size * 0.5} ${size * 0.88}
    C ${size * 0.5} ${size * 0.88} ${size * 0.85} ${size * 0.72} ${size * 0.85} ${size * 0.52}
    C ${size * 0.85} ${size * 0.37} ${size * 0.70} ${size * 0.22} ${size * 0.5} ${size * 0.22} Z
  `;

  const checkPath = `
    M ${size * 0.39} ${size * 0.50}
    L ${size * 0.46} ${size * 0.57}
    L ${size * 0.61} ${size * 0.42}
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <!-- Fondo cuadrado redondeado estilo iOS -->
    <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${COLOR_PRIMARIO}"/>
    <!-- Map pin -->
    <path d="${pinPath}" fill="${BLANCO}"/>
    <!-- Círculo interior azul -->
    <circle cx="${size * 0.5}" cy="${size * 0.50}" r="${size * 0.14}" fill="${COLOR_PRIMARIO}"/>
    <!-- Checkmark blanco -->
    <polyline points="${size * 0.39},${size * 0.50} ${size * 0.46},${size * 0.57} ${size * 0.61},${size * 0.42}"
      fill="none" stroke="${BLANCO}" stroke-width="${size * 0.045}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Adaptive Icon (Android)
 * Misma imagen pero con más margen para que Android la recorte
 * al círculo o curvas adaptativas sin cortar el pin.
 */
function svgAdaptiveIcon(size = 1024) {
  const pinPath = `
    M ${size * 0.5} ${size * 0.28}
    C ${size * 0.34} ${size * 0.28} ${size * 0.22} ${size * 0.40} ${size * 0.22} ${size * 0.52}
    C ${size * 0.22} ${size * 0.68} ${size * 0.5} ${size * 0.80} ${size * 0.5} ${size * 0.80}
    C ${size * 0.5} ${size * 0.80} ${size * 0.78} ${size * 0.68} ${size * 0.78} ${size * 0.52}
    C ${size * 0.78} ${size * 0.40} ${size * 0.66} ${size * 0.28} ${size * 0.5} ${size * 0.28} Z
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="none"/>
    <path d="${pinPath}" fill="${BLANCO}"/>
    <circle cx="${size * 0.5}" cy="${size * 0.52}" r="${size * 0.11}" fill="${COLOR_PRIMARIO}"/>
    <polyline points="${size * 0.42},${size * 0.52} ${size * 0.47},${size * 0.57} ${size * 0.58},${size * 0.45}"
      fill="none" stroke="${BLANCO}" stroke-width="${size * 0.035}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Splash Screen (1284×2778)
 * Fondo sólido índigo con el logo blanco centrado.
 * El logo es más grande y tiene un glow sutil.
 */
function svgSplash(w = 1284, h = 2778) {
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) * 0.35; // escala del logo

  const pinPath = `
    M ${cx} ${cy - s * 0.30}
    C ${cx - s * 0.50} ${cy - s * 0.30} ${cx - s * 0.75} ${cy - s * 0.05} ${cx - s * 0.75} ${cy + s * 0.05}
    C ${cx - s * 0.75} ${cy + s * 0.35} ${cx} ${cy + s * 0.55} ${cx} ${cy + s * 0.55}
    C ${cx} ${cy + s * 0.55} ${cx + s * 0.75} ${cy + s * 0.35} ${cx + s * 0.75} ${cy + s * 0.05}
    C ${cx + s * 0.75} ${cy - s * 0.05} ${cx + s * 0.50} ${cy - s * 0.30} ${cx} ${cy - s * 0.30} Z
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${COLOR_PRIMARIO}"/>
    <!-- Glow sutil -->
    <circle cx="${cx}" cy="${cy}" r="${s * 0.90}" fill="${COLOR_CLARO}" opacity="0.12"/>
    <circle cx="${cx}" cy="${cy}" r="${s * 0.70}" fill="${COLOR_CLARO}" opacity="0.18"/>
    <!-- Pin -->
    <path d="${pinPath}" fill="${BLANCO}"/>
    <circle cx="${cx}" cy="${cy}" r="${s * 0.18}" fill="${COLOR_PRIMARIO}"/>
    <polyline points="${cx - s * 0.12},${cy} ${cx - s * 0.03},${cy + s * 0.09} ${cx + s * 0.15},${cy - s * 0.12}"
      fill="none" stroke="${BLANCO}" stroke-width="${s * 0.055}" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Texto GeoTask -->
    <text x="${cx}" y="${cy + s * 0.80}" font-family="sans-serif" font-size="${s * 0.22}" font-weight="700"
      fill="${BLANCO}" text-anchor="middle" letter-spacing="${s * 0.01}">GeoTask</text>
  </svg>`;
}

/**
 * Favicon (48×48) — miniatura del icono.
 */
function svgFavicon(size = 48) {
  const pinPath = `
    M ${size * 0.5} ${size * 0.12}
    C ${size * 0.22} ${size * 0.12} ${size * 0.05} ${size * 0.32} ${size * 0.05} ${size * 0.50}
    C ${size * 0.05} ${size * 0.78} ${size * 0.5} ${size * 0.98} ${size * 0.5} ${size * 0.98}
    C ${size * 0.5} ${size * 0.98} ${size * 0.95} ${size * 0.78} ${size * 0.95} ${size * 0.50}
    C ${size * 0.95} ${size * 0.32} ${size * 0.78} ${size * 0.12} ${size * 0.5} ${size * 0.12} Z
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * 0.20}" fill="${COLOR_PRIMARIO}"/>
    <path d="${pinPath}" fill="${BLANCO}"/>
    <circle cx="${size * 0.5}" cy="${size * 0.50}" r="${size * 0.14}" fill="${COLOR_PRIMARIO}"/>
    <polyline points="${size * 0.37},${size * 0.50} ${size * 0.46},${size * 0.59} ${size * 0.63},${size * 0.39}"
      fill="none" stroke="${BLANCO}" stroke-width="${size * 0.05}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ──────────────────────────────────────────────
// 🏭 Generación
// ──────────────────────────────────────────────

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

async function generar() {
  console.log('🎨 Generando assets visuales de GeoTask...\n');

  // 1. Icono principal (1024×1024)
  const iconoPath = path.join(ASSETS_DIR, 'icon.png');
  await sharp(Buffer.from(svgIconoPrincipal(1024)))
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(iconoPath);
  console.log('✅  icon.png         → 1024×1024  (iOS + Android store)');

  // 2. Adaptive icon (1024×1024)
  const adaptivePath = path.join(ASSETS_DIR, 'adaptive-icon.png');
  await sharp(Buffer.from(svgAdaptiveIcon(1024)))
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(adaptivePath);
  console.log('✅  adaptive-icon.png → 1024×1024  (Android adaptive foreground)');

  // 3. Splash screen (1284×2778)
  const splashPath = path.join(ASSETS_DIR, 'splash.png');
  await sharp(Buffer.from(svgSplash(1284, 2778)))
    .resize(1284, 2778, { fit: 'contain', background: { r: 29, g: 78, b: 216, alpha: 1 } })
    .png()
    .toFile(splashPath);
  console.log('✅  splash.png       → 1284×2778  (Splash screen)');

  // 4. Favicon (48×48)
  const faviconPath = path.join(ASSETS_DIR, 'favicon.png');
  await sharp(Buffer.from(svgFavicon(48)))
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(faviconPath);
  console.log('✅  favicon.png      → 48×48      (Web)');

  console.log('\n🚀 Todos los assets generados correctamente en ./assets/');
}

generar().catch((err) => {
  console.error('❌ Error generando iconos:', err);
  process.exit(1);
});
