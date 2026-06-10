/**
 * CPE Token Service
 * Obtiene y cachea tokens JWT de SUNAT para la API CPE
 * 
 * Flujo:
 * 1. Login SOL via Playwright (RUC + usuario + clave)
 * 2. Navegar a e-factura (app Angular de SUNAT)
 * 3. Interceptar el Bearer token de las requests a api-cpe.sunat.gob.pe
 * 4. Cachear token (~1 hora de vida)
 * 5. Cerrar browser inmediatamente
 * 
 * NO requiere client_id / client_secret del usuario.
 * El token es generado internamente por SUNAT al hacer login SOL.
 */

const { chromium } = require('playwright');
const logger = require('./logger');

// Cache de tokens por RUC: { ruc: { token, expiresAt, rucConsultante } }
const tokenCache = new Map();

// Lock para evitar logins simultáneos por el mismo RUC
const loginLocks = new Map();

/**
 * Obtiene un token JWT para la API CPE de SUNAT
 * Si hay un token cacheado válido, lo reutiliza.
 * Si no, hace login SOL + intercepta el JWT.
 * 
 * @param {string} ruc - RUC del consultante
 * @param {Object} credenciales - { usuario_sol, clave_sol }
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
async function obtenerToken(ruc, credenciales) {
  // 1. Verificar cache
  const cached = tokenCache.get(ruc);
  if (cached && cached.expiresAt > Date.now() + 60000) { // 1 min de margen
    logger.info(`[CPE Token] Token cacheado válido para RUC ${ruc}`);
    return { success: true, token: cached.token };
  }

  // 2. Verificar si ya hay un login en proceso para este RUC
  if (loginLocks.has(ruc)) {
    logger.info(`[CPE Token] Esperando login en proceso para RUC ${ruc}...`);
    try {
      const result = await loginLocks.get(ruc);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 3. Iniciar login + interceptación
  const loginPromise = _loginYCapturarToken(ruc, credenciales);
  loginLocks.set(ruc, loginPromise);

  try {
    const result = await loginPromise;
    return result;
  } finally {
    loginLocks.delete(ruc);
  }
}

/**
 * Guarda una captura de pantalla de error en la carpeta dist/screenshots
 * para poder visualizarla vía web desde /screenshots/name.png
 */
/**
 * Guarda una captura de pantalla de error en la carpeta dist/screenshots
 * y escribe metadatos (URL, HTML, y los últimos logs del servidor) en archivos públicos para depuración.
 */
async function guardarScreenshotError(page, name) {
  if (!page) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const distPath = path.join(process.cwd(), 'dist');
    const screenshotsDir = path.join(distPath, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotsDir, name);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const currentUrl = page.url();
    let htmlContent = '';
    try {
      htmlContent = await page.content();
    } catch (e) {
      htmlContent = `No se pudo obtener el html: ${e.message}`;
    }

    const infoName = name.replace('.png', '_info.txt');
    const infoPath = path.join(screenshotsDir, infoName);
    const logInfo = `URL: ${currentUrl}\n\nHTML Content (primeros 5000 chars):\n${htmlContent.substring(0, 5000)}`;
    fs.writeFileSync(infoPath, logInfo, 'utf-8');

    let logContent = '';
    try {
      const logFile = path.join(process.cwd(), 'logs', 'automatizador.log');
      if (fs.existsSync(logFile)) {
        const fullLogs = fs.readFileSync(logFile, 'utf-8');
        const lines = fullLogs.split('\n');
        logContent = lines.slice(-150).join('\n');
      } else {
        logContent = 'Log file not found';
      }
    } catch (e) {
      logContent = `No se pudo leer log: ${e.message}`;
    }

    const logName = name.replace('.png', '_logs.txt');
    const logPath = path.join(screenshotsDir, logName);
    fs.writeFileSync(logPath, logContent, 'utf-8');

    logger.info(`[CPE Token] 📸 Captura guardada en: /screenshots/${name} | Info: /screenshots/${infoName} | Logs: /screenshots/${logName}`);
  } catch (err) {
    logger.error(`[CPE Token] No se pudo guardar captura de pantalla de error: ${err.message}`);
  }
}

/**
 * Cierra las alertas o popups emergentes típicos de SUNAT (buzón, contacto, etc.)
 */
async function bypassAlerts(p) {
  try {
    const selectors = [
      'button:has-text("Continuar")',
      'button:has-text("Aceptar")',
      'button:has-text("Omitir")',
      'input[type="button"][value="Continuar"]',
      'input[type="button"][value="Aceptar"]',
      '#btnContinuar',
      '#btnAceptar',
      'a:has-text("Continuar")',
      'a:has-text("Aceptar")',
      '.modal-footer button'
    ];
    for (const selector of selectors) {
      try {
        const btn = p.locator(selector).first();
        if (await btn.isVisible()) {
          logger.info(`[CPE Token] Cerrando emergente SUNAT con selector: ${selector}`);
          await btn.click();
          await p.waitForTimeout(2000);
        }
      } catch (err) {}
    }
  } catch (err) {
    logger.debug(`[CPE Token] Error cerrando alertas: ${err.message}`);
  }
}

