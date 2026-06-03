/**
 * RGStrategy - Régimen General
 * 
 * Características:
 * - Pago a cuenta mensual: Mayor entre Coeficiente o 1.5%
 * - Regularización Anual: Tasa fija 29.5% sobre Utilidad Neta
 * - Sin tramos escalonados
 */

import { TAX_CONSTANTS } from '../constants/taxConstants';

export class RGStrategy {
    constructor() {
        this.type = TAX_CONSTANTS.REGIME_TYPES.RG;
        this.config = TAX_CONSTANTS.RG;
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
     * Calcula el coeficiente basado en el ejercicio anterior
     * Coeficiente = Impuesto calculado año anterior / Ingresos netos año anterior
     */
    calculateCoeficiente(impuestoAnterior, ingresosAnterior) {
        if (ingresosAnterior === 0) return 0;
        return impuestoAnterior / ingresosAnterior;
    }

    /**
     * Determina la tasa de pago a cuenta (mayor entre coeficiente y 1.5%)
     */
    getMonthlyRate(coeficiente = 0) {
        const minRate = this.config.MONTHLY_MIN_RATE;
        const effectiveRate = Math.max(coeficiente, minRate);

        return {
            rate: effectiveRate,
            method: coeficiente > minRate
                ? `Coeficiente ${(coeficiente * 100).toFixed(4)}%`
                : 'Tasa mínima 1.5%',
            coeficiente,
            usesCoeficiente: coeficiente > minRate,
        };
    }

    /**
     * Calcula impuestos mensuales
     */
    calculateMonthly(monthData, coeficiente = 0) {
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
        const rateInfo = this.getMonthlyRate(coeficiente);

        // Pago a cuenta mensual sobre ingresos netos
        const pagoACuenta = igvCalc.baseVentas * rateInfo.rate;

        const alerts = [];

        // Alerta si hay pérdida
        if (utilidadNeta === 0 && igvCalc.baseVentas > 0) {
            alerts.push({
                type: 'warning',
                code: 'RG_LOSS_MONTH',
                message: 'Este mes presenta pérdida operativa. Los pagos a cuenta se mantienen.',
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
            creditoFiscal: igvCalc.creditoFiscal,
            utilidadNeta,
            coeficiente: rateInfo.coeficiente,
            tasaPagoACuenta: rateInfo.rate,
            metodoPago: rateInfo.method,
            pagoACuenta,
            totalImpuestos: igvCalc.igvAPagar + pagoACuenta,
            alerts,
        };
    }

    /**
     * Calcula el impuesto anual (tasa única 29.5%)
     */
    calculateAnnualTax(utilidadNetaAnual) {
        const rate = this.config.ANNUAL_RATE;
        const impuesto = utilidadNetaAnual * rate;

        return {
            utilidadNetaAnual,
            rate,
            impuesto,
            tasaEfectiva: rate, // En RG siempre es la misma
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
            baseCompras: acc.baseCompras + month.baseImponibleCompras,
            igv: acc.igv + month.igv,
            pagosACuenta: acc.pagosACuenta + month.pagoACuenta,
            utilidadNeta: acc.utilidadNeta + month.utilidadNeta,
            gastos: acc.gastos + month.gastosOperativos + month.plame + month.otrosGastos,
        }), { ventas: 0, compras: 0, baseVentas: 0, baseCompras: 0, igv: 0, pagosACuenta: 0, utilidadNeta: 0, gastos: 0 });

        // Calcular impuesto anual
        const annualTax = this.calculateAnnualTax(totals.utilidadNeta);

        // Regularización: Impuesto anual - pagos a cuenta
        const regularizacion = Math.max(0, annualTax.impuesto - totals.pagosACuenta);
        const saldoAFavor = totals.pagosACuenta > annualTax.impuesto
            ? totals.pagosACuenta - annualTax.impuesto
            : 0;

        // Calcular nuevo coeficiente para siguiente año
        const nuevoCoeficiente = totals.baseVentas > 0
            ? annualTax.impuesto / totals.baseVentas
            : 0;

        const alerts = [];

        if (saldoAFavor > 0) {
            alerts.push({
                type: 'info',
                code: 'RG_SALDO_FAVOR',
                message: `Saldo a favor de S/ ${saldoAFavor.toFixed(2)} para compensar o solicitar devolución.`,
            });
        }

        if (totals.utilidadNeta === 0 && totals.ventas > 0) {
            alerts.push({
                type: 'warning',
                code: 'RG_ANNUAL_LOSS',
                message: 'El ejercicio presenta pérdida. Puede arrastrarse hasta 4 años.',
            });
        }

        return {
            totalVentas: totals.ventas,
            totalCompras: totals.compras,
            totalBaseImponibleVentas: totals.baseVentas,
            totalBaseImponibleCompras: totals.baseCompras,
            totalGastos: totals.gastos,
            totalIGV: totals.igv,
            totalPagosACuenta: totals.pagosACuenta,
            utilidadNetaAnual: totals.utilidadNeta,
            annualTaxDetails: annualTax,
            impuestoAnualCalculado: annualTax.impuesto,
            regularizacion,
            saldoAFavor,
            nuevoCoeficiente,
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

export default RGStrategy;
