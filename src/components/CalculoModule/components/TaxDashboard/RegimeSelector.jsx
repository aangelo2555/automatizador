/**
 * RegimeSelector - Selector visual de régimen tributario
 * 
 * Tabs flotantes con efecto glassmorphism para cambiar entre regímenes
 */

import React from 'react';
import styles from './TaxDashboard.module.css';

const RegimeSelector = ({
    availableRegimes,
    selectedRegime,
    onRegimeChange
}) => {
    return (
        <div className={styles.regimeSelector}>
            <div className={styles.regimeTabs}>
                {availableRegimes.map((regime) => (
                    <button
                        key={regime.type}
                        className={`${styles.regimeTab} ${selectedRegime === regime.type ? styles.regimeTabActive : ''
                            }`}
                        onClick={() => onRegimeChange(regime.type)}
                        style={{
                            '--regime-color': regime.color,
                        }}
                    >
                        <span className={styles.regimeTabIcon}>
                            {getRegimeIcon(regime.type)}
                        </span>
                        <span className={styles.regimeTabName}>{regime.name}</span>
                    </button>
                ))}
            </div>

            {/* Descripción del régimen seleccionado */}
            <div className={styles.regimeDescription}>
                {availableRegimes.find(r => r.type === selectedRegime)?.description}
            </div>
        </div>
    );
};

// Iconos SVG para cada régimen
const getRegimeIcon = (type) => {
    const icons = {
        NRUS: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
        RER: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
        ),
        RMT: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
        ),
        RG: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
        ),
    };

    return icons[type] || null;
};

export default RegimeSelector;
