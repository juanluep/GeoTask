// metro.config.js
// Configuración de Metro (el bundler de React Native) con soporte para NativeWind v4
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// withNativeWind integra el procesamiento de clases Tailwind en el proceso de compilación
module.exports = withNativeWind(config, { input: './global.css' });
