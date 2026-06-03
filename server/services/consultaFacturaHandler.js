/**
 * Handler para Consulta Integrada de Comprobantes SUNAT
 * Implementa OAuth2 y validaciÃ³n de comprobantes via API SUNAT
 * Lee credenciales desde API_SIRE.xlsm
 */

const axios = require('axios');
// [WEB] Electron removed
const shell = { openPath: (p) => Promise.resolve() };
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const excelReader = require('./excelReader');

// URLs de la API SUNAT
const AUTH_URL = 'https://api-seguridad.sunat.gob.pe/v1';
const VALIDAR_URL_TEMPLATE = 'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/{ruc}/validarcomprobante';
const CPE_API_URL = 'https://api-cpe.sunat.gob.pe/v1/contribuyente';

// Cache de tokens
let tokenCache = {};

// CÃ³digos de estado segÃºn manual SUNAT
const ESTADO_CP = {
  '0': 'NO EXISTE',
  '1': 'ACEPTADO',
  '2': 'ANULADO',
  '3': 'AUTORIZADO',
  '4': 'NO AUTORIZADO'
};

const ESTADO_RUC = {
  '00': 'ACTIVO',
  '01': 'BAJA PROVISIONAL',
  '02': 'BAJA PROV. POR OFICIO',
  '03': 'SUSPENSION TEMPORAL',
  '10': 'BAJA DEFINITIVA',
  '11': 'BAJA DE OFICIO',
  '22': 'INHABILITADO-VENT.UNICA'
};

const COND_DOMI_RUC = {
  '00': 'HABIDO',
  '09': 'PENDIENTE',
  '11': 'POR VERIFICAR',
  '12': 'NO HABIDO',
  '20': 'NO HALLADO'
};

const TIPOS_COMPROBANTE = {
  '01': 'Factura',
  '03': 'Boleta de Venta',
  '04': 'LiquidaciÃ³n de Compra',
  '07': 'Nota de CrÃ©dito',
  '08': 'Nota de DÃ©bito',
  'R1': 'Recibo por Honorarios',
  'R7': 'Recibo por Honorarios - Nota de CrÃ©dito'
};

/**
 * Obtiene las empresas/credenciales desde API_SIRE.xlsm
 */
async function obtenerEmpresasDesdeExcel() {
  try {
    const clientStorage = require('./clientStorageService');
    if (clientStorage && clientStorage.currentUserId) {
      const clients = clientStorage.getAllClients();
      const empresasConCredenciales = clients.filter(c =>
        c.clienteId && c.clienteSecret && c.ruc
      ).map(c => ({
        ruc: c.ruc,
        razonSocial: c.empresa,
        usuario_sol: c.usuario,
        clave_sol: c.clave,
        client_id: c.clienteId,
        client_secret: c.clienteSecret
      }));
      return {
        success: true,
        empresas: empresasConCredenciales
      };
    }
    const facturasPath = path.join(process.cwd(), 'server', 'data', 'API_SIRE.xlsm');

    if (!fs.existsSync(facturasPath)) {
      return {
        success: false,
        error: 'No se encontrÃ³ el archivo API_SIRE.xlsm en la carpeta data/',
        empresas: []
      };
    }

    const clientes = await excelReader.readClients(facturasPath);

    // Filtrar solo los que tienen credenciales OAuth2 completas
    const empresasConCredenciales = clientes.filter(c =>
      c.client_id && c.client_secret && c.ruc
    ).map(c => ({
      ruc: c.ruc,
      razonSocial: c.empresa,
      usuario_sol: c.usuario_sol,
      clave_sol: c.clave_sol,
      client_id: c.client_id,
      client_secret: c.client_secret
    }));

    return {
      success: true,
      empresas: empresasConCredenciales
    };

  } catch (error) {
    logger.error('Error al leer empresas desde Excel', { error: error.message });
    return {
      success: false,
      error: error.message,
      empresas: []
    };
  }
}

