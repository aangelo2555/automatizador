/**
 * SummaryCard - Tarjetas de resumen con efecto glassmorphism
 * 
 * Muestra métricas clave y proyecciones anuales
 */

import React from 'react';
import { formatCurrency, formatPercentage } from '../../constants/taxConstants';
import styles from './TaxDashboard.module.css';

const SummaryCard = ({
    title,
    value,
    subtitle,
    icon,
    variant = 'default',
    trend = null,
    details = null,
}) => {
    return (
        <div className={`${styles.summaryCard} ${styles[`card${variant}`]}`}>
            <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>{icon}</span>
                <h3 className={styles.cardTitle}>{title}</h3>
            </div>

            <div className={styles.cardBody}>
                <div className={styles.cardValue}>
                    {typeof value === 'number' ? formatCurrency(value) : value}
                </div>

                {trend !== null && (
                    <div className={`${styles.cardTrend} ${trend >= 0 ? styles.trendUp : styles.trendDown}`}>
                        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
                    </div>
                )}

                {subtitle && (
                    <div className={styles.cardSubtitle}>{subtitle}</div>
                )}
            </div>

            {details && (
                <div className={styles.cardDetails}>
                    {details.map((detail, index) => (
                        <div key={index} className={styles.detailRow}>
                            <span className={styles.detailLabel}>{detail.label}</span>
                            <span className={styles.detailValue}>
                                {typeof detail.value === 'number'
                                    ? formatCurrency(detail.value)
                                    : detail.value
                                }
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Tarjeta específica para resumen anual
const AnnualSummaryCard = ({ annualProjection, regimeType, hasAnnualDeclaration }) => {
    if (!annualProjection) return null;

    const getDetails = () => {
        const details = [
            { label: 'Total IGV', value: annualProjection.totalIGV || 0 },
        ];

        if (regimeType === 'NRUS') {
            details.push({ label: 'Total Cuotas', value: annualProjection.totalCuotas || 0 });
        } else if (regimeType === 'RER') {
            details.push({ label: 'Renta Mensual Acum.', value: annualProjection.totalRentaMensual || 0 });
        } else {
            details.push(
                { label: 'Pagos a Cuenta', value: annualProjection.totalPagosACuenta || 0 },
                { label: 'Regularización', value: annualProjection.regularizacion || 0 }
            );

            if (annualProjection.saldoAFavor > 0) {
                details.push({ label: 'Saldo a Favor', value: annualProjection.saldoAFavor });
            }
        }

        return details;
    };

    return (
        <SummaryCard
            title="Impuesto Anual Proyectado"
            value={annualProjection.impuestoAnual || 0}
            subtitle={hasAnnualDeclaration ? 'Incluye regularización anual' : 'Sin declaración anual'}
            icon={<TaxIcon />}
            variant="highlight"
            details={getDetails()}
        />
    );
};

// Tarjeta para desglose de tramos RMT
const RMTTramoCard = ({ annualTaxDetails }) => {
    if (!annualTaxDetails) return null;

    return (
        <SummaryCard
            title="Cálculo por Tramos RMT"
            value={annualTaxDetails.impuestoTotal}
            subtitle={`Tasa efectiva: ${formatPercentage(annualTaxDetails.tasaEfectiva)}`}
            icon={<LayersIcon />}
            variant="info"
            details={[
                {
                    label: `Tramo 1 (10%) - ${formatCurrency(annualTaxDetails.tramo1?.limit || 0)}`,
                    value: annualTaxDetails.tramo1?.impuesto || 0
                },
                {
                    label: 'Tramo 2 (29.5%)',
                    value: annualTaxDetails.tramo2?.impuesto || 0
                },
            ]}
        />
    );
};

// Iconos SVG
const TaxIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
);

const LayersIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

export { SummaryCard, AnnualSummaryCard, RMTTramoCard };
export default SummaryCard;