/**
 * Intenta extraer el JWT directamente del sessionStorage o localStorage de la página
 */
async function extraerJWTDesdeStorage(p) {
  try {
    return await p.evaluate(() => {
      const isJWT = (str) => {
        if (typeof str !== 'string') return false;
        if (!str.startsWith('ey') || str.length < 100) return false;
        const parts = str.split('.');
        return parts.length === 3;
      };

      // 1. Buscar en sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const val = sessionStorage.getItem(key);
        if (isJWT(val)) return val;
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
              if (isJWT(parsed[k])) return parsed[k];
            }
          }
        } catch (e) {}
      }

      // 2. Buscar en localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (isJWT(val)) return val;
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
              if (isJWT(parsed[k])) return parsed[k];
            }
          }
        } catch (e) {}
      }
      return null;
    });
  } catch (err) {
    logger.warn(`[CPE Token] Error al extraer JWT desde storage: ${err.message}`);
    return null;
  }
}

/**
 * Login SOL + interceptar JWT de la API CPE
 * @private
 */
async function _loginYCapturarToken(ruc, credenciales) {
  let browser = null;
  let page = null;

  try {
    const { usuario_sol, clave_sol } = credenciales;

    if (!usuario_sol || !clave_sol) {
      return { success: false, error: 'Faltan credenciales SOL (usuario y clave)' };
    }

    logger.info(`[CPE Token] Iniciando login SOL para RUC ${ruc}...`);

    // Lanzar browser headless
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: {
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
      }
    });

    page = await context.newPage();

    // Anti-detección (seguro, sin romper navigator.plugins)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Capturar crashes de JS en la página
    page.on('pageerror', exception => {
      logger.error(`[CPE Token Page JS Crash] Error: ${exception.message}`, { stack: exception.stack });
    });

    // Log de mensajes de la consola de la página para depuración
    page.on('console', msg => {
      const txt = msg.text();
      if (msg.type() === 'error' || txt.includes('blocked') || txt.includes('WAF') || txt.includes('failed')) {
        logger.warn(`[CPE Token Page Console] ${msg.type()}: ${txt}`);
      } else {
        logger.info(`[CPE Token Page Console] ${msg.type()}: ${txt}`);
      }
    });

    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(90000);

    // ===== PASO 1: LOGIN SOL =====
    const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
    logger.info('[CPE Token] Navegando al login SOL...');

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // Esperar y validar el selector de RUC
    try {
      await page.waitForSelector('#txtRuc', { timeout: 30000 });
    } catch (selectorErr) {
      logger.error(`[CPE Token] Timeout esperando selector #txtRuc en URL: ${page.url()}`);
      await guardarScreenshotError(page, `error_selector_${ruc}.png`);
      throw selectorErr;
    }

    // Rellenar formulario
    await page.fill('#txtRuc', ruc);
    await page.waitForTimeout(300);
    await page.fill('#txtUsuario', usuario_sol);
    await page.waitForTimeout(300);
    await page.fill('#txtContrasena', clave_sol);
    await page.waitForTimeout(300);

    logger.info('[CPE Token] Enviando login...');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}),
      page.click('#btnAceptar')
    ]);

    await page.waitForTimeout(4000);

    // Intentar cerrar alertas/ventanas emergentes iniciales si las hubiera
    await bypassAlerts(page);

    // Verificar si sigue en la página de login o si hay errores visibles en pantalla
    const errorText = await page.evaluate(() => {
      const el = document.querySelector('.error, #errorMensaje, .alert-danger, [id*="error"]');
      return el ? el.innerText.trim() : null;
    });

    if (errorText) {
      logger.error(`[CPE Token] Mensaje de error detectado en login: "${errorText}"`);
      await guardarScreenshotError(page, `error_login_${ruc}.png`);
      return { success: false, error: `Error en login SUNAT: ${errorText}` };
    }

    // Verificar OAuth redirect
    let currentUrl = page.url();
    if (currentUrl.includes('api-seguridad')) {
      logger.info('[CPE Token] Redirect OAuth detectado, navegando al menú...');
      await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await page.waitForTimeout(3000);
    }

    logger.info('[CPE Token] Login SOL exitoso');

    // ===== PASO 2: CONFIGURAR INTERCEPTACIÓN DE RED =====
    let capturedToken = null;

    // Escuchar todas las requests para capturar Bearer token
    page.on('request', (request) => {
      const authHeader = request.headers()['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token.length > 100) {
          capturedToken = token;
          logger.info(`[CPE Token] ✅ Token JWT capturado de cabecera! (${token.length} chars)`);
        }
      }
    });

    // Intercepta todas las respuestas JSON con access_token
    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          const text = await response.text();
          if (text.includes('access_token')) {
            const data = JSON.parse(text);
            if (data.access_token && data.access_token.length > 100) {
              capturedToken = data.access_token;
              logger.info(`[CPE Token] ✅ Token capturado de respuesta JSON! (${data.access_token.length} chars)`);
            }
          }
        } catch (e) {
          // Ignorar no JSON
        }
      }
    });

    // ===== PASO 3: NAVEGAR A E-FACTURA =====
    logger.info('[CPE Token] Navegando al módulo de consulta CPE...');
    
    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);
    await bypassAlerts(page);

    // Navegar al portal CPE Angular
    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
    logger.info('[CPE Token] Navegando a e-factura Angular...');
    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

    // Esperar a que la app Angular cargue y haga sus requests de inicialización
    try {
      logger.info('[CPE Token] Esperando que carguen los elementos de e-factura Angular...');
      await page.waitForSelector('input[name="rucEmisor"], input[formcontrolname="rucEmisor"], p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 15000 });
      logger.info('[CPE Token] Elementos Angular cargados');
    } catch (err) {
      logger.warn(`[CPE Token] Timeout esperando carga de elementos Angular: ${err.message}`);
    }
    await bypassAlerts(page);

    // Tratar de extraer directamente de sessionStorage / localStorage
    if (!capturedToken) {
      capturedToken = await extraerJWTDesdeStorage(page);
      if (capturedToken) {
        logger.info(`[CPE Token] ✅ Token JWT obtenido de sessionStorage/localStorage!`);
      }
    }

    // Si aún no se captura el token, forzar una consulta mock/búsqueda para disparar el endpoint
    if (!capturedToken) {
      logger.info('[CPE Token] Token no capturado pasivamente. Ejecutando consulta mock para forzar request...');
      try {
        const rucInput = page.locator('input[name="rucEmisor"], input[formcontrolname="rucEmisor"]').first();
        if (await rucInput.isVisible()) {
          await rucInput.fill('20607032514');
          await page.waitForTimeout(500);

          const searchBtn = page.locator('button[type="submit"], button:has-text("Buscar"), button:has-text("Consultar")').first();
          if (await searchBtn.isVisible()) {
            await searchBtn.click();
            logger.info('[CPE Token] Consulta mock enviada, esperando token de red...');
            await page.waitForTimeout(5000);
          }
        }
      } catch (err) {
        logger.warn(`[CPE Token] Error en consulta mock para forzar token: ${err.message}`);
      }
    }

    // ===== PASO 4: VALIDAR Y CACHEAR =====
    if (!capturedToken) {
      logger.error('[CPE Token] ❌ No se pudo capturar el token JWT');
      await guardarScreenshotError(page, `error_token_not_found_${ruc}.png`);
      return {
        success: false,
        error: `No se pudo obtener el token de SUNAT. Verifique las credenciales SOL. Captura guardada en /screenshots/error_token_not_found_${ruc}.png`
      };
    }

    // Decodificar JWT para obtener expiración
    let expiresAt = Date.now() + 3600000; // Default 1 hora
    try {
      const payload = JSON.parse(Buffer.from(capturedToken.split('.')[1], 'base64').toString());
      if (payload.exp) {
        expiresAt = payload.exp * 1000;
      }
      logger.info(`[CPE Token] Token expira en ${Math.round((expiresAt - Date.now()) / 60000)} minutos`);
    } catch (e) {
      logger.warn('[CPE Token] No se pudo decodificar JWT, usando expiración por defecto (1h)');
    }

    // Guardar en cache
    tokenCache.set(ruc, {
      token: capturedToken,
      expiresAt,
      rucConsultante: ruc,
      capturedAt: Date.now()
    });

    logger.info(`[CPE Token] ✅ Token cacheado exitosamente para RUC ${ruc}`);

    return { success: true, token: capturedToken };

  } catch (error) {
    logger.error('[CPE Token] Error en login/interceptación:', {
      error: error.message,
      stack: error.stack
    });

    if (page) {
      await guardarScreenshotError(page, `exception_${ruc}.png`);
    }

    return {
      success: false,
      error: `Error al obtener token: ${error.message}. Captura guardada en /screenshots/exception_${ruc}.png`
    };
  } finally {
    // ===== SIEMPRE CERRAR BROWSER =====
    if (browser) {
      try {
        await browser.close();
        logger.info('[CPE Token] Browser cerrado');
      } catch (e) {
        logger.warn('[CPE Token] Error cerrando browser:', e.message);
      }
    }
  }
}

/**
 * Invalida el token cacheado para un RUC
 */
function invalidarToken(ruc) {
  tokenCache.delete(ruc);
  logger.info(`[CPE Token] Token invalidado para RUC ${ruc}`);
}

/**
 * Verifica si hay un token válido cacheado
 */
function tieneTokenValido(ruc) {
  const cached = tokenCache.get(ruc);
  return cached && cached.expiresAt > Date.now() + 60000;
}

/**
 * Obtiene info del token cacheado (para debug)
 */
function getTokenInfo(ruc) {
  const cached = tokenCache.get(ruc);
  if (!cached) return null;
  return {
    ruc: cached.rucConsultante,
    capturedAt: new Date(cached.capturedAt).toISOString(),
    expiresAt: new Date(cached.expiresAt).toISOString(),
    remainingMinutes: Math.round((cached.expiresAt - Date.now()) / 60000),
    isValid: cached.expiresAt > Date.now() + 60000
  };
}

module.exports = {
  obtenerToken,
  invalidarToken,
  tieneTokenValido,
  getTokenInfo
};
