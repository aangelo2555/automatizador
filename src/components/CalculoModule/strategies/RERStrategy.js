/**
 * RERStrategy - Régimen Especial de Renta
 * 
 * Características:
 * - Renta Mensual: 1.5% de los Ingresos Netos
 * - IGV: 18% (Débito - Crédito)
 * - Sin Declaración Anual de Renta
 * - Tope anual: S/ 525,000
 */

import { TAX_CONSTANTS } from '../constants/taxConstants';

export class RERStrategy {
    constructor() {
        this.type = TAX_CONSTANTS.REGIME_TYPES.RER;
        this.config = TAX_CONSTANTS.RER;
        this.igvConfig = TAX_CONSTANTS.IGV;
    }

    /**
     * Calcula el IGV del mes (Débito - Crédito)
     */
    calculateIGV(ventas, compras) {
        // Base imponible (sin IGV)
        const baseVentas = ventas / this.igvConfig.FACTOR;
        const baseCompras = compras / this.igvConfig.FACTOR;

        // IGV Débito (ventas) e IGV Crédito (compras)
        const igvDebito = baseVentas * this.igvConfig.RATE;
        const igvCredito = baseCompras * this.igvConfig.RATE;

        // IGV a pagar (puede ser negativo = crédito fiscal)
        const igvAPagar = Math.max(0, igvDebito - igvCredito);

        return {
            baseVentas,
            baseCompras,
            igvDebito,
            igvCredito,
            igvAPagar,
            creditoFiscal: igvCredito > igvDebito ? igvCredito - igvDebito : 0,
        };
    }

    /**
     * Calcula impuestos mensuales
     */
    calculateMonthly(monthData) {
        const { ventas, compras } = monthData;

        // Calcular IGV
        const igvCalc = this.calculateIGV(ventas, compras);

        // Renta mensual: 1.5% de ingresos netos (base imponible)
        const rentaMensual = igvCalc.baseVentas * this.config.MONTHLY_RATE;

        const alerts = [];

        return {
            ventas,
            compras,
            baseImponibleVentas: igvCalc.baseVentas,
            baseImponibleCompras: igvCalc.baseCompras,
            igvDebito: igvCalc.igvDebito,
            igvCredito: igvCalc.igvCredito,
            igv: igvCalc.igvAPagar,
            creditoFiscal: igvCalc.creditoFiscal,
            rentaMensual,
            totalImpuestos: igvCalc.igvAPagar + rentaMensual,
            alerts,
        };
    }

    /**
     * Calcula proyección anual (sin declaración anual en RER)
     */
    calculateAnnual(monthlyResults) {
        const totals = monthlyResults.reduce((acc, month) => ({
            ventas: acc.ventas + month.ventas,
            compras: acc.compras + month.compras,
            baseVentas: acc.baseVentas + month.baseImponibleVentas,
            igv: acc.igv + month.igv,
            renta: acc.renta + month.rentaMensual,
        }), { ventas: 0, compras: 0, baseVentas: 0, igv: 0, renta: 0 });

        const alerts = [];

        // Verificar límite anual
        if (totals.ventas > this.config.ANNUAL_LIMIT) {
            alerts.push({
                type: 'error',
                code: 'RER_ANNUAL_EXCEEDED',
                message: `Ingresos anuales superan S/ ${this.config.ANNUAL_LIMIT.toLocaleString()}. Debe migrar a RMT o Régimen General.`,
            });
        } else if (totals.ventas > this.config.ANNUAL_LIMIT * 0.9) {
            alerts.push({
                type: 'warning',
                code: 'RER_NEAR_LIMIT',
                message: `Ingresos al 90% del límite RER. Considere su proyección para el próximo período.`,
            });
        }

        return {
            totalVentas: totals.ventas,
            totalCompras: totals.compras,
            totalBaseImponible: totals.baseVentas,
            totalIGV: totals.igv,
            totalRentaMensual: totals.renta,
            rentaAnual: 0, // RER no tiene regularización anual
            impuestoAnual: totals.igv + totals.renta,
            hasAnnualDeclaration: false,
            alerts,
        };
    }

    /**
     * Obtiene las columnas visibles para este régimen
     */
    getVisibleColumns() {
        return ['month', 'ventas', 'compras', 'igv', 'rentaMensual', 'totalImpuestos'];
    }

    /**
     * Obtiene las filas de entrada para este régimen
     */
    getInputFields() {
        return [
            { key: 'ventas', label: 'Ventas (inc. IGV)', type: 'currency' },
            { key: 'compras', label: 'Compras (inc. IGV)', type: 'currency' },
        ];
    }
}

export default RERStrategy;
