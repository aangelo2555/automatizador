/**
 * Boleta Routes - Boleta emission operations
 * Replaces Electron's boleta:* IPC handlers
 */
const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

function getBoletaHandler() {
  try { return require('../services/boletaHandler'); }
  catch (e) { logger.warn('boletaHandler not available:', e.message); return null; }
}

function getAjustesHandler() {
  try { return require('../services/ajustesPosterioresHandler'); }
  catch (e) { logger.warn('ajustesPosterioresHandler not available:', e.message); return null; }
}

router.post('/connect', async (req, res) => {
  try {
    const handler = getBoletaHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Boleta no disponible' });
    const result = await handler.connectInternal(req.body.ruc);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/process-internal', async (req, res) => {
  try {
    const handler = getBoletaHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Boleta no disponible' });
    const result = await handler.processInternalBatch(req.body.ruc, req.body.items, req.body.flow);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/close-session', async (req, res) => {
  try {
    const handler = getBoletaHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Boleta no disponible' });
    const result = await handler.closeSession(req.body.ruc);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/process-batch', async (req, res) => {
  try {
    const handler = getBoletaHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Boleta no disponible' });
    
    const { boletas, session } = req.body;
    let connectResult;
    if (session && session.cookies) {
      connectResult = await handler.initBrowserSession(session);
    } else {
      connectResult = await handler.connectToBrowser();
    }
    if (!connectResult.success) return res.json({ success: false, error: connectResult.error });

    const results = [];
    let errors = 0;
    for (let i = 0; i < (boletas || []).length; i++) {
      const result = await handler.processBoleta(boletas[i], () => {});
      results.push({ ...boletas[i], status: result.success ? 'success' : 'error', error: result.error });
      if (!result.success) errors++;
    }
    await handler.closeBrowser();
    res.json({ success: true, results, errors });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Login SUNAT routes (start-logins, stop-all, get-sessions)
router.post('/login/start', async (req, res) => {
  try {
    const sunatBot = require('../services/sunatBot');
    const config = require('../services/config');
    const { clients, portalId, options } = req.body;
    
    const portalUrl = config.PORTALES[portalId];
    if (!portalUrl) return res.json({ success: false, error: 'Portal inválido' });

    // Process logins sequentially in background
    const results = [];
    for (const client of clients) {
      try {
        const result = await sunatBot.loginCliente(client, portalUrl, { ...options, portalId });
        results.push(result);
      } catch (e) {
        results.push({ success: false, error: e.message, ruc: client.ruc });
      }
    }
    res.json({ success: true, results });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/login/stop', async (req, res) => {
  try {
    const sunatBot = require('../services/sunatBot');
    const result = await sunatBot.closeAllSessions();
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/login/sessions', async (req, res) => {
  try {
    const sunatBot = require('../services/sunatBot');
    const sessions = sunatBot.getActiveSessions();
    res.json({ success: true, sessions });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Ajustes Posteriores
router.post('/ajustes-posteriores/:action', async (req, res) => {
  try {
    const handler = getAjustesHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo no disponible' });
    const action = req.params.action;
    if (typeof handler[action] === 'function') {
      const result = await handler[action](req.body);
      res.json(result);
    } else {
      res.status(404).json({ success: false, error: `Acción no encontrada: ${action}` });
    }
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// PDF merge
router.post('/pdf/merge', async (req, res) => {
  try {
    const pdfMerger = require('../services/pdfMergerService');
    const result = await pdfMerger.mergeInPairs(req.body.inputFiles, req.body.outputDir);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Excel operations
router.post('/excel/get-sheets', async (req, res) => {
  try {
    const excelReader = require('../services/excelReader');
    const sheets = excelReader.getSheets(req.body.filePath);
    res.json({ success: true, sheets });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/excel/read-sheet', async (req, res) => {
  try {
    const excelReader = require('../services/excelReader');
    const data = excelReader.readSheet(req.body.filePath, req.body.sheetName);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

module.exports = router;
