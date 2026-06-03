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
const CryptoJS = require('crypto-js');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const userStorageManager = require('./userStorageManager');
const excelReader = require('./excelReader');

// Clave secreta para encriptaciÃ³n (en producciÃ³n deberÃ­a estar en variables de entorno)
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'sunat-app-secret-key-2026';

// LÃ­mites de plan
const PLAN_LIMITS = {
    basico: { maxClientes: 10 },
    vip: { maxClientes: 50 },
    premium: { maxClientes: Infinity }
};

class ClientStorageService {
    constructor() {
        // El storage ahora se inicializa dinÃ¡micamente por usuario
        this.store = null;
        this.currentUserId = null;
        this.currentUserPlan = null;
    }

    /**
     * Inicializar storage para un usuario especÃ­fico
     */
    initializeForUser(userId, userPlan = 'basico') {
        if (!userStorageManager.isInitialized()) {
            throw new Error('UserStorageManager no inicializado');
        }

        this.currentUserId = userId;
        this.currentUserPlan = userPlan.toLowerCase();

        // Usar el archivo del usuario especÃ­fico
        const userDataPath = userStorageManager.getUserFilePath('clients-data.json');

        this.store = new Store({
            name: 'clients-data',
            cwd: require('path').dirname(userDataPath),
            defaults: {
                clients: []
            }
        });

        logger.info('ClientStorage inicializado para usuario', {
            userId,
            plan: this.currentUserPlan,
            path: userDataPath
        });
    }

    /**
     * Verificar si se puede agregar un cliente nuevo segÃºn el plan
     */
    canAddClient() {
        const currentCount = this.getAllClients().length;
        const limit = PLAN_LIMITS[this.currentUserPlan] || PLAN_LIMITS.basico;
        return currentCount < limit.maxClientes;
    }

    /**
     * Obtener lÃ­mite de clientes segÃºn el plan actual
     */
    getClientLimit() {
        const limit = PLAN_LIMITS[this.currentUserPlan] || PLAN_LIMITS.basico;
        return limit.maxClientes;
    }

    /**
     * Verificar que el storage estÃ© inicializado
     */
    _ensureInitialized() {
        if (!this.store || !this.currentUserId) {
            throw new Error('ClientStorage no inicializado - usuario no autenticado');
        }
    }


    // Encriptar texto
    encrypt(text) {
        if (!text) return '';
        return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    }

