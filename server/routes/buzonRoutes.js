/**
 * Buzón Electrónico Routes
 * Replaces Electron's buzon:* IPC handlers
 */
const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

function getBuzonHandler() {
  try { return require('../services/buzonHandler'); }
  catch (e) { logger.warn('buzonHandler not available:', e.message); return null; }
}

router.get('/clientes', async (req, res) => {
  try {
    const handler = getBuzonHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Buzón no disponible' });
    const result = await handler.obtenerClientes();
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/consultar', async (req, res) => {
  try {
    const handler = getBuzonHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Buzón no disponible' });
    const resultado = await handler.consultarBuzon(req.body.ruc);
    res.json(resultado);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/descargar-adjunto', async (req, res) => {
  try {
    const handler = getBuzonHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Buzón no disponible' });
    const result = await handler.descargarAdjunto(req.body.browserId, req.body.mensajeId);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/cerrar-sesion', async (req, res) => {
  try {
    const handler = getBuzonHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Buzón no disponible' });
    const result = await handler.cerrarSesion(req.body.browserId);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/sesiones', async (req, res) => {
  try {
    const handler = getBuzonHandler();
    if (!handler) return res.json({ success: true, sesiones: [] });
    res.json({ success: true, sesiones: handler.getSesionesActivas ? handler.getSesionesActivas() : [] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/listar-constancias', async (req, res) => {
  try {
    const handler = getBuzonHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Buzón no disponible' });
    const result = await handler.listarConstancias(req.body.ruc);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/abrir-constancia', async (req, res) => {
  try {
    const handler = getBuzonHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Buzón no disponible' });
    const result = await handler.abrirConstancia(req.body.ruta);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

module.exports = router;
