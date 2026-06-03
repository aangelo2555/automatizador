/**
 * CPE Routes - CPE scraping and Excel operations
 * Replaces Electron's cpe-* IPC handlers
 */
const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

function getCpeHandler() {
  try { return require('../services/cpeScrapingHandler'); }
  catch (e) { logger.warn('cpeScrapingHandler not available:', e.message); return null; }
}

function getCpeExcelHandler() {
  try { return require('../services/cpeExcelHandler'); }
  catch (e) { logger.warn('cpeExcelHandler not available:', e.message); return null; }
}

function getConsultaHandler() {
  try { return require('../services/consultaFacturaHandler'); }
  catch (e) { logger.warn('consultaFacturaHandler not available:', e.message); return null; }
}

router.post('/consultar', async (req, res) => {
  try {
    const handlerObj = getCpeHandler();
    if (!handlerObj) return res.status(503).json({ success: false, error: 'Módulo CPE no disponible' });
    const { rucConsultante, rucEmisor, tipoDoc, serie, numero, fecha, monto, filtro } = req.body;
    const result = await handlerObj.cpeScrapingHandler.consultarCPE(rucConsultante, { rucEmisor, tipoDoc, serie, numero, fecha, monto, filtro });
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/descargar-pdf', async (req, res) => {
  try {
    const handlerObj = getCpeHandler();
    if (!handlerObj) return res.status(503).json({ success: false, error: 'Módulo CPE no disponible' });
    const { sessionId, cpe } = req.body;
    const result = await handlerObj.cpeScrapingHandler.descargarPDF(sessionId, cpe);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/descargar-xml', async (req, res) => {
  try {
    const handlerObj = getCpeHandler();
    if (!handlerObj) return res.status(503).json({ success: false, error: 'Módulo CPE no disponible' });
    const { sessionId, cpe } = req.body;
    const result = await handlerObj.cpeScrapingHandler.descargarXML(sessionId, cpe);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/descargar-cdr', async (req, res) => {
  try {
    const handlerObj = getCpeHandler();
    if (!handlerObj) return res.status(503).json({ success: false, error: 'Módulo CPE no disponible' });
    const { sessionId, cpe } = req.body;
    const result = await handlerObj.cpeScrapingHandler.descargarCDR(sessionId, cpe);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/excel/cargar-cliente', async (req, res) => {
  try {
    const handler = getCpeExcelHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo CPE Excel no disponible' });
    const result = await handler.cargarExcelCliente(req.body);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/excel/leer-hoja', async (req, res) => {
  try {
    const handler = getCpeExcelHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo CPE Excel no disponible' });
    const result = await handler.leerHojaExcel(req.body);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/excel/abrir-archivo', async (req, res) => {
  try {
    const handler = getCpeExcelHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo CPE Excel no disponible' });
    const result = await handler.abrirArchivoExcel(req.body);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Consulta Factura routes
router.post('/consulta-factura', async (req, res) => {
  try {
    const handler = getConsultaHandler();
    if (!handler) return res.status(503).json({ success: false, error: 'Módulo Consulta no disponible' });
    const result = await handler.validarComprobante(req.body);
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

module.exports = router;
