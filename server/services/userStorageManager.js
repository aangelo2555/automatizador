const path = require('path');
const fs = require('fs');
// [WEB] Electron removed
const logger = require('./logger');

/**
 * Gestor de almacenamiento por usuario
 * Cada usuario tiene su propia carpeta en storage/user-{id}/
 */
class UserStorageManager {
    constructor() {
        this.currentUserId = null;
        this.currentUserEmail = null;
        this.currentUserPlan = null;
        this.storagePath = null;
        const userDataPath = path.join(process.cwd(), 'server', 'data');
        this.storageRoot = path.join(userDataPath, 'storage');
    }

    /**
     * Inicializar storage para un usuario especÃ­fico
     * @param {number} userId - ID del usuario
     * @param {string} userEmail - Email del usuario
     * @param {string} userPlan - Plan del usuario (basico, premium, empresarial)
     */
    initializeForUser(userId, userEmail, userPlan = 'basico') {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        this.currentUserId = userId;
        this.currentUserEmail = userEmail;
        this.currentUserPlan = userPlan;
        this.storagePath = path.join(this.storageRoot, `user-${userId}`);

        // Crear carpeta raÃ­z de storage si no existe
        if (!fs.existsSync(this.storageRoot)) {
            fs.mkdirSync(this.storageRoot, { recursive: true });
            logger.info('Carpeta storage raÃ­z creada', { path: this.storageRoot });
        }

        // Crear carpeta del usuario si no existe
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
            logger.info('Carpeta de usuario creada', {
                userId,
                email: userEmail,
                path: this.storagePath
            });

            // Crear subcarpetas necesarias
            this._createUserSubfolders();
        }

        logger.info('Storage inicializado para usuario', {
            userId,
            email: userEmail,
            plan: userPlan,
            path: this.storagePath
        });

