/**
 * SIRE Routes - SIRE module operations
 * Replaces Electron's sire-related IPC handlers
 */

const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

// Lazy-load handlers to avoid Electron import errors at startup
function getSireHandler() {
  try { return require('../services/sireHandler'); } 
  catch (e) { logger.warn('sireHandler not available:', e.message); return null; }
}

function getSireFileManager() {
  try { return require('../services/sireFileManager'); }
  catch (e) { logger.warn('sireFileManager not available:', e.message); return null; }
}

function getSireAjustesHandler() {
  try { return require('../services/sireAjustesHandler'); }
  catch (e) { logger.warn('sireAjustesHandler not available:', e.message); return null; }
}

// POST /api/sire/ejecutar
router.post('/ejecutar', async (req, res) => {
  try {
    const handler = getSireHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo SIRE no disponible' });
    
    const datos = req.body;
    datos.plan = req.user.plan || 'basico';
    const result = await handler.ejecutarSire(datos);
    res.json(result);
  } catch (error) {
    logger.error('Error executing SIRE:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sire/abrir-excel
router.post('/abrir-excel', async (req, res) => {
  try {
    const handler = getSireHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo SIRE no disponible' });
    
    const result = await handler.abrirExcelSire();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sire/archivos
router.get('/archivos', async (req, res) => {
  try {
    const manager = getSireFileManager();
    if (!manager) return res.status(503).json({ success: false, error: 'Módulo SIRE no disponible', archivos: [] });
    
    const result = await manager.listarArchivos();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, archivos: [] });
  }
});

// POST /api/sire/archivos/abrir
router.post('/archivos/abrir', async (req, res) => {
  try {
    const manager = getSireFileManager();
    if (!manager) return res.status(503).json({ success: false, error: 'Módulo SIRE no disponible' });
    
    const result = await manager.abrirArchivo(req.body.nombreArchivo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/sire/archivos/:nombre
router.delete('/archivos/:nombre', async (req, res) => {
  try {
    const manager = getSireFileManager();
    if (!manager) return res.status(503).json({ success: false, error: 'Módulo SIRE no disponible' });
    
    const result = await manager.eliminarArchivo(req.params.nombre);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sire/ajustes/abrir
router.post('/ajustes/abrir', async (req, res) => {
  try {
    const handler = getSireAjustesHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo SIRE Ajustes no disponible' });
    
    // In web version, we don't open a window - we return the configuration
    res.json({ success: true, message: 'SIRE Ajustes disponible en web' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sire/ajustes/:action - Generic SIRE Ajustes handler
router.post('/ajustes/:action', async (req, res) => {
  try {
    const handler = getSireAjustesHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo SIRE Ajustes no disponible' });
    
    const action = req.params.action;
    const data = req.body;
    
    // Map actions to handler methods
    if (typeof handler[action] === 'function') {
      const result = await handler[action](data);
      res.json(result);
    } else {
      res.status(404).json({ success: false, error: `Acción SIRE Ajustes no encontrada: ${action}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sire/archivos/descargar - Download a specific SIRE file
router.get('/archivos/descargar', async (req, res) => {
  try {
    const manager = getSireFileManager();
    if (!manager) return res.status(503).json({ success: false, error: 'Módulo SIRE no disponible' });

    const nombre = req.query.nombre;
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'Falta el nombre del archivo' });
    }

    const path = require('path');
    const fs = require('fs');
    const normalizedNombre = nombre.replace(/\\/g, path.sep).replace(/\//g, path.sep);
    const filePath = path.join(manager.outputDir, normalizedNombre);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }

    res.download(filePath, path.basename(filePath));
  } catch (error) {
    logger.error('Error downloading SIRE file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