    // Desencriptar texto
    decrypt(ciphertext) {
        if (!ciphertext) return '';
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            logger.error('Error al desencriptar:', error);
            return '';
        }
    }

    // Obtener todos los clientes
    getAllClients() {
        this._ensureInitialized();

        try {
            const clients = this.store.get('clients', []);
            // Desencriptar credenciales para uso
            return clients.map(client => ({
                ...client,
                clave: this.decrypt(client.clave),
                clienteSecret: client.clienteSecret ? this.decrypt(client.clienteSecret) : ''
            }));
        } catch (error) {
            logger.error('Error al obtener clientes:', error);
            return [];
        }
    }

    // Obtener cliente por RUC
    getClient(ruc) {
        try {
            const clients = this.getAllClients();
            return clients.find(client => client.ruc === ruc) || null;
        } catch (error) {
            logger.error(`Error al obtener cliente ${ruc}:`, error);
            return null;
        }
    }

    // Agregar nuevo cliente
    addClient(clientData) {
        this._ensureInitialized();

        try {
            // VALIDACIÃ“N CRÃTICA: Verificar lÃ­mite de plan
            if (!this.canAddClient()) {
                const limit = this.getClientLimit();
                const currentCount = this.getAllClients().length;

                throw new Error(
                    `LÃ­mite de clientes alcanzado. Plan ${this.currentUserPlan.toUpperCase()}: ${currentCount}/${limit === Infinity ? 'ilimitado' : limit} clientes. ` +
                    `Actualiza tu plan para agregar mÃ¡s clientes.`
                );
            }

            const clients = this.store.get('clients', []);

            // Verificar si ya existe
            if (clients.find(c => c.ruc === clientData.ruc)) {
                throw new Error(`Ya existe un cliente con RUC ${clientData.ruc}`);
            }

            const newClient = {
                id: uuidv4(),
                ruc: clientData.ruc,
                empresa: clientData.empresa,
                usuario: clientData.usuario,
                clave: this.encrypt(clientData.clave), // Encriptar
                email: clientData.email || '',
                tipo: clientData.tipo || 'CLIENTES',
                clienteId: clientData.clienteId || '',
                clienteSecret: clientData.clienteSecret ? this.encrypt(clientData.clienteSecret) : '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                userId: this.currentUserId // Marcar a quÃ© usuario pertenece
            };

            clients.push(newClient);
            this.store.set('clients', clients);

            logger.info(`Cliente agregado por usuario ${this.currentUserId}`, {
                ruc: clientData.ruc,
                empresa: clientData.empresa,
                plan: this.currentUserPlan,
                totalClientes: clients.length
            });

            return { success: true, client: this.getClient(clientData.ruc) };
        } catch (error) {
            logger.error('Error al agregar cliente:', error);
            return { success: false, error: error.message };
        }
    }

    // Actualizar cliente
    updateClient(ruc, clientData) {
        try {
            const clients = this.store.get('clients', []);
            const index = clients.findIndex(c => c.ruc === ruc);

            if (index === -1) {
                throw new Error(`Cliente con RUC ${ruc} no encontrado`);
            }

            // Actualizar datos
            clients[index] = {
                ...clients[index],
                empresa: clientData.empresa || clients[index].empresa,
                usuario: clientData.usuario || clients[index].usuario,
                clave: clientData.clave ? this.encrypt(clientData.clave) : clients[index].clave,
                email: clientData.email !== undefined ? clientData.email : clients[index].email,
                tipo: clientData.tipo || clients[index].tipo,
                clienteId: clientData.clienteId !== undefined ? clientData.clienteId : clients[index].clienteId,
                clienteSecret: clientData.clienteSecret ? this.encrypt(clientData.clienteSecret) : clients[index].clienteSecret,
                updatedAt: new Date().toISOString()
            };

            this.store.set('clients', clients);

            logger.info(`Cliente actualizado: ${ruc}`);
            return { success: true, client: this.getClient(ruc) };
        } catch (error) {
            logger.error('Error al actualizar cliente:', error);
            return { success: false, error: error.message };
        }
    }

    // Eliminar cliente
    deleteClient(ruc) {
        try {
            const clients = this.store.get('clients', []);
            const index = clients.findIndex(c => c.ruc === ruc);

            if (index === -1) {
                throw new Error(`Cliente con RUC ${ruc} no encontrado`);
            }

            const deletedClient = clients[index];
            clients.splice(index, 1);
            this.store.set('clients', clients);

            logger.info(`Cliente eliminado: ${ruc} - ${deletedClient.empresa}`);
            return { success: true, message: `Cliente ${deletedClient.empresa} eliminado` };
        } catch (error) {
            logger.error('Error al eliminar cliente:', error);
            return { success: false, error: error.message };
        }
    }

    // Importar desde datos (usado para migraciÃ³n de Excel)
    importClients(clientsData) {
        try {
            const existingClients = this.store.get('clients', []);
            let imported = 0;
            let updated = 0;
            let skipped = 0;

            clientsData.forEach(clientData => {
                // Verificar si ya existe
                const existingIndex = existingClients.findIndex(c => c.ruc === clientData.ruc);

                if (existingIndex !== -1) {
                    // Cliente existe - verificar si hay que actualizar CLIENTE_ID o CLIENTE_SECRET
                    const existingClient = existingClients[existingIndex];
                    let needsUpdate = false;

                    // Actualizar CLIENTE_ID si viene en el Excel y no estÃ¡ vacÃ­o
                    if (clientData.clienteId && clientData.clienteId.trim() !== '') {
                        existingClient.clienteId = clientData.clienteId.trim();
                        needsUpdate = true;
                    }

                    // Actualizar CLIENTE_SECRET si viene en el Excel y no estÃ¡ vacÃ­o
                    if (clientData.clienteSecret && clientData.clienteSecret.trim() !== '') {
                        existingClient.clienteSecret = this.encrypt(clientData.clienteSecret.trim());
                        needsUpdate = true;
                    }

                    // Si tiene CLIENTE_ID y CLIENTE_SECRET, automÃ¡ticamente es tipo SIRE
                    if (existingClient.clienteId && existingClient.clienteSecret && existingClient.tipo !== 'SIRE') {
                        existingClient.tipo = 'SIRE';
                        needsUpdate = true;
                        logger.info(`Cliente ${clientData.ruc} cambiado a tipo SIRE`);
                    }

                    if (needsUpdate) {
                        existingClient.updatedAt = new Date().toISOString();
                        existingClients[existingIndex] = existingClient;
                        updated++;
                        logger.info(`Cliente ${clientData.ruc} actualizado con CLIENTE_ID/SECRET`);
                    } else {
                        skipped++;
                    }
                    return;
                }

                // Cliente nuevo - agregar
                // Determinar tipo: si tiene CLIENTE_ID y CLIENTE_SECRET, es SIRE
                const hasSireCredentials = clientData.clienteId && clientData.clienteSecret;
                const tipo = hasSireCredentials ? 'SIRE' : (clientData.tipo || 'CLIENTES');

                const newClient = {
                    id: uuidv4(),
                    ruc: clientData.ruc,
                    empresa: clientData.empresa,
                    usuario: clientData.usuario,
                    clave: this.encrypt(clientData.clave),
                    email: clientData.email || '',
                    tipo: tipo,
                    clienteId: clientData.clienteId || '',
                    clienteSecret: clientData.clienteSecret ? this.encrypt(clientData.clienteSecret) : '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                existingClients.push(newClient);
                imported++;
            });

            this.store.set('clients', existingClients);

            const message = `${imported} nuevos, ${updated} actualizados, ${skipped} sin cambios`;
            logger.info(`ImportaciÃ³n completada: ${message}`);
            return {
                success: true,
                imported,
                updated,
                skipped,
                message
            };
        } catch (error) {
            logger.error('Error al importar clientes:', error);
            return { success: false, error: error.message };
        }
    }

    // Limpiar todos los clientes (usar con precauciÃ³n)
    clearAll() {
        try {
            this.store.set('clients', []);
            logger.warn('Todos los clientes han sido eliminados');
            return { success: true, message: 'Todos los clientes eliminados' };
        } catch (error) {
            logger.error('Error al limpiar clientes:', error);
            return { success: false, error: error.message };
        }
    }

    // Buscar clientes
    searchClients(query) {
        try {
            const clients = this.getAllClients();
            const lowerQuery = query.toLowerCase();

            return clients.filter(client =>
                client.ruc.includes(lowerQuery) ||
                client.empresa.toLowerCase().includes(lowerQuery) ||
                client.usuario.toLowerCase().includes(lowerQuery) ||
                (client.email && client.email.toLowerCase().includes(lowerQuery))
            );
        } catch (error) {
            logger.error('Error al buscar clientes:', error);
            return [];
        }
    }

    // Obtener estadÃ­sticas
    getStats() {
        try {
            const clients = this.getAllClients();
            return {
                total: clients.length,
                tipoClientes: clients.filter(c => c.tipo === 'CLIENTES').length,
                tipoSire: clients.filter(c => c.tipo === 'SIRE').length,
                conEmail: clients.filter(c => c.email).length,
                sinEmail: clients.filter(c => !c.email).length
            };
        } catch (error) {
            logger.error('Error al obtener estadÃ­sticas:', error);
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
const clientStorage = new ClientStorageService();

module.exports = clientStorage;



