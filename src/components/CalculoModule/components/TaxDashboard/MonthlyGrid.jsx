/**
 * MonthlyGrid - Grid inteligente de datos mensuales
 * 
 * Tabla adaptativa que cambia según el régimen seleccionado.
 * Incluye inputs editables con validación y estados visuales.
 */

import React, { useCallback } from 'react';
import { formatCurrency } from '../../constants/taxConstants';
import styles from './TaxDashboard.module.css';

const MonthlyGrid = ({
    months,
    monthlyData,
    monthlyResults,
    monthlyTotals,
    inputFields,
    visibleColumns,
    regimeType,
    onUpdateMonth,
}) => {
    // Handler para cambios en inputs
    const handleInputChange = useCallback((monthIndex, field, value) => {
        // Validar que sea un número válido
        const numValue = value.replace(/[^0-9.]/g, '');
        onUpdateMonth(monthIndex, field, numValue);
    }, [onUpdateMonth]);

    // Determinar el estado visual de una fila
    const getRowStatus = (result) => {
        if (!result) return 'neutral';

        if (result.alerts?.some(a => a.type === 'error')) {
            return 'negative';
        }

        if (result.utilidadNeta !== undefined) {
            return result.utilidadNeta > 0 ? 'positive' : 'neutral';
        }

        const ganancia = (result.ventas || 0) - (result.compras || 0);
        return ganancia > 0 ? 'positive' : ganancia < 0 ? 'negative' : 'neutral';
    };

    // Renderizar celda según tipo
    const renderCell = (key, value, isInput = false, monthIndex = null) => {
        if (isInput) {
            return (
                <input
                    type="text"
                    className={styles.gridInput}
                    value={value || ''}
                    onChange={(e) => handleInputChange(monthIndex, key, e.target.value)}
                    placeholder="0.00"
                />
            );
        }

        if (typeof value === 'number') {
            return (
                <span className={styles.currencyValue}>
                    {formatCurrency(value)}
                </span>
            );
        }

        return value;
    };

    // Obtener etiqueta de columna
    const getColumnLabel = (key) => {
        const labels = {
            month: 'Mes',
            ventas: 'Ventas',
            compras: 'Compras',
            category: 'Cat.',
            cuotaMensual: 'Cuota',
            igv: 'IGV',
            rentaMensual: 'Renta',
            pagoACuenta: 'Pago a Cuenta',
            totalImpuestos: 'Total Imp.',
            gastosOperativos: 'Gastos Op.',
            plame: 'PLAME',
            utilidadNeta: 'Utilidad',
            otrosGastos: 'Otros',
        };
        return labels[key] || key;
    };

    // Determinar si una columna es editable
    const isEditableColumn = (key) => {
        return inputFields.some(field => field.key === key);
    };

    return (
        <div className={styles.gridContainer}>
            <div className={styles.gridWrapper}>
                <table className={styles.monthlyGrid}>
                    <thead>
                        <tr>
                            {visibleColumns.map((col) => (
                                <th key={col} className={styles.gridHeader}>
                                    {getColumnLabel(col)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((month, index) => {
                            const data = monthlyData[index];
                            const result = monthlyResults[index];
                            const status = getRowStatus(result);

                            return (
                                <tr
                                    key={month}
                                    className={`${styles.gridRow} ${styles[`row${status}`]}`}
                                >
                                    {visibleColumns.map((col) => {
                                        const isEditable = isEditableColumn(col);
                                        const value = isEditable ? data[col] : result?.[col];

                                        return (
                                            <td key={col} className={styles.gridCell}>
                                                {col === 'month' ? (
                                                    <span className={styles.monthLabel}>{month}</span>
                                                ) : col === 'category' ? (
                                                    <span className={`${styles.categoryBadge} ${result?.category === 1 ? styles.cat1 :
                                                            result?.category === 2 ? styles.cat2 :
                                                                styles.catExceeded
                                                        }`}>
                                                        {result?.categoryLabel || '-'}
                                                    </span>
                                                ) : (
                                                    renderCell(col, value, isEditable, index)
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className={styles.totalsRow}>
                            {visibleColumns.map((col) => (
                                <td key={col} className={styles.totalsCell}>
                                    {col === 'month' ? (
                                        <span className={styles.totalsLabel}>TOTALES</span>
                                    ) : col === 'category' ? (
                                        '-'
                                    ) : (
                                        <span className={styles.totalsValue}>
                                            {formatCurrency(monthlyTotals[col] || 0)}
                                        </span>
                                    )}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default MonthlyGrid;
