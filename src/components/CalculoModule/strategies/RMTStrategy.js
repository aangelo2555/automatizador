/**
 * RMTStrategy - Régimen MYPE Tributario
 * 
 * Características:
 * - Pago a cuenta mensual:
 *   - 1.0% si ingresos anuales < 300 UIT
 *   - Coeficiente o 1.5% (el mayor) si supera 300 UIT
 * 
 * - Regularización Anual (Proyección 2026):
 *   - Tramo 1: Primeras 15 UIT → Tasa 10%
 *   - Tramo 2: Exceso de 15 UIT → Tasa 29.5%
 */

import { TAX_CONSTANTS } from '../constants/taxConstants';

export class RMTStrategy {
    constructor() {
        this.type = TAX_CONSTANTS.REGIME_TYPES.RMT;
        this.config = TAX_CONSTANTS.RMT;
        this.igvConfig = TAX_CONSTANTS.IGV;
    }

    /**
     * Calcula el IGV del mes (Débito - Crédito)
     */
    calculateIGV(ventas, compras) {
        const baseVentas = ventas / this.igvConfig.FACTOR;
        const baseCompras = compras / this.igvConfig.FACTOR;

        const igvDebito = baseVentas * this.igvConfig.RATE;
        const igvCredito = baseCompras * this.igvConfig.RATE;
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
     * Calcula la utilidad neta del mes
     */
    calculateUtilidadNeta(baseVentas, baseCompras, gastosOperativos, plame, otrosGastos) {
        const totalGastos = baseCompras + gastosOperativos + plame + otrosGastos;
        return Math.max(0, baseVentas - totalGastos);
    }

    /**
     * Determina la tasa de pago a cuenta según ingresos acumulados
     */
    getMonthlyRate(ingresosAcumulados, coeficiente = 0) {
        if (ingresosAcumulados < this.config.THRESHOLD_300_UIT) {
            return {
                rate: this.config.MONTHLY_RATE_BELOW_300,
                method: 'Tasa fija 1.0%',
                isBelow300UIT: true,
            };
        }

        // Si supera 300 UIT, usa el mayor entre coeficiente y 1.5%
        const effectiveRate = Math.max(coeficiente, this.config.MONTHLY_RATE_ABOVE_300);
        return {
            rate: effectiveRate,
            method: coeficiente > this.config.MONTHLY_RATE_ABOVE_300
                ? `Coeficiente ${(coeficiente * 100).toFixed(2)}%`
                : 'Tasa mínima 1.5%',
            isBelow300UIT: false,
        };
    }

    /**
     * Calcula impuestos mensuales
     */
    calculateMonthly(monthData, ingresosAcumulados = 0, coeficiente = 0) {
        const { ventas, compras, gastosOperativos = 0, plame = 0, otrosGastos = 0 } = monthData;

        // Calcular IGV
        const igvCalc = this.calculateIGV(ventas, compras);

        // Calcular utilidad
        const utilidadNeta = this.calculateUtilidadNeta(
            igvCalc.baseVentas,
            igvCalc.baseCompras,
            gastosOperativos,
            plame,
            otrosGastos
        );

        // Determinar tasa de pago a cuenta
        const rateInfo = this.getMonthlyRate(ingresosAcumulados + ventas, coeficiente);

        // Pago a cuenta mensual sobre ingresos netos
        const pagoACuenta = igvCalc.baseVentas * rateInfo.rate;

        const alerts = [];

        // Alerta al acercarse al umbral de 300 UIT
        const newAccumulated = ingresosAcumulados + ventas;
        if (rateInfo.isBelow300UIT && newAccumulated > this.config.THRESHOLD_300_UIT * 0.9) {
            alerts.push({
                type: 'warning',
                code: 'RMT_NEAR_300UIT',
                message: 'Próximo a superar 300 UIT. La tasa de pago a cuenta aumentará.',
            });
        }

        return {
            ventas,
            compras,
            gastosOperativos,
            plame,
            otrosGastos,
            baseImponibleVentas: igvCalc.baseVentas,
            baseImponibleCompras: igvCalc.baseCompras,
            igvDebito: igvCalc.igvDebito,
            igvCredito: igvCalc.igvCredito,
            igv: igvCalc.igvAPagar,
            utilidadNeta,
            tasaPagoACuenta: rateInfo.rate,
            metodoPago: rateInfo.method,
            pagoACuenta,
            totalImpuestos: igvCalc.igvAPagar + pagoACuenta,
            alerts,
        };
    }

    /**
     * Calcula el impuesto anual aplicando tramos escalonados
     */
    calculateAnnualTax(utilidadNetaAnual) {
        const tramo1Limit = this.config.TRAMO_1.limit;
        const tramo1Rate = this.config.TRAMO_1.rate;
        const tramo2Rate = this.config.TRAMO_2.rate;

        let impuestoTramo1 = 0;
        let impuestoTramo2 = 0;
        let baseTramo1 = 0;
        let baseTramo2 = 0;

        if (utilidadNetaAnual <= tramo1Limit) {
            // Solo tramo 1
            baseTramo1 = utilidadNetaAnual;
            impuestoTramo1 = utilidadNetaAnual * tramo1Rate;
        } else {
            // Ambos tramos
            baseTramo1 = tramo1Limit;
            impuestoTramo1 = tramo1Limit * tramo1Rate;

            baseTramo2 = utilidadNetaAnual - tramo1Limit;
            impuestoTramo2 = baseTramo2 * tramo2Rate;
        }

        return {
            utilidadNetaAnual,
            tramo1: {
                base: baseTramo1,
                rate: tramo1Rate,
                impuesto: impuestoTramo1,
                limit: tramo1Limit,
            },
            tramo2: {
                base: baseTramo2,
                rate: tramo2Rate,
                impuesto: impuestoTramo2,
            },
            impuestoTotal: impuestoTramo1 + impuestoTramo2,
            tasaEfectiva: utilidadNetaAnual > 0
                ? (impuestoTramo1 + impuestoTramo2) / utilidadNetaAnual
                : 0,
        };
    }

    /**
     * Calcula proyección anual con regularización
     */
    calculateAnnual(monthlyResults) {
        const totals = monthlyResults.reduce((acc, month) => ({
            ventas: acc.ventas + month.ventas,
            compras: acc.compras + month.compras,
            baseVentas: acc.baseVentas + month.baseImponibleVentas,
            igv: acc.igv + month.igv,
            pagosACuenta: acc.pagosACuenta + month.pagoACuenta,
            utilidadNeta: acc.utilidadNeta + month.utilidadNeta,
            gastos: acc.gastos + month.gastosOperativos + month.plame + month.otrosGastos,
        }), { ventas: 0, compras: 0, baseVentas: 0, igv: 0, pagosACuenta: 0, utilidadNeta: 0, gastos: 0 });

        // Calcular impuesto anual con tramos
        const annualTax = this.calculateAnnualTax(totals.utilidadNeta);

        // Regularización: Impuesto anual - pagos a cuenta
        const regularizacion = Math.max(0, annualTax.impuestoTotal - totals.pagosACuenta);
        const saldoAFavor = totals.pagosACuenta > annualTax.impuestoTotal
            ? totals.pagosACuenta - annualTax.impuestoTotal
            : 0;

        const alerts = [];

        if (saldoAFavor > 0) {
            alerts.push({
                type: 'info',
                code: 'RMT_SALDO_FAVOR',
                message: `Tiene un saldo a favor de S/ ${saldoAFavor.toFixed(2)} para aplicar o solicitar devolución.`,
            });
        }

        return {
            totalVentas: totals.ventas,
            totalCompras: totals.compras,
            totalBaseImponible: totals.baseVentas,
            totalGastos: totals.gastos,
            totalIGV: totals.igv,
            totalPagosACuenta: totals.pagosACuenta,
            utilidadNetaAnual: totals.utilidadNeta,
            annualTaxDetails: annualTax,
            impuestoAnualCalculado: annualTax.impuestoTotal,
            regularizacion,
            saldoAFavor,
            rentaAnual: regularizacion,
            impuestoAnual: totals.igv + totals.pagosACuenta + regularizacion,
            hasAnnualDeclaration: true,
            alerts,
        };
    }

    /**
     * Obtiene las columnas visibles para este régimen
     */
    getVisibleColumns() {
        return ['month', 'ventas', 'compras', 'gastosOperativos', 'plame', 'utilidadNeta', 'igv', 'pagoACuenta', 'totalImpuestos'];
    }

    /**
     * Obtiene las filas de entrada para este régimen
     */
    getInputFields() {
        return [
            { key: 'ventas', label: 'Ventas (inc. IGV)', type: 'currency' },
            { key: 'compras', label: 'Compras (inc. IGV)', type: 'currency' },
            { key: 'gastosOperativos', label: 'Gastos Operativos', type: 'currency' },
            { key: 'plame', label: 'Liquidación PLAME', type: 'currency' },
            { key: 'otrosGastos', label: 'Otros Gastos', type: 'currency' },
        ];
    }
}

export default RMTStrategy;
