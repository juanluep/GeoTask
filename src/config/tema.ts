/**
 * ============================================================
 * Sistema de Diseno — tema.ts
 * ============================================================
 *
 * Este archivo define el "Design System" completo de GeoTask.
 * Un Design System es el conjunto de reglas visuales que garantiza
 * coherencia en toda la app: mismos colores, mismas fuentes,
 * mismo espaciado en todas las pantallas.
 *
 * Filosofia "Digital Cartographer":
 * - Paleta indigo/rosa, estilo editorial premium
 * - Regla "Sin Bordes": separar secciones con cambios de color tonal
 *   en lugar de lineas de 1px (mas premium y moderno)
 * - Glassmorphism para elementos flotantes del mapa
 *
 * @version 1.0.0
 * ============================================================
 */

// ──────────────────────────────────────────────
// SECCION: Paleta de Colores
// Basada en Material Design 3 (M3) pero con tokens propios.
// La nomenclatura usa "on_" para indicar el color del texto/icono
// que va ENCIMA de ese color de fondo (asegura contraste accesible).
// ──────────────────────────────────────────────
export const Colores = {
  // --- Primario (Indigo) ---
  // Uso: botones principales, iconos activos, headers
  primario: '#4648d4',
  primarioClaro: '#6063ee',         // Para gradientes y estados hover
  primarioContenedor: '#e8e8ff',    // Fondo de chips/badges primarios
  sobrePrimario: '#ffffff',         // Texto blanco sobre fondo primario
  sobrePrimarioContenedor: '#0000a1',

  // --- Secundario (Rosa/Magenta) ---
  // Uso: urgencia, proximidad activa, metadata labels, accents
  secundario: '#b4136d',
  secundarioContenedor: '#ffd8e9',
  sobreSecundario: '#ffffff',
  sobreSecundarioContenedor: '#3d0024',

  // --- Superficies (fondos, tarjetas, contenedores) ---
  // La jerarquia de superficies crea profundidad sin usar sombras duras.
  // Piensa en ellas como capas de cristal esmerilado apiladas:
  superficie: '#fcf8ff',            // Capa base de la app
  superficieDim: '#f5f2fe',         // Ligeramente mas oscura que superficie
  superficieContenedor: '#f0ecff',  // Para tarjetas dentro de superficie
  superficieContenedorBaja: '#f5f2fe',
  superficieContenedorAlta: '#e9e6f3',
  superficieContenedorMasAlta: '#e3e0ed',
  sobreSuperficie: '#1b1b23',       // Texto principal (NO negro puro — mas suave)
  sobreSuperficieVariante: '#46464f',

  // --- Outline (bordes sutiles cuando son necesarios) ---
  // Regla: usar SOLO para accesibilidad, al 15% de opacidad ("Ghost Border")
  contorno: '#777680',
  contornoVariante: '#c7c4d7',      // Al 15% opacity = "ghost border" sutil

  // --- Estados funcionales ---
  exito: '#22C55E',    // Tarea completada, establecimiento abierto
  alerta: '#F59E0B',   // Cierra pronto, advertencia
  error: '#EF4444',    // Error, tarea vencida
  info: '#3B82F6',     // Informacion neutral

  // --- Categorias de tareas (colores para marcadores en el mapa) ---
  categorias: {
    compras: '#4CAF50',
    papeleo: '#2196F3',
    bancos: '#FF9800',
    farmacia: '#F44336',
    recogidas: '#9C27B0',
    reparaciones: '#795548',
    restaurantes: '#E91E63',
    otros: '#607D8B',
  },

  // --- Utilidades ---
  transparente: 'transparent',
  negro: '#000000',
  blanco: '#ffffff',
} as const;

// ──────────────────────────────────────────────
// SECCION: Tipografia
// Fuente: Inter — seleccionada por su excelente legibilidad en pantallas
// pequenas y su caracter "editorial" con tracking ajustado.
// ──────────────────────────────────────────────
export const Tipografia = {
  // --- Familias de fuentes ---
  // Estas cadenas deben coincidir con los nombres cargados en expo-font
  fuentes: {
    regular: 'Inter_400Regular',
    medio: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },

  // --- Escala de tamanios ---
  // Display: para "grandes momentos" — nombres de zona, objetivos del dia
  // Body: para descripciones de tareas, legibilidad en movimiento
  // Label: para metadata, etiquetas funcionales
  tamanos: {
    displayGrande: 57,
    displayMedio: 45,
    displayPequeno: 36,
    titularGrande: 32,
    titularMedio: 28,
    titularPequeno: 24,
    tituloGrande: 22,
    tituloMedio: 16,
    tituloPequeno: 14,
    cuerpoGrande: 16,
    cuerpoMedio: 14,
    cuerpoPequeno: 12,
    etiquetaGrande: 14,
    etiquetaMedio: 12,
    etiquetaPequeno: 11,
  },

  // --- Tracking (letter-spacing) ---
  // Los tamanios Display usan tracking negativo (-0.02em) para impacto
  tracking: {
    display: -0.5,
    titulo: 0,
    cuerpo: 0.15,
    etiqueta: 0.5,
  },
} as const;

// ──────────────────────────────────────────────
// SECCION: Espaciado
// Sistema de 4pt para mantener coherencia visual entre componentes.
// Usar siempre multiplos de 4: 4, 8, 12, 16, 20, 24, 32, 40, 48...
// ──────────────────────────────────────────────
export const Espaciado = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  enorme: 48,
  gigante: 64,
} as const;

// ──────────────────────────────────────────────
// SECCION: Radios de borde
// Regla del design system:
// - Botones: 12px (sensacion "activa", clickable)
// - Tarjetas: 16px (sensacion de "contenedor" suave)
// - Modales/bottom sheets: 24px (curva generosa, premium)
// ──────────────────────────────────────────────
export const Radios = {
  ninguno: 0,
  xs: 4,
  sm: 8,
  boton: 12,    // Para botones — no usar 16 en botones (segun design system)
  tarjeta: 16,  // Para cards y contenedores
  modal: 24,    // Para bottom sheets y modales flotantes
  completo: 9999, // Para chips/badges completamente redondeados
} as const;

// ──────────────────────────────────────────────
// SECCION: Elevacion y Sombras
// La filosofia "Tonal Layering" evita sombras fuertes.
// Usamos sombras muy suaves: 32px blur, 0 offset, 6% opacidad.
// ──────────────────────────────────────────────
export const Sombras = {
  ninguna: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sutil: {
    // Para tarjetas flotando sobre superficie
    shadowColor: Colores.sobreSuperficie,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    // Para bottom sheets y modales
    shadowColor: Colores.sobreSuperficie,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 16,
  },
} as const;

// ──────────────────────────────────────────────
// SECCION: Duraciones de animacion
// ──────────────────────────────────────────────
export const Animaciones = {
  rapida: 150,
  normal: 250,
  lenta: 400,
} as const;
