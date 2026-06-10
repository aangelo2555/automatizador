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
    logger.info(`[CPE Token] 📸 Captura de pantalla de error guardada en: /screenshots/${name}`);
  } catch (err) {
    logger.error(`[CPE Token] No se pudo guardar captura de pantalla de error: ${err.message}`);
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

    // Anti-detección
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    // Log de mensajes de la consola de la página para depuración
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('blocked') || msg.text().includes('WAF')) {
        logger.warn(`[CPE Token Page Console] ${msg.type()}: ${msg.text()}`);
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

    // ===== PASO 2: INTERCEPTAR TOKEN =====
    let capturedToken = null;

    // Escuchar requests a api-cpe.sunat.gob.pe para capturar el Bearer token
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('api-cpe.sunat.gob.pe') || url.includes('api-seguridad.sunat.gob.pe')) {
        const authHeader = request.headers()['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          if (token.length > 100) { // JWT válido suele ser largo
            capturedToken = token;
            logger.info(`[CPE Token] ✅ Token JWT capturado! (${token.length} chars)`);
          }
        }
      }
    });

    // Intercepta respuestas que contengan access_token
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('oauth2/token') && response.status() === 200) {
        try {
          const data = await response.json();
          if (data.access_token) {
            capturedToken = data.access_token;
            logger.info(`[CPE Token] ✅ Token capturado desde respuesta OAuth! (${data.access_token.length} chars)`);
          }
        } catch (e) {
          // Ignorar respuestas no JSON
        }
      }
    });

    // ===== PASO 3: NAVEGAR A E-FACTURA =====
    logger.info('[CPE Token] Navegando al módulo de consulta CPE...');
    
    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);

    // Navegar al portal CPE Angular
    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
    logger.info('[CPE Token] Navegando a e-factura Angular...');
    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

    // Esperar a que la app Angular cargue y haga sus requests de inicialización
    await page.waitForTimeout(6000);

    // Si aún no capturamos el token, esperar un poco más
    if (!capturedToken) {
      logger.info('[CPE Token] Token no capturado aún, esperando más...');
      await page.waitForTimeout(6000);
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
