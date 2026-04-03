/** @type {import('tailwindcss').Config} */
module.exports = {
  // Indica a Tailwind qué archivos escanear para generar solo las clases usadas
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Colores del design system "Digital Cartographer"
        primario: '#4648d4',
        'primario-claro': '#6063ee',
        secundario: '#b4136d',
        superficie: '#fcf8ff',
        'superficie-dim': '#f5f2fe',
        'superficie-alta': '#e9e6f3',
        'sobre-superficie': '#1b1b23',
        exito: '#22C55E',
        alerta: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        // Inter se carga mediante expo-font
        inter: ['Inter_400Regular'],
        'inter-medio': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-bold': ['Inter_700Bold'],
      },
      borderRadius: {
        // Radios del design system
        boton: '12px',   // Botones: 12px para sensación más "clicable"
        tarjeta: '16px', // Tarjetas: 16px para sensación de "contenedor"
        modal: '24px',   // Modales/bottom sheets: 24px (xl)
      },
    },
  },
  plugins: [],
};
