/**
 * Boleta Configuration Handler
 * Manages per-client JSON configurations for "EmisiÃ³n EspecÃ­fica" feature
 */

const fs = require('fs');
const path = require('path');
// [WEB] Electron removed
const logger = require('./logger');

class BoletaConfigHandler {
    constructor() {
        // Directory for boleta configurations
        this.configDir = path.join(require('path').join(process.cwd(), 'server', 'data'), 'boletas_config');
        this.ensureConfigDir();
    }

    /**
     * Ensure config directory exists
     */
    ensureConfigDir() {
        try {
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
                logger.info(`Created boleta config directory: ${this.configDir}`);
            }
        } catch (error) {
            logger.error('Error creating boleta config directory:', error);
        }
    }

    /**
     * Get config file path for a client
     */
    getConfigPath(ruc) {
        return path.join(this.configDir, `${ruc}.json`);
    }

    /**
     * Save configuration for a client
     */
    async saveConfig(ruc, config) {
        try {
            const configPath = this.getConfigPath(ruc);
            const data = {
                clienteRuc: ruc,
                updatedAt: new Date().toISOString(),
                ...config
            };
            
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
            logger.info(`Saved boleta config for RUC: ${ruc}`);
            
            return { success: true, path: configPath };
        } catch (error) {
            logger.error(`Error saving boleta config for ${ruc}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load configuration for a client
     */
    async loadConfig(ruc) {
        try {
            const configPath = this.getConfigPath(ruc);
            
            if (!fs.existsSync(configPath)) {
                return { 
                    success: true, 
                    exists: false, 
                    config: null,
                    message: 'No hay configuraciÃ³n guardada para este cliente'
                };
            }
            
            const data = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(data);
            
            logger.info(`Loaded boleta config for RUC: ${ruc}`);
            return { success: true, exists: true, config };
        } catch (error) {
            logger.error(`Error loading boleta config for ${ruc}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all saved configurations
     */
    async listConfigs() {
        try {
            this.ensureConfigDir();
            
            const files = fs.readdirSync(this.configDir)
                .filter(f => f.endsWith('.json'));
            
            const configs = files.map(file => {
                const ruc = path.basename(file, '.json');
                const filePath = path.join(this.configDir, file);
                const stats = fs.statSync(filePath);
                
                let preview = null;
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    preview = {
                        clienteNombre: content.clienteNombre || '',
                        itemCount: content.items ? content.items.length : 0
                    };
                } catch (e) {}
                
                return {
                    ruc,
                    file,
                    updatedAt: stats.mtime.toISOString(),
                    ...preview
                };
            });
            
            return { success: true, configs };
        } catch (error) {
            logger.error('Error listing boleta configs:', error);
            return { success: false, error: error.message, configs: [] };
        }
    }

    /**
     * Delete configuration for a client
     */
    async deleteConfig(ruc) {
        try {
            const configPath = this.getConfigPath(ruc);
            
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
                logger.info(`Deleted boleta config for RUC: ${ruc}`);
                return { success: true };
            }
            
            return { success: false, error: 'ConfiguraciÃ³n no encontrada' };
        } catch (error) {
            logger.error(`Error deleting boleta config for ${ruc}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Setup IPC handlers
     */
    setupIPC() {
        // [WEB-DISABLED] ipcMain.handle('boleta-config:save', async (event, { ruc, config }) => {
            return this.saveConfig(ruc, config);
        });

        // [WEB-DISABLED] ipcMain.handle('boleta-config:load', async (event, { ruc }) => {
            return this.loadConfig(ruc);
        });

        // [WEB-DISABLED] ipcMain.handle('boleta-config:list', async () => {
            return this.listConfigs();
        });

        // [WEB-DISABLED] ipcMain.handle('boleta-config:delete', async (event, { ruc }) => {
            return this.deleteConfig(ruc);
        });

        logger.info('Boleta config IPC handlers registered');
    }
}

module.exports = new BoletaConfigHandler();