        return {
            success: true,
            storagePath: this.storagePath
        };
    }

    /**
     * Crear subcarpetas dentro del storage del usuario
     */
    _createUserSubfolders() {
        const subfolders = [
            'sire-files',
            'downloads',
            'logs'
        ];

        subfolders.forEach(folder => {
            const folderPath = path.join(this.storagePath, folder);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
        });
    }

    /**
     * Obtener ruta de archivo para el usuario actual
     * @param {string} filename - Nombre del archivo
     * @returns {string} Ruta completa del archivo
     */
    getUserFilePath(filename) {
        if (!this.currentUserId) {
            throw new Error('Storage no inicializado - usuario no autenticado');
        }
        return path.join(this.storagePath, filename);
    }

    /**
     * Obtener ruta de una subcarpeta del usuario
     * @param {string} subfolder - Nombre de la subcarpeta
     * @returns {string} Ruta completa de la subcarpeta
     */
    getUserFolderPath(subfolder) {
        if (!this.currentUserId) {
            throw new Error('Storage no inicializado - usuario no autenticado');
        }
        return path.join(this.storagePath, subfolder);
    }

    /**
     * Obtener informaciÃ³n del usuario actual
     */
    getCurrentUser() {
        return {
            id: this.currentUserId,
            email: this.currentUserEmail,
            plan: this.currentUserPlan,
            storagePath: this.storagePath
        };
    }

    /**
     * Verificar si el usuario estÃ¡ inicializado
     */
    isInitialized() {
        return this.currentUserId !== null;
    }

    /**
     * Limpiar sesiÃ³n del usuario (logout)
     */
    clearUser() {
        logger.info('Limpiando sesiÃ³n de usuario', {
            userId: this.currentUserId,
            email: this.currentUserEmail
        });

        this.currentUserId = null;
        this.currentUserEmail = null;
        this.currentUserPlan = null;
        this.storagePath = null;
    }

    /**
     * Migrar datos legacy a la carpeta del usuario
     * @param {number} userId - ID del usuario
     */
    async migrateLegacyData(userId) {
        try {
            const userPath = path.join(this.storageRoot, `user-${userId}`);
            const migrationFlagFile = path.join(userPath, '.migrated');

            // Si ya se migrÃ³, no hacer nada
            if (fs.existsSync(migrationFlagFile)) {
                logger.info('Datos ya migrados para usuario', { userId });
                return { success: true, alreadyMigrated: true };
            }

            logger.info('Iniciando migraciÃ³n de datos legacy', { userId });

            // Migrar clients-data.json global
            const globalClientsFile = path.join(require('path').join(process.cwd(), 'server', 'data'), 'clients-data.json');
            const userClientsFile = path.join(userPath, 'clients-data.json');

            if (fs.existsSync(globalClientsFile) && !fs.existsSync(userClientsFile)) {
                fs.copyFileSync(globalClientsFile, userClientsFile);
                logger.info('Archivo clients-data.json migrado', { userId });
            }

            // Migrar email_tracking.json si existe
            const globalEmailFile = path.join(require('path').join(process.cwd(), 'server', 'data'), '../../../email_tracking.json');
            const userEmailFile = path.join(userPath, 'email-tracking.json');

            if (fs.existsSync(globalEmailFile) && !fs.existsSync(userEmailFile)) {
                fs.copyFileSync(globalEmailFile, userEmailFile);
                logger.info('Archivo email-tracking.json migrado', { userId });
            }

            // Crear flag de migraciÃ³n
            fs.writeFileSync(migrationFlagFile, new Date().toISOString(), 'utf8');

            logger.info('MigraciÃ³n completada exitosamente', { userId });

            return {
                success: true,
                migrated: true,
                message: 'Datos legacy migrados correctamente'
            };

        } catch (error) {
            logger.error('Error en migraciÃ³n de datos', { userId, error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estadÃ­sticas de uso del usuario
     */
    getStats() {
        if (!this.isInitialized()) {
            return {
                consultasHoy: 0,
                descargasMes: 0,
                buzonPendientes: 0,
                lastUpdate: new Date().toISOString().split('T')[0]
            };
        }

        const statsFile = path.join(this.storagePath, 'stats.json');

        try {
            if (!fs.existsSync(statsFile)) {
                // Inicializar stats si no existe
                const initialStats = {
                    consultasHoy: 0,
                    descargasMes: 0,
                    buzonPendientes: 0,
                    lastUpdate: new Date().toISOString().split('T')[0],
                    currentMonth: new Date().getMonth()
                };
                fs.writeFileSync(statsFile, JSON.stringify(initialStats, null, 2));
                return initialStats;
            }

            const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = new Date().getMonth();

            // Resetear contadores si cambia el dÃ­a o mes
            let changed = false;

            if (stats.lastUpdate !== today) {
                stats.consultasHoy = 0;
                stats.lastUpdate = today;
                changed = true;
            }

            if (stats.currentMonth !== currentMonth) {
                stats.descargasMes = 0;
                stats.currentMonth = currentMonth;
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
            }

            return stats;

        } catch (error) {
            logger.error('Error al leer stats:', error);
            return {
                consultasHoy: 0,
                descargasMes: 0,
                buzonPendientes: 0
            };
        }
    }

    /**
     * Actualizar una estadÃ­stica especÃ­fica
     * @param {string} key - Clave a actualizar (consultasHoy, descargasMes, buzonPendientes)
     * @param {number} value - Valor a sumar (puede ser negativo) o establecer
     * @param {boolean} isIncrement - Si es true suma, si es false reemplaza
     */
    updateStats(key, value, isIncrement = true) {
        if (!this.isInitialized()) return false;

        const statsFile = path.join(this.storagePath, 'stats.json');

        try {
            // Asegurar que existe y obtener actual
            const stats = this.getStats();

            if (isIncrement) {
                stats[key] = (stats[key] || 0) + value;
            } else {
                stats[key] = value;
            }

            // Evitar negativos
            if (stats[key] < 0) stats[key] = 0;

            fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
            return stats;

        } catch (error) {
            logger.error('Error al actualizar stats:', error);
            return false;
        }
    }

    /**
     * Obtener estadÃ­sticas de uso del storage del usuario
     */
    getUserStorageStats() {
        if (!this.isInitialized()) {
            return null;
        }

        try {
            const stats = {
                userId: this.currentUserId,
                email: this.currentUserEmail,
                plan: this.currentUserPlan,
                storagePath: this.storagePath,
                files: []
            };

            // Listar archivos en el storage del usuario
            if (fs.existsSync(this.storagePath)) {
                const files = fs.readdirSync(this.storagePath);
                stats.files = files.map(file => {
                    const filePath = path.join(this.storagePath, file);
                    const fileStat = fs.statSync(filePath);
                    return {
                        name: file,
                        size: fileStat.size,
                        isDirectory: fileStat.isDirectory(),
                        modified: fileStat.mtime
                    };
                });
            }

            return stats;

        } catch (error) {
            logger.error('Error al obtener stats de storage', { error: error.message });
            return null;
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
const userStorageManager = new UserStorageManager();

module.exports = userStorageManager;


