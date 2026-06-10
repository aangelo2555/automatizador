/**
 * Client Routes - REST API for client management
 * Uses clientStorageService as the single source of truth (with secure encryption)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../services/logger');
const clientStorage = require('../services/clientStorageService');

// Directorio de datos legacy
const DATA_DIR = path.join(process.cwd(), 'server', 'data');

/**
 * Migra clientes desde el archivo legacy clients.json (sin encriptar)
 * al almacenamiento seguro clientStorage (encriptado en clients-data.json)
 */
function migrarClientesLegacySiExiste(userId) {
  const legacyFile = path.join(DATA_DIR, 'users', String(userId), 'clients.json');
  try {
    if (fs.existsSync(legacyFile)) {
      logger.info(`[Client Migration] Detectado archivo legacy clients.json para usuario ${userId}. Migrando...`);
      const legacyClients = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
      
      if (Array.isArray(legacyClients) && legacyClients.length > 0) {
        // Asegurar que clientStorage está inicializado
        clientStorage.initializeForUser(userId);
        
        // Obtener clientes ya guardados en la base de datos segura para evitar duplicados exactos
        const secureClients = clientStorage.getAllClients();
        const secureRucs = new Set(secureClients.map(c => c.ruc));
        
        let count = 0;
        for (const c of legacyClients) {
          if (!c.ruc) continue;
          if (!secureRucs.has(c.ruc)) {
            // Agregar al almacenamiento seguro (addClient encripta clave y clienteSecret internamente)
            clientStorage.addClient({
              ruc: c.ruc,
              empresa: c.empresa || c.razonSocial || `Empresa RUC ${c.ruc}`,
              usuario: c.usuario || '',
              clave: c.clave || '',
              email: c.email || '',
              tipo: c.tipo || 'CLIENTES',
              clienteId: c.clienteId || '',
              clienteSecret: c.clienteSecret || ''
            });
            count++;
          }
        }
        logger.info(`[Client Migration] Migrados exitosamente ${count} clientes a clients-data.json`);
      }
      
      // Renombrar o eliminar el archivo viejo para que no vuelva a procesarse
      const legacyBackupFile = legacyFile + '.bak';
      fs.renameSync(legacyFile, legacyBackupFile);
      logger.info(`[Client Migration] Archivo legacy renombrado a ${path.basename(legacyBackupFile)}`);
    }
  } catch (err) {
    logger.error(`[Client Migration] Error durante la migración de clientes legacy: ${err.message}`, err);
  }
}

// GET /api/clients - Get all clients
router.get('/', (req, res) => {
  try {
    // 1. Ejecutar migración legacy si existe el archivo viejo
    migrarClientesLegacySiExiste(req.user.id);

    // 2. Cargar desde el storage seguro
    const clients = clientStorage.getAllClients();
    res.json({ success: true, clients });
  } catch (error) {
    logger.error('Error getting clients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/clients/:ruc - Get single client
router.get('/:ruc', (req, res) => {
  try {
    migrarClientesLegacySiExiste(req.user.id);
    const client = clientStorage.getClient(req.params.ruc);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    res.json({ success: true, client });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/clients - Add new client
router.post('/', (req, res) => {
  try {
    migrarClientesLegacySiExiste(req.user.id);
    const clientData = req.body;
    
    if (!clientData.ruc) {
      return res.status(400).json({ success: false, error: 'RUC es requerido' });
    }
    
    const result = clientStorage.addClient(clientData);
    if (!result.success) {
      return res.json({ success: false, error: result.error });
    }
    
    res.json({ success: true, client: result.client });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/clients/:ruc - Update client
router.put('/:ruc', (req, res) => {
  try {
    migrarClientesLegacySiExiste(req.user.id);
    const result = clientStorage.updateClient(req.params.ruc, req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, client: result.client });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/clients/:ruc - Delete client
router.delete('/:ruc', (req, res) => {
  try {
    migrarClientesLegacySiExiste(req.user.id);
    const result = clientStorage.deleteClient(req.params.ruc);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/clients/search/:query - Search clients
router.get('/search/:query', (req, res) => {
  try {
    migrarClientesLegacySiExiste(req.user.id);
    const clients = clientStorage.searchClients(req.params.query);
    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/clients/stats/summary - Get statistics
router.get('/stats/summary', (req, res) => {
  try {
    migrarClientesLegacySiExiste(req.user.id);
    const clients = clientStorage.getAllClients();
    res.json({
      success: true,
      stats: {
        total: clients.length,
        withCredentials: clients.filter(c => c.usuario && c.clave).length,
        withEmail: clients.filter(c => c.email).length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
