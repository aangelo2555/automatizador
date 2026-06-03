/**
 * API Bridge - Replaces window.electronAPI for web environment
 * 
 * This module intercepts all calls that the React components make to
 * window.electronAPI and redirects them to the Express REST API.
 * 
 * The bridge is injected as window.electronAPI at app startup,
 * making the migration transparent to all existing components.
 */

const API_BASE = '/api';

// Get stored JWT token
function getToken() {
  return localStorage.getItem('authToken') || '';
}

// Set JWT token
function setToken(token) {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
}

// Generic fetch helper with auth headers
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  };
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[API Bridge] Error in ${endpoint}:`, error);
    return { success: false, error: error.message || 'Error de conexión con el servidor' };
  }
}

// Generic IPC invoke bridge (for channels not covered by dedicated routes)
async function ipcInvoke(channel, ...args) {
  return apiFetch(`/ipc/${channel}`, {
    method: 'POST',
    body: JSON.stringify({ args })
  });
}

// ══════════════════════════════════════════════════
//  ELECTRON API BRIDGE OBJECT
// ══════════════════════════════════════════════════

const electronAPIBridge = {
  // ─── Generic invoke (used by clientService.js etc.) ───
  invoke: async (channel, ...args) => {
    if (typeof electronAPIBridge[channel] === 'function') {
      return electronAPIBridge[channel](...args);
    }
    const camelKey = channel.replace(/[:\-_]([a-z])/g, (g) => g[1].toUpperCase());
    if (typeof electronAPIBridge[camelKey] === 'function') {
      return electronAPIBridge[camelKey](...args);
    }
    return ipcInvoke(channel, ...args);
  },
  
  // ─── Event listeners (no-op in web - no push events) ───
  on: (channel, func) => { /* No-op: web uses polling instead */ },
  onLoginStarted: (callback) => {},
  onLoginCompleted: (callback) => {},
  onLoginProcessCompleted: (callback) => {},
  onBuzonProgreso: (callback) => {},
  onZoomChanged: (callback) => {},
  removeAllListeners: (channel) => {},

  // ═══════════════════════════════
  //  AUTH
  // ═══════════════════════════════
  authLogin: async (credentials) => {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (result.success && result.token) {
      setToken(result.token);
    }
    return result;
  },

  authRegister: async (userData) => {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  authLogout: async () => {
    setToken(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userPlan');
    return { success: true };
  },

  authGetRecentEmails: async () => {
    return apiFetch('/auth/recent-emails');
  },

  authCheckFlag: async () => {
    const token = getToken();
    if (!token) return { success: true, authenticated: false };
    return apiFetch('/auth/verify');
  },

  // ═══════════════════════════════
  //  CLIENTS
  // ═══════════════════════════════
  getClients: async (filePath) => {
    return apiFetch('/clients');
  },
  
  selectExcelFile: async () => {
    // In web, we use file upload instead
    return { success: false, error: 'Use el módulo de subida de archivos' };
  },

  createExampleFile: async (filePath) => {
    return { success: false, error: 'No disponible en versión web' };
  },

  // ═══════════════════════════════
  //  LOGIN SUNAT
  // ═══════════════════════════════
  startLogins: async (data) => {
    return apiFetch('/boleta/login/start', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  stopAllSessions: async () => {
    return apiFetch('/boleta/login/stop', { method: 'POST' });
  },

  getActiveSessions: async () => {
    return apiFetch('/boleta/login/sessions');
  },

  // ═══════════════════════════════
  //  CONFIG
  // ═══════════════════════════════
  getConfig: async () => {
    return apiFetch('/config');
  },

  // ═══════════════════════════════
  //  SIRE
  // ═══════════════════════════════
  abrirExcelSire: async () => {
    return apiFetch('/sire/abrir-excel', { method: 'POST' });
  },

  ejecutarSire: async (datos) => {
    return apiFetch('/sire/ejecutar', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  listarArchivosSire: async () => {
    return apiFetch('/sire/archivos');
  },

  abrirArchivoSire: async (nombreArchivo) => {
    return apiFetch('/sire/archivos/abrir', {
      method: 'POST',
      body: JSON.stringify({ nombreArchivo })
    });
  },

  eliminarArchivoSire: async (nombreArchivo) => {
    return apiFetch(`/sire/archivos/${encodeURIComponent(nombreArchivo)}`, {
      method: 'DELETE'
    });
  },

  // SIRE AJUSTES
  abrirSireAjustes: async () => {
    return apiFetch('/sire/ajustes/abrir', { method: 'POST' });
  },

  // ═══════════════════════════════
  //  BUZÓN ELECTRÓNICO
  // ═══════════════════════════════
  buzonObtenerClientes: async () => {
    return apiFetch('/buzon/clientes');
  },

  buzonConsultar: async (datos) => {
    return apiFetch('/buzon/consultar', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  buzonDescargarAdjunto: async (datos) => {
    return apiFetch('/buzon/descargar-adjunto', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  buzonCerrarSesion: async (datos) => {
    return apiFetch('/buzon/cerrar-sesion', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  buzonObtenerSesiones: async () => {
    return apiFetch('/buzon/sesiones');
  },

  buzonListarConstancias: async (datos) => {
    return apiFetch('/buzon/listar-constancias', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  buzonAbrirConstancia: async (datos) => {
    return apiFetch('/buzon/abrir-constancia', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  // ═══════════════════════════════
  //  CPE SCRAPING
  // ═══════════════════════════════
  cpeConsultar: async (datos) => {
    return apiFetch('/cpe/consultar', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  cpeDescargar: async (datos) => {
    const typeMap = { 'pdf': 'descargar-pdf', 'xml': 'descargar-xml', 'cdr': 'descargar-cdr' };
    const endpoint = typeMap[(datos.tipo || '').toLowerCase()];
    if (!endpoint) return { success: false, error: 'Tipo de descarga no válido' };
    return apiFetch(`/cpe/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  // CPE EXCEL
  cpeCargarExcelCliente: async (params) => {
    return apiFetch('/cpe/excel/cargar-cliente', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  cpeLeerHojaExcel: async (params) => {
    return apiFetch('/cpe/excel/leer-hoja', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  cpeAbrirArchivoExcel: async (params) => {
    return apiFetch('/cpe/excel/abrir-archivo', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  cpeListarConstancias: async (params) => ipcInvoke('cpe-listar-constancias', params),
  cpeVisualizarFacturas: async (params) => ipcInvoke('cpe-visualizar-facturas', params),
  cpeEmitirFacturas: async (params) => ipcInvoke('cpe-emitir-facturas', params),

  // ═══════════════════════════════
  //  EMAIL SERVICE
  // ═══════════════════════════════
  emailConfigurar: async ({ user, pass }) => {
    return apiFetch('/email/configurar', { method: 'POST', body: JSON.stringify({ user, pass }) });
  },
  emailEnviar: async (data) => {
    return apiFetch('/email/enviar', { method: 'POST', body: JSON.stringify(data) });
  },
  emailEnviarConAdjuntos: async (data) => {
    return apiFetch('/email/enviar-con-adjuntos', { method: 'POST', body: JSON.stringify(data) });
  },
  emailAlertaFacturas: async (data) => {
    return apiFetch('/email/alerta-facturas', { method: 'POST', body: JSON.stringify(data) });
  },
  emailReporteFacturas: async (data) => {
    return apiFetch('/email/reporte-facturas', { method: 'POST', body: JSON.stringify(data) });
  },
  emailNotificarError: async (data) => {
    return apiFetch('/email/notificar-error', { method: 'POST', body: JSON.stringify(data) });
  },
  getEmailConfig: async () => apiFetch('/email/config'),
  updateEmailConfig: async ({ user, pass }) => {
    return apiFetch('/email/update-config', { method: 'POST', body: JSON.stringify({ user, pass }) });
  },
  testEmailConfig: async ({ user, pass }) => {
    return apiFetch('/email/test-config', { method: 'POST', body: JSON.stringify({ user, pass }) });
  },
  reloadEmailConfig: async () => {
    return apiFetch('/email/reload-config', { method: 'POST' });
  },

  // ═══════════════════════════════
  //  WHATSAPP (DISABLED IN WEB)
  // ═══════════════════════════════
  getWhatsAppStatus: async () => ({ success: true, status: { state: 'DISABLED', message: 'WhatsApp no disponible en versión web' } }),
  initializeWhatsApp: async () => ({ success: false, error: 'WhatsApp no disponible en versión web' }),
  getWhatsAppQR: async () => ({ success: false, error: 'WhatsApp no disponible en versión web' }),
  sendWhatsAppMessage: async () => ({ success: false, error: 'WhatsApp no disponible en versión web' }),
  sendWhatsAppFile: async () => ({ success: false, error: 'WhatsApp no disponible en versión web' }),
  logoutWhatsApp: async () => ({ success: true }),
  sendWhatsAppTest: async () => ({ success: false, error: 'WhatsApp no disponible en versión web' }),
  sendWhatsAppFileBatch: async () => ({ success: false, error: 'WhatsApp no disponible en versión web' }),
  clearWhatsAppSession: async () => ({ success: true }),
  onWhatsAppQR: () => {},
  onWhatsAppReady: () => {},
  onWhatsAppDisconnected: () => {},
  onWhatsAppAuthFailure: () => {},
  onWhatsAppStateChanged: () => {},
  onWhatsAppError: () => {},
  onWhatsAppLoading: () => {},
  onWhatsAppBatchProgress: () => {},

  // ═══════════════════════════════
  //  BOLETA
  // ═══════════════════════════════
  boletaConfigSave: async ({ ruc, config }) => ipcInvoke('boleta-config:save', { ruc, config }),
  boletaConfigLoad: async ({ ruc }) => ipcInvoke('boleta-config:load', { ruc }),
  boletaConfigList: async () => ipcInvoke('boleta-config:list'),
  boletaConfigDelete: async ({ ruc }) => ipcInvoke('boleta-config:delete', { ruc }),

  // ═══════════════════════════════
  //  PDF & EXCEL
  // ═══════════════════════════════
  'pdf:merge-files': async (data) => {
    return apiFetch('/boleta/pdf/merge', { method: 'POST', body: JSON.stringify(data) });
  },
  'excel:get-sheets': async (filePath) => {
    return apiFetch('/boleta/excel/get-sheets', { method: 'POST', body: JSON.stringify({ filePath }) });
  },
  'excel:read-sheet': async (data) => {
    return apiFetch('/boleta/excel/read-sheet', { method: 'POST', body: JSON.stringify(data) });
  },
};

// ══════════════════════════════════════════════════
//  INJECT THE BRIDGE
// ══════════════════════════════════════════════════

console.log('[API Bridge] 🌐 Entorno Web detectado. Inyectando puente de API.');
window.electronAPI = electronAPIBridge;

export default electronAPIBridge;
export { getToken, setToken, apiFetch };
