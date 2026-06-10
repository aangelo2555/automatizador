/**
 * CPE Routes - API-based CPE consultation + Excel operations
 * Uses SUNAT API (api-cpe.sunat.gob.pe) with JWT tokens intercepted from SOL login
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const logger = require('../services/logger');

const CPE_API_URL = 'https://api-cpe.sunat.gob.pe/v1/contribuyente';

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

function getTokenService() {
  try { return require('../services/cpeTokenService'); }
  catch (e) { logger.warn('cpeTokenService not available:', e.message); return null; }
}

/**
 * Obtiene credenciales SOL para un RUC
 */
async function obtenerCredencialesSOL(ruc) {
  try {
    const clientStorage = require('../services/clientStorageService');
    if (clientStorage && clientStorage.currentUserId) {
      const cliente = clientStorage.getClient(ruc);
      if (cliente) {
        return {
          success: true,
          data: {
            ruc: cliente.ruc,
            razonSocial: cliente.empresa,
            usuario_sol: cliente.usuario,
            clave_sol: cliente.clave
          }
        };
      }
    }
    return { success: false, error: `No se encontraron credenciales para RUC ${ruc}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Transforma la respuesta de la API CPE al formato del frontend
 */
function transformarRespuestaAPI(apiData) {
  if (!apiData || !apiData.comprobantes || apiData.comprobantes.length === 0) {
    return { estado: 'NO_ENCONTRADO', encontrado: false };
  }

  const cpe = apiData.comprobantes[0];
  const emisor = cpe.datosEmisor || {};
  const receptor = cpe.datosReceptor || {};
  const totales = cpe.procedenciaMasiva || {};
  const items = cpe.informacionItems || [];

  const ESTADO_MAP = { '0': 'ACEPTADO', '1': 'ACEPTADO', '2': 'ANULADO', '3': 'AUTORIZADO', '4': 'NO AUTORIZADO' };
  const TIPO_MAP = { '01': 'FACTURA ELECTRÓNICA', '03': 'BOLETA DE VENTA', '07': 'NOTA DE CRÉDITO', '08': 'NOTA DE DÉBITO' };
  const MONEDA_MAP = { 'PEN': 'SOL', 'USD': 'DÓLAR AMERICANO', 'EUR': 'EURO' };

  return {
    encontrado: true,
    estado: ESTADO_MAP[cpe.indEstadoCpe] || 'ACEPTADO',
    // Datos del emisor
    emisor: {
      ruc: emisor.numRuc,
      razonSocial: emisor.desRazonSocialEmis,
      nombreComercial: emisor.desNomComercialEmis,
      direccion: emisor.desDirEmis,
      ubigeo: emisor.ubigeoEmis
    },
    // Datos del receptor
    receptor: {
      tipoDoc: receptor.codDocIdeRecep,
      numDoc: receptor.numDocIdeRecep,
      razonSocial: receptor.desRazonSocialRecep,
      direccion: receptor.dirDetCliente
    },
    // Comprobante
    comprobante: {
      tipo: cpe.codCpe,
      tipoDescripcion: TIPO_MAP[cpe.codCpe] || `TIPO ${cpe.codCpe}`,
      serie: cpe.numSerie,
      numero: cpe.numCpe,
      fechaEmision: cpe.fecEmision,
      fechaRegistro: cpe.fecRegistro,
      moneda: cpe.codMoneda,
      monedaDescripcion: MONEDA_MAP[cpe.codMoneda] || cpe.codMoneda,
      observacion: cpe.desObservacion !== '-' ? cpe.desObservacion : '',
      formaPago: cpe.codTipTransaccion === '1' ? 'Contado' : 'Crédito'
    },
    // Items
    items: items.map(item => ({
      cantidad: item.cntItems,
      unidadMedida: item.desUnidadMedida,
      codigo: item.desCodigo,
      descripcion: item.desItem,
      valorUnitario: item.mtoValUnitario,
      icbper: item.mtoICBPER,
      descuento: item.mtoDesc,
      total: item.mtoImpTotal
    })),
    // Totales
    totales: {
      descuentoGlobalAfecBI: totales.mtoDtoGlobalAfecBI || 0,
      totalGravado: totales.mtoTotalValVentaGrabado || 0,
      totalInafecto: totales.mtoTotalValVentaInafecto || 0,
      totalExonerado: totales.mtoTotalValVentaExonerado || 0,
      totalGratuito: totales.mtoTotalValVentaGratuito || 0,
      totalExportacion: totales.mtoTotalValVentaExportacion || 0,
      descuentoGlobalNoAfecBI: totales.mtoDtoGlobalNoAfecBI || 0,
      totalDescuentos: totales.mtoTotalDtos || 0,
      sumOtrosTributos: totales.mtoSumOtrosTributos || 0,
      sumOtrosCargos: totales.mtoSumOtrosCargos || 0,
      sumISC: totales.mtoSumISC || 0,
      sumIGV: totales.mtoSumIGV || 0,
      sumICBPER: totales.mtoSumICBPER || 0,
      totalAnticipo: totales.mtoTotalAnticipo || 0,
      importeTotal: totales.mtoImporteTotal || 0,
      redondeo: totales.mtoRedondeo || 0
    },
    totalEnLetras: cpe.desMtoTotalLetras,
    // Para compatibilidad con el sistema anterior
    razonSocial: emisor.desRazonSocialEmis,
    rucEmisor: emisor.numRuc,
    fechaEmision: cpe.fecEmision,
    importeTotal: totales.mtoImporteTotal ? `S/ ${totales.mtoImporteTotal.toFixed(2)}` : '',
    // Datos raw para referencia
    _raw: apiData
  };
}

// ═══════════════════════════════════════════
// CONSULTA INDIVIDUAL via API CPE
// ═══════════════════════════════════════════
router.post('/consultar', async (req, res) => {
  try {
    const { rucConsultante, rucEmisor, tipoDoc, serie, numero, filtro = 'recibido' } = req.body;

    if (!rucConsultante || !rucEmisor || !serie || !numero) {
      return res.json({ success: false, error: 'Faltan campos requeridos' });
    }

    // 1. Obtener credenciales SOL
    const creds = await obtenerCredencialesSOL(rucConsultante);
    if (!creds.success) {
      return res.json({ success: false, error: creds.error });
    }

    // 2. Obtener token JWT (cacheado o nuevo login)
    const tokenService = getTokenService();
    if (!tokenService) {
      return res.json({ success: false, error: 'Servicio de token no disponible' });
    }

    const tokenResult = await tokenService.obtenerToken(rucConsultante, creds.data);
    if (!tokenResult.success) {
      return res.json({ success: false, error: tokenResult.error });
    }

    // 3. Consultar API CPE
    const digito = filtro === 'emitido' ? '1' : '2';
    const cpeId = `${rucEmisor}-${tipoDoc || '01'}-${serie}-${numero}-${digito}`;
    const url = `${CPE_API_URL}/consultacpe/comprobantes/${cpeId}`;

    logger.info(`[CPE API] Consultando: ${cpeId}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // 4. Transformar respuesta
    const data = transformarRespuestaAPI(response.data);

    return res.json({
      success: true,
      data,
      cpeId,
      method: 'API'
    });

  } catch (error) {
    logger.error('[CPE API] Error en consulta:', error.message);

    if (error.response?.status === 401) {
      // Token expirado, invalidar cache
      const tokenService = getTokenService();
      if (tokenService) tokenService.invalidarToken(req.body.rucConsultante);
      return res.json({ success: false, error: 'Sesión expirada. Intente nuevamente.' });
    }

    return res.json({
      success: false,
      error: error.response?.data?.message || error.message || 'Error al consultar comprobante'
    });
  }
});

