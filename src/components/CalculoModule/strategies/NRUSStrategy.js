/**
 * NRUSStrategy - Nuevo Régimen Único Simplificado
 * 
 * Categorías:
 * - Categoría 1: Ingresos/Compras ≤ S/5,000 → Cuota S/20
 * - Categoría 2: Ingresos/Compras ≤ S/8,000 → Cuota S/50
 * 
 * Alertas:
 * - Si supera S/8,000 mensual → Cambio de régimen obligatorio
 * - Si supera S/96,000 anual → Cambio de régimen obligatorio
 */

import { TAX_CONSTANTS } from '../constants/taxConstants';

export class NRUSStrategy {
    constructor() {
        this.type = TAX_CONSTANTS.REGIME_TYPES.NRUS;
        this.config = TAX_CONSTANTS.NRUS;
    }

    /**
     * Determina la categoría NRUS según el mayor entre ingresos y compras
     */
    getCategory(ventas, compras) {
        const maxAmount = Math.max(ventas, compras);

        if (maxAmount <= this.config.CATEGORY_1.limit) {
            return {
                category: 1,
                ...this.config.CATEGORY_1,
            };
        }

        if (maxAmount <= this.config.CATEGORY_2.limit) {
            return {
                category: 2,
                ...this.config.CATEGORY_2,
            };
        }

        // Excede límites
        return {
            category: null,
            limit: this.config.CATEGORY_2.limit,
            quota: 0,
            label: 'Excede límites',
            exceeded: true,
        };
    }

    /**
     * Calcula impuestos mensuales
     */
    calculateMonthly(monthData) {
        const { ventas, compras } = monthData;
        const categoryInfo = this.getCategory(ventas, compras);

        const alerts = [];

        if (categoryInfo.exceeded) {
            alerts.push({
                type: 'error',
                code: 'NRUS_MONTHLY_EXCEEDED',
                message: `Ingresos o compras superan S/ ${this.config.CATEGORY_2.limit.toLocaleString()}. Cambio de régimen obligatorio.`,
            });
        }

        return {
            ventas,
            compras,
            category: categoryInfo.category,
            categoryLabel: categoryInfo.label,
            cuotaMensual: categoryInfo.quota,
            igv: 0, // NRUS no calcula IGV separado
            rentaMensual: categoryInfo.quota,
            totalImpuestos: categoryInfo.quota,
            alerts,
        };
    }

    /**
     * Calcula proyección anual
     */
    calculateAnnual(monthlyResults) {
        const totals = monthlyResults.reduce((acc, month) => ({
            ventas: acc.ventas + month.ventas,
            compras: acc.compras + month.compras,
            cuotas: acc.cuotas + month.cuotaMensual,
        }), { ventas: 0, compras: 0, cuotas: 0 });

        const alerts = [];

        // Verificar límite anual
        if (totals.ventas > this.config.ANNUAL_LIMIT || totals.compras > this.config.ANNUAL_LIMIT) {
            alerts.push({
                type: 'error',
                code: 'NRUS_ANNUAL_EXCEEDED',
                message: `Ingresos anuales superan S/ ${this.config.ANNUAL_LIMIT.toLocaleString()}. Debe cambiar de régimen tributario.`,
            });
        }

        return {
            totalVentas: totals.ventas,
            totalCompras: totals.compras,
            totalCuotas: totals.cuotas,
            rentaAnual: 0, // NRUS no tiene regularización anual
            impuestoAnual: totals.cuotas,
            hasAnnualDeclaration: false,
            alerts,
        };
    }

    /**
     * Obtiene las columnas visibles para este régimen
     */
    getVisibleColumns() {
        return ['month', 'ventas', 'compras', 'category', 'cuotaMensual'];
    }

    /**
     * Obtiene las filas de entrada para este régimen
     */
    getInputFields() {
        return [
            { key: 'ventas', label: 'Total Ingresos Brutos', type: 'currency' },
            { key: 'compras', label: 'Total Adquisiciones', type: 'currency' },
        ];
    }
}

export default NRUSStrategy;
