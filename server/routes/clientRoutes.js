/**
 * Client Routes - REST API for client management
 * Replaces Electron's clients:* IPC handlers
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../services/logger');

// Simple JSON-based client storage (replaces clientStorageService with IPC)
const DATA_DIR = path.join(process.cwd(), 'server', 'data');

function getClientsFile(userId) {
  const userDir = path.join(DATA_DIR, 'users', String(userId));
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  return path.join(userDir, 'clients.json');
}

function loadClients(userId) {
  const file = getClientsFile(userId);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    logger.error('Error loading clients:', e);
  }
  return [];
}

function saveClients(userId, clients) {
  const file = getClientsFile(userId);
  fs.writeFileSync(file, JSON.stringify(clients, null, 2), 'utf8');
}

// GET /api/clients - Get all clients
router.get('/', (req, res) => {
  try {
    const clients = loadClients(req.user.id);
    res.json({ success: true, clients });
  } catch (error) {
    logger.error('Error getting clients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/clients/:ruc - Get single client
router.get('/:ruc', (req, res) => {
  try {
    const clients = loadClients(req.user.id);
    const client = clients.find(c => c.ruc === req.params.ruc);
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
    const clients = loadClients(req.user.id);
    const clientData = req.body;
    
    if (!clientData.ruc) {
      return res.status(400).json({ success: false, error: 'RUC es requerido' });
    }
    
    // Check duplicate
    if (clients.find(c => c.ruc === clientData.ruc)) {
      return res.json({ success: false, error: 'Ya existe un cliente con ese RUC' });
    }
    
    clientData.createdAt = new Date().toISOString();
    clients.push(clientData);
    saveClients(req.user.id, clients);
    
    res.json({ success: true, client: clientData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/clients/:ruc - Update client
router.put('/:ruc', (req, res) => {
  try {
    const clients = loadClients(req.user.id);
    const index = clients.findIndex(c => c.ruc === req.params.ruc);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    
    clients[index] = { ...clients[index], ...req.body, ruc: req.params.ruc };
    saveClients(req.user.id, clients);
    
    res.json({ success: true, client: clients[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/clients/:ruc - Delete client
router.delete('/:ruc', (req, res) => {
  try {
    let clients = loadClients(req.user.id);
    const before = clients.length;
    clients = clients.filter(c => c.ruc !== req.params.ruc);
    
    if (clients.length === before) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    
    saveClients(req.user.id, clients);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/clients/search/:query - Search clients
router.get('/search/:query', (req, res) => {
  try {
    const query = req.params.query.toLowerCase();
    const clients = loadClients(req.user.id);
    const results = clients.filter(c => 
      (c.ruc && c.ruc.toLowerCase().includes(query)) ||
      (c.empresa && c.empresa.toLowerCase().includes(query)) ||
      (c.razonSocial && c.razonSocial.toLowerCase().includes(query))
    );
    res.json({ success: true, clients: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/clients/stats/summary - Get statistics
router.get('/stats/summary', (req, res) => {
  try {
    const clients = loadClients(req.user.id);
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
