const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('./config');

class SunatBot {
  constructor() {
    this.activeBrowsers = new Map();
    this.ensureDirectories();
  }

  /**
   * Asegura que existan los directorios necesarios
   */
  ensureDirectories() {
    const dirs = ['screenshots', 'html'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Realiza login para un cliente especÃ­fico
   * @param {Object} cliente - Datos del cliente
   * @param {string} portalUrl - URL del portal SUNAT
   * @param {Object} opts - Opciones adicionales
   * @returns {Promise<Object>} Resultado del login
   */
  async loginCliente(cliente, portalUrl, opts = {}) {
    const { retries = 2, timeout = config.PLAYWRIGHT.timeout, portalId = null } = opts;
    let lastError = null;

    logger.redactSensitive('Iniciando login para cliente', {
      ruc: cliente.ruc,
      empresa: cliente.empresa,
      usuario: cliente.usuario,
      portalUrl,
      portalId
    });

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const result = await this.attemptLogin(cliente, portalUrl, { timeout, attempt, portalId });

        if (result.success) {
          logger.info('Login exitoso', {
            ruc: cliente.ruc,
            empresa: cliente.empresa,
            attempt,
            browserId: result.browserId
          });
          return result;
        }

        lastError = result.error;

      } catch (error) {
        lastError = error;
        logger.error(`Intento ${attempt} fallido para ${cliente.ruc}`, {
          error: error.message,
          ruc: cliente.ruc
        });

        if (attempt <= retries) {
          logger.info(`Reintentando en 2 segundos... (${attempt}/${retries})`);
          await this.sleep(2000);
        }
      }
    }

    // Todos los intentos fallaron
    await this.captureErrorEvidence(cliente, lastError);

    return {
      success: false,
      error: lastError?.message || 'Error desconocido',
      ruc: cliente.ruc,
      empresa: cliente.empresa
    };
  }

  /**
   * Intenta realizar el login una vez
   * @param {Object} cliente - Datos del cliente
   * @param {string} portalUrl - URL del portal
   * @param {Object} opts - Opciones
   * @returns {Promise<Object>} Resultado del intento
   */
  async attemptLogin(cliente, portalUrl, opts = {}) {
    const { timeout, attempt, portalId } = opts;
    let browser = null;
    let page = null;

    // [WEB] Electron removed

    try {
      // Configurar path del ejecutable si fuera necesario
      let executablePath = undefined;

      // Lanzar navegador
      browser = await chromium.launch({
        headless: config.PLAYWRIGHT.headless,
        slowMo: config.PLAYWRIGHT.slowMo,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        viewport: null,
        executablePath: executablePath
      });

      const browserId = `${cliente.ruc}_${Date.now()}`;
      this.activeBrowsers.set(browserId, browser);
      logger.info(`Browser agregado al Map`, {
        browserId,
        totalBrowsers: this.activeBrowsers.size
      });

      // Crear un contexto explÃ­cito para poder crear mÃºltiples pÃ¡ginas en la misma ventana
      const context = await browser.newContext({ viewport: null });
      page = await context.newPage();

      // Configurar timeouts
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout * 3);

      // Navegar al portal seleccionado - FORZAR CARGA COMPLETA
      logger.info(`Navegando a portal (intento ${attempt})`, {
        ruc: cliente.ruc,
        url: portalUrl,
        portalId
      });

      // Estrategia de navegaciÃ³n robusta
      await this.navigateToPortal(page, portalUrl, timeout);

      // Esperar que la pÃ¡gina estÃ© completamente cargada
      await this.waitForPageReady(page, timeout);

      // Esperar y rellenar campos
      await this.fillLoginForm(page, cliente, timeout);

      // Click ROBUSTO en botÃ³n de login con mÃºltiples estrategias
      await this.clickLoginButton(page, timeout);

      logger.info('Formulario enviado, esperando respuesta', {
        ruc: cliente.ruc
      });

      // Esperar navegaciÃ³n despuÃ©s del login
      await this.waitForLoginSuccess(page, timeout);

      // Verificar si hay errores en la pÃ¡gina
      const hasError = await this.checkForErrors(page);

      if (hasError) {
        throw new Error('Error en credenciales o pÃ¡gina de login');
      }

      // Si es el portal 4 (Emitir Factura), navegar por el menÃº
      if (portalId === 4) {
        logger.info('Portal Emitir Factura detectado, navegando por el menÃº', {
          ruc: cliente.ruc
        });
        await this.navigateToEmitirFactura(page, timeout);
      }

      return {
        success: true,
        message: 'Login exitoso',
        ruc: cliente.ruc,
        empresa: cliente.empresa,
        browserId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Limpiar browser si hay error
      if (browser) {
        const browserId = `${cliente.ruc}_${Date.now()}`;

        try {
          await browser.close();
          logger.info('Browser cerrado despuÃ©s de error', { ruc: cliente.ruc });
        } catch (closeError) {
          logger.error('Error al cerrar browser', { error: closeError.message });
        }

        // IMPORTANTE: Eliminar del Map de browsers activos
        // Buscar y eliminar este browser del Map
        let removed = false;
        for (const [id, b] of this.activeBrowsers.entries()) {
          if (b === browser) {
            this.activeBrowsers.delete(id);
            logger.info('Browser eliminado del Map de activos despuÃ©s de error', {
              browserId: id,
              totalBrowsers: this.activeBrowsers.size
            });
            removed = true;
            break;
          }
        }

        if (!removed) {
          logger.warn('Browser no encontrado en Map para eliminar', {
            ruc: cliente.ruc
          });
        }
      }

      throw error;
    }
  }

