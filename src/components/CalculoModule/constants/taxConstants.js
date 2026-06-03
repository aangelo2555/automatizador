/**
 * TAX_CONSTANTS - Configuración Global Tributaria SUNAT 2026
 * 
 * La UIT (Unidad Impositiva Tributaria) es la base para todos los cálculos.
 * Todos los topes se calculan dinámicamente a partir de la UIT para
 * asegurar compatibilidad con futuros ejercicios fiscales.
 */

export const TAX_CONSTANTS = {
  // ============================================
  // VARIABLE PRINCIPAL - EDITABLE PARA CADA AÑO
  // ============================================
  UIT_2026: 5350, // Valor proyectado para 2026 (S/)

  // ============================================
  // NRUS - Nuevo Régimen Único Simplificado
  // ============================================
  NRUS: {
    CATEGORY_1: {
      limit: 5000,      // Tope mensual ingresos/compras
      quota: 20,        // Cuota mensual fija
      label: 'Categoría 1'
    },
    CATEGORY_2: {
      limit: 8000,      // Tope mensual ingresos/compras
      quota: 50,        // Cuota mensual fija
      label: 'Categoría 2'
    },
    ANNUAL_LIMIT: 96000, // Límite anual (12 x 8,000)
  },

  // ============================================
  // RER - Régimen Especial de Renta
  // ============================================
  RER: {
    get ANNUAL_LIMIT() { return 525000; },          // Límite anual de ingresos
    MONTHLY_RATE: 0.015,                             // 1.5% de ingresos netos
    HAS_ANNUAL_DECLARATION: false,                   // Sin declaración anual
  },

  // ============================================
  // RMT - Régimen MYPE Tributario
  // ============================================
  get RMT() {
    return {
      THRESHOLD_300_UIT: this.UIT_2026 * 300,        // S/ 1,605,000 para 2026
      MONTHLY_RATE_BELOW_300: 0.01,                  // 1.0% si < 300 UIT
      MONTHLY_RATE_ABOVE_300: 0.015,                 // 1.5% o coeficiente
      TRAMO_1: {
        limit: this.UIT_2026 * 15,                   // Primeras 15 UIT (S/ 80,250)
        rate: 0.10,                                  // 10%
        label: 'Primeras 15 UIT'
      },
      TRAMO_2: {
        rate: 0.295,                                 // 29.5%
        label: 'Exceso de 15 UIT'
      },
      HAS_ANNUAL_DECLARATION: true,
    };
  },

  // ============================================
  // RG - Régimen General
  // ============================================
  RG: {
    MONTHLY_MIN_RATE: 0.015,                         // Mínimo 1.5%
    ANNUAL_RATE: 0.295,                              // 29.5% tasa única
    HAS_ANNUAL_DECLARATION: true,
  },

  // ============================================
  // IGV - Impuesto General a las Ventas
  // ============================================
  IGV: {
    RATE: 0.18,                                      // 18%
    get FACTOR() { return 1 + this.RATE; },          // 1.18
  },

  // ============================================
  // MESES DEL AÑO
  // ============================================
  MONTHS: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],

  // ============================================
  // TIPOS DE RÉGIMEN
  // ============================================
  REGIME_TYPES: {
    NRUS: 'NRUS',
    RER: 'RER',
    RMT: 'RMT',
    RG: 'RG',
  },

  // ============================================
  // INFORMACIÓN DE REGÍMENES
  // ============================================
  REGIME_INFO: {
    NRUS: {
      name: 'Nuevo RUS',
      fullName: 'Nuevo Régimen Único Simplificado',
      description: 'Para pequeños comerciantes con ingresos hasta S/ 96,000 anuales',
      color: '#00f0ff',
    },
    RER: {
      name: 'RER',
      fullName: 'Régimen Especial de Renta',
      description: 'Cuota fija mensual del 1.5% sin declaración anual',
      color: '#a855f7',
    },
    RMT: {
      name: 'RMT',
      fullName: 'Régimen MYPE Tributario',
      description: 'Tasas escalonadas para micro y pequeñas empresas',
      color: '#00ff88',
    },
    RG: {
      name: 'RG',
      fullName: 'Régimen General',
      description: 'Tasa única del 29.5% sobre utilidad neta',
      color: '#ff3366',
    },
  },
};

/**
 * Función helper para formatear moneda peruana
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Función helper para formatear porcentajes
 */
export const formatPercentage = (value) => {
  return `${(value * 100).toFixed(1)}%`;
};

/**
 * Estructura inicial de datos mensuales
 */
export const getInitialMonthlyData = () => {
  return TAX_CONSTANTS.MONTHS.map((month, index) => ({
    month,
    monthIndex: index,
    ventas: 0,
    compras: 0,
    gastosOperativos: 0,
    plame: 0,
    otrosGastos: 0,
  }));
};

export default TAX_CONSTANTS;
