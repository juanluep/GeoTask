/**
 * ============================================================
 * Modelo de Plantilla — plantilla.modelo.ts
 * ============================================================
 *
 * Una PlantillaTarea define una tarea que se regenera automáticamente
 * según una frecuencia (diaria, semanal, mensual...).
 *
 * Relación con Tarea:
 * Tarea tiene un campo opcional `plantillaId`.
 * Al completar una tarea con plantillaId, se crea automáticamente
 * la siguiente instancia con la fecha calculada según la frecuencia.
 *
 * @version 1.0.0
 * ============================================================
 */

/** Frecuencias de repetición disponibles */
export type FrecuenciaPlantilla =
  | 'diaria'
  | 'semanal'
  | 'quincenal'
  | 'mensual';

/**
 * Plantilla de tarea recurrente.
 * Define los datos base que se copian a cada instancia generada.
 */
export interface PlantillaTarea {
  id: string;

  // ── Datos base de la tarea (se copian a cada instancia) ──
  titulo: string;
  descripcion: string;
  categoriaId: string;
  latitud: number;
  longitud: number;
  direccion: string;
  nombreLugar?: string;
  osmId?: string;
  radioProximidad: number;
  prioridad: 'alta' | 'media' | 'baja';

  // ── Configuración de recurrencia ─────────
  frecuencia: FrecuenciaPlantilla;

  /**
   * Para frecuencia 'semanal': días de la semana (0=Dom, 1=Lun, ... 6=Sáb)
   * Ejemplo: [1, 4] = lunes y jueves
   */
  diasSemana?: number[];

  /** Fecha de creación de la plantilla en ISO 8601 */
  fechaCreacion: string;

  /** Si la plantilla está activa (puede pausarse sin eliminarla) */
  activa: boolean;

  /** ID de la última tarea generada por esta plantilla */
  ultimaTareaId?: string;
}

/**
 * Calcula la fecha de la próxima instancia de una tarea recurrente.
 * @param plantilla - La plantilla de la tarea
 * @param desde - Fecha base (normalmente la fecha de completado)
 * @returns Fecha ISO 8601 de la próxima instancia
 */
export function calcularProximaFecha(
  plantilla: PlantillaTarea,
  desde: Date = new Date()
): string {
  const siguiente = new Date(desde);

  switch (plantilla.frecuencia) {
    case 'diaria':
      // Sumar un día natural a la fecha base
      siguiente.setDate(siguiente.getDate() + 1);
      break;

    case 'semanal':
      if (plantilla.diasSemana && plantilla.diasSemana.length > 0) {
        // Encontrar el próximo día de la semana en la lista configurada.
        // Por ejemplo: si hoy es martes (2) y los días son [1, 4],
        // el próximo es jueves (4), que está a 2 días.
        const diaActual = desde.getDay();
        const diasOrdenados = [...plantilla.diasSemana].sort((a, b) => a - b);
        const proximoDia = diasOrdenados.find((d) => d > diaActual) ?? diasOrdenados[0];
        const diasHasta =
          proximoDia > diaActual
            ? proximoDia - diaActual
            : 7 - diaActual + proximoDia; // Vuelta al inicio de la semana
        siguiente.setDate(siguiente.getDate() + diasHasta);
      } else {
        // Sin días específicos: repetir exactamente 7 días después
        siguiente.setDate(siguiente.getDate() + 7);
      }
      break;

    case 'quincenal':
      // Cada 14 días exactos
      siguiente.setDate(siguiente.getDate() + 14);
      break;

    case 'mensual':
      // setMonth maneja automáticamente el cambio de año
      // (ej: diciembre + 1 → enero del año siguiente)
      siguiente.setMonth(siguiente.getMonth() + 1);
      break;
  }

  return siguiente.toISOString();
}
