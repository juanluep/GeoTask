module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      // Permite usar alias de paths como @/componentes en lugar de rutas relativas largas
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@componentes': './src/components',
            '@hooks': './src/hooks',
            '@stores': './src/stores',
            '@servicios': './src/services',
            '@modelos': './src/models',
            '@utils': './src/utils',
            '@config': './src/config',
          },
        },
      ],
      // Reanimated DEBE ser el último plugin siempre
      'react-native-reanimated/plugin',
    ],
  };
};
