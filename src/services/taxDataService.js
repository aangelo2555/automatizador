/**
 * TaxDataService - Servicio Frontend para Datos Tributarios
 * 
 * Comunicación con el backend para guardar/cargar datos tributarios por cliente y régimen.
 */

const taxDataService = {
    /**
     * Guardar datos tributarios para un cliente y régimen
     * @param {string} ruc - RUC del cliente
     * @param {string} regimeType - Tipo de régimen (NRUS, RER, RMT, RG)
     * @param {object} data - Datos a guardar (monthlyData, coeficiente)
     */
    save: async (ruc, regimeType, data) => {
        try {
            const result = await window.electronAPI.invoke('taxData:save', { ruc, regimeType, data });
            return result;
        } catch (error) {
            console.error('Error saving tax data:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Cargar datos tributarios para un cliente y régimen
     * @param {string} ruc - RUC del cliente
     * @param {string} regimeType - Tipo de régimen (NRUS, RER, RMT, RG)
     */
    load: async (ruc, regimeType) => {
        try {
            const result = await window.electronAPI.invoke('taxData:load', { ruc, regimeType });
            return result;
        } catch (error) {
            console.error('Error loading tax data:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Cargar todos los datos tributarios de un cliente
     * @param {string} ruc - RUC del cliente
     */
    loadAll: async (ruc) => {
        try {
            const result = await window.electronAPI.invoke('taxData:load-all', { ruc });
            return result;
        } catch (error) {
            console.error('Error loading all client data:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Eliminar datos tributarios
     * @param {string} ruc - RUC del cliente
     * @param {string} regimeType - Tipo de régimen (opcional)
     */
    delete: async (ruc, regimeType = null) => {
        try {
            const result = await window.electronAPI.invoke('taxData:delete', { ruc, regimeType });
            return result;
        } catch (error) {
            console.error('Error deleting tax data:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Obtener lista de clientes que tienen datos guardados
     */
    getClientsWithData: async () => {
        try {
            const result = await window.electronAPI.invoke('taxData:get-clients-with-data');
            return result;
        } catch (error) {
            console.error('Error getting clients with data:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Obtener estadísticas de datos tributarios
     */
    getStats: async () => {
        try {
            const result = await window.electronAPI.invoke('taxData:stats');
            return result;
        } catch (error) {
            console.error('Error getting tax data stats:', error);
            return { success: false, error: error.message };
        }
    }
};

export default taxDataService;
