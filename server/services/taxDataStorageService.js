/**
 * TaxDataStorageService - Servicio de Almacenamiento de Datos Tributarios
 * 
 * Gestiona la persistencia de datos de cÃ¡lculo tributario por cliente y rÃ©gimen.
 * Cada cliente puede tener datos independientes para cada rÃ©gimen (NRUS, RER, RMT, RG).
 */

// [WEB] electron-store replaced with JSON file store
const path = require('path');
const fsStore = require('fs');
class Store {
  constructor(opts = {}) {
    this.name = opts.name || 'store';
    this.dir = opts.cwd || path.join(process.cwd(), 'server', 'data');
    if (!fsStore.existsSync(this.dir)) fsStore.mkdirSync(this.dir, { recursive: true });
    this.filePath = path.join(this.dir, this.name + '.json');
    this._data = {};
    try { if (fsStore.existsSync(this.filePath)) this._data = JSON.parse(fsStore.readFileSync(this.filePath, 'utf8')); } catch(e) {}
  }
  get(key, defaultVal) { const keys = key.split('.'); let val = this._data; for (const k of keys) { if (val == null) return defaultVal; val = val[k]; } return val !== undefined ? val : defaultVal; }
  set(key, value) { const keys = key.split('.'); let obj = this._data; for (let i = 0; i < keys.length - 1; i++) { if (!obj[keys[i]]) obj[keys[i]] = {}; obj = obj[keys[i]]; } obj[keys[keys.length-1]] = value; this._save(); }
  has(key) { return this.get(key) !== undefined; }
  delete(key) { const keys = key.split('.'); let obj = this._data; for (let i = 0; i < keys.length - 1; i++) { if (!obj[keys[i]]) return; obj = obj[keys[i]]; } delete obj[keys[keys.length-1]]; this._save(); }
  clear() { this._data = {}; this._save(); }
  get store() { return this._data; }
  _save() { try { fsStore.writeFileSync(this.filePath, JSON.stringify(this._data, null, 2), 'utf8'); } catch(e) { console.error('Store save error:', e); } }
}
const logger = require('./logger');
const userStorageManager = require('./userStorageManager');

class TaxDataStorageService {
    constructor() {
        this.store = null;
        this.currentUserId = null;
    }

    /**
     * Inicializar storage para un usuario especÃ­fico
     */
    initializeForUser(userId) {
        if (!userStorageManager.isInitialized()) {
            throw new Error('UserStorageManager no inicializado');
        }

        this.currentUserId = userId;

        const userDataPath = userStorageManager.getUserFilePath('tax-data.json');

        this.store = new Store({
            name: 'tax-data',
            cwd: require('path').dirname(userDataPath),
            defaults: {
                taxData: {}
            }
        });

        logger.info('TaxDataStorage inicializado para usuario', {
            userId,
            path: userDataPath
        });
    }

    /**
     * Verificar que el storage estÃ© inicializado
     */
    _ensureInitialized() {
        if (!this.store || !this.currentUserId) {
            throw new Error('TaxDataStorage no inicializado - usuario no autenticado');
        }
    }

    /**
     * Obtener la clave de almacenamiento para un cliente y rÃ©gimen
     */
    _getKey(ruc, regimeType) {
        return `${ruc}.${regimeType}`;
    }

