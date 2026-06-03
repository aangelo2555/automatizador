/**
 * useTaxCalculator - Custom Hook Principal
 * 
 * Hook que orquesta toda la lógica de cálculo tributario según el régimen seleccionado.
 * Utiliza el patrón Strategy para delegar los cálculos específicos de cada régimen.
 * 
 * ACTUALIZADO: Ahora soporta persistencia de datos por cliente y régimen.
 * 
 * @param {string} regimeType - Tipo de régimen (NRUS, RER, RMT, RG)
 * @param {Array} monthlyData - Datos mensuales ingresados por el usuario
 * @param {Object} options - Opciones adicionales (coeficiente, etc.)
 * 
 * @returns {Object} - Resultados calculados, alertas y métodos helper
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TAX_CONSTANTS, getInitialMonthlyData } from '../constants/taxConstants';
import { createStrategy, getAvailableRegimes } from '../strategies';
import taxDataService from '../../../services/taxDataService';

// Debounce delay para auto-guardado (ms)
const SAVE_DEBOUNCE_MS = 1500;

const useTaxCalculator = (initialRegimeType = TAX_CONSTANTS.REGIME_TYPES.NRUS) => {
    // Estado del régimen seleccionado
    const [regimeType, setRegimeType] = useState(initialRegimeType);

    // Estado del cliente seleccionado
    const [selectedClient, setSelectedClient] = useState(null);

    // Estado de los datos mensuales (independiente por régimen)
    const [regimeData, setRegimeData] = useState({
        NRUS: { monthlyData: getInitialMonthlyData(), coeficiente: 0 },
        RER: { monthlyData: getInitialMonthlyData(), coeficiente: 0 },
        RMT: { monthlyData: getInitialMonthlyData(), coeficiente: 0 },
        RG: { monthlyData: getInitialMonthlyData(), coeficiente: 0 },
    });

    // Estado de guardado
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'noClient'
    const saveTimeoutRef = useRef(null);
    const lastSaveRef = useRef(null);

    // Datos del régimen actual
    const currentRegimeData = regimeData[regimeType] || { monthlyData: getInitialMonthlyData(), coeficiente: 0 };
    const monthlyData = currentRegimeData.monthlyData;
    const coeficiente = currentRegimeData.coeficiente;

    // Estrategia actual
    const strategy = useMemo(() => createStrategy(regimeType), [regimeType]);

    // Información del régimen actual
    const regimeInfo = useMemo(() =>
        TAX_CONSTANTS.REGIME_INFO[regimeType],
        [regimeType]
    );

    // Cargar datos cuando cambia el cliente o el régimen
    useEffect(() => {
        if (selectedClient?.ruc) {
            loadClientData(selectedClient.ruc, regimeType);
        } else {
            setSaveStatus('noClient');
        }
    }, [selectedClient?.ruc, regimeType]);

    // Auto-guardar cuando cambian los datos (con debounce)
    useEffect(() => {
        if (!selectedClient?.ruc) {
            setSaveStatus('noClient');
            return;
        }

        // Crear hash de los datos actuales para detectar cambios
        const dataHash = JSON.stringify({ monthlyData, coeficiente });

        // Si es la primera carga, no guardar
        if (lastSaveRef.current === null) {
            lastSaveRef.current = dataHash;
            return;
        }

        // Si los datos no han cambiado, no guardar
        if (lastSaveRef.current === dataHash) {
            return;
        }

        // Limpiar timeout anterior
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        setSaveStatus('saving');

        // Debounce del guardado
        saveTimeoutRef.current = setTimeout(() => {
            saveClientData(selectedClient.ruc, regimeType, { monthlyData, coeficiente });
            lastSaveRef.current = dataHash;
        }, SAVE_DEBOUNCE_MS);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [monthlyData, coeficiente, selectedClient?.ruc, regimeType]);

    // Cargar datos del cliente
    const loadClientData = async (ruc, regime) => {
        try {
            const result = await taxDataService.load(ruc, regime);
            if (result.success && result.data) {
                setRegimeData(prev => ({
                    ...prev,
                    [regime]: {
                        monthlyData: result.data.monthlyData || getInitialMonthlyData(),
                        coeficiente: result.data.coeficiente || 0
                    }
                }));
                lastSaveRef.current = JSON.stringify({
                    monthlyData: result.data.monthlyData || getInitialMonthlyData(),
                    coeficiente: result.data.coeficiente || 0
                });
                setSaveStatus('saved');
            } else {
                // No hay datos guardados, inicializar con valores por defecto
                setRegimeData(prev => ({
                    ...prev,
                    [regime]: {
                        monthlyData: getInitialMonthlyData(),
                        coeficiente: 0
                    }
                }));
                lastSaveRef.current = null;
                setSaveStatus('idle');
            }
        } catch (error) {
            console.error('Error loading client data:', error);
            setSaveStatus('idle');
        }
    };

    // Guardar datos del cliente
    const saveClientData = async (ruc, regime, data) => {
        try {
            const result = await taxDataService.save(ruc, regime, data);
            if (result.success) {
                setSaveStatus('saved');
                // Mostrar "saved" por 2 segundos, luego volver a idle
                setTimeout(() => {
                    setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
                }, 2000);
            } else {
                console.error('Error saving data:', result.error);
                setSaveStatus('idle');
            }
        } catch (error) {
            console.error('Error saving client data:', error);
            setSaveStatus('idle');
        }
    };

    // Calcular resultados mensuales
    const monthlyResults = useMemo(() => {
        let ingresosAcumulados = 0;

        return monthlyData.map((data, index) => {
            let result;

            switch (regimeType) {
                case TAX_CONSTANTS.REGIME_TYPES.NRUS:
                    result = strategy.calculateMonthly(data);
                    break;

                case TAX_CONSTANTS.REGIME_TYPES.RER:
                    result = strategy.calculateMonthly(data);
                    break;

                case TAX_CONSTANTS.REGIME_TYPES.RMT:
                    result = strategy.calculateMonthly(data, ingresosAcumulados, coeficiente);
                    ingresosAcumulados += data.ventas;
                    break;

                case TAX_CONSTANTS.REGIME_TYPES.RG:
                    result = strategy.calculateMonthly(data, coeficiente);
                    break;

                default:
                    result = strategy.calculateMonthly(data);
            }

            return {
                ...result,
                monthIndex: index,
                month: TAX_CONSTANTS.MONTHS[index],
            };
        });
    }, [monthlyData, regimeType, strategy, coeficiente]);

    // Calcular proyección anual
    const annualProjection = useMemo(() => {
        return strategy.calculateAnnual(monthlyResults);
    }, [monthlyResults, strategy]);

    // Consolidar todas las alertas
    const allAlerts = useMemo(() => {
        const monthlyAlerts = monthlyResults.flatMap((result, index) =>
            result.alerts.map(alert => ({
                ...alert,
                source: `monthly`,
                monthIndex: index,
                month: TAX_CONSTANTS.MONTHS[index],
            }))
        );

        const annualAlerts = annualProjection.alerts.map(alert => ({
            ...alert,
            source: 'annual',
        }));

        return [...monthlyAlerts, ...annualAlerts];
    }, [monthlyResults, annualProjection]);

    // Totales mensuales
    const monthlyTotals = useMemo(() => {
        return monthlyResults.reduce((acc, month) => ({
            ventas: acc.ventas + (month.ventas || 0),
            compras: acc.compras + (month.compras || 0),
            igv: acc.igv + (month.igv || 0),
            rentaMensual: acc.rentaMensual + (month.rentaMensual || month.pagoACuenta || month.cuotaMensual || 0),
            totalImpuestos: acc.totalImpuestos + (month.totalImpuestos || 0),
            utilidadNeta: acc.utilidadNeta + (month.utilidadNeta || 0),
        }), { ventas: 0, compras: 0, igv: 0, rentaMensual: 0, totalImpuestos: 0, utilidadNeta: 0 });
    }, [monthlyResults]);

    // Actualizar un mes específico
    const updateMonth = useCallback((monthIndex, field, value) => {
        setRegimeData(prev => {
            const currentData = prev[regimeType] || { monthlyData: getInitialMonthlyData(), coeficiente: 0 };
            const updatedMonthly = [...currentData.monthlyData];
            updatedMonthly[monthIndex] = {
                ...updatedMonthly[monthIndex],
                [field]: parseFloat(value) || 0,
            };
            return {
                ...prev,
                [regimeType]: {
                    ...currentData,
                    monthlyData: updatedMonthly
                }
            };
        });
    }, [regimeType]);

    // Actualizar todos los campos de un mes
    const updateMonthData = useCallback((monthIndex, data) => {
        setRegimeData(prev => {
            const currentData = prev[regimeType] || { monthlyData: getInitialMonthlyData(), coeficiente: 0 };
            const updatedMonthly = [...currentData.monthlyData];
            updatedMonthly[monthIndex] = {
                ...updatedMonthly[monthIndex],
                ...data,
            };
            return {
                ...prev,
                [regimeType]: {
                    ...currentData,
                    monthlyData: updatedMonthly
                }
            };
        });
    }, [regimeType]);

    // Actualizar coeficiente
    const setCoeficiente = useCallback((value) => {
        setRegimeData(prev => {
            const currentData = prev[regimeType] || { monthlyData: getInitialMonthlyData(), coeficiente: 0 };
            return {
                ...prev,
                [regimeType]: {
                    ...currentData,
                    coeficiente: value
                }
            };
        });
    }, [regimeType]);

    // Limpiar todos los datos del régimen actual
    const clearAllData = useCallback(() => {
        setRegimeData(prev => ({
            ...prev,
            [regimeType]: {
                monthlyData: getInitialMonthlyData(),
                coeficiente: 0
            }
        }));
    }, [regimeType]);

    // Cambiar régimen
    const changeRegime = useCallback((newRegimeType) => {
        setRegimeType(newRegimeType);
    }, []);

    // Cambiar cliente
    const changeClient = useCallback((client) => {
        // Resetear el ref de último guardado al cambiar de cliente
        lastSaveRef.current = null;
        setSelectedClient(client);
    }, []);

    // Campos de entrada según el régimen
    const inputFields = useMemo(() => strategy.getInputFields(), [strategy]);

    // Columnas visibles según el régimen
    const visibleColumns = useMemo(() => strategy.getVisibleColumns(), [strategy]);

    // Tiene declaración anual
    const hasAnnualDeclaration = useMemo(() => {
        if (regimeType === TAX_CONSTANTS.REGIME_TYPES.NRUS ||
            regimeType === TAX_CONSTANTS.REGIME_TYPES.RER) {
            return false;
        }
        return true;
    }, [regimeType]);

    // Indicador de estado financiero general
    const financialStatus = useMemo(() => {
        const totalImpuestos = monthlyTotals.totalImpuestos + (annualProjection.regularizacion || 0);
        const utilidad = monthlyTotals.utilidadNeta || monthlyTotals.ventas - monthlyTotals.compras;

        if (utilidad <= 0) {
            return { status: 'loss', label: 'Pérdida', color: 'negative' };
        }

        const cargaTributaria = totalImpuestos / utilidad;

        if (cargaTributaria <= 0.15) {
            return { status: 'optimal', label: 'Óptimo', color: 'positive' };
        } else if (cargaTributaria <= 0.25) {
            return { status: 'moderate', label: 'Moderado', color: 'neutral' };
        } else {
            return { status: 'high', label: 'Alto', color: 'warning' };
        }
    }, [monthlyTotals, annualProjection]);

    return {
        // Estado
        regimeType,
        regimeInfo,
        monthlyData,
        coeficiente,
        selectedClient,

        // Resultados calculados
        monthlyResults,
        annualProjection,
        monthlyTotals,

        // Alertas
        alerts: allAlerts,
        hasAlerts: allAlerts.length > 0,
        criticalAlerts: allAlerts.filter(a => a.type === 'error'),

        // Configuración UI
        inputFields,
        visibleColumns,
        hasAnnualDeclaration,
        availableRegimes: getAvailableRegimes(),

        // Indicadores
        financialStatus,
        saveStatus,

        // Métodos
        updateMonth,
        updateMonthData,
        clearAllData,
        changeRegime,
        changeClient,
        setCoeficiente,

        // Constantes útiles
        UIT: TAX_CONSTANTS.UIT_2026,
        months: TAX_CONSTANTS.MONTHS,
    };
};

export default useTaxCalculator;
