/**
 * AlertBanner - Banner de alertas con animación
 * 
 * Muestra alertas de límites superados, cambios de régimen, etc.
 */

import React from 'react';
import styles from './AlertBanner.module.css';

const AlertBanner = ({ alerts, onDismiss }) => {
    if (!alerts || alerts.length === 0) return null;

    const getAlertIcon = (type) => {
        switch (type) {
            case 'error':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                );
            case 'info':
            default:
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                );
        }
    };

    return (
        <div className={styles.alertContainer}>
            {alerts.map((alert, index) => (
                <div
                    key={`${alert.code}-${index}`}
                    className={`${styles.alertBanner} ${styles[alert.type]}`}
                >
                    <span className={styles.alertIcon}>
                        {getAlertIcon(alert.type)}
                    </span>

                    <div className={styles.alertContent}>
                        <span className={styles.alertMessage}>{alert.message}</span>
                        {alert.month && (
                            <span className={styles.alertSource}>
                                {alert.month}
                            </span>
                        )}
                    </div>

                    {onDismiss && (
                        <button
                            className={styles.alertDismiss}
                            onClick={() => onDismiss(index)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

export default AlertBanner;
