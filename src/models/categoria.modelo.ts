/**
 * ============================================================
 * Modelo de Categoria — categoria.modelo.ts
 * ============================================================
 *
 * Define la estructura de datos de una Categoria de tarea.
 * Las categorias permiten clasificar visualmente las tareas
 * y determinar el color del marcador en el mapa.
 *
 * @version 1.0.0
 * ============================================================
 */

// ──────────────────────────────────────────────
// SECCION: Interfaz principal
// ──────────────────────────────────────────────

/**
 * Representa una categoria para clasificar tareas.
 * Incluye categorias predeterminadas del sistema y permite
 * que el usuario cree las suyas propias.
 */
export interface Categoria {
  /** Identificador unico (UUID generado con react-native-uuid) */
  id: string;

  /** Nombre visible de la categoria (ej: "Compras", "Bancos") */
  nombre: string;

  /**
   * Nombre del icono de MaterialCommunityIcons o Ionicons.
   * Ejemplo: 'shopping-cart', 'bank', 'pill'
   * Referencia: https://oblador.github.io/react-native-vector-icons/
   */
  icono: string;

  /**
   * Color hexadecimal para el marcador en el mapa y el badge de la categoria.
   * Ejemplo: '#4CAF50' para Compras (verde)
   */
  color: string;

  /**
   * Indica si es una categoria del sistema (no puede eliminarse).
   * Las categorias predeterminadas se insertan al iniciar la BD por primera vez.
   */
  esPredeterminada: boolean;
}

// ──────────────────────────────────────────────
// SECCION: Categorias predeterminadas del sistema
// Estas 8 categorias se insertan en SQLite al iniciar la app por primera vez.
// Cubren los casos de uso mas comunes de mandados cotidianos.
// ──────────────────────────────────────────────

/** IDs fijos para las categorias predeterminadas (no cambian entre sesiones) */
export const ID_CATEGORIAS = {
  COMPRAS: 'cat-compras',
  PAPELEO: 'cat-papeleo',
  BANCOS: 'cat-bancos',
  FARMACIA: 'cat-farmacia',
  RECOGIDAS: 'cat-recogidas',
  REPARACIONES: 'cat-reparaciones',
  RESTAURANTES: 'cat-restaurantes',
  OTROS: 'cat-otros',
} as const;

/** Lista completa de categorias predeterminadas con sus atributos visuales */
export const CATEGORIAS_PREDETERMINADAS: Categoria[] = [
  {
    id: ID_CATEGORIAS.COMPRAS,
    nombre: 'Compras',
    icono: 'cart',
    color: '#4CAF50',
    esPredeterminada: true,
  },
  {
    id: ID_CATEGORIAS.PAPELEO,
    nombre: 'Papeleo',
    icono: 'file-document',
    color: '#2196F3',
    esPredeterminada: true,
  },
  {
    id: ID_CATEGORIAS.BANCOS,
    nombre: 'Bancos',
    icono: 'bank',
    color: '#FF9800',
    esPredeterminada: true,
  },
  {
    id: ID_CATEGORIAS.FARMACIA,
    nombre: 'Farmacia',
    icono: 'pill',
    color: '#F44336',
    esPredeterminada: true,
  },
  {
    id: ID_CATEGORIAS.RECOGIDAS,
    nombre: 'Recogidas',
    icono: 'package-variant',
    color: '#9C27B0',
    esPredeterminada: true,
  },
  {
    id: ID_CATEGORIAS.REPARACIONES,
    nombre: 'Reparaciones',
    icono: 'wrench',
    color: '#795548',
    esPredeterminada: true,
  },
  {
    id: ID_CATEGORIAS.RESTAURANTES,
    nombre: 'Restaurantes',
    icono: 'silverware-fork-knife',
    color: '#E91E63',
    esPredeterminada: true,
  },
  {
    id: ID_CATEGORIAS.OTROS,
    nombre: 'Otros',
    icono: 'map-marker',
    color: '#607D8B',
    esPredeterminada: true,
  },
];