  /**
   * Navega al portal de manera robusta con reintentos
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {string} url - URL del portal
   * @param {number} timeout - Timeout en ms
   */
  async navigateToPortal(page, url, timeout) {
    const maxAttempts = 3;

    for (let i = 1; i <= maxAttempts; i++) {
      try {
        logger.info(`Intento de navegaciÃ³n ${i}/${maxAttempts} a ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: timeout * 3
        });

        // Verificar que la pÃ¡gina se cargÃ³ correctamente
        const currentUrl = page.url();
        logger.info(`PÃ¡gina cargada: ${currentUrl}`);

        // Si llegamos aquÃ­, la navegaciÃ³n fue exitosa
        return;

      } catch (error) {
        logger.warn(`Intento ${i} de navegaciÃ³n fallÃ³: ${error.message}`);

        if (i < maxAttempts) {
          await this.sleep(2000);
          // Intentar recargar
          try {
            await page.reload({ waitUntil: 'networkidle', timeout: timeout * 2 });
          } catch (reloadError) {
            logger.warn(`Error al recargar: ${reloadError.message}`);
          }
        } else {
          throw new Error(`No se pudo cargar el portal despuÃ©s de ${maxAttempts} intentos`);
        }
      }
    }
  }

  /**
   * Espera a que la pÃ¡gina estÃ© completamente lista
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {number} timeout - Timeout en ms
   */
  async waitForPageReady(page, timeout) {
    try {
      // Esperar a que el DOM estÃ© listo
      await page.waitForLoadState('domcontentloaded', { timeout });

      // Esperar un poco mÃ¡s para JavaScript
      await this.sleep(1000);

      // Verificar que los elementos del formulario estÃ©n presentes
      const formReady = await page.evaluate(() => {
        const ruc = document.querySelector('#txtRuc');
        const usuario = document.querySelector('#txtUsuario');
        const password = document.querySelector('#txtContrasena');
        const button = document.querySelector('#btnAceptar');

        return !!(ruc && usuario && password && button);
      });

      if (!formReady) {
        logger.warn('Formulario no estÃ¡ completamente cargado, esperando...');
        await this.sleep(2000);
      }

      logger.info('PÃ¡gina lista para interacciÃ³n');

    } catch (error) {
      logger.warn(`Error esperando pÃ¡gina lista: ${error.message}`);
      // Continuar de todos modos
    }
  }

  /**
   * Espera a que el login sea exitoso
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {number} timeout - Timeout en ms
   */
  async waitForLoginSuccess(page, timeout) {
    try {
      // Esperar a que la URL cambie o aparezca contenido del portal
      await Promise.race([
        // OpciÃ³n 1: Esperar cambio de URL
        page.waitForURL(url => !url.includes('MenuInternet'), { timeout: timeout * 2 }),

        // OpciÃ³n 2: Esperar que desaparezca el formulario de login
        page.waitForSelector('#txtRuc', { state: 'hidden', timeout: timeout * 2 }).catch(() => { }),

        // OpciÃ³n 3: Esperar contenido del portal
        page.waitForSelector('frame, iframe, [class*="menu"], [id*="menu"]', { timeout: timeout * 2 }).catch(() => { }),

        // OpciÃ³n 4: Timeout de seguridad
        this.sleep(5000)
      ]);

      logger.info('Login procesado, verificando resultado');

      // Dar tiempo adicional para que cargue el contenido
      await this.sleep(2000);

    } catch (error) {
      logger.warn(`Timeout esperando Ã©xito de login: ${error.message}`);
      // Continuar para verificar errores
    }
  }

  async fillLoginForm(page, cliente, timeout) {
    // Intentar seleccionar la pestaña "RUC" por si acaso la página de SUNAT carga por defecto otra opción (como DNI)
    try {
      const btnPorRuc = await page.$('#btnPorRuc');
      if (btnPorRuc) {
        logger.info('Pestaña RUC detectada, haciendo click para activarla');
        await btnPorRuc.click({ timeout: 2000 });
        await this.sleep(500);
      }
    } catch (e) {
      logger.warn('No se pudo hacer click en pestaña RUC (puede estar seleccionada o no disponible):', e.message);
    }

    // Esperar campo RUC
    await page.waitForSelector('#txtRuc', { timeout });

    // Limpiar y rellenar RUC
    await page.fill('#txtRuc', '');
    await page.fill('#txtRuc', cliente.ruc);

    // Esperar y rellenar usuario
    await page.waitForSelector('#txtUsuario', { timeout });
    await page.fill('#txtUsuario', '');
    await page.fill('#txtUsuario', cliente.usuario);

    // Esperar y rellenar contraseña
    await page.waitForSelector('#txtContrasena', { timeout });
    await page.fill('#txtContrasena', '');
    await page.fill('#txtContrasena', cliente.clave);

    logger.info('Campos de login rellenados', {
      ruc: cliente.ruc
    });
  }

  /**
   * Click robusto en el botÃ³n de login con mÃºltiples estrategias
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {number} timeout - Timeout en ms
   */
  async clickLoginButton(page, timeout) {
    // Primero verificar que el botÃ³n estÃ© visible y habilitado
    try {
      await page.waitForSelector('#btnAceptar', {
        state: 'visible',
        timeout: 5000
      });

      // Verificar que estÃ© habilitado
      const isEnabled = await page.evaluate(() => {
        const btn = document.querySelector('#btnAceptar');
        return btn && !btn.disabled;
      });

      if (!isEnabled) {
        logger.warn('BotÃ³n de login estÃ¡ deshabilitado, esperando...');
        await this.sleep(1000);
      }
    } catch (error) {
      logger.warn(`Error verificando botÃ³n: ${error.message}`);
    }

    const strategies = [
      // Estrategia 1: Esperar y hacer click normal
      async () => {
        logger.info('Estrategia 1: Click normal en #btnAceptar');
        await page.waitForSelector('#btnAceptar', { state: 'visible', timeout: 3000 });
        await page.click('#btnAceptar', { timeout: 5000 });
      },

      // Estrategia 2: Click forzado (ignora si estÃ¡ cubierto)
      async () => {
        logger.info('Estrategia 2: Click forzado en #btnAceptar');
        await page.click('#btnAceptar', { force: true, timeout: 5000 });
      },

      // Estrategia 3: JavaScript click directo
      async () => {
        logger.info('Estrategia 3: Click mediante JavaScript directo');
        await page.evaluate(() => {
          const btn = document.querySelector('#btnAceptar');
          if (btn) {
            btn.click();
          }
        });
        await this.sleep(500);
      },

      // Estrategia 4: Disparar evento click manualmente
      async () => {
        logger.info('Estrategia 4: Disparar evento click con MouseEvent');
        await page.evaluate(() => {
          const btn = document.querySelector('#btnAceptar');
          if (btn) {
            const event = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            btn.dispatchEvent(event);
          }
        });
        await this.sleep(500);
      },

      // Estrategia 5: Submit del formulario directamente
      async () => {
        logger.info('Estrategia 5: Submit del formulario directamente');
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) {
            form.submit();
          }
        });
        await this.sleep(500);
      },

      // Estrategia 6: Presionar Enter en campo de contraseÃ±a
      async () => {
        logger.info('Estrategia 6: Presionar Enter en campo contraseÃ±a');
        await page.focus('#txtContrasena');
        await page.keyboard.press('Enter');
        await this.sleep(500);
      },

      // Estrategia 7: Buscar por texto del botÃ³n
      async () => {
        logger.info('Estrategia 7: Click por texto "Aceptar"');
        await page.click('text=Aceptar', { timeout: 5000 });
      },

      // Estrategia 8: Buscar input type submit
      async () => {
        logger.info('Estrategia 8: Click en input[type="submit"]');
        await page.click('input[type="submit"]', { timeout: 5000 });
      },

      // Estrategia 9: Click con coordenadas del botÃ³n
      async () => {
        logger.info('Estrategia 9: Click en coordenadas del botÃ³n');
        const button = await page.$('#btnAceptar');
        if (button) {
          const box = await button.boundingBox();
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          }
        }
        await this.sleep(500);
      }
    ];

    let lastError = null;

    for (let i = 0; i < strategies.length; i++) {
      try {
        await strategies[i]();
        logger.info(`âœ“ Estrategia ${i + 1} exitosa para click en botÃ³n login`);

        // Verificar que algo cambiÃ³ en la pÃ¡gina
        await this.sleep(1000);

        const pageChanged = await page.evaluate(() => {
          // Verificar si el formulario sigue visible
          const form = document.querySelector('#txtRuc');
          return !form || form.offsetParent === null;
        });

        if (pageChanged) {
          logger.info('PÃ¡gina cambiÃ³ despuÃ©s del click, login enviado correctamente');
          return; // Ã‰xito confirmado
        } else {
          logger.warn('PÃ¡gina no cambiÃ³, intentando siguiente estrategia...');
        }

      } catch (error) {
        lastError = error;
        logger.warn(`âœ— Estrategia ${i + 1} fallÃ³: ${error.message}`);

        if (i < strategies.length - 1) {
          await this.sleep(800); // Pausa antes de intentar siguiente estrategia
        }
      }
    }

    // Si todas las estrategias fallaron
    logger.error(`Todas las estrategias de click fallaron`);
    throw new Error(`No se pudo hacer click en botÃ³n login despuÃ©s de ${strategies.length} intentos. Ãšltimo error: ${lastError?.message}`);
  }

  /**
   * Verifica si hay errores en la pÃ¡gina despuÃ©s del login
   * @param {Page} page - PÃ¡gina de Playwright
   * @returns {Promise<boolean>} True si hay errores
   */
  async checkForErrors(page) {
    try {
      // Buscar mensajes de error comunes
      const errorSelectors = [
        '.error',
        '.mensaje-error',
        '#lblMensaje',
        '[class*="error"]',
        '[id*="error"]'
      ];

      for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
          const errorText = await errorElement.textContent();
          if (errorText && errorText.trim().length > 0) {
            logger.warn('Error detectado en pÃ¡gina', {
              selector,
              errorText: errorText.trim()
            });
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error('Error al verificar errores en pÃ¡gina', { error: error.message });
      return false;
    }
  }

  /**
   * Captura evidencia en caso de error
   * @param {Object} cliente - Datos del cliente
   * @param {Error} error - Error ocurrido
   */
  async captureErrorEvidence(cliente, error) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = `${cliente.ruc}_${timestamp}`;

      // Si hay un browser activo, capturar screenshot y HTML
      const activeBrowser = Array.from(this.activeBrowsers.values())[0];
      if (activeBrowser) {
        const pages = await activeBrowser.pages();
        if (pages.length > 0) {
          const page = pages[0];

          // Screenshot
          await page.screenshot({
            path: path.join('screenshots', `${baseFilename}.png`),
            fullPage: true
          });

          // HTML
          const html = await page.content();
          fs.writeFileSync(
            path.join('html', `${baseFilename}.html`),
            html,
            'utf8'
          );

          logger.info('Evidencia de error capturada', {
            ruc: cliente.ruc,
            screenshot: `screenshots/${baseFilename}.png`,
            html: `html/${baseFilename}.html`
          });
        }
      }
    } catch (captureError) {
      logger.error('Error al capturar evidencia', {
        error: captureError.message,
        ruc: cliente.ruc
      });
    }
  }

  /**
   * Cierra todas las sesiones activas
   * @returns {Promise<Object>} Resultado de la operaciÃ³n
   */
  async closeAllSessions() {
    try {
      const totalBrowsers = this.activeBrowsers.size;

      if (totalBrowsers === 0) {
        logger.info('No hay sesiones activas para cerrar');
        return {
          success: true,
          message: 'No hay sesiones activas',
          closedCount: 0
        };
      }

      logger.info(`Cerrando ${totalBrowsers} sesiones activas`);

      const results = {
        closed: 0,
        errors: 0
      };

      // Procesar cada browser secuencialmente para mejor control
      for (const [browserId, browser] of this.activeBrowsers.entries()) {
        try {
          logger.info(`Intentando cerrar browser`, { browserId });

          // Verificar si el browser estÃ¡ conectado
          let isConnected = false;
          try {
            isConnected = browser.isConnected();
          } catch (checkError) {
            logger.warn(`Error al verificar conexiÃ³n, asumiendo desconectado`, {
              browserId,
              error: checkError.message
            });
          }

          if (isConnected) {
            await browser.close();
            results.closed++;
            logger.info(`âœ“ Browser cerrado exitosamente`, { browserId });
          } else {
            logger.warn(`Browser ya estaba cerrado`, { browserId });
            results.closed++; // Contar como cerrado porque ya no estÃ¡ activo
          }

        } catch (error) {
          results.errors++;
          logger.error(`âœ— Error al cerrar browser`, {
            browserId,
            error: error.message
          });

          // Intentar forzar cierre
          try {
            await browser.close();
            logger.info(`Browser cerrado forzadamente despuÃ©s de error`, { browserId });
          } catch (forceError) {
            logger.error(`No se pudo forzar cierre`, {
              browserId,
              error: forceError.message
            });
          }
        }
      }

      // Limpiar el Map despuÃ©s de cerrar todos
      const clearedCount = this.activeBrowsers.size;
      this.activeBrowsers.clear();
      logger.info(`Map de browsers limpiado`, { clearedCount });

      const message = results.errors > 0
        ? `Se cerraron ${results.closed} sesiones (${results.errors} con errores)`
        : `Se cerraron ${results.closed} sesiones exitosamente`;

      logger.info(message);

      return {
        success: true,
        message,
        closedCount: results.closed,
        errorCount: results.errors
      };

    } catch (error) {
      logger.error('Error crÃ­tico al cerrar sesiones', { error: error.message });

      // Intentar limpiar el Map de todos modos
      const clearedCount = this.activeBrowsers.size;
      this.activeBrowsers.clear();
      logger.info(`Map limpiado despuÃ©s de error crÃ­tico`, { clearedCount });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene informaciÃ³n de sesiones activas
   * @returns {Array} Lista de sesiones activas
   */
  getActiveSessions() {
    // Limpiar browsers desconectados antes de retornar
    this.cleanupDisconnectedBrowsers();

    return Array.from(this.activeBrowsers.keys()).map(browserId => ({
      browserId,
      timestamp: browserId.split('_')[1]
    }));
  }

  /**
   * Limpia browsers que estÃ¡n en el Map pero ya no estÃ¡n conectados
   */
  cleanupDisconnectedBrowsers() {
    const disconnected = [];

    for (const [browserId, browser] of this.activeBrowsers.entries()) {
      try {
        if (!browser.isConnected()) {
          disconnected.push(browserId);
        }
      } catch (error) {
        // Si hay error al verificar, asumir que estÃ¡ desconectado
        disconnected.push(browserId);
      }
    }

    if (disconnected.length > 0) {
      logger.info(`Limpiando ${disconnected.length} browsers desconectados`);
      disconnected.forEach(id => {
        this.activeBrowsers.delete(id);
        logger.debug(`Browser desconectado eliminado del Map`, { browserId: id });
      });
    }
  }

  /**
   * Navega por el menÃº del portal para llegar a Emitir Factura
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {number} timeout - Timeout en ms
   */
  async navigateToEmitirFactura(page, timeout) {
    try {
      logger.info('Iniciando navegaciÃ³n a Emitir Factura');

      // Esperar a que la pÃ¡gina del menÃº cargue completamente
      await this.sleep(3000);

      // Paso 1: Click en "Empresas"
      logger.info('Paso 1: Click en Empresas');
      await page.waitForSelector('#divOpcionServicio2', { timeout, state: 'visible' });
      await page.click('#divOpcionServicio2');
      await this.sleep(1500);

      // Paso 2: Click en "Comprobantes de pago"
      logger.info('Paso 2: Click en Comprobantes de pago');
      await page.waitForSelector('#nivel1_11', { timeout, state: 'visible' });
      await page.click('#nivel1_11');
      await this.sleep(1500);

      // Paso 3: Click en "SEE-SOL"
      logger.info('Paso 3: Click en SEE-SOL');
      await page.waitForSelector('#nivel2_11_5', { timeout, state: 'visible' });
      await page.click('#nivel2_11_5');
      await this.sleep(1500);

      // Paso 4: Click en "Factura ElectrÃ³nica"
      logger.info('Paso 4: Click en Factura ElectrÃ³nica');
      await page.waitForSelector('#nivel3_11_5_3', { timeout, state: 'visible' });
      await page.click('#nivel3_11_5_3');
      await this.sleep(1500);

      // Paso 5: Click en "Emitir Factura" - Esto carga un iframe
      logger.info('Paso 5: Click en Emitir Factura');
      await page.waitForSelector('#nivel4_11_5_3_1_1', { timeout, state: 'visible' });
      await page.click('#nivel4_11_5_3_1_1');

      logger.info('Esperando carga del iframe con la aplicaciÃ³n de facturaciÃ³n');
      await this.sleep(3000);

      // Buscar el iframe que contiene la aplicaciÃ³n de facturaciÃ³n
      let iframeElement = await page.$('iframe[id*="frameApplication"], iframe[name*="frameApplication"]');

      if (!iframeElement) {
        logger.warn('No se encontrÃ³ iframe especÃ­fico, buscando cualquier iframe');
        const allIframes = await page.$$('iframe');
        logger.info(`Se encontraron ${allIframes.length} iframes en la pÃ¡gina`);

        if (allIframes.length > 0) {
          iframeElement = allIframes[0];
        } else {
          throw new Error('No se encontraron iframes en la pÃ¡gina');
        }
      }

      // Obtener el frame de Playwright para acceder al contenido del iframe
      const frame = await iframeElement.contentFrame();

      if (!frame) {
        throw new Error('No se pudo acceder al contenido del iframe');
      }

      logger.info('Accediendo al contenido del iframe');

      // Esperar a que el iframe cargue y redirija a la URL final
      await this.sleep(3000);

      // Obtener la URL final del iframe despuÃ©s de la redirecciÃ³n
      const iframeUrl = frame.url();
      logger.info('URL final del iframe despuÃ©s de redirecciÃ³n', { url: iframeUrl });

      // Verificar que sea la URL de emisiÃ³n de factura
      if (iframeUrl && (iframeUrl.includes('itemisionfactura') || iframeUrl.includes('emitir.do'))) {
        logger.info('Abriendo URL de facturaciÃ³n en nueva pestaÃ±a dentro del mismo Chromium');

        // Abrir la URL en una nueva pestaÃ±a dentro de la misma ventana usando el contexto de la pÃ¡gina
        const context = page.context();
        const newPage = await context.newPage();
        await newPage.goto(iframeUrl, { waitUntil: 'domcontentloaded', timeout: timeout * 3 });

        logger.info('Nueva pestaÃ±a abierta con aplicaciÃ³n de facturaciÃ³n en el mismo Chromium', { url: iframeUrl });
        await this.sleep(1000);

        // Cerrar la pestaÃ±a del menÃº principal, dejando solo la de facturaciÃ³n
        logger.info('Cerrando pestaÃ±a del menÃº principal');
        await page.close();
        logger.info('PestaÃ±a del menÃº cerrada, solo queda la aplicaciÃ³n de facturaciÃ³n');

        await this.sleep(1000);
      } else {
        logger.warn('La URL del iframe no parece ser de emisiÃ³n de factura, intentando de todos modos', {
          url: iframeUrl
        });

        // Intentar abrir de todos modos por si la URL es relativa o diferente
        const context = page.context();
        const newPage = await context.newPage();
        await newPage.goto(iframeUrl, { waitUntil: 'domcontentloaded', timeout: timeout * 3 });

        logger.info('Nueva pestaÃ±a abierta en el mismo Chromium', { url: iframeUrl });
        await this.sleep(1000);

        // Cerrar la pestaÃ±a del menÃº principal
        logger.info('Cerrando pestaÃ±a del menÃº principal');
        await page.close();
        logger.info('PestaÃ±a del menÃº cerrada');

        await this.sleep(1000);
      }

      logger.info('NavegaciÃ³n a Emitir Factura completada exitosamente');

    } catch (error) {
      logger.error('Error al navegar a Emitir Factura', {
        error: error.message
      });
      throw new Error(`No se pudo navegar a Emitir Factura: ${error.message}`);
    }
  }

  /**
   * FunciÃ³n de utilidad para sleep
   * @param {number} ms - Milisegundos a esperar
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SunatBot();
