/**
 * Strategy Factory - Patrón Factory para selección de estrategias tributarias
 */

import { TAX_CONSTANTS } from '../constants/taxConstants';
import { NRUSStrategy } from './NRUSStrategy';
import { RERStrategy } from './RERStrategy';
import { RMTStrategy } from './RMTStrategy';
import { RGStrategy } from './RGStrategy';

const strategies = {
    [TAX_CONSTANTS.REGIME_TYPES.NRUS]: NRUSStrategy,
    [TAX_CONSTANTS.REGIME_TYPES.RER]: RERStrategy,
    [TAX_CONSTANTS.REGIME_TYPES.RMT]: RMTStrategy,
    [TAX_CONSTANTS.REGIME_TYPES.RG]: RGStrategy,
};

/**
 * Factory function para crear la estrategia según el tipo de régimen
 * @param {string} regimeType - Tipo de régimen (NRUS, RER, RMT, RG)
 * @returns {Object} Instancia de la estrategia correspondiente
 */
export const createStrategy = (regimeType) => {
    const StrategyClass = strategies[regimeType];

    if (!StrategyClass) {
        throw new Error(`Régimen tributario no soportado: ${regimeType}`);
    }

    return new StrategyClass();
};

/**
 * Obtiene información de todos los regímenes disponibles
 * @returns {Array} Lista de regímenes con su información
 */
export const getAvailableRegimes = () => {
    return Object.keys(TAX_CONSTANTS.REGIME_TYPES).map(key => ({
        type: TAX_CONSTANTS.REGIME_TYPES[key],
        ...TAX_CONSTANTS.REGIME_INFO[key],
    }));
};

export { NRUSStrategy, RERStrategy, RMTStrategy, RGStrategy };
