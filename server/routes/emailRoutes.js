/**
 * Email Routes - Email service operations
 * Replaces Electron's email:* IPC handlers
 */
const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

function getEmailService() {
  try { return require('../services/emailService'); }
  catch (e) { logger.warn('emailService not available:', e.message); return null; }
}

function getEnvManager() {
  try { return require('../services/envManager'); }
  catch (e) { logger.warn('envManager not available:', e.message); return null; }
}

router.post('/configurar', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = svc.configurar(req.body.user, req.body.pass);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/enviar', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = await svc.enviarEmail(req.body.destinatario, req.body.asunto, req.body.mensaje, req.body.mensajeHTML);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/enviar-con-adjuntos', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = await svc.enviarEmailConAdjuntos(req.body.destinatario, req.body.asunto, req.body.mensaje, req.body.archivos);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/alerta-facturas', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = await svc.enviarAlertaFacturas(req.body.destinatario, req.body.cliente, req.body.cantidad);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/reporte-facturas', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = await svc.enviarReporteFacturas(req.body.destinatario, req.body.facturas, req.body.archivos);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/notificar-error', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = await svc.enviarNotificacionError(req.body.destinatario, req.body.error, req.body.contexto);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/enviar-factura', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = await svc.enviarFacturaEmail(req.body.destinatario, req.body.facturaData);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/config', async (req, res) => {
  try {
    const mgr = getEnvManager();
    if (!mgr) return res.json({ success: true, config: {} });
    const config = mgr.getCurrentEmailConfig();
    res.json({ success: true, config });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/update-config', async (req, res) => {
  try {
    const mgr = getEnvManager();
    const svc = getEmailService();
    if (!mgr) return res.status(503).json({ success: false, error: 'EnvManager no disponible' });
    const updateResult = mgr.updateEmailConfig(req.body.user, req.body.pass);
    if (!updateResult.success) return res.json(updateResult);
    if (svc) svc.reloadConfiguration();
    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/test-config', async (req, res) => {
  try {
    const mgr = getEnvManager();
    const svc = getEmailService();
    if (!mgr || !svc) return res.status(503).json({ success: false, error: 'Servicio no disponible' });
    const validation = mgr.validateEmailConfig(req.body.user, req.body.pass);
    if (!validation.valid) return res.json({ success: false, error: validation.error });
    svc.configurar(req.body.user, req.body.pass);
    const testResult = await svc.testConfiguration(req.body.user);
    res.json(testResult);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/reload-config', async (req, res) => {
  try {
    const svc = getEmailService();
    if (!svc) return res.status(503).json({ success: false, error: 'Email no disponible' });
    const result = svc.reloadConfiguration();
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

module.exports = router;