/**
 * Obtiene credenciales de una empresa especÃ­fica por RUC
 * Valida que tenga todos los campos necesarios (igual que SIRE)
 */
async function obtenerCredencialesPorRuc(ruc) {
  try {
    const clientStorage = require('./clientStorageService');
    if (clientStorage && clientStorage.currentUserId) {
      const cliente = clientStorage.getClient(ruc);
      if (cliente) {
        return {
          success: true,
          data: {
            ruc: cliente.ruc,
            razonSocial: cliente.empresa,
            usuario_sol: cliente.usuario,
            clave_sol: cliente.clave,
            client_id: cliente.clienteId,
            client_secret: cliente.clienteSecret
          }
        };
      }
    }
    const facturasPath = path.join(process.cwd(), 'server', 'data', 'API_SIRE.xlsm');

    if (!fs.existsSync(facturasPath)) {
      return {
        success: false,
        error: 'No se encontrÃ³ el archivo API_SIRE.xlsm'
      };
    }

    const clientes = await excelReader.readClients(facturasPath);
    const cliente = clientes.find(c => c.ruc === ruc);

    if (!cliente) {
      return {
        success: false,
        error: `No se encontraron credenciales para el RUC ${ruc} en API_SIRE.xlsm`
      };
    }

    // Validar todos los campos requeridos (igual que SIRE)
    const camposRequeridos = ['usuario_sol', 'clave_sol', 'client_id', 'client_secret'];
    const camposFaltantes = camposRequeridos.filter(campo => !cliente[campo]);

    if (camposFaltantes.length > 0) {
      return {
        success: false,
        error: `Faltan campos en API_SIRE.xlsm para el RUC ${ruc}: ${camposFaltantes.join(', ').toUpperCase()}`
      };
    }

    return {
      success: true,
      data: {
        ruc: cliente.ruc,
        razonSocial: cliente.empresa,
        usuario_sol: cliente.usuario_sol,
        clave_sol: cliente.clave_sol,
        client_id: cliente.client_id,
        client_secret: cliente.client_secret
      }
    };

  } catch (error) {
    logger.error('Error al obtener credenciales', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Obtiene token OAuth2 para SIRE (grant_type: password) - usado para test
 */
async function getTokenSire(credentials) {
  const { ruc, usuario_sol, clave_sol, client_id, client_secret } = credentials;

  const cacheKey = `token_sire_${ruc}`;
  const cached = tokenCache[cacheKey];

  if (cached && cached.expiresAt > Date.now() + 60000) {
    logger.info('Usando token SIRE cacheado');
    return { success: true, token: cached.access_token };
  }

  try {
    const url = `${AUTH_URL}/clientessol/${client_id}/oauth2/token/`;

    const params = new URLSearchParams({
      grant_type: 'password',
      scope: 'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes',
      client_id: client_id,
      client_secret: client_secret,
      username: `${ruc}${usuario_sol}`,
      password: clave_sol
    });

    logger.info('Solicitando token SIRE (password grant)', { ruc, usuario_sol });

    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;

    tokenCache[cacheKey] = {
      access_token: token,
      expiresAt: Date.now() + (expiresIn * 1000)
    };

    logger.info('Token SIRE obtenido exitosamente', { expiresIn });
    return { success: true, token, expiresIn };

  } catch (error) {
    logger.error('Error al obtener token SIRE', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    let errorMsg = 'Error al obtener token';
    if (error.response?.data?.error_description) {
      errorMsg = error.response.data.error_description;
    } else if (error.response?.status === 400) {
      errorMsg = 'Credenciales invÃ¡lidas';
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Obtiene token OAuth2 para Consulta de Comprobantes (grant_type: client_credentials)
 * SegÃºn manual SUNAT: usa clientesextranet con client_credentials
 */
async function getToken(credentials) {
  const { ruc, client_id, client_secret } = credentials;

  const cacheKey = `token_consulta_${ruc}`;
  const cached = tokenCache[cacheKey];

  if (cached && cached.expiresAt > Date.now() + 60000) {
    logger.info('Usando token de consulta cacheado');
    return { success: true, token: cached.access_token };
  }

  try {
    // SegÃºn manual: clientesextranet con client_credentials
    const url = `${AUTH_URL}/clientesextranet/${client_id}/oauth2/token/`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes',
      client_id: client_id,
      client_secret: client_secret
    });

    logger.info('Solicitando token para consulta (client_credentials)', { ruc, client_id });

    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;

    tokenCache[cacheKey] = {
      access_token: token,
      expiresAt: Date.now() + (expiresIn * 1000)
    };

    logger.info('Token de consulta obtenido exitosamente', { expiresIn });
    return { success: true, token, expiresIn };

  } catch (error) {
    logger.error('Error al obtener token de consulta', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    let errorMsg = 'Error al obtener token';
    if (error.response?.data?.error_description) {
      errorMsg = error.response.data.error_description;
    } else if (error.response?.status === 400) {
      const errorData = error.response?.data;
      if (errorData?.error === 'unauthorized_client') {
        errorMsg = 'Cliente no autorizado para consulta de comprobantes. Debe crear una aplicaciÃ³n especÃ­fica en SOL para este servicio.';
      } else {
        errorMsg = 'Credenciales invÃ¡lidas. Verifique CLIENTE_ID y CLIENTE_SECRET';
      }
    } else if (error.response?.status === 401) {
      errorMsg = 'Credenciales invÃ¡lidas';
    } else if (error.code === 'ECONNABORTED') {
      errorMsg = 'Timeout: No se pudo conectar con SUNAT';
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Obtiene token OAuth2 para API CPE (consulta y descarga de comprobantes)
 * Scope: https://api-cpe.sunat.gob.pe
 */
async function getTokenCPE(credentials) {
  const { ruc, usuario_sol, clave_sol, client_id, client_secret } = credentials;

  const cacheKey = `token_cpe_${ruc}`;
  const cached = tokenCache[cacheKey];

  if (cached && cached.expiresAt > Date.now() + 60000) {
    logger.info('Usando token CPE cacheado');
    return { success: true, token: cached.access_token };
  }

  try {
    const url = `${AUTH_URL}/clientessol/${client_id}/oauth2/token/`;

    const params = new URLSearchParams({
      grant_type: 'password',
      scope: 'https://api-cpe.sunat.gob.pe',
      client_id: client_id,
      client_secret: client_secret,
      username: `${ruc}${usuario_sol}`,
      password: clave_sol
    });

    logger.info('Solicitando token CPE (password grant)', { ruc, usuario_sol });

    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;

    tokenCache[cacheKey] = {
      access_token: token,
      expiresAt: Date.now() + (expiresIn * 1000)
    };

    logger.info('Token CPE obtenido exitosamente', { expiresIn });
    return { success: true, token, expiresIn };

  } catch (error) {
    logger.error('Error al obtener token CPE', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    let errorMsg = 'Error al obtener token CPE';
    if (error.response?.data?.error_description) {
      errorMsg = error.response.data.error_description;
    } else if (error.response?.status === 400) {
      errorMsg = 'Credenciales invÃ¡lidas';
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Consulta un CPE desde la API CPE de SUNAT
 * @param {Object} credentials - Credenciales del usuario
 * @param {Object} params - ParÃ¡metros de consulta (rucEmisor, tipoDoc, serie, numero, filtro)
 */
async function consultarCPE(credentials, { rucEmisor, tipoDoc, serie, numero, filtro = 'recibido' }) {
  const tokenResult = await getTokenCPE(credentials);
  if (!tokenResult.success) {
    return tokenResult;
  }

  try {
    // Build CPE ID: RUC-TIPO-SERIE-NUMERO-DIGITO (1=emitido, 2=recibido)
    const digito = filtro === 'emitido' ? '1' : '2';
    const cpeId = `${rucEmisor}-${tipoDoc}-${serie}-${numero}-${digito}`;

    const url = `${CPE_API_URL}/consultacpe/comprobantes/${cpeId}`;

    logger.info('Consultando CPE', { cpeId, url });

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    return {
      success: true,
      data: response.data,
      cpeId: cpeId
    };

  } catch (error) {
    logger.error('Error al consultar CPE', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    let errorMsg = error.response?.data?.message || 'Error al consultar comprobante';
    if (error.response?.status === 404) {
      errorMsg = 'Comprobante no encontrado';
    } else if (error.response?.status === 401) {
      errorMsg = 'No autorizado. Verifique sus credenciales.';
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Descarga PDF de un CPE
 * @param {Object} credentials - Credenciales del usuario
 * @param {string} cpeId - ID del CPE (RUC-TIPO-SERIE-NUMERO-DIGITO)
 * @param {string} outputPath - Ruta donde guardar el archivo
 */
async function descargarPDF(credentials, cpeId, outputPath) {
  const tokenResult = await getTokenCPE(credentials);
  if (!tokenResult.success) {
    return tokenResult;
  }

  try {
    const url = `${CPE_API_URL}/consultacpe/comprobantes/${cpeId}/pdf`;

    logger.info('Descargando PDF', { cpeId, url });

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Accept': 'application/pdf'
      },
      responseType: 'arraybuffer',
      timeout: 60000
    });

    // Crear directorio si no existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, response.data);

    logger.info('PDF descargado exitosamente', { outputPath });
    return { success: true, path: outputPath };

  } catch (error) {
    logger.error('Error al descargar PDF', {
      error: error.message,
      status: error.response?.status
    });

    let errorMsg = 'Error al descargar PDF';
    if (error.response?.status === 404) {
      errorMsg = 'PDF no encontrado';
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Descarga XML de un CPE (incluye CDR si estÃ¡ disponible)
 * @param {Object} credentials - Credenciales del usuario
 * @param {string} cpeId - ID del CPE
 * @param {string} outputPath - Ruta donde guardar el archivo
 */
async function descargarXML(credentials, cpeId, outputPath) {
  const tokenResult = await getTokenCPE(credentials);
  if (!tokenResult.success) {
    return tokenResult;
  }

  try {
    const url = `${CPE_API_URL}/consultacpe/comprobantes/${cpeId}/xml`;

    logger.info('Descargando XML', { cpeId, url });

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Accept': 'application/xml'
      },
      responseType: 'arraybuffer',
      timeout: 60000
    });

    // Crear directorio si no existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, response.data);

    logger.info('XML descargado exitosamente', { outputPath });
    return { success: true, path: outputPath };

  } catch (error) {
    logger.error('Error al descargar XML', {
      error: error.message,
      status: error.response?.status
    });

    let errorMsg = 'Error al descargar XML';
    if (error.response?.status === 404) {
      errorMsg = 'XML no encontrado';
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Realiza la consulta HTTP a SUNAT
 */
async function realizarConsultaHTTP(url, bodyJson, token) {
  const response = await axios.post(url, bodyJson, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  const data = response.data;

  return {
    success: true,
    data: {
      ...data.data,
      estadoCpDescripcion: ESTADO_CP[data.data?.estadoCp] || 'DESCONOCIDO',
      estadoRucDescripcion: ESTADO_RUC[data.data?.estadoRuc] || 'DESCONOCIDO',
      condDomiRucDescripcion: COND_DOMI_RUC[data.data?.condDomiRuc] || 'DESCONOCIDO'
    },
    message: data.message,
    observaciones: data.data?.observaciones || []
  };
}

/**
 * Valida un comprobante de pago
 * Intenta primero con client_credentials, si falla usa token SIRE
 */
async function validarComprobante(credentials, bodyJson) {
  const url = VALIDAR_URL_TEMPLATE.replace('{ruc}', credentials.ruc);

  logger.info('Consultando comprobante', {
    rucConsultante: credentials.ruc,
    numRuc: bodyJson.numRuc,
    codComp: bodyJson.codComp,
    serie: bodyJson.numeroSerie,
    numero: bodyJson.numero
  });

  // Intentar primero con client_credentials
  logger.info('Intentando con token client_credentials...');
  const tokenConsulta = await getToken(credentials);

  if (tokenConsulta.success) {
    try {
      logger.info('Enviando request con token client_credentials');
      const resultado = await realizarConsultaHTTP(url, bodyJson, tokenConsulta.token);
      logger.info('Consulta exitosa con client_credentials', { estadoCp: resultado.data?.estadoCp });
      return resultado;
    } catch (error) {
      logger.warn('FallÃ³ con client_credentials, intentando con token SIRE...', {
        status: error.response?.status
      });
    }
  }

  // Si falla, intentar con token SIRE (password grant)
  logger.info('Intentando con token SIRE (password grant)...');
  const tokenSire = await getTokenSire(credentials);

  if (!tokenSire.success) {
    return {
      success: false,
      error: 'No se pudo obtener token. Verifique sus credenciales en API_SIRE.xlsm'
    };
  }

  try {
    logger.info('Enviando request con token SIRE');
    const resultado = await realizarConsultaHTTP(url, bodyJson, tokenSire.token);
    logger.info('Consulta exitosa con token SIRE', { estadoCp: resultado.data?.estadoCp });
    return resultado;
  } catch (error) {
    logger.error('Error al validar comprobante', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    let errorMsg = error.response?.data?.message || 'Error al consultar comprobante';

    if (error.response?.status === 401) {
      errorMsg = 'No autorizado. Las credenciales no tienen permiso para consultar comprobantes. Debe crear una aplicaciÃ³n especÃ­fica en SUNAT SOL.';
    } else if (error.response?.status === 400) {
      errorMsg = error.response?.data?.message || 'Datos invÃ¡lidos. Verifique el formato de los campos';
    } else if (error.response?.status === 403) {
      errorMsg = 'RUC no habilitado para consultas';
    } else if (error.response?.status === 404) {
      errorMsg = 'Comprobante no encontrado o servicio no disponible';
    }

    return {
      success: false,
      error: errorMsg,
      errorCode: error.response?.data?.errorCode,
      details: error.response?.data
    };
  }
}

/**
 * Guarda consulta en historial
 */
function saveToHistory(rucConsultante, comprobante, result) {
  try {
    const historyFile = path.join(process.cwd(), 'server', 'data', 'consulta_history.json');
    let data = { history: [] };

    if (fs.existsSync(historyFile)) {
      data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    }

    data.history.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      rucConsultante,
      comprobante,
      resultado: {
        success: result.success,
        estadoCp: result.data?.estadoCp,
        estadoCpDesc: result.data?.estadoCpDescripcion,
        error: result.error
      }
    });

    // Mantener solo Ãºltimas 100 consultas
    data.history = data.history.slice(0, 100);

    const dir = path.dirname(historyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('Error al guardar historial', { error: error.message });
  }
}

/**
 * Configura los handlers IPC para consulta de facturas
 */
function setupConsultaFacturaIPC() {
  // [WEB] Electron IPC handlers disabled in web mode
}

module.exports = {
  setupConsultaFacturaIPC,
  getToken,
  getTokenCPE,
  validarComprobante,
  consultarCPE,
  descargarPDF,
  descargarXML,
  obtenerEmpresasDesdeExcel,
  obtenerCredencialesPorRuc,
  TIPOS_COMPROBANTE,
  ESTADO_CP,
  ESTADO_RUC,
  COND_DOMI_RUC
};