// ═══════════════════════════════════════════
// CONSULTA MASIVA via API CPE
// ═══════════════════════════════════════════
router.post('/consultar-masivo', async (req, res) => {
  try {
    const { rucConsultante, listaComprobantes } = req.body;

    if (!rucConsultante || !listaComprobantes || listaComprobantes.length === 0) {
      return res.json({ success: false, error: 'Faltan datos requeridos' });
    }

    // 1. Obtener token
    const creds = await obtenerCredencialesSOL(rucConsultante);
    if (!creds.success) return res.json({ success: false, error: creds.error });

    const tokenService = getTokenService();
    if (!tokenService) return res.json({ success: false, error: 'Servicio de token no disponible' });

    const tokenResult = await tokenService.obtenerToken(rucConsultante, creds.data);
    if (!tokenResult.success) return res.json({ success: false, error: tokenResult.error });

    // 2. Procesar en lotes de 10 en paralelo
    const BATCH_SIZE = 10;
    const resultados = [];
    let procesados = 0;
    let errores = 0;

    for (let i = 0; i < listaComprobantes.length; i += BATCH_SIZE) {
      const lote = listaComprobantes.slice(i, i + BATCH_SIZE);

      const promesas = lote.map(async (comp) => {
        try {
          const digito = (comp.filtro === 'emitido') ? '1' : '2';
          const cpeId = `${comp.rucEmisor}-${comp.tipoDoc || '01'}-${comp.serie}-${comp.numero}-${digito}`;
          const url = `${CPE_API_URL}/consultacpe/comprobantes/${cpeId}`;

          const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${tokenResult.token}`, 'Accept': 'application/json' },
            timeout: 30000
          });

          const data = transformarRespuestaAPI(response.data);
          procesados++;
          return { success: true, request: comp, data, cpeId };
        } catch (err) {
          errores++;
          return {
            success: false,
            request: comp,
            error: err.response?.data?.message || err.message,
            data: { estado: 'ERROR', encontrado: false }
          };
        }
      });

      const loteResultados = await Promise.all(promesas);
      resultados.push(...loteResultados);
    }

    return res.json({
      success: true,
      resultados,
      procesados,
      errores,
      total: listaComprobantes.length,
      method: 'API'
    });

  } catch (error) {
    logger.error('[CPE API Masivo] Error:', error.message);
    return res.json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// DESCARGAS via API CPE
// ═══════════════════════════════════════════
router.post('/descargar-pdf', async (req, res) => {
  try {
    const { rucConsultante, cpe } = req.body;
    if (!rucConsultante || !cpe) return res.json({ success: false, error: 'Faltan datos' });

    const creds = await obtenerCredencialesSOL(rucConsultante);
    if (!creds.success) return res.json(creds);

    const tokenService = getTokenService();
    const tokenResult = await tokenService.obtenerToken(rucConsultante, creds.data);
    if (!tokenResult.success) return res.json(tokenResult);

    const digito = '2'; // recibido por defecto
    const cpeId = `${cpe.rucEmisor}-${cpe.tipoDoc || '01'}-${cpe.serie}-${cpe.numero}-${digito}`;
    const url = `${CPE_API_URL}/consultacpe/comprobantes/${cpeId}/pdf`;

    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${tokenResult.token}`, 'Accept': 'application/pdf' },
      responseType: 'arraybuffer',
      timeout: 60000
    });

    // Guardar archivo
    const userStorageManager = require('../services/userStorageManager');
    let downloadDir = path.join(process.cwd(), 'descargas_cpe', rucConsultante);
    if (userStorageManager && userStorageManager.isInitialized()) {
      downloadDir = path.join(userStorageManager.getUserFolderPath('downloads'), rucConsultante);
    }
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    const filePath = path.join(downloadDir, `${cpe.rucEmisor}-${cpe.tipoDoc || '01'}-${cpe.serie}-${cpe.numero}.pdf`);
    fs.writeFileSync(filePath, response.data);

    return res.json({ success: true, path: filePath });
  } catch (error) {
    logger.error('[CPE API] Error descargando PDF:', error.message);
    return res.json({ success: false, error: error.message });
  }
});

router.post('/descargar-xml', async (req, res) => {
  try {
    const { rucConsultante, cpe } = req.body;
    if (!rucConsultante || !cpe) return res.json({ success: false, error: 'Faltan datos' });

    const creds = await obtenerCredencialesSOL(rucConsultante);
    if (!creds.success) return res.json(creds);

    const tokenService = getTokenService();
    const tokenResult = await tokenService.obtenerToken(rucConsultante, creds.data);
    if (!tokenResult.success) return res.json(tokenResult);

    const digito = '2';
    const cpeId = `${cpe.rucEmisor}-${cpe.tipoDoc || '01'}-${cpe.serie}-${cpe.numero}-${digito}`;
    const url = `${CPE_API_URL}/consultacpe/comprobantes/${cpeId}/xml`;

    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${tokenResult.token}`, 'Accept': 'application/xml' },
      responseType: 'arraybuffer',
      timeout: 60000
    });

    const userStorageManager = require('../services/userStorageManager');
    let downloadDir = path.join(process.cwd(), 'descargas_cpe', rucConsultante);
    if (userStorageManager && userStorageManager.isInitialized()) {
      downloadDir = path.join(userStorageManager.getUserFolderPath('downloads'), rucConsultante);
    }
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    const filePath = path.join(downloadDir, `${cpe.rucEmisor}-${cpe.tipoDoc || '01'}-${cpe.serie}-${cpe.numero}.xml`);
    fs.writeFileSync(filePath, response.data);

    return res.json({ success: true, path: filePath });
  } catch (error) {
    logger.error('[CPE API] Error descargando XML:', error.message);
    return res.json({ success: false, error: error.message });
  }
});

router.post('/descargar-cdr', async (req, res) => {
  return res.json({ success: false, error: 'CDR no disponible via API. Use la descarga manual.' });
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

  // Build Cookie header with relaxed domain matching (e.g. sunat.gob.pe matches subdomains)
  const matchedCookies = session.cookies.filter(c => {
    let cookieDomain = c.domain.toLowerCase();
    const reqDomain = targetDomain.toLowerCase();
    
    if (!cookieDomain.startsWith('.')) {
      cookieDomain = '.' + cookieDomain;
    }
    
    const domainMatches = reqDomain.endsWith(cookieDomain) || reqDomain === cookieDomain.substring(1);
    
    // Path check
    const cookiePath = c.path || '/';
    const targetPath = '/' + pathSuffix;
    const pathMatches = targetPath.startsWith(cookiePath);
    
    return domainMatches && pathMatches;
  });
  
  const cookieHeader = matchedCookies.map(c => `${c.name}=${c.value}`).join('; ');

  logger.info(`[Proxy Request] ${req.method} -> ${targetUrl}`);
  logger.info(`[Proxy Cookies] Total: ${session.cookies.length}, Match: ${matchedCookies.length}`);
  logger.info(`[Proxy Match Names] ${matchedCookies.map(c => `${c.name}(${c.domain})`).join(', ')}`);

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
