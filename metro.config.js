// metro.config.js
// Configuración de Metro (el bundler de React Native) con soporte para NativeWind v4
//
// NOTA: Este archivo extiende @expo/metro-config via getDefaultConfig de expo/metro-config,
// que es la forma oficial documentada por Expo y NativeWind v4.
// Si EAS muestra un warning sobre "does not extend @expo/metro-config", puedes ignorarlo
// respondiendo "n" (No abortar) — el build funcionará correctamente.
//
// @see https://www.nativewind.dev/v4/getting-started/expo-router

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// withNativeWind integra el procesamiento de clases Tailwind en el proceso de compilación
module.exports = withNativeWind(config, { input: './global.css' });
