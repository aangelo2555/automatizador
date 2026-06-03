/**
 * TaxDashboard - Componente Principal del Hub Fiscal 360°
 * 
 * Integra el selector de régimen, grid mensual y tarjetas de resumen
 * con el diseño Antigravity (Dark Mode, Glassmorphism, Neones)
 * 
 * ACTUALIZADO: Ahora incluye selector de cliente y auto-guardado
 */

import React from 'react';
import useTaxCalculator from '../../hooks/useTaxCalculator';
import RegimeSelector from './RegimeSelector';
import ClientSelector from './ClientSelector';
import MonthlyGrid from './MonthlyGrid';
import { SummaryCard, AnnualSummaryCard, RMTTramoCard } from './SummaryCard';
import AlertBanner from '../common/AlertBanner';
import { formatCurrency, TAX_CONSTANTS } from '../../constants/taxConstants';
import styles from './TaxDashboard.module.css';

// Componente indicador de guardado
const SaveIndicator = ({ status }) => {
    const getIndicatorContent = () => {
        switch (status) {
            case 'saving':
                return (
                    <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Guardando...
                    </>
                );
            case 'saved':
                return (
                    <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Guardado
                    </>
                );
            case 'noClient':
                return (
                    <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Selecciona un cliente
                    </>
                );
            default:
                return null;
        }
    };

    if (status === 'idle') return null;

    return (
        <div className={`${styles.saveIndicator} ${styles[status]}`}>
            {getIndicatorContent()}
        </div>
    );
};

