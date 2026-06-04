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

// GET /api/cpe/download - Download a specific CPE file from server filesystem
router.get('/download', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Se requiere la ruta del archivo' });
    }
    
    const path = require('path');
    const fs = require('fs');
    
    // Resolve absolute path
    const resolvedPath = path.resolve(filePath);
    
    // Safety check: ensure file exists
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }
    
    // Safety check: ensure it is a file and not a directory
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ success: false, error: 'La ruta especificada no es un archivo' });
    }

    res.download(resolvedPath, path.basename(resolvedPath));
  } catch (error) {
    logger.error('Error al descargar archivo CPE:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper cookie functions
function parseSetCookie(headerVal, defaultDomain) {
  const parts = headerVal.split(';').map(p => p.trim());
  const [cookiePair] = parts;
  if (!cookiePair) return null;
  
  const eqIdx = cookiePair.indexOf('=');
  if (eqIdx === -1) return null;
  
  const name = cookiePair.substring(0, eqIdx);
  const value = cookiePair.substring(eqIdx + 1);
  if (!name) return null;
  
  let domain = defaultDomain;
  let path = '/';
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const eq = part.indexOf('=');
    let k = part, v = '';
    if (eq !== -1) {
      k = part.substring(0, eq).trim();
      v = part.substring(eq + 1).trim();
    }
    const key = k.toLowerCase();
    if (key === 'domain' && v) {
      domain = v.startsWith('.') ? v : '.' + v;
    } else if (key === 'path' && v) {
      path = v;
    }
  }
  
  return { name, value, domain, path };
}

function updateSessionCookies(session, setCookieHeaders, targetDomain) {
  if (!setCookieHeaders) return;
  
  let headers = [];
  if (Array.isArray(setCookieHeaders)) {
    headers = setCookieHeaders;
  } else {
    headers = [setCookieHeaders];
  }
  
  if (!session.cookies) {
    session.cookies = [];
  }
  
  for (const header of headers) {
    const parsed = parseSetCookie(header, targetDomain);
    if (parsed) {
      // Remove existing cookie with same name, domain, and path
      session.cookies = session.cookies.filter(c => !(
        c.name === parsed.name &&
        c.domain.toLowerCase() === parsed.domain.toLowerCase() &&
        (c.path || '/') === (parsed.path || '/')
      ));
      session.cookies.push(parsed);
    }
  }
}

// Wildcard reverse proxy route for SUNAT
router.all('/sunat-proxy/:sessionId/:targetDomain/*', async (req, res) => {
  const { sessionId, targetDomain } = req.params;
  const pathSuffix = req.params[0] || '';
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  
  const targetUrl = `https://${targetDomain}/${pathSuffix}${queryString}`;
  
  const cpeHandler = getCpeHandler();
  const session = cpeHandler ? cpeHandler.cpeScrapingHandler.proxySessions.get(sessionId) : null;
  if (!session) {
    logger.warn(`[Proxy] Sesión no encontrada: ${sessionId}`);
    return res.status(404).send('Sesión de SUNAT no encontrada o expirada en el servidor.');
  }

  // Build Cookie header
  const matchedCookies = session.cookies.filter(c => {
    const cookieDomain = c.domain.toLowerCase();
    const reqDomain = targetDomain.toLowerCase();
    if (cookieDomain.startsWith('.')) {
      return reqDomain.endsWith(cookieDomain) || reqDomain === cookieDomain.substring(1);
    }
    return reqDomain === cookieDomain;
  });
  const cookieHeader = matchedCookies.map(c => `${c.name}=${c.value}`).join('; ');

  try {
    const axios = require('axios');
    const querystring = require('querystring');
    
    // Copy only standard safe headers to prevent triggering SUNAT's WAF (F5 BIG-IP)
    const headers = {};
    const safeHeaders = ['user-agent', 'accept', 'accept-language', 'content-type', 'cache-control', 'pragma'];
    safeHeaders.forEach(h => {
      if (req.headers[h]) {
        headers[h] = req.headers[h];
      }
    });

    headers['host'] = targetDomain;
    headers['cookie'] = cookieHeader;
    headers['accept-encoding'] = 'identity'; // request raw body

    // Rewrite Origin header if present
    if (req.headers['origin']) {
      headers['origin'] = `https://${targetDomain}`;
    }

    // Rewrite Referer header to make it look like a direct SUNAT request
    if (req.headers['referer']) {
      let ref = req.headers['referer'];
      const proxyPrefixPattern = new RegExp(`https?://[^/]+/api/cpe/sunat-proxy/[^/]+/([^/]+)`);
      const match = ref.match(proxyPrefixPattern);
      if (match) {
        const refDomain = match[1];
        ref = ref.replace(proxyPrefixPattern, `https://${refDomain}`);
      } else {
        ref = `https://${targetDomain}/`;
      }
      headers['referer'] = ref;
    } else {
      headers['referer'] = `https://${targetDomain}/`;
    }

    let requestData = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        requestData = querystring.stringify(req.body);
      } else if (contentType.includes('application/json')) {
        requestData = JSON.stringify(req.body);
      } else {
        requestData = req.body;
      }
    }

    // Forward request
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: requestData,
      responseType: 'arraybuffer',
      validateStatus: () => true
    });

    // Intercept Set-Cookie headers
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      updateSessionCookies(session, setCookie, targetDomain);
    }

    // Rewrite redirects (Location header)
    let location = response.headers['location'];
    if (location) {
      if (location.startsWith('http://') || location.startsWith('https://')) {
        location = location.replace(/https?:\/\/([a-zA-Z0-9_-]+)\.sunat\.gob\.pe/g, (match, subdomain) => {
          return `/api/cpe/sunat-proxy/${sessionId}/${subdomain}.sunat.gob.pe`;
        });
      } else if (location.startsWith('/')) {
        location = `/api/cpe/sunat-proxy/${sessionId}/${targetDomain}${location}`;
      } else {
        const currentPath = pathSuffix.substring(0, pathSuffix.lastIndexOf('/') + 1);
        location = `/api/cpe/sunat-proxy/${sessionId}/${targetDomain}/${currentPath}${location}`;
      }
      res.setHeader('location', location);
    }

    // Strip frame-blocking and other incompatible headers
    delete response.headers['x-frame-options'];
    delete response.headers['content-security-policy'];
    delete response.headers['x-webkit-csp'];
    delete response.headers['content-security-policy-report-only'];

    // Forward response headers
    Object.keys(response.headers).forEach(key => {
      if (key !== 'set-cookie' && key !== 'location' && key !== 'content-length') {
        res.setHeader(key, response.headers[key]);
      }
    });

    // Rewrite links and subdomains in response body for text responses
    const resContentType = response.headers['content-type'] || '';
    const isText = resContentType.includes('text') || 
                   resContentType.includes('javascript') || 
                   resContentType.includes('json');

    if (isText) {
      let bodyStr = response.data.toString('utf8');
      
      // Rewrite https://(subdomain).sunat.gob.pe -> /api/cpe/sunat-proxy/:sessionId/(subdomain).sunat.gob.pe
      bodyStr = bodyStr.replace(/https:\/\/([a-zA-Z0-9_-]+)\.sunat\.gob\.pe/g, (match, subdomain) => {
        return `${req.protocol}://${req.get('host')}/api/cpe/sunat-proxy/${sessionId}/${subdomain}.sunat.gob.pe`;
      });

      // Rewrite relative protocol //(subdomain).sunat.gob.pe
      bodyStr = bodyStr.replace(/\/\/([a-zA-Z0-9_-]+)\.sunat\.gob\.pe/g, (match, subdomain) => {
        return `${req.protocol}://${req.get('host')}/api/cpe/sunat-proxy/${sessionId}/${subdomain}.sunat.gob.pe`;
      });

      res.status(response.status).send(bodyStr);
    } else {
      res.status(response.status).send(response.data);
    }
  } catch (error) {
    logger.error(`[Proxy] Error para URL: ${targetUrl}`, error);
    res.status(500).send(`Error de Proxy: ${error.message}`);
  }
});

module.exports = router;