    /**
     * Guardar datos tributarios para un cliente y rÃ©gimen especÃ­fico
     * @param {string} ruc - RUC del cliente
     * @param {string} regimeType - Tipo de rÃ©gimen (NRUS, RER, RMT, RG)
     * @param {object} data - Datos a guardar (monthlyData, coeficiente, etc.)
     */
    saveTaxData(ruc, regimeType, data) {
        this._ensureInitialized();

        try {
            const taxData = this.store.get('taxData', {});

            // Inicializar objeto del cliente si no existe
            if (!taxData[ruc]) {
                taxData[ruc] = {};
            }

            // Guardar datos del rÃ©gimen
            taxData[ruc][regimeType] = {
                monthlyData: data.monthlyData || [],
                coeficiente: data.coeficiente || 0,
                updatedAt: new Date().toISOString(),
                createdAt: taxData[ruc][regimeType]?.createdAt || new Date().toISOString()
            };

            this.store.set('taxData', taxData);

            logger.info(`Datos tributarios guardados para ${ruc} - ${regimeType}`);

            return {
                success: true,
                message: `Datos guardados para ${regimeType}`
            };
        } catch (error) {
            logger.error('Error al guardar datos tributarios:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cargar datos tributarios para un cliente y rÃ©gimen especÃ­fico
     * @param {string} ruc - RUC del cliente
     * @param {string} regimeType - Tipo de rÃ©gimen (NRUS, RER, RMT, RG)
     */
    loadTaxData(ruc, regimeType) {
        this._ensureInitialized();

        try {
            const taxData = this.store.get('taxData', {});

            if (!taxData[ruc] || !taxData[ruc][regimeType]) {
                return {
                    success: true,
                    data: null,
                    message: 'No hay datos guardados para este cliente y rÃ©gimen'
                };
            }

            logger.info(`Datos tributarios cargados para ${ruc} - ${regimeType}`);

            return {
                success: true,
                data: taxData[ruc][regimeType]
            };
        } catch (error) {
            logger.error('Error al cargar datos tributarios:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cargar todos los datos tributarios de un cliente
     * @param {string} ruc - RUC del cliente
     */
    loadAllClientData(ruc) {
        this._ensureInitialized();

        try {
            const taxData = this.store.get('taxData', {});

            if (!taxData[ruc]) {
                return {
                    success: true,
                    data: null,
                    message: 'No hay datos guardados para este cliente'
                };
            }

            return {
                success: true,
                data: taxData[ruc]
            };
        } catch (error) {
            logger.error('Error al cargar datos del cliente:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Eliminar datos tributarios de un cliente y rÃ©gimen especÃ­fico
     * @param {string} ruc - RUC del cliente
     * @param {string} regimeType - Tipo de rÃ©gimen (opcional, si no se especifica elimina todos)
     */
    deleteTaxData(ruc, regimeType = null) {
        this._ensureInitialized();

        try {
            const taxData = this.store.get('taxData', {});

            if (!taxData[ruc]) {
                return {
                    success: true,
                    message: 'No habÃ­a datos para eliminar'
                };
            }

            if (regimeType) {
                // Eliminar solo un rÃ©gimen
                delete taxData[ruc][regimeType];

                // Si el cliente ya no tiene datos, eliminar el objeto completo
                if (Object.keys(taxData[ruc]).length === 0) {
                    delete taxData[ruc];
                }
            } else {
                // Eliminar todos los datos del cliente
                delete taxData[ruc];
            }

            this.store.set('taxData', taxData);

            logger.info(`Datos tributarios eliminados para ${ruc}${regimeType ? ` - ${regimeType}` : ''}`);

            return {
                success: true,
                message: 'Datos eliminados correctamente'
            };
        } catch (error) {
            logger.error('Error al eliminar datos tributarios:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener lista de clientes que tienen datos tributarios guardados
     */
    getClientsWithData() {
        this._ensureInitialized();

        try {
            const taxData = this.store.get('taxData', {});

            const clientsWithData = Object.keys(taxData).map(ruc => {
                const regimes = Object.keys(taxData[ruc]);
                const lastUpdate = regimes.reduce((latest, regime) => {
                    const updatedAt = taxData[ruc][regime]?.updatedAt;
                    return updatedAt && updatedAt > latest ? updatedAt : latest;
                }, '');

                return {
                    ruc,
                    regimes,
                    lastUpdate
                };
            });

            return {
                success: true,
                clients: clientsWithData
            };
        } catch (error) {
            logger.error('Error al obtener clientes con datos:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estadÃ­sticas de datos tributarios
     */
    getStats() {
        this._ensureInitialized();

        try {
            const taxData = this.store.get('taxData', {});

            const clientCount = Object.keys(taxData).length;
            let totalRecords = 0;
            let regimeCounts = { NRUS: 0, RER: 0, RMT: 0, RG: 0 };

            Object.values(taxData).forEach(clientData => {
                Object.keys(clientData).forEach(regime => {
                    totalRecords++;
                    if (regimeCounts[regime] !== undefined) {
                        regimeCounts[regime]++;
                    }
                });
            });

            return {
                success: true,
                stats: {
                    clientCount,
                    totalRecords,
                    regimeCounts
                }
            };
        } catch (error) {
            logger.error('Error al obtener estadÃ­sticas:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Limpiar todos los datos tributarios
     */
    clearAll() {
        this._ensureInitialized();

        try {
            this.store.set('taxData', {});
            logger.warn('Todos los datos tributarios han sido eliminados');
            return {
                success: true,
                message: 'Todos los datos eliminados'
            };
        } catch (error) {
            logger.error('Error al limpiar datos tributarios:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Configurar handlers IPC
     */
    setupHandlers() {
        // [WEB] Handlers registered in Express router instead
    }
}

// Singleton instance
const taxDataStorage = new TaxDataStorageService();

module.exports = taxDataStorage;



