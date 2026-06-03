const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('./config');
const excelReader = require('./excelReader');

/**
 * Handler para el mÃ³dulo BuzÃ³n ElectrÃ³nico SUNAT
 * Permite consultar notificaciones y mensajes del buzÃ³n de clientes
 */
class BuzonHandler {
  constructor() {
    this.activeSessions = new Map(); // browserId -> { browser, page, cliente }
    this.downloadPath = path.join(process.cwd(), 'descargas_buzon');
    this.ensureDirectories();
  }

  /**
   * Espera hasta encontrar un frame que cumpla con la condiciÃ³n
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {Function} predicate - FunciÃ³n que recibe un frame y retorna true si es el buscado
   * @param {number} timeout - Tiempo mÃ¡ximo de espera en ms
   * @returns {Promise<Frame|null>} El frame encontrado o null
   */
  async waitForFrame(page, predicate, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const frame = page.frames().find(predicate);
      if (frame) return frame;
      await page.waitForTimeout(500);
    }
    return null;
  }

  /**
   * Asegura que existan los directorios necesarios
   */
  ensureDirectories() {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
      logger.info('Directorio de descargas del buzÃ³n creado', { path: this.downloadPath });
    }
  }

  /**
   * Obtiene la lista de clientes desde el archivo Excel
   * @returns {Promise<Object>} Lista de clientes
   */
  async obtenerClientes() {
    try {
      const clientesPath = path.join(process.cwd(), 'server', 'data', 'CLIENTES.xlsx');

      if (!fs.existsSync(clientesPath)) {
        return {
          success: false,
          error: 'No se encontrÃ³ el archivo CLIENTES.xlsx en la carpeta data/'
        };
      }

      const clientes = await excelReader.readClients(clientesPath);

      // Retornar solo los datos necesarios (sin exponer claves)
      const clientesSeguros = clientes.map(c => ({
        ruc: c.ruc,
        empresa: c.empresa,
        usuario: c.usuario,
        email: c.email || '',
        whatsapp: c.whatsapp || ''
      }));

      return {
        success: true,
        clientes: clientesSeguros
      };

    } catch (error) {
      logger.error('Error al obtener clientes para buzÃ³n', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Consulta el buzÃ³n de un cliente especÃ­fico
   * @param {string} ruc - RUC del cliente
   * @returns {Promise<Object>} Mensajes del buzÃ³n
   */
  async consultarBuzon(ruc) {
    let browser = null;
    let page = null;
    let context = null;

    try {
      logger.info('Iniciando consulta de buzÃ³n', { ruc });

      // CERRAR SESIONES ANTERIORES AUTOMÃTICAMENTE
      if (this.activeSessions.size > 0) {
        logger.info('Cerrando sesiones anteriores para iniciar nueva consulta...');
        await this.cerrarTodasLasSesiones();
      }

      // Obtener credenciales del cliente
      const clientesPath = path.join(process.cwd(), 'server', 'data', 'CLIENTES.xlsx');
      const clientes = await excelReader.readClients(clientesPath);
      const cliente = clientes.find(c => c.ruc === ruc);

      if (!cliente) {
        return {
          success: false,
          error: `No se encontrÃ³ el cliente con RUC ${ruc}`
        };
      }

      // Lanzar navegador OCULTO (headless: true para compatibilidad con versiones antiguas/estrictas)
      browser = await chromium.launch({
        headless: true, // OCULTO: Solicitud del usuario
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1366,768'
        ]
      });

      // Contexto con User-Agent real y configuraciÃ³n anti-detecciÃ³n
      context = await browser.newContext({
        acceptDownloads: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        extraHTTPHeaders: {
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      page = await context.newPage();

      // Ocultar la detecciÃ³n de automatizaciÃ³n
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-PE', 'es', 'en'] });
      });

      // Configurar timeouts mÃ¡s largos para SUNAT
      const timeout = 30000; // 30 segundos fijo para el buzÃ³n
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(90000); // 90 segundos para navegaciÃ³n

      // Navegar al portal del buzÃ³n
      const portalUrl = config.PORTALES[3]; // Portal BuzÃ³n
      logger.info('Navegando al portal buzÃ³n', { url: portalUrl });

      await page.goto(portalUrl, {
        waitUntil: 'domcontentloaded', // MÃ¡s rÃ¡pido y confiable que networkidle
        timeout: 90000
      });

      // Esperar que cargue el formulario de login
      await page.waitForSelector('#txtRuc', { timeout });

      // Rellenar formulario de login
      await page.fill('#txtRuc', cliente.ruc);
      await page.fill('#txtUsuario', cliente.usuario);
      await page.fill('#txtContrasena', cliente.clave);

      logger.info('Formulario de login completado, enviando...', { ruc });

      // Click en botÃ³n de login y esperar navegaciÃ³n
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
        page.click('#btnAceptar')
      ]);

      // Esperar para que SUNAT complete su redirect natural
      await page.waitForTimeout(3000);

      // Verificar la URL despuÃ©s del login
      let currentUrl = page.url();
      logger.info('URL despuÃ©s de login:', { url: currentUrl });

      // SOLO forzar navegaciÃ³n si detectamos OAuth (URL larga con JWT)
      if (currentUrl.includes('api-seguridad') || currentUrl.includes('loginMenuSol')) {
        logger.warn('OAuth detectado (URL larga), forzando navegaciÃ³n a URL correcta del buzÃ³n...');

        // Esperar para que OAuth procese cookies
        await page.waitForTimeout(3000);

        const buzonUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?pestana=*&agrupacion=*&exe=buzon';
        await page.goto(buzonUrl, {
          waitUntil: 'networkidle',
          timeout: 60000
        });

        currentUrl = page.url();
        logger.info('URL despuÃ©s de navegaciÃ³n forzada:', { url: currentUrl });

        // Si aÃºn estÃ¡ en OAuth, reintentar una vez mÃ¡s
        if (currentUrl.includes('api-seguridad') || currentUrl.includes('loginMenuSol')) {
          logger.warn('TodavÃ­a en OAuth, esperando 5s y reintentando...');
          await page.waitForTimeout(5000);

          await page.goto(buzonUrl, {
            waitUntil: 'networkidle',
            timeout: 60000
          });

          currentUrl = page.url();
          logger.info('URL despuÃ©s de reintento:', { url: currentUrl });

          // Si TODAVÃA estÃ¡ en OAuth, cerrar browser y reiniciar proceso completo
          if (currentUrl.includes('api-seguridad') || currentUrl.includes('loginMenuSol')) {
            logger.warn('OAuth persiste despuÃ©s de 2 intentos. Cerrando browser y reintentando proceso completo...');

            // Cerrar browser actual
            await browser.close();

            // REINTENTO COMPLETO: Navegar DIRECTAMENTE a URL correcta desde el inicio
            logger.info('Iniciando segundo intento con navegaciÃ³n directa a URL correcta...');

            browser = await chromium.launch({
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1366,768'
              ]
            });

            const newContext = await browser.newContext({
              acceptDownloads: true,
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              viewport: { width: 1366, height: 768 },
              extraHTTPHeaders: {
                'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
              }
            });
            page = await newContext.newPage();
            context = newContext;

            await page.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
              Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
              Object.defineProperty(navigator, 'languages', { get: () => ['es-PE', 'es', 'en'] });
            });

            page.setDefaultTimeout(timeout);
            page.setDefaultNavigationTimeout(90000);

            // Navegar DIRECTAMENTE a URL correcta (con parÃ¡metros completos)
            const buzonUrlCompleto = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?pestana=*&agrupacion=*&exe=buzon';
            logger.info('Navegando a URL correcta con parÃ¡metros completos...');

            await page.goto(buzonUrlCompleto, {
              waitUntil: 'domcontentloaded',
              timeout: 90000
            });

            // Login en esta pÃ¡gina
            await page.waitForSelector('#txtRuc', { timeout: 30000 });
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave);
            await page.waitForTimeout(500);

            logger.info('Segundo intento: Enviando login...');

            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
              page.click('#btnAceptar')
            ]);

            await page.waitForTimeout(3000);

            currentUrl = page.url();
            logger.info('URL despuÃ©s de segundo intento completo:', { url: currentUrl });

            // Verificar resultado final
            if (currentUrl.includes('api-seguridad') || currentUrl.includes('loginMenuSol')) {
              throw new Error('No se pudo establecer sesiÃ³n en SUNAT despuÃ©s de reintento completo. Verifique las credenciales.');
            }

            logger.info('Segundo intento exitoso - sesiÃ³n establecida');
          }
        }

        logger.info('NavegaciÃ³n exitosa despuÃ©s de resolver OAuth');
      } else {
        // SUNAT redirigiÃ³ correctamente sin OAuth - continuar normalmente
        logger.info('Login exitoso, SUNAT redirigiÃ³ correctamente (sin OAuth)');
      }

      // Esperar a que se rendericen los frames del menÃº
      logger.info('Esperando que se rendericen los frames del menÃº...');
      try {
        await page.waitForFunction(() => {
          return window.frames.length > 1 || document.querySelector('iframe');
        }, { timeout: 20000 });
        logger.info('Frames del menÃº detectados');
      } catch (frameTimeout) {
        logger.warn('Frames no detectados en el timeout, continuando...');
      }

      // Espera adicional para estabilizaciÃ³n
      await page.waitForTimeout(3000);

      // Esperar a que cargue el buzÃ³n
      await this.esperarCargaBuzon(page, timeout);

      // Extraer mensajes del buzÃ³n
      const mensajes = await this.extraerMensajes(page);

      // Guardar sesiÃ³n para futuras descargas
      const browserId = `buzon_${ruc}_${Date.now()}`;
      this.activeSessions.set(browserId, { browser, page, cliente, context });

      logger.info('Consulta de buzÃ³n exitosa', {
        ruc,
        totalMensajes: mensajes.length,
        browserId
      });

      // ðŸ“§ ENVIAR EMAIL AUTOMÃTICO SI HAY MENSAJES Y EL CLIENTE TIENE EMAIL
      if (mensajes.length > 0 && cliente.email) {
        try {
          const emailService = require('./emailService');

          // Verificar si se debe enviar (evitar duplicados)
          const debeEnviar = emailService.debeEnviarEmail(cliente.ruc, mensajes);

          if (debeEnviar) {
            const resultado = await emailService.enviarAlertaMensajesBuzon(
              cliente.email,
              {
                ruc: cliente.ruc,
                empresa: cliente.empresa
              },
              mensajes
            );

            if (resultado.success) {
              // Registrar que se enviÃ³ el email
              emailService.registrarEmailEnviado(cliente.ruc, mensajes);

              logger.info('Email automÃ¡tico enviado exitosamente', {
                ruc,
                email: cliente.email,
                cantidad: mensajes.length
              });
            } else {
              logger.debug('Email automÃ¡tico no enviado (servicio no configurado)', {
                ruc,
                email: cliente.email
              });
            }
          } else {
            logger.debug('Email no enviado (sin cambios en mensajes)', {
              ruc,
              email: cliente.email,
              cantidadMensajes: mensajes.length
            });
          }
        } catch (emailError) {
          logger.warn('Error al enviar email automÃ¡tico (no crÃ­tico)', {
            error: emailError.message,
            ruc
          });
          // No fallamos la consulta si falla el email
        }
      } else if (mensajes.length > 0 && !cliente.email) {
        logger.debug('Cliente sin email configurado, email automÃ¡tico omitido', { ruc });
      }

      return {
        success: true,
        mensajes,
        browserId,
        cliente: {
          ruc: cliente.ruc,
          empresa: cliente.empresa
        },
        emailEnviado: mensajes.length > 0 && !!cliente.email
      };

    } catch (error) {
      logger.error('Error al consultar buzÃ³n', { error: error.message, ruc });

      // Cerrar browser en caso de error
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          logger.error('Error al cerrar browser', { error: closeError.message });
        }
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Espera a que el buzÃ³n cargue completamente y navega a la secciÃ³n de Empresas
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {number} timeout - Timeout en ms
   */
  async esperarCargaBuzon(page, timeout) {
    try {
      // Esperar que desaparezca el formulario de login
      await page.waitForSelector('#txtRuc', { state: 'hidden', timeout: timeout * 2 }).catch(() => { });

      // Esperar redirecciÃ³n OAuth completa (de api-seguridad a e-menu)
      logger.info('Esperando redirecciÃ³n OAuth...');
      try {
        await page.waitForURL('**/cl-ti-itmenu/**', { timeout: 30000 });
        logger.info('RedirecciÃ³n a menÃº completada');
      } catch (e) {
        logger.warn('Timeout esperando redirecciÃ³n al menÃº, continuando...');
      }

      // Esperar a que aparezcan mÃºltiples frames (el menÃº tiene iframes)
      try {
        await page.waitForFunction(() => {
          return window.frames.length > 1 || document.querySelector('iframe');
        }, { timeout: 15000 }); // Aumentado a 15 segundos
        logger.info('Frames del menÃº detectados');
      } catch (e) {
        logger.warn('No se detectaron mÃºltiples frames');
        // Intentar esperar mÃ¡s para casos de OAuth lento
        await page.waitForTimeout(3000);
      }

      // Verificar si hay errores de login
      try {
        const errorElement = await page.waitForSelector('.error, .mensaje-error, #lblMensaje', { timeout: 2000 });
        if (errorElement) {
          const errorText = await errorElement.textContent();
          if (errorText && errorText.trim().length > 0 && errorText.includes('error')) {
            throw new Error(`Error de login: ${errorText.trim()}`);
          }
        }
      } catch (e) { }

      // Buscar y hacer click en "Empresas" para ver las notificaciones empresariales
      // Buscar y hacer click en "Empresas" para ver las notificaciones empresariales
      let empresasClicked = false;
      try {
        // Intentar varias veces encontrar el botÃ³n Empresas (mÃ¡s intentos tras OAuth)
        for (let i = 0; i < 5; i++) {
          logger.info(`Intento ${i + 1}/5 de encontrar botÃ³n Empresas...`);
          empresasClicked = await page.evaluate(() => {
            const elementos = document.querySelectorAll('*');
            for (const el of elementos) {
              const texto = el.innerText || el.textContent || '';
              if (texto.trim() === 'Empresas' ||
                (texto.includes('Empresas') && !texto.includes('Operador') && el.tagName !== 'BODY')) {
                if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'DIV' ||
                  el.tagName === 'SPAN' || el.tagName === 'LI' || el.onclick ||
                  el.style.cursor === 'pointer' || el.getAttribute('role') === 'button') {
                  el.click();
                  return true;
                }
              }
            }
            return false;
          });
          if (empresasClicked) {
            logger.info(`BotÃ³n Empresas encontrado en el intento ${i + 1}`);
            break;
          }
          await page.waitForTimeout(2000); // Esperar 2 segundos entre intentos
        }
      } catch (e) {
        logger.warn('Error intentando click en Empresas', { error: e.message });
      }

      if (empresasClicked) {
        logger.info('Click en secciÃ³n Empresas realizado');

        // Esperar activamente por la apariciÃ³n del frame de BuzÃ³n
        // Usar nuestro helper waitForFrame para mayor robustez
        const buzonFrame = await this.waitForFrame(page, (frame) => {
          return frame.name() === 'iframeApplication' || frame.url().includes('visornoti');
        }, 20000);

        if (buzonFrame) {
          logger.info('iframeApplication detectado correctamente');
          // Esperar un poco para que el contenido dentro del iframe empiece a renderizar
          await page.waitForTimeout(2000);
        } else {
          logger.warn('Timeout esperando iframeApplication, continuando a extracciÃ³n...');
          // Intentar forzar recarga del frame si es posible o esperar mÃ¡s
        }
      } else {
        logger.warn('No se encontrÃ³ la secciÃ³n Empresas, continuando con la vista actual');
      }

      logger.info('BuzÃ³n cargado correctamente (fase preliminar)');

    } catch (error) {
      logger.warn('Error esperando carga del buzÃ³n', { error: error.message });
      // Continuar de todos modos e intentar extraer
    }
  }

  /**
   * Extrae los mensajes del buzÃ³n usando la API de SUNAT
   * Flujo: (1) Buscar iframe, (2) Extraer IDs de mensajes, (3) Llamar API para cada mensaje
   * API descubierta: /ol-ti-itvisornoti/visor/obtenerDetalleNotiMen
   * @param {Page} page - PÃ¡gina de Playwright
   * @returns {Promise<Array>} Lista de mensajes
   */
  async extraerMensajes(page) {
    try {
      // Tomar screenshot para debug
      const screenshotPath = path.join(process.cwd(), 'screenshots', `buzon_mensajes_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info('Screenshot del buzÃ³n guardado', { path: screenshotPath });

      // Buscar el iframe del buzÃ³n real (iframeApplication), NO el menÃº
      // Buscar el iframe del buzÃ³n real de forma robusta
      let targetFrame = await this.waitForFrame(page, (f) =>
        f.name() === 'iframeApplication' ||
        f.url().includes('visornoti') ||
        f.url().includes('visorNotificaciones')
        , 10000);

      // Paso 2: Si no encontramos por nombre, buscar por contenido (fallback inteligente)
      if (!targetFrame) {
        logger.warn('Frame principal no encontrado por nombre, buscando por contenido...');
        const frames = page.frames();
        for (const frame of frames) {
          if (frame === page.mainFrame()) continue;
          const frameUrl = frame.url();
          if (frameUrl.includes('MenuInternet.htm')) continue;

          try {
            const hasRealNotifications = await frame.evaluate(() => {
              const text = document.body?.innerText || '';
              // Excluir contenido que es del menÃº
              if (text.includes('"type":"programa"') || text.includes('"invoke":"')) return false;
              // Buscar patrones
              return text.includes('Carta N') || text.includes('ResoluciÃ³n N') ||
                (text.includes('NotificaciÃ³n') && text.length < 50000);
            });

            if (hasRealNotifications) {
              targetFrame = frame;
              logger.info('Encontrado frame con notificaciones reales por contenido');
              break;
            }
          } catch (e) { }
        }
      }

      const frameToUse = targetFrame || page.mainFrame();
      logger.info(`Usando frame: ${targetFrame ? targetFrame.name() || 'anonimo' : 'main'} para extracciÃ³n`);

      // ESPERA CRÃTICA: Esperar a que la tabla o lista de mensajes se renderice
      try {
        logger.info('Esperando renderizado de lista de mensajes...');
        await frameToUse.waitForSelector('li.list-group-item, .alert-info, body', { timeout: 15000 });

        // Espera adicional si vemos un loader
        const isLoader = await frameToUse.$('.fa-spinner, .loader');
        if (isLoader) {
          await frameToUse.waitForTimeout(2000);
        }
      } catch (e) {
        logger.warn('Timeout esperando selector de mensajes, intentando extracciÃ³n directa');
      }

      // Guardar HTML del frame para debug
      try {
        const frameHtml = await frameToUse.content();
        const htmlPath = path.join(process.cwd(), 'screenshots', `buzon_iframe_${Date.now()}.html`);
        fs.writeFileSync(htmlPath, frameHtml);
        logger.info('HTML del frame guardado', { path: htmlPath });
      } catch (e) {
        logger.warn('No se pudo guardar HTML del frame');
      }

      // PASO 1: Extraer los mensajes desde el DOM (con IDs reales de SUNAT)
      const mensajesDOM = await this.extraerCodigosMensajes(frameToUse);
      logger.info(`Mensajes encontrados en DOM: ${mensajesDOM.length}`, { primeros: mensajesDOM.slice(0, 3) });

      if (mensajesDOM.length === 0) {
        logger.warn('No se encontraron mensajes en el DOM, usando extracciÃ³n alternativa');
        return await this.extraerMensajesDelHTML(frameToUse);
      }

      // Los mensajes ya vienen con {id, asunto, fecha, tieneAdjunto} del DOM
      // Formatear para que coincida con la estructura esperada por el frontend
      const mensajes = mensajesDOM.map(msg => ({
        id: msg.id,
        asunto: msg.asunto,
        fecha: msg.fecha,
        tieneAdjunto: msg.tieneAdjunto,
        estado: 'no_leido'
      }));

      logger.info(`Mensajes extraÃ­dos: ${mensajes.length}`);
      return mensajes;

    } catch (error) {
      logger.error('Error al extraer mensajes', { error: error.message });
      return [];
    }
  }

  /**
   * Extrae los cÃ³digos/IDs de los mensajes desde el DOM del frame
   * Los mensajes estÃ¡n en: <li id="{codigoMensaje}" class="list-group-item">
   * @param {Frame} frame - Frame de Playwright
   * @returns {Promise<Array>} Lista de objetos con datos de mensajes
   */
  async extraerCodigosMensajes(frame) {
    try {
      const mensajes = await frame.evaluate(() => {
        const mensajesEncontrados = [];

        // ESTRATEGIA PRINCIPAL: Los mensajes en SUNAT estÃ¡n en <li id="{codigoMensaje}" class="list-group-item">
        document.querySelectorAll('li.list-group-item[id]').forEach(li => {
          const id = li.id;
          // Los IDs de SUNAT son nÃºmeros de 6+ dÃ­gitos
          if (id && /^\d{6,}$/.test(id)) {
            const asuntoEl = li.querySelector('.linkMensaje');
            const fechaEl = li.querySelector('.fecPublica');
            const tieneAdjunto = li.querySelector('.fa-paperclip') !== null;

            mensajesEncontrados.push({
              id: id,
              asunto: asuntoEl ? asuntoEl.textContent.trim() : '',
              fecha: fechaEl ? fechaEl.textContent.trim() : '',
              tieneAdjunto: tieneAdjunto
            });
          }
        });

        return mensajesEncontrados;
      });
      return mensajes;
    } catch (error) {
      logger.warn('Error al extraer cÃ³digos', { error: error.message });
      return [];
    }
  }

  /**
   * Llama a la API de SUNAT para obtener el detalle de un mensaje
   * API: /ol-ti-itvisornoti/visor/obtenerDetalleNotiMen
   * @param {Page} page - PÃ¡gina de Playwright
   * @param {string} codigoMensaje - CÃ³digo del mensaje
   * @returns {Promise<Object>} Objeto con datos del mensaje
   */
  async obtenerDetalleMensajeAPI(page, codigoMensaje) {
    try {
      const timestamp = Date.now();
      const apiUrl = `https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/obtenerDetalleNotiMen?codigoMensaje=${codigoMensaje}&tipoMsj=2&_=${timestamp}`;
      logger.info(`Llamando API SUNAT: ${codigoMensaje}`);

      // Hacer la peticiÃ³n usando fetch desde el contexto del navegador (mantiene cookies)
      const response = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          return { ok: res.ok, status: res.status, data: await res.text() };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }, apiUrl);

      if (!response.ok) {
        logger.warn(`API error para ${codigoMensaje}:`, { status: response.status });
        return null;
      }

      // Parsear la respuesta JSON
      let data;
      try {
        data = JSON.parse(response.data);
      } catch (e) {
        // Extraer con regex si no es JSON vÃ¡lido
        const asuntoMatch = response.data.match(/"asunto"\s*:\s*"([^"]+)"/);
        const fechaMatch = response.data.match(/"fecha"\s*:\s*"([^"]+)"/);
        data = {
          asunto: asuntoMatch ? asuntoMatch[1] : 'Sin asunto',
          fecha: fechaMatch ? fechaMatch[1] : ''
        };
      }

      // Extraer anexos
      const anexos = [];
      if (data.anexos && Array.isArray(data.anexos)) {
        data.anexos.forEach(anexo => {
          anexos.push({
            id: anexo.id_archivo || anexo.idArchivo,
            nombre: anexo.nombre || anexo.nomArchivo || 'archivo.pdf'
          });
        });
      }

      return {
        id: codigoMensaje,
        asunto: data.asunto || 'Sin asunto',
        fecha: data.fecha || '',
        tieneAdjunto: anexos.length > 0,
        anexos: anexos,
        estado: 'no_leido'
      };
    } catch (error) {
      logger.warn(`Error al obtener detalle ${codigoMensaje}`, { error: error.message });
      return null;
    }
  }

  /**
   * ExtracciÃ³n alternativa de mensajes del HTML (fallback si no hay IDs)
   * @param {Frame} frame - Frame de Playwright
   * @returns {Promise<Array>} Lista de mensajes
   */
  async extraerMensajesDelHTML(frame) {
    try {
      const mensajes = await frame.evaluate(() => {
        const encontrados = [];
        const procesados = new Set();

        document.querySelectorAll('*').forEach((el, idx) => {
          const texto = (el.innerText || '').trim();
          if ((texto.includes('NotificaciÃ³n') && texto.includes('Carta')) ||
            (texto.includes('ASUNTO:') && texto.length < 500)) {

            const key = texto.substring(0, 80);
            if (procesados.has(key)) return;
            procesados.add(key);

            let asunto = '';
            const asuntoMatch = texto.match(/ASUNTO:\s*([^\n]+)/);
            if (asuntoMatch) {
              asunto = asuntoMatch[1].trim();
            } else {
              const notifMatch = texto.match(/(NotificaciÃ³n[^\n]+)/);
              asunto = notifMatch ? notifMatch[1] : texto.substring(0, 150);
            }

            const fechaMatch = texto.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/);
            const tieneAdjunto = el.innerHTML.includes('clip') || el.innerHTML.includes('attach');

            encontrados.push({
              id: `msg_${idx}`,
              asunto: asunto.substring(0, 200),
              fecha: fechaMatch ? fechaMatch[1] : '',
              tieneAdjunto,
              estado: 'no_leido'
            });
          }
        });
        return encontrados.slice(0, 50);
      });

      logger.info(`Mensajes extraÃ­dos del HTML (fallback): ${mensajes.length}`);
      return mensajes;
    } catch (error) {
      logger.warn('Error en extracciÃ³n alternativa');
      return [];
    }
  }

  /**
   * Intenta extraer mensajes desde iframes
   * @param {Page} page - PÃ¡gina de Playwright
   * @returns {Promise<Array>} Lista de mensajes
   */
  async extraerMensajesDeIframes(page) {
    try {
      const frames = page.frames();
      logger.info(`Buscando mensajes en ${frames.length} frames`);

      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;

        try {
          const mensajes = await frame.evaluate(() => {
            const mensajesEncontrados = [];

            // Buscar en el iframe
            document.querySelectorAll('*').forEach((el, index) => {
              const texto = el.innerText || '';
              if (texto.includes('ASUNTO:') || texto.includes('NotificaciÃ³n')) {
                mensajesEncontrados.push({
                  id: `iframe_msg_${index}`,
                  asunto: texto.substring(0, 150),
                  fecha: '',
                  tieneAdjunto: texto.includes('.pdf') || texto.includes('constancia'),
                  estado: 'no_leido'
                });
              }
            });

            return mensajesEncontrados.slice(0, 50); // Limitar cantidad
          });

          if (mensajes.length > 0) {
            return mensajes;
          }
        } catch (frameError) {
          // Continuar con siguiente frame
        }
      }

      return [];

    } catch (error) {
      logger.error('Error al extraer de iframes', { error: error.message });
      return [];
    }
  }

  /**
   * Descarga un archivo adjunto de un mensaje
   * URL de descarga SUNAT: /ol-ti-itvisornoti/visor/bajarArchivo/{codArchivo}/{anexo}/{sistema}/{ruc}
   * @param {string} browserId - ID de la sesiÃ³n activa
   * @param {string} mensajeId - ID del mensaje
   * @returns {Promise<Object>} Resultado de la descarga
   */
  async descargarAdjunto(browserId, mensajeId) {
    try {
      const session = this.activeSessions.get(browserId);

      if (!session) {
        return {
          success: false,
          error: 'SesiÃ³n no encontrada. Por favor consulte el buzÃ³n nuevamente.'
        };
      }

      const { page, context, cliente } = session;

      logger.info('Descargando adjunto(s)', { browserId, mensajeId, ruc: cliente.ruc });

      // Configurar directorio de descarga
      const clienteDownloadPath = path.join(this.downloadPath, cliente.ruc);
      if (!fs.existsSync(clienteDownloadPath)) {
        fs.mkdirSync(clienteDownloadPath, { recursive: true });
      }

      // Buscar el iframeApplication donde estÃ¡ el buzÃ³n real
      let targetFrame = null;
      for (const frame of page.frames()) {
        if (frame.name() === 'iframeApplication') {
          targetFrame = frame;
          break;
        }
      }
      const frameToUse = targetFrame || page.mainFrame();

      // PASO 1: Hacer click en el mensaje para cargar sus detalles
      logger.info('Haciendo click en mensaje para ver detalles', { mensajeId });
      const clickedMessage = await frameToUse.evaluate((msgId) => {
        const messageLi = document.getElementById(msgId);
        if (messageLi) {
          const linkMensaje = messageLi.querySelector('.linkMensaje');
          if (linkMensaje) {
            linkMensaje.click();
            return true;
          }
        }
        return false;
      }, mensajeId);

      // Esperar a que carguen los detalles del mensaje
      await page.waitForTimeout(2000);

      // Obtener la fecha REAL del mensaje desde el detalle
      const fechaMensajeStr = await frameToUse.evaluate(() => {
        const fechaEl = document.getElementById('idFechaDetalle');
        return fechaEl ? fechaEl.textContent.trim() : '';
      });

      let fechaPrefix = '';
      if (fechaMensajeStr) {
        // Convertir DD/MM/YYYY HH:MM:SS a YYYYMMDDHHMMSS
        const [fecha, hora] = fechaMensajeStr.split(' ');
        if (fecha && hora) {
          const [d, m, y] = fecha.split('/');
          const [h, min, s] = hora.split(':');
          if (d && m && y && h && min && s) {
            fechaPrefix = `${y}${m}${d}${h}${min}${s}`;
          }
        }
      }

      // PASO 2: Identificar TODOS los archivos descargables (Constancia + Carta)
      const downloadTargets = await frameToUse.evaluate(() => {
        const targets = [];
        const seenUrls = new Set();

        // 1. Buscar enlaces directos de descarga (Constancias, etc.)
        const links = Array.from(document.querySelectorAll('a[href*="bajarArchivo"], a[href*=".pdf"]'));
        links.forEach(a => {
          if (!seenUrls.has(a.href)) {
            seenUrls.add(a.href);
            targets.push({
              type: 'link',
              url: a.href,
              name: a.innerText || 'archivo_adjunto'
            });
          }
        });

        // 2. Buscar Cartas embebidas en iframes
        const iframes = Array.from(document.querySelectorAll('iframe'));
        iframes.forEach(iframe => {
          try {
            const src = iframe.src || '';
            if (src.includes('gendocS01Alias') && src.includes('datos=')) {
              const currentUrl = document.location.href;
              const fullSrc = src.startsWith('http') ? src : new URL(src, currentUrl).href;

              const urlObj = new URL(fullSrc);
              const datosStr = urlObj.searchParams.get('datos');
              if (datosStr) {
                const datos = JSON.parse(datosStr);
                if (datos.id_archivo && datos.numruc) {
                  const downloadUrl = `${window.location.origin}/ol-ti-itvisornoti/visor/bajarArchivo/${datos.id_archivo}/${datos.id_anexo || 0}/${datos.sistema || 0}/${datos.numruc}`;

                  if (!seenUrls.has(downloadUrl)) {
                    seenUrls.add(downloadUrl);
                    targets.push({
                      type: 'carta',
                      url: downloadUrl,
                      name: `Carta_${datos.num_doc || datos.id_archivo}`
                    });
                  }
                }
              }
            }
          } catch (e) { }
        });

        return targets;
      });

      if (downloadTargets.length === 0) {
        return { success: false, error: 'No se encontraron adjuntos' };
      }

      // PASO 3: Descargar cada archivo secuencialmente
      const downloadedFiles = [];

      for (const target of downloadTargets) {
        try {
          const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

          const triggered = await frameToUse.evaluate((url) => {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_self';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            return true;
          }, target.url);

          if (triggered) {
            const download = await downloadPromise;
            let suggestedFilename = download.suggestedFilename();

            // Renombrar Cartas para incluir fecha real si existe
            if (target.type === 'carta' && fechaPrefix) {
              const safeName = target.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
              const ext = path.extname(suggestedFilename) || '.pdf';
              suggestedFilename = `Carta_${safeName}_${fechaPrefix}${ext}`;
              if (!suggestedFilename.startsWith('Carta')) {
                suggestedFilename = `Carta_${suggestedFilename}`;
              }
            }

            // Generar nombre de archivo Ãºnico SIEMPRE para evitar EBUSY
            const ext = path.extname(suggestedFilename);
            const name = path.basename(suggestedFilename, ext);
            // Formato: Nombre_TIMESTAMP_RANDOM.ext
            const uniqueName = `${name}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
            const filePath = path.join(clienteDownloadPath, uniqueName);

            await download.saveAs(filePath);
            downloadedFiles.push({ archivo: suggestedFilename, ruta: filePath });
            await page.waitForTimeout(1000);
          }
        } catch (err) {
          logger.warn(`Error descargando ${target.url}: ${err.message}`);
        }
      }

      const rutasHtml = downloadedFiles.map(f => f.ruta).join('<br/>');
      return {
        success: true,
        archivo: downloadedFiles.map(f => f.archivo).join(', '),
        ruta: rutasHtml,
        archivos: downloadedFiles
      };

    } catch (error) {
      logger.error('Error al descargar adjunto', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Cierra una sesiÃ³n del buzÃ³n
   * @param {string} browserId - ID de la sesiÃ³n
   * @returns {Promise<Object>} Resultado
   */
  async cerrarSesion(browserId) {
    try {
      const session = this.activeSessions.get(browserId);

      if (!session) {
        return {
          success: true,
          message: 'SesiÃ³n ya cerrada o no existe'
        };
      }

      const { browser, cliente } = session;

      try {
        await browser.close();
        logger.info('SesiÃ³n del buzÃ³n cerrada', { browserId, ruc: cliente.ruc });
      } catch (closeError) {
        logger.warn('Error al cerrar browser', { error: closeError.message });
      }

      this.activeSessions.delete(browserId);

      return {
        success: true,
        message: 'SesiÃ³n cerrada correctamente'
      };

    } catch (error) {
      logger.error('Error al cerrar sesiÃ³n del buzÃ³n', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cierra todas las sesiones activas del buzÃ³n
   * @returns {Promise<Object>} Resultado
   */
  async cerrarTodasLasSesiones() {
    try {
      const totalSesiones = this.activeSessions.size;

      for (const [browserId, session] of this.activeSessions.entries()) {
        try {
          await session.browser.close();
        } catch (error) {
          logger.warn('Error al cerrar sesiÃ³n', { browserId, error: error.message });
        }
      }

      this.activeSessions.clear();

      return {
        success: true,
        message: `${totalSesiones} sesiones cerradas`
      };

    } catch (error) {
      logger.error('Error al cerrar todas las sesiones', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene las sesiones activas
   * @returns {Array} Lista de sesiones activas
   */
  getSesionesActivas() {
    return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
      browserId: id,
      ruc: session.cliente.ruc,
      empresa: session.cliente.empresa
    }));
  }

  /**
   * Lista las constancias descargadas para un RUC especÃ­fico
   * @param {string} ruc - RUC del cliente
   * @returns {Promise<Object>} Lista de constancias
   */
  async listarConstancias(ruc) {
    try {
      const rucPath = path.join(this.downloadPath, ruc);

      if (!fs.existsSync(rucPath)) {
        return {
          success: true,
          constancias: [],
          message: 'No hay constancias descargadas para este RUC'
        };
      }

      const archivos = fs.readdirSync(rucPath);
      const constancias = archivos
        .filter(archivo => archivo.toLowerCase().endsWith('.pdf'))
        .map(archivo => {
          const filePath = path.join(rucPath, archivo);
          const stats = fs.statSync(filePath);

          let fecha = stats.mtime;
          let numeroDoc = '';

          // Intentar encontrar timestamp de 14 dÃ­gitos (YYYYMMDDHHMMSS)
          const dateMatch = archivo.match(/(\d{14})/);

          if (dateMatch) {
            const fechaStr = dateMatch[1];
            const year = parseInt(fechaStr.substring(0, 4));
            if (year >= 2000 && year <= 2099) {
              fecha = new Date(
                year,
                parseInt(fechaStr.substring(4, 6)) - 1,
                parseInt(fechaStr.substring(6, 8)),
                parseInt(fechaStr.substring(8, 10)),
                parseInt(fechaStr.substring(10, 12)),
                parseInt(fechaStr.substring(12, 14))
              );
            }
          }

          if (archivo.includes('constancia')) {
            const docMatch = archivo.match(/constancia_\d{14}.*_(\d+)_/);
            if (docMatch) numeroDoc = docMatch[1];
          } else if (archivo.includes('Carta')) {
            const docMatch = archivo.match(/Carta_([^\.]+)/);
            if (docMatch) numeroDoc = docMatch[1];
          }

          return {
            nombre: archivo,
            ruta: filePath,
            tamano: this.formatearTamano(stats.size),
            fecha: fecha.toLocaleString('es-PE'),
            timestamp: fecha.getTime(),
            numeroDoc: numeroDoc
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      logger.info('Constancias listadas', { ruc, total: constancias.length });

      return {
        success: true,
        constancias,
        total: constancias.length
      };

    } catch (error) {
      logger.error('Error al listar constancias', { ruc, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Abre una constancia en el visor predeterminado del sistema
   * @param {string} rutaArchivo - Ruta completa al archivo
   * @returns {Promise<Object>} Resultado
   */
  async abrirConstancia(rutaArchivo) {
    try {
      const shell = { openPath: (p) => Promise.resolve() };

      if (!fs.existsSync(rutaArchivo)) {
        return {
          success: false,
          error: 'El archivo no existe'
        };
      }

      await shell.openPath(rutaArchivo);
      logger.info('Constancia abierta', { ruta: rutaArchivo });

      return {
        success: true,
        message: 'Archivo abierto correctamente'
      };

    } catch (error) {
      logger.error('Error al abrir constancia', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Formatea el tamaÃ±o del archivo
   * @param {number} bytes - TamaÃ±o en bytes
   * @returns {string} TamaÃ±o formateado
   */
  formatearTamano(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Instancia singleton
const buzonHandler = new BuzonHandler();

module.exports = buzonHandler;