const TaxDashboard = () => {
    const {
        // Estado
        regimeType,
        regimeInfo,
        monthlyData,
        coeficiente,
        selectedClient,

        // Resultados
        monthlyResults,
        annualProjection,
        monthlyTotals,

        // Alertas
        alerts,
        hasAlerts,

        // Config UI
        inputFields,
        visibleColumns,
        hasAnnualDeclaration,
        availableRegimes,

        // Indicadores
        financialStatus,
        saveStatus,

        // Métodos
        updateMonth,
        clearAllData,
        changeRegime,
        changeClient,
        setCoeficiente,

        // Constantes
        UIT,
        months,
    } = useTaxCalculator();

    return (
        <div className={styles.dashboard}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerTitle}>
                        <h1 className={styles.title}>
                            <span className={styles.titleIcon}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                            </span>
                            Hub Fiscal 360°
                        </h1>
                        <p className={styles.subtitle}>
                            Sistema de Cálculo Tributario • Proyección Fiscal 2026
                        </p>
                    </div>

                    <div className={styles.headerActions}>
                        {/* Selector de Cliente */}
                        <ClientSelector
                            selectedClient={selectedClient}
                            onClientChange={changeClient}
                        />

                        <div className={styles.headerMeta}>
                            <div className={styles.uitBadge}>
                                <span className={styles.uitLabel}>UIT 2026</span>
                                <span className={styles.uitValue}>{formatCurrency(UIT)}</span>
                            </div>

                            <div className={`${styles.statusBadge} ${styles[financialStatus.color]}`}>
                                {financialStatus.label}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Indicador de guardado y selector de régimen */}
            <section className={styles.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <RegimeSelector
                        availableRegimes={availableRegimes}
                        selectedRegime={regimeType}
                        onRegimeChange={changeRegime}
                    />
                    <SaveIndicator status={saveStatus} />
                </div>
            </section>

            {/* Alertas */}
            {hasAlerts && (
                <section className={styles.section}>
                    <AlertBanner alerts={alerts} />
                </section>
            )}

            {/* Controles adicionales para RMT/RG */}
            {(regimeType === 'RMT' || regimeType === 'RG') && (
                <section className={styles.section}>
                    <div className={styles.controlsPanel}>
                        <div className={styles.controlGroup}>
                            <label className={styles.controlLabel}>
                                Coeficiente (ejercicio anterior)
                            </label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    max="1"
                                    value={coeficiente}
                                    onChange={(e) => setCoeficiente(parseFloat(e.target.value) || 0)}
                                    className={styles.controlInput}
                                    placeholder="0.0000"
                                />
                                <span className={styles.inputSuffix}>
                                    {(coeficiente * 100).toFixed(4)}%
                                </span>
                            </div>
                        </div>

                        <button
                            className={styles.clearButton}
                            onClick={clearAllData}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                            Limpiar Datos
                        </button>
                    </div>
                </section>
            )}

            {/* Grid Principal */}
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                        <span className={styles.sectionIcon}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                        </span>
                        Registro Mensual {new Date().getFullYear()}
                    </h2>

                    <div className={styles.regimeBadge} style={{ '--regime-color': regimeInfo.color }}>
                        {regimeInfo.fullName}
                    </div>
                </div>

                <MonthlyGrid
                    months={months}
                    monthlyData={monthlyData}
                    monthlyResults={monthlyResults}
                    monthlyTotals={monthlyTotals}
                    inputFields={inputFields}
                    visibleColumns={visibleColumns}
                    regimeType={regimeType}
                    onUpdateMonth={updateMonth}
                />
            </section>

            {/* Resumen y Proyecciones */}
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                        <span className={styles.sectionIcon}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                        </span>
                        Resumen Fiscal
                    </h2>
                </div>

                <div className={styles.summaryGrid}>
                    {/* Ventas Totales */}
                    <SummaryCard
                        title="Ventas Totales"
                        value={monthlyTotals.ventas}
                        subtitle="Ingresos brutos del período"
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                            </svg>
                        }
                        variant="default"
                    />

                    {/* Compras Totales */}
                    <SummaryCard
                        title="Compras Totales"
                        value={monthlyTotals.compras}
                        subtitle="Adquisiciones del período"
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="9" cy="21" r="1" />
                                <circle cx="20" cy="21" r="1" />
                                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                            </svg>
                        }
                        variant="default"
                    />

                    {/* IGV Total */}
                    <SummaryCard
                        title="IGV a Pagar"
                        value={monthlyTotals.igv}
                        subtitle="18% Débito - Crédito"
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                        }
                        variant={monthlyTotals.igv > 0 ? 'warning' : 'default'}
                    />

                    {/* Total Impuestos Mensuales */}
                    <SummaryCard
                        title="Impuestos Mensuales"
                        value={monthlyTotals.totalImpuestos}
                        subtitle="Suma de pagos mensuales"
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                        }
                        variant="highlight"
                    />
                </div>
            </section>

            {/* Proyección Anual (solo para regímenes con declaración) */}
            {hasAnnualDeclaration && (
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <span className={styles.sectionIcon}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </span>
                            Proyección Anual 2026
                        </h2>
                    </div>

                    <div className={styles.annualGrid}>
                        {/* Utilidad Neta */}
                        <SummaryCard
                            title="Utilidad Neta Anual"
                            value={annualProjection.utilidadNetaAnual || 0}
                            subtitle="Base imponible para renta"
                            icon={
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                            }
                            variant={annualProjection.utilidadNetaAnual > 0 ? 'positive' : 'negative'}
                        />

                        {/* Tramos RMT (solo para RMT) */}
                        {regimeType === 'RMT' && annualProjection.annualTaxDetails && (
                            <RMTTramoCard annualTaxDetails={annualProjection.annualTaxDetails} />
                        )}

                        {/* Impuesto Anual */}
                        <AnnualSummaryCard
                            annualProjection={annualProjection}
                            regimeType={regimeType}
                            hasAnnualDeclaration={hasAnnualDeclaration}
                        />
                    </div>
                </section>
            )}

            {/* Footer con info UIT */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <p className={styles.footerNote}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        Los cálculos están basados en la UIT proyectada 2026 (S/ {UIT.toLocaleString()}).
                        El valor oficial será publicado por SUNAT.
                    </p>

                    <div className={styles.footerMeta}>
                        <span>Hub Fiscal 360° v1.0</span>
                        <span>•</span>
                        <span>SUNAT 2026</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default TaxDashboard;
