const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const excelReader = require('./excelReader');
// [WEB] Electron removed
const shell = { openPath: (p) => Promise.resolve(), showItemInFolder: (p) => Promise.resolve() };
const axios = require('axios');

/**
 * Handler para Consulta de CPE via Web Scraping
 * Portal: https://e-factura.sunat.gob.pe
 */
class CPEScrapingHandler {
    get downloadPath() {
        const userStorageManager = require('./userStorageManager');
        if (userStorageManager && userStorageManager.isInitialized()) {
            const userDir = userStorageManager.getUserFolderPath('downloads');
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }
            return userDir;
        }
        const defaultDir = path.join(process.cwd(), 'descargas_cpe');
        if (!fs.existsSync(defaultDir)) {
            fs.mkdirSync(defaultDir, { recursive: true });
        }
        return defaultDir;
    }

    constructor() {
        this.activeSessions = new Map();
        this.proxySessions = new Map();
        this.ensureDirectories();

        // Limpiar sesiones inactivas de proxy cada 10 minutos (sesiones de mas de 2 horas)
        setInterval(() => {
            try {
                const now = Date.now();
                for (const [sid, sess] of this.proxySessions.entries()) {
                    if (now - sess.createdAt > 7200000) {
                        this.proxySessions.delete(sid);
                        logger.info(`Sesión proxy expirada y eliminada: ${sid}`);
                    }
                }
            } catch (err) {
                logger.error('Error en limpieza de sesiones proxy:', err);
            }
        }, 600000);
    }

    ensureDirectories() {
        if (this.downloadPath && !fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
            logger.info('Directorio de descargas CPE creado', { path: this.downloadPath });
        }
        const screenshotsPath = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotsPath)) {
            fs.mkdirSync(screenshotsPath, { recursive: true });
        }
    }

    /**
     * Obtiene credenciales desde API_SIRE.xlsm
     */
    async obtenerCredenciales(ruc) {
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
                            clave_sol: cliente.clave
                        }
                    };
                }
            }
            const apiSirePath = path.join(process.cwd(), 'server', 'data', 'API_SIRE.xlsm');

            if (!fs.existsSync(apiSirePath)) {
                return { success: false, error: 'No se encontrÃ³ API_SIRE.xlsm' };
            }

            const clientes = await excelReader.readClients(apiSirePath);
            const cliente = clientes.find(c => c.ruc === ruc);

            if (!cliente) {
                return { success: false, error: `No se encontrÃ³ RUC ${ruc} en API_SIRE.xlsm` };
            }

            return {
                success: true,
                data: {
                    ruc: cliente.ruc,
                    razonSocial: cliente.empresa,
                    usuario_sol: cliente.usuario_sol || cliente.usuario,
                    clave_sol: cliente.clave_sol || cliente.clave
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene lista de empresas desde API_SIRE.xlsm
     */
    async obtenerEmpresas() {
        try {
            const clientStorage = require('./clientStorageService');
            if (clientStorage && clientStorage.currentUserId) {
                const clients = clientStorage.getAllClients();
                const empresas = clients.map(c => ({
                    ruc: c.ruc,
                    razonSocial: c.empresa
                }));
                return { success: true, empresas };
            }
            const apiSirePath = path.join(process.cwd(), 'server', 'data', 'API_SIRE.xlsm');

            if (!fs.existsSync(apiSirePath)) {
                return { success: false, error: 'No se encontrÃ³ API_SIRE.xlsm', empresas: [] };
            }

            const clientes = await excelReader.readClients(apiSirePath);
            const empresas = clientes.map(c => ({
                ruc: c.ruc,
                razonSocial: c.empresa
            }));

            return { success: true, empresas };
        } catch (error) {
            return { success: false, error: error.message, empresas: [] };
        }
    }

    /**
     * Consulta CPE via web scraping
     * Flujo: 1) Login en SOL  2) Navegar al portal CPE  3) Consultar
     */
    async consultarCPE(rucConsultante, { rucEmisor, tipoDoc, serie, numero, filtro = 'recibido' }) {
        let browser = null;
        let page = null;

        try {
            logger.info('Iniciando consulta CPE via web scraping', { rucConsultante, rucEmisor, serie, numero });

            // Obtener credenciales
            const credResult = await this.obtenerCredenciales(rucConsultante);
            if (!credResult.success) {
                return credResult;
            }
            const cliente = credResult.data;

            browser = await chromium.launch({
                headless: true, // Oculto para optimizar rendimiento
                // slowMo: 0, // Eliminado para mayor velocidad
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--start-maximized'
                ]
            });

            const context = await browser.newContext({
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1366, height: 900 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });
            page = await context.newPage();

            // Anti-detección
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(90000);

            // ========== PASO 1: LOGIN EN SUNAT SOL ==========
            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            logger.info('PASO 1: Navegando al login SUNAT', { url: loginUrl });

            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // Esperar formulario de login
            logger.info('Esperando formulario de login...');
            await page.waitForSelector('#txtRuc', { timeout: 30000 });

            // Rellenar formulario
            logger.info('Rellenando credenciales...');
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario_sol);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave_sol);
            await page.waitForTimeout(500);

            logger.info('Enviando login...', { ruc: cliente.ruc, usuario: cliente.usuario_sol });

            // Click en login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => { }),
                page.click('#btnAceptar')
            ]);

            // Esperar carga
            await page.waitForTimeout(3000);

            let currentUrl = page.url();
            logger.info('URL despuÃ©s de login:', { url: currentUrl });

            // Si estamos en api-seguridad (OAuth), navegar al menÃº principal
            if (currentUrl.includes('api-seguridad')) {
                logger.info('Detectada pÃ¡gina OAuth, navegando al menÃº principal...');
                const menuUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
                await page.goto(menuUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(3000);
                currentUrl = page.url();
                logger.info('URL despuÃ©s de navegar al menÃº:', { url: currentUrl });
            }


            logger.info('Login exitoso, continuando...');

            // ========== PASO 2: NAVEGACIÃ“N DIRECTA A LA INTERFAZ ==========
            // Navegamos directamente al link de consulta de facturas sin clicks en el menÃº
            logger.info('PASO 2: Navegando directamente a la interfaz de consulta de facturas...');

            const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
            await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // Esperar procesamiento de la navegaciÃ³n directa
            await page.waitForTimeout(3000);

            // Capturar la URL actual
            currentUrl = page.url();
            logger.info('URL despuÃ©s de navegaciÃ³n directa:', { url: currentUrl });

            // ========== PASO 3: NAVEGAR AL PORTAL CPE ==========
            const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
            logger.info('PASO 3: Navegando al portal CPE...', { url: cpeUrl });

            await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // Esperar que cargue el formulario Angular
            logger.info('Esperando carga del formulario Angular...');
            await page.waitForTimeout(5000);

            // ========== PASO 4: RELLENAR FORMULARIO DE CONSULTA ==========
            logger.info('PASO 4: Rellenando formulario de consulta...');

            // Seleccionar "Recibido" o "Emitido" segÃºn el filtro
            if (filtro === 'recibido') {
                try {
                    await page.click('label[for="recibido"]');
                    logger.info('Seleccionado: Recibido');
                } catch (e) {
                    await page.click('#recibido');
                }
            } else {
                try {
                    await page.click('label[for="emitido"]');
                    logger.info('Seleccionado: Emitido');
                } catch (e) {
                    await page.click('#emitido');
                }
            }
            // await page.waitForTimeout(100);

            // Rellenar RUC Emisor (input[name="rucEmisor"])
            try {
                await page.fill('input[name="rucEmisor"]', rucEmisor);
                logger.info('RUC Emisor rellenado', { ruc: rucEmisor });
            } catch (e) {
                await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor);
            }
            // await page.waitForTimeout(100);

            // Tipo Comprobante (p-dropdown)
            try {
                const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crÃ©dito', '08': 'Nota de dÃ©bito' };
                const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

                // OptimizaciÃ³n: Click directo y selecciÃ³n rÃ¡pida
                await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]');
                await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 2000 }).catch(() => page.click(`text=${tipoLabel}`));
                logger.info('Tipo comprobante seleccionado', { tipo: tipoLabel });
            } catch (e) {
                logger.warn('Error seleccionando tipo comprobante:', e.message);
            }
            // await page.waitForTimeout(100);

            // Serie (input[name="serieComprobante"])
            try {
                await page.fill('input[name="serieComprobante"]', serie);
                logger.info('Serie rellenada', { serie });
            } catch (e) {
                await page.fill('input[formcontrolname="serieComprobante"]', serie);
            }
            // await page.waitForTimeout(100);

            // NÃºmero (input[name="numeroComprobante"])
            try {
                await page.fill('input[name="numeroComprobante"]', numero);
                logger.info('NÃºmero rellenado', { numero });
            } catch (e) {
                await page.fill('input[formcontrolname="numeroComprobante"]', numero);
            }
            // await page.waitForTimeout(100);


            // Click en "Consultar"
            logger.info('Haciendo click en Consultar...');
            try {
                await page.click('button.boton-primary:has-text("Consultar")');
            } catch (e) {
                await page.click('button[type="submit"]:has-text("Consultar")');
            }

            // Esperar resultado
            await page.waitForTimeout(3000);


            // Extraer resultado - mejorado para detectar datos especÃ­ficos del formato HTML
            const resultado = await page.evaluate(() => {
                const body = document.body.innerText;
                const modal = document.querySelector('div[role="document"].modal-dialog');

                // Si no hay modal de resultado, verificamos mensajes de texto simple
                if (!modal) {
                    if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe') || body.includes('no existe registro')) {
                        return { estado: 'NO_ENCONTRADO', encontrado: false };
                    }
                    if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true };
                    return { estado: 'PENDIENTE_REVISION', encontrado: false };
                }

                // ExtracciÃ³n de datos especÃ­ficos del HTML (si existe el modal)
                const datos = {
                    estado: 'ENCONTRADO',
                    encontrado: true,
                    html: modal.outerHTML, // Guardamos todo el HTML para renderizarlo igual
                    razonSocial: '',
                    rucEmisor: '',
                    fechaEmision: '',
                    importeTotal: ''
                };

                // 1. RazÃ³n Social (Clase .emisor)
                const emisorTable = modal.querySelector('table.emisor');
                if (emisorTable) {
                    const bTags = emisorTable.querySelectorAll('b');
                    if (bTags.length > 0) datos.razonSocial = bTags[0].innerText.trim();
                }

                // 2. RUC Emisor y NÃºmero (Clase .comprobante-numeracion)
                const numeracionTable = modal.querySelector('table.comprobante-numeracion');
                if (numeracionTable) {
                    const tds = numeracionTable.querySelectorAll('td');
                    tds.forEach(td => {
                        const text = td.innerText;
                        if (text.includes('RUC:')) datos.rucEmisor = text.replace('RUC:', '').trim();
                    });
                }

                // 3. Fecha de EmisiÃ³n (Clase .comprobante-datosprincipales)
                const filasDatos = modal.querySelectorAll('tr.comprobante-datosprincipales');
                filasDatos.forEach(tr => {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length >= 3 && tds[0].innerText.includes('Fecha de EmisiÃ³n')) {
                        datos.fechaEmision = tds[2].innerText.trim();
                    }
                });

                // 4. Importe Total (Clase .comprobante-totales)
                const totalesTable = modal.querySelector('table.comprobante-totales');
                if (totalesTable) {
                    const filas = totalesTable.querySelectorAll('tr');
                    filas.forEach(tr => {
                        const tds = tr.querySelectorAll('td');
                        if (tds.length >= 3 && tds[0].innerText.includes('Importe total')) {
                            datos.importeTotal = tds[2].innerText.trim();
                        }
                    });
                }

                // Determinar estado basado en el contenido visual si es posible, sino default ENCONTRADO
                if (body.includes('Estado del comprobante: ACEPTADO') || body.includes('ACTIVO')) {
                    datos.estado = 'ACEPTADO';
                } else if (body.includes('ANULADO') || body.includes('BAJA')) {
                    datos.estado = 'ANULADO';
                }

                return datos;
            });

            // Guardar sesiÃ³n para descargas
            const sessionId = `cpe_${rucConsultante}_${Date.now()}`;

            this.activeSessions.set(sessionId, { browser, page, context, cliente, cpe: { rucEmisor, tipoDoc, serie, numero } });

            logger.info('Consulta CPE completada', { resultado, sessionId });

            return {
                success: true,
                data: resultado,
                sessionId,
                cpeId: `${rucEmisor}-${tipoDoc}-${serie}-${numero}`
            };
        } catch (error) {
            logger.error('Error en consulta CPE', { error: error.message, stack: error.stack });



            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Helper universal para descargas seguras (Estrategia tipo BuzÃ³n: Native Playwright Download)
     * Espera el evento de descarga nativo del navegador en lugar de interceptar red manualmente.
     */
    async _descargarArchivoInterceptado(session, selector, tipoArchivo, extension) {
        const { page, cliente, cpe } = session;
        const tempPath = path.join(this.downloadPath, cliente.ruc);
        if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });

        try {
            logger.info(`Iniciando descarga nativa de ${tipoArchivo}...`);

            // 1. Encontrar el botÃ³n (misma lÃ³gica robusta)
            let btn = null;
            if (tipoArchivo === 'pdf') {
                btn = await page.$('button[ngbtooltip="Descargar PDF"]') || await page.$('button i.fa-file-pdf');
            } else if (tipoArchivo === 'xml') {
                btn = await page.$('button[ngbtooltip="Descargar XML"]') || await page.$('button i.fa-file-code');
            } else if (tipoArchivo === 'cdr') {
                btn = await page.evaluateHandle(() => {
                    const tilde = document.querySelector('button[ngbtooltip="Descargar CDR"]');
                    if (tilde) return tilde;
                    const icons = Array.from(document.querySelectorAll('i'));
                    const icon = icons.find(i => i.classList.contains('fa-file-contract') || i.classList.contains('fa-file-signature'));
                    return icon ? icon.closest('button') : null;
                });
            }

            if (!btn) throw new Error(`BotÃ³n de descarga ${tipoArchivo} no encontrado. Verifique resultados.`);

            // Debug: Loguear el HTML del botÃ³n encontrado para verificar
            const btnHtml = await btn.evaluate(b => b.outerHTML);
            logger.info(`BotÃ³n ${tipoArchivo} encontrado:`, { html: btnHtml });

            // Verificar si el botÃ³n estÃ¡ deshabilitado
            const isDisabled = await btn.evaluate(b => b.hasAttribute('disabled') || b.classList.contains('disabled'));
            if (isDisabled) {
                logger.warn(`El botÃ³n de descarga ${tipoArchivo} estÃ¡ deshabilitado (Posiblemente no disponible).`);
                return { success: false, error: `${tipoArchivo.toUpperCase()} no disponible (BotÃ³n deshabilitado)` };
            }

            // 2. Preparar espera del evento 'download' (Timeout aumentado a 60s por seguridad)
            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

            // 3. Click (intentamos click nativo primero, luego JS)
            let clicked = false;
            try {
                if (btn.click) {
                    await btn.click();
                    clicked = true;
                }
            } catch (e) { }

            if (!clicked) {
                await btn.evaluate(b => b.click());
            }

            // 4. Esperar a que el navegador inicie y complete la descarga
            const download = await downloadPromise;

            // 5. Determinar extensiÃ³n desde el servidor (IMPORTANTE: SUNAT envÃ­a ZIPs incluso si pides XML)
            const suggestedFilename = download.suggestedFilename();
            const serverExtension = path.extname(suggestedFilename) || `.${extension}`;

            // Construir nombre: RUC-TIPO-SERIE-NUMERO + extensiÃ³n real del servidor
            const filename = `${cpe.rucEmisor}-${cpe.tipoDoc}-${cpe.serie}-${cpe.numero}${serverExtension}`;
            const filePath = path.join(tempPath, filename);

            // Limpiar archivo previo si existe
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { }
            }

            // 6. Guardar en la ruta especÃ­fica (Playwright maneja el stream temporal)
            await download.saveAs(filePath);

            logger.info(`${tipoArchivo.toUpperCase()} descargado exitosamente`, { filePath, originalName: suggestedFilename });
            shell.showItemInFolder(filePath);
            return { success: true, path: filePath };

        } catch (error) {
            logger.error(`Error en descarga nativa de ${tipoArchivo}`, { error: error.message });
            return { success: false, error: `Error descargando: ${error.message}` };
        }
    }

    async _findSession(sessionId, cpeData = null) {
        // 1. Intento directo por ID
        if (this.activeSessions.has(sessionId)) {
            return this.activeSessions.get(sessionId);
        }

        // 2. BÃºsqueda por coincidencia de CPE (Fuzzy Match)
        // Esto recupera la sesiÃ³n si el ID cambiÃ³ o se perdiÃ³ pero la ventana sigue abierta con esa factura
        if (cpeData) {
            logger.info('âš ï¸ BÃºsqueda por ID fallÃ³, intentando recuperar por datos del CPE...', { cpeData });
            for (const [key, session] of this.activeSessions.entries()) {
                const sCpe = session.cpe;
                if (sCpe && cpeData.rucEmisor && sCpe.rucEmisor === cpeData.rucEmisor &&
                    sCpe.serie === cpeData.serie &&
                    sCpe.numero === cpeData.numero) {
                    logger.info(`âœ… SesiÃ³n recuperada por coincidencia de CPE! ID original: ${sessionId}, ID encontrado: ${key}`);
                    return session;
                }
            }
        }

        // 3. Fallo total
        const activeKeys = Array.from(this.activeSessions.keys());
        logger.warn(`âŒ SesiÃ³n no encontrada: ${sessionId}. Activas (${this.activeSessions.size}): [${activeKeys.join(', ')}]`);
        return null;
    }

    /**
     * Descarga PDF del CPE
     */
    async descargarPDF(sessionId, cpeData = null) {
        logger.info(`Solicitud descarga PDF para sesiÃ³n: ${sessionId}`, { cpeData });
        const session = await this._findSession(sessionId, cpeData);
        if (!session) {
            const activeKeys = Array.from(this.activeSessions.keys());
            logger.warn(`SesiÃ³n no encontrada o expirada: ${sessionId}. Sesiones activas (${this.activeSessions.size}): [${activeKeys.join(', ')}]`);
            return { success: false, error: 'SesiÃ³n expirada' };
        }
        return await this._descargarArchivoInterceptado(session, null, 'pdf', 'pdf');
    }

    async descargarXML(sessionId, cpeData = null) {
        logger.info(`Solicitud descarga XML para sesiÃ³n: ${sessionId}`, { cpeData });
        const session = await this._findSession(sessionId, cpeData);
        if (!session) {
            logger.warn(`SesiÃ³n no encontrada o expirada: ${sessionId}`);
            return { success: false, error: 'SesiÃ³n expirada' };
        }
        return await this._descargarArchivoInterceptado(session, null, 'xml', 'xml');
    }

    async descargarCDR(sessionId, cpeData = null) {
        logger.info(`Solicitud descarga CDR para sesiÃ³n: ${sessionId}`, { cpeData });
        const session = await this._findSession(sessionId, cpeData);
        if (!session) {
            logger.warn(`SesiÃ³n no encontrada o expirada: ${sessionId}`);
            return { success: false, error: 'SesiÃ³n expirada' };
        }
        return await this._descargarArchivoInterceptado(session, null, 'cdr', 'zip');
    }

    /**
     * Cierra una sesiÃ³n
     */
    async cerrarSesion(sessionId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                if (session.browser) {
                    await session.browser.close();
                }
                this.activeSessions.delete(sessionId);
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Cierra todas las sesiones
     */
    async cerrarTodasLasSesiones() {
        for (const [sessionId, session] of this.activeSessions) {
            try {
                if (session.browser) {
                    await session.browser.close();
                }
            } catch (e) { }
        }
        this.activeSessions.clear();
        return { success: true };
    }

    /**
     * Lista archivos descargados (constancias) para un RUC consultante
     * Lee el directorio descargas_cpe/[RUC] y devuelve la lista de archivos PDF, XML, ZIP
     */
    async listarConstancias(rucConsultante) {
        try {
            const rucPath = path.join(this.downloadPath, rucConsultante);

            // Verificar si existe el directorio
            if (!fs.existsSync(rucPath)) {
                return {
                    success: true,
                    archivos: [],
                    message: 'No hay archivos descargados para este RUC'
                };
            }

            // Leer archivos del directorio
            const files = fs.readdirSync(rucPath);

            // Filtrar solo PDF, XML, ZIP y obtener metadata
            const archivos = files
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.pdf', '.xml', '.zip'].includes(ext);
                })
                .map(file => {
                    const filePath = path.join(rucPath, file);
                    const stats = fs.statSync(filePath);

                    return {
                        nombre: file,
                        ruta: filePath,
                        size: stats.size,
                        fechaModificacion: stats.mtime,
                        tipo: path.extname(file).substring(1).toUpperCase() // PDF, XML, ZIP
                    };
                })
                .sort((a, b) => b.fechaModificacion - a.fechaModificacion); // MÃ¡s recientes primero

            logger.info(`Listadas ${archivos.length} constancias para RUC ${rucConsultante}`);

            return {
                success: true,
                archivos,
                total: archivos.length
            };

        } catch (error) {
            logger.error('Error listando constancias', { error: error.message });
            return {
                success: false,
                error: error.message,
                archivos: []
            };
        }
    }

    /**
     * Consulta masiva usando 20 PESTAÃ‘AS en un ÃšNICO BROWSER VISIBLE
     * Procesa en lotes de 20: abre tabs, consulta en paralelo, extrae datos, cierra y continÃºa
     * @param {string} sessionId - NO USADO (mantener por compatibilidad)
     * @param {Array} listaComprobantes - Lista de comprobantes [{rucEmisor, tipoDoc, serie, numero, filtro}]
     * @param {Object} cliente - Datos del cliente (puede ser solo {ruc} o {ruc, usuario, clave})
     */
    async consultarMasivo(sessionId, listaComprobantes, cliente) {
        const MAX_TABS = 20; // MÃ¡ximo de pestaÃ±as simultÃ¡neas
        const CONSULTA_URL = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
        const CPE_URL = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';

        logger.info(`ðŸš€ Iniciando consulta masiva con ${MAX_TABS} PESTAÃ‘AS para ${listaComprobantes.length} comprobantes...`);

        // Validar que al menos tengamos el RUC
        if (!cliente || !cliente.ruc) {
            return {
                success: false,
                error: 'Se requiere el RUC del cliente consultante'
            };
        }

        // Si no se enviaron credenciales, buscarlas automÃ¡ticamente en API_SIRE.xlsm
        let credencialesCompletas = cliente;
        if (!cliente.usuario || !cliente.clave) {
            logger.info(`Buscando credenciales para RUC: ${cliente.ruc} en API_SIRE.xlsm...`);
            const credResult = await this.obtenerCredenciales(cliente.ruc);

            if (!credResult.success) {
                return {
                    success: false,
                    error: `No se encontraron credenciales para RUC ${cliente.ruc} en API_SIRE.xlsm`
                };
            }

            credencialesCompletas = credResult.data;
            logger.info(`âœ… Credenciales obtenidas exitosamente para ${credResult.data.razonSocial}`);
        }

        const resultados = [];
        let browser = null;
        let context = null;

        try {
            // ========== PASO 1: LANZAR BROWSER OCULTO ==========
            logger.info('ðŸŒ Lanzando browser OCULTO...');
            browser = await chromium.launch({
                headless: true, // OCULTO para producciÃ³n
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars'
                ]
            });

            context = await browser.newContext({
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });

            // ========== PASO 2: LOGIN EN PRIMERA PESTAÃ‘A ==========
            logger.info('ðŸ” Realizando login en SUNAT...');
            const loginPage = await context.newPage();

            // Anti-detecciÃ³n
            await loginPage.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            loginPage.setDefaultTimeout(60000);
            loginPage.setDefaultNavigationTimeout(90000);

            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            await loginPage.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
            await loginPage.waitForSelector('#txtRuc', { timeout: 30000 });

            // Rellenar formulario de login
            await loginPage.fill('#txtRuc', credencialesCompletas.ruc);
            await loginPage.waitForTimeout(500);
            await loginPage.fill('#txtUsuario', credencialesCompletas.usuario_sol);
            await loginPage.waitForTimeout(500);
            await loginPage.fill('#txtContrasena', credencialesCompletas.clave_sol);
            await loginPage.waitForTimeout(500);

            logger.info('ðŸ“¤ Enviando login...');
            await Promise.all([
                loginPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => { }),
                loginPage.click('#btnAceptar')
            ]);
            await loginPage.waitForTimeout(3000);

            // Verificar OAuth
            let currentUrl = loginPage.url();
            if (currentUrl.includes('api-seguridad')) {
                logger.info('Detectada pÃ¡gina OAuth, navegando al menÃº principal...');
                await loginPage.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', { waitUntil: 'domcontentloaded', timeout: 60000 });
                await loginPage.waitForTimeout(3000);
            }

            logger.info('âœ… Login exitoso');

            // Navegar a la URL de consulta para establecer sesiÃ³n
            await loginPage.goto(CONSULTA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
            await loginPage.waitForTimeout(5000);

            // IMPORTANTE: NO cerrar la pestaÃ±a de login - mantenerla abierta para conservar la sesiÃ³n
            logger.info('ðŸ“Œ PestaÃ±a principal con sesiÃ³n activa (NO cerrar)');

            // ========== PASO 3: PROCESAR EN LOTES DE 20 ==========
            const totalLotes = Math.ceil(listaComprobantes.length / MAX_TABS);
            logger.info(`ðŸ“Š Total de lotes a procesar: ${totalLotes} (${MAX_TABS} facturas por lote)`);

            for (let loteIdx = 0; loteIdx < totalLotes; loteIdx++) {
                const inicio = loteIdx * MAX_TABS;
                const fin = Math.min(inicio + MAX_TABS, listaComprobantes.length);
                const loteActual = listaComprobantes.slice(inicio, fin);

                logger.info(`\n========== LOTE ${loteIdx + 1}/${totalLotes} (Facturas ${inicio + 1} a ${fin}) ==========`);

                // ========== CREAR PESTAÃ‘AS PARA ESTE LOTE ==========
                const tabs = [];
                for (let i = 0; i < loteActual.length; i++) {
                    const tab = await context.newPage();
                    await tab.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    });
                    tab.setDefaultTimeout(60000);
                    tab.setDefaultNavigationTimeout(90000);
                    tabs.push(tab);
                    logger.info(`ðŸ“‘ [TAB ${i + 1}/${loteActual.length}] Creada`);
                }

                // ========== NAVEGAR TODAS LAS TABS A LA URL DE CONSULTA ==========
                logger.info('ðŸŒ Navegando todas las pestaÃ±as a la URL de consulta...');
                await Promise.all(tabs.map(async (tab, i) => {
                    try {
                        // IMPORTANTE: Usar CONSULTA_URL, NO CPE_URL
                        await tab.goto(CONSULTA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
                        await tab.waitForTimeout(3000 + (i * 300)); // Escalonar para no saturar
                    } catch (e) {
                        logger.warn(`[TAB ${i + 1}] Error navegando: ${e.message}`);
                    }
                }));

                await new Promise(r => setTimeout(r, 3000)); // Esperar que todas carguen

                // ========== PROCESAR CONSULTAS EN PARALELO CON REINTENTOS ==========
                logger.info('ðŸ” Ejecutando consultas en paralelo...');
                const MAX_RETRIES = 3;

                const promesasLote = tabs.map(async (tab, i) => {
                    const cpe = loteActual[i];
                    const { rucEmisor, tipoDoc, serie, numero, filtro = 'recibido' } = cpe;
                    const tabNum = inicio + i + 1;
                    const uniqueSessionId = `cpe_tab_${credencialesCompletas.ruc}_${Date.now()}_${tabNum}`;

                    // FunciÃ³n para ejecutar consulta con reintentos
                    const ejecutarConsultaConReintento = async (intentoActual = 1) => {
                        try {
                            logger.info(`[TAB ${i + 1}/${loteActual.length}] Consultando ${rucEmisor}-${serie}-${numero}... (Intento ${intentoActual})`);

                            // Si es reintento, recargar la pÃ¡gina primero
                            if (intentoActual > 1) {
                                logger.info(`[TAB ${i + 1}] Recargando pÃ¡gina para reintento...`);
                                await tab.goto(CONSULTA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
                                await tab.waitForTimeout(3000);
                            }

                            // Seleccionar "Recibido" o "Emitido"
                            if (filtro === 'recibido') {
                                try { await tab.click('label[for="recibido"]'); } catch (e) { await tab.click('#recibido').catch(() => { }); }
                            } else {
                                try { await tab.click('label[for="emitido"]'); } catch (e) { await tab.click('#emitido').catch(() => { }); }
                            }

                            await tab.waitForTimeout(500);

                            // Rellenar RUC Emisor
                            try {
                                await tab.fill('input[name="rucEmisor"]', rucEmisor);
                            } catch (e) {
                                await tab.fill('input[formcontrolname="rucEmisor"]', rucEmisor).catch(() => { });
                            }

                            // Tipo Comprobante
                            try {
                                const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crÃ©dito', '08': 'Nota de dÃ©bito' };
                                const tipoLabel = tipoLabels[tipoDoc] || 'Factura';
                                await tab.click('p-dropdown[formcontrolname="tipoComprobanteI"]');
                                await tab.waitForTimeout(300);
                                await tab.click(`li[aria-label="${tipoLabel}"]`, { timeout: 2000 }).catch(() => tab.click(`text=${tipoLabel}`).catch(() => { }));
                            } catch (e) {
                                // Ignorar error de tipo
                            }

                            // Serie
                            try {
                                await tab.fill('input[name="serieComprobante"]', serie);
                            } catch (e) {
                                await tab.fill('input[formcontrolname="serieComprobante"]', serie).catch(() => { });
                            }

                            // NÃºmero
                            try {
                                await tab.fill('input[name="numeroComprobante"]', numero);
                            } catch (e) {
                                await tab.fill('input[formcontrolname="numeroComprobante"]', numero).catch(() => { });
                            }

                            await tab.waitForTimeout(500);

                            // Click en "Consultar"
                            try {
                                await tab.click('button.boton-primary:has-text("Consultar")');
                            } catch (e) {
                                await tab.click('button[type="submit"]:has-text("Consultar")').catch(() => { });
                            }

                            // Esperar resultado
                            await tab.waitForTimeout(4000);

                            // Verificar si hay error de servidor
                            const pageContent = await tab.content();
                            const bodyText = await tab.evaluate(() => document.body.innerText);

                            if (bodyText.includes('Error del Servidor') ||
                                bodyText.includes('no se puede acceder') ||
                                bodyText.includes('reintentar en') ||
                                bodyText.includes('error de conexiÃ³n') ||
                                pageContent.includes('Error del Servidor')) {

                                logger.warn(`âš ï¸ [TAB ${i + 1}] Error del servidor detectado, reintento ${intentoActual}/${MAX_RETRIES}`);

                                // Click en ACEPTAR si existe
                                try {
                                    await tab.click('button:has-text("ACEPTAR")').catch(() => { });
                                    await tab.click('button:has-text("Aceptar")').catch(() => { });
                                    await tab.waitForTimeout(1000);
                                } catch (e) { }

                                if (intentoActual < MAX_RETRIES) {
                                    // Esperar antes de reintentar
                                    await tab.waitForTimeout(5000);
                                    return await ejecutarConsultaConReintento(intentoActual + 1);
                                } else {
                                    return { estado: 'ERROR_SERVIDOR', encontrado: false, error: 'Error del servidor SUNAT despuÃ©s de mÃºltiples reintentos' };
                                }
                            }

                            // Extraer resultado
                            const resultado = await tab.evaluate(() => {
                                const body = document.body.innerText;
                                const modal = document.querySelector('div[role="document"].modal-dialog');

                                if (!modal) {
                                    if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe')) {
                                        return { estado: 'NO_ENCONTRADO', encontrado: false };
                                    }
                                    if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true };
                                    return { estado: 'PENDIENTE_REVISION', encontrado: false };
                                }

                                const datos = {
                                    estado: 'ENCONTRADO',
                                    encontrado: true,
                                    html: modal.outerHTML,
                                    razonSocial: '',
                                    rucEmisor: '',
                                    fechaEmision: '',
                                    importeTotal: ''
                                };

                                const emisorTable = modal.querySelector('table.emisor');
                                if (emisorTable) {
                                    const bTags = emisorTable.querySelectorAll('b');
                                    if (bTags.length > 0) datos.razonSocial = bTags[0].innerText.trim();
                                }

                                const numeracionTable = modal.querySelector('table.comprobante-numeracion');
                                if (numeracionTable) {
                                    const tds = numeracionTable.querySelectorAll('td');
                                    tds.forEach(td => {
                                        const text = td.innerText;
                                        if (text.includes('RUC:')) datos.rucEmisor = text.replace('RUC:', '').trim();
                                    });
                                }

                                const filasDatos = modal.querySelectorAll('tr.comprobante-datosprincipales');
                                filasDatos.forEach(tr => {
                                    const tds = tr.querySelectorAll('td');
                                    if (tds.length >= 3 && tds[0].innerText.includes('Fecha de EmisiÃ³n')) {
                                        datos.fechaEmision = tds[2].innerText.trim();
                                    }
                                });

                                const totalesTable = modal.querySelector('table.comprobante-totales');
                                if (totalesTable) {
                                    const filas = totalesTable.querySelectorAll('tr');
                                    filas.forEach(tr => {
                                        const tds = tr.querySelectorAll('td');
                                        if (tds.length >= 3 && tds[0].innerText.includes('Importe total')) {
                                            datos.importeTotal = tds[2].innerText.trim();
                                        }
                                    });
                                }

                                if (body.includes('Estado del comprobante: ACEPTADO') || body.includes('ACTIVO')) {
                                    datos.estado = 'ACEPTADO';
                                } else if (body.includes('ANULADO') || body.includes('BAJA')) {
                                    datos.estado = 'ANULADO';
                                }

                                return datos;
                            });

                            return resultado;

                        } catch (error) {
                            logger.error(`âŒ [TAB ${i + 1}] Error en intento ${intentoActual}: ${error.message}`);
                            if (intentoActual < MAX_RETRIES) {
                                await tab.waitForTimeout(3000);
                                return await ejecutarConsultaConReintento(intentoActual + 1);
                            }
                            throw error;
                        }
                    };

                    try {
                        const resultado = await ejecutarConsultaConReintento();
                        logger.info(`âœ… [TAB ${i + 1}] ${rucEmisor}-${serie}-${numero} â†’ ${resultado.estado}`);

                        // Guardar sesiÃ³n para posibles descargas
                        this.activeSessions.set(uniqueSessionId, {
                            browser,
                            page: tab,
                            context,
                            cliente: credencialesCompletas,
                            cpe: cpe
                        });

                        return {
                            success: resultado.estado !== 'ERROR_SERVIDOR',
                            data: resultado,
                            request: cpe,
                            sessionId: uniqueSessionId,
                            rucConsultante: credencialesCompletas.ruc
                        };

                    } catch (error) {
                        logger.error(`âŒ [TAB ${i + 1}] Error final: ${error.message}`);
                        return {
                            success: false,
                            error: error.message,
                            request: cpe
                        };
                    }
                });

                // Esperar que todas las consultas del lote terminen
                const resultadosLote = await Promise.all(promesasLote);
                resultados.push(...resultadosLote);

                logger.info(`âœ… Lote ${loteIdx + 1} completado: ${resultadosLote.filter(r => r.success).length}/${loteActual.length} exitosos`);

                // ========== CERRAR PESTAÃ‘AS DEL LOTE ==========
                logger.info('ðŸ”’ Cerrando pestaÃ±as del lote...');
                for (const tab of tabs) {
                    try {
                        await tab.close();
                    } catch (e) { }
                }

                // Esperar un poco antes del siguiente lote
                if (loteIdx < totalLotes - 1) {
                    logger.info('â³ Preparando siguiente lote...');
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            // ========== CERRAR BROWSER AL FINALIZAR ==========
            logger.info('ðŸ”’ Cerrando browser...');
            try {
                await browser.close();
            } catch (e) { }

            const exitosos = resultados.filter(r => r.success).length;
            const fallidos = resultados.filter(r => !r.success).length;

            logger.info(`\nðŸŽ‰ ========== CONSULTA MASIVA COMPLETADA ==========`);
            logger.info(`ðŸ“Š Total: ${listaComprobantes.length} | âœ… Exitosos: ${exitosos} | âŒ Fallidos: ${fallidos}`);

            return {
                success: true,
                total: listaComprobantes.length,
                procesados: exitosos,
                fallidos: fallidos,
                resultados
            };

        } catch (error) {
            logger.error('Error crÃ­tico en consulta masiva:', error);

            // Cerrar browser en caso de error
            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return {
                success: false,
                error: error.message,
                resultados
            };
        }
    }

    /**
     * Descarga masiva para MODO PRODUCCIÃ“N (Auto-descarga PDF)
     * Realiza consulta y descarga automÃ¡ticamente el PDF de cada comprobante.
     * Cierra los browsers al finalizar cada descarga para liberar recursos.
     */
    async descargarMasivoProduccion(sessionId, listaComprobantes, cliente) {
        logger.info(`ðŸš€ Iniciando DESCARGA MASIVA PRODUCCIÃ“N de ${listaComprobantes.length} comprobantes...`);

        // Validar RUC
        if (!cliente || !cliente.ruc) {
            return { success: false, error: 'Se requiere el RUC del cliente consultante' };
        }

        // Credenciales
        let credencialesCompletas = cliente;
        if (!cliente.usuario || !cliente.clave) {
            const credResult = await this.obtenerCredenciales(cliente.ruc);
            if (!credResult.success) {
                return { success: false, error: `No se encontraron credenciales para RUC ${cliente.ruc}` };
            }
            credencialesCompletas = credResult.data;
        }

        const MAX_BROWSERS_SIMULTANEOS = 5; // Menos concurrencia para asegurar descargas estables
        const resultados = [];
        let browsersActivos = 0;

        try {
            const procesarDescarga = async (cpe, idx) => {
                const uniqueSessionId = `prod_${credencialesCompletas.ruc}_${Date.now()}_${idx}`;
                let browser = null;

                try {
                    // Reutilizamos la lÃ³gica de consulta pero forzando una sesiÃ³n efÃ­mera
                    // TODO: Refactorizar para no duplicar todo el cÃ³digo de lanzamiento/login
                    // Por ahora, usamos una versiÃ³n simplificada que llama a consultarCPE y luego descarga

                    // 1. Lanzamos consulta (esto crea browser y hace login)
                    // Importante: consultarCPE maneja su propio browser. 
                    // Si llamamos a consultarCPE, crearÃ¡ un browser.
                    // Pero necesitamos el sessionId para luego llamar a descargarPDF.

                    // Mejor estrategia: Instanciar browser aquÃ­ controladamente.
                    // Copiamos la lÃ³gica core de worker.

                    const { rucEmisor, tipoDoc, serie, numero } = cpe;

                    // Usamos consultarCPE para obtener la sesiÃ³n lista
                    const consultaResult = await this.consultarCPE(credencialesCompletas.ruc, {
                        rucEmisor, tipoDoc, serie, numero, filtro: cpe.filtro
                    });

                    if (!consultaResult.success || !consultaResult.data.encontrado) {
                        // Si no encuentra o error, cerramos esa sesiÃ³n inmediatamente
                        if (consultaResult.sessionId) await this.cerrarSesion(consultaResult.sessionId);

                        return {
                            ...cpe,
                            status: 'ERROR',
                            error: consultaResult.error || 'No encontrado',
                            data: consultaResult.data
                        };
                    }

                    // 2. Si se encontrÃ³, intentamos descargar PDF inmediatamente
                    const downloadResult = await this.descargarPDF(consultaResult.sessionId, cpe);

                    // 3. Cerramos la sesiÃ³n
                    await this.cerrarSesion(consultaResult.sessionId);

                    if (downloadResult.success) {
                        return {
                            ...cpe,
                            status: 'OK',
                            pdfPath: downloadResult.path,
                            data: consultaResult.data
                        };
                    } else {
                        return {
                            ...cpe,
                            status: 'ERROR_DOWNLOAD',
                            error: downloadResult.error,
                            data: consultaResult.data
                        };
                    }

                } catch (error) {
                    logger.error(`Error procesando descarga ${idx}:`, error);
                    return { ...cpe, status: 'ERROR_SYSTEM', error: error.message };
                } finally {
                    browsersActivos--;
                }
            };

            const promesas = [];
            for (let i = 0; i < listaComprobantes.length; i++) {
                while (browsersActivos >= MAX_BROWSERS_SIMULTANEOS) {
                    await new Promise(r => setTimeout(r, 1000));
                }

                browsersActivos++;
                // PequeÃ±o delay para no saturar inicio de procesos
                await new Promise(r => setTimeout(r, 2000));

                promesas.push(procesarDescarga(listaComprobantes[i], i));
            }

            const results = await Promise.all(promesas);
            logger.info(`âœ… Descarga producciÃ³n finalizada. ${results.length} procesados.`);

            return {
                success: true,
                resultados: results
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Visualizar Facturas - Hace login y devuelve cookies + URL para BrowserView de Electron
     * Playwright autentica y obtiene la sesiÃ³n, luego Electron usa esa sesiÃ³n en BrowserView
     */
    async visualizarFacturas(rucConsultante) {
        let browser = null;
        let page = null;

        try {
            logger.info('Iniciando visualizaciÃ³n de facturas', { rucConsultante });

            // Obtener credenciales
            const credResult = await this.obtenerCredenciales(rucConsultante);
            if (!credResult.success) {
                return credResult;
            }
            const cliente = credResult.data;

            // Lanzar browser en modo headless para obtener cookies
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
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1200, height: 800 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });
            page = await context.newPage();

            // Anti-detecciÃ³n
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(90000);

            // PASO 1: Login en portal principal de SUNAT
            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            logger.info('Navegando a portal principal para login', { url: loginUrl });

            await page.goto(loginUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar formulario de login
            await page.waitForSelector('#txtRuc', { timeout: 30000 });

            // Completar formulario de login
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario_sol);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave_sol);

            logger.info('Formulario de login completado, enviando...', { rucConsultante });

            // Enviar login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
                page.click('#btnAceptar')
            ]);

            // Esperar a que la pÃ¡gina cargue despuÃ©s de login
            await page.waitForTimeout(3000);

            // PASO 2: Navegar a la URL de visualizaciÃ³n
            const visualizacionUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.3.1.2&s=ww1';
            logger.info('Login exitoso, navegando a portal de visualizaciÃ³n', { url: visualizacionUrl });

            await page.goto(visualizacionUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar la redirecciÃ³n de SUNAT - la URL debe cambiar del menÃº al portal de visualizaciÃ³n
            // SUNAT redirige de e-menu.sunat.gob.pe a ww1.sunat.gob.pe con el token de sesiÃ³n
            logger.info('Esperando redirecciÃ³n de SUNAT...');

            try {
                await page.waitForURL(/ww1\.sunat\.gob\.pe|ol-ti-itconscpemype/, { timeout: 30000 });
                logger.info('RedirecciÃ³n a portal de visualizaciÃ³n detectada');
            } catch (e) {
                logger.warn('No se detectÃ³ redirecciÃ³n esperada, usando URL actual');
            }

            // Esperar a que la pÃ¡gina cargue completamente despuÃ©s de redirecciÃ³n
            await page.waitForTimeout(5000);

            // Capturar la URL final (incluye token de sesiÃ³n)
            const targetUrl = page.url();
            logger.info('URL de destino capturada (despuÃ©s de redirecciÃ³n)', { targetUrl });

            // PASO 3: Obtener todas las cookies de la sesiÃ³n
            const cookies = await context.cookies();
            logger.info(`Obtenidas ${cookies.length} cookies de la sesiÃ³n`);

            // Crear ID de sesiÃ³n
            const sessionId = `visualizacion_${rucConsultante}_${Date.now()}`;

            // Guardar cookies y datos en el proxySessions
            this.proxySessions.set(sessionId, {
                cookies,
                clienteRuc: cliente.ruc,
                clienteRazon: cliente.razonSocial,
                createdAt: Date.now()
            });

            // Cerrar browser de Playwright - ya no lo necesitamos
            await browser.close();
            browser = null;

            logger.info('SesiÃ³n de login capturada correctamente', {
                sessionId,
                rucConsultante,
                targetUrl,
                cookieCount: cookies.length
            });

            return {
                success: true,
                sessionId,
                targetUrl, // URL con token de sesiÃ³n para navegarla en BrowserView
                cookies, // Cookies para inyectar en Electron
                clienteRuc: cliente.ruc,
                clienteRazon: cliente.razonSocial
            };

        } catch (error) {
            logger.error('Error en visualizaciÃ³n de facturas', {
                error: error.message,
                stack: error.stack,
                rucConsultante
            });

            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Emitir Facturas - Hace login y devuelve cookies + URL para BrowserView de Electron
     * Similar a visualizarFacturas pero para el portal de emisiÃ³n de facturas
     */
    async emitirFacturas(rucConsultante) {
        let browser = null;
        let page = null;

        try {
            logger.info('Iniciando emisiÃ³n de facturas', { rucConsultante });

            // Obtener credenciales
            const credResult = await this.obtenerCredenciales(rucConsultante);
            if (!credResult.success) {
                return credResult;
            }
            const cliente = credResult.data;

            // Lanzar browser en modo headless para obtener cookies
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
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1200, height: 800 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });
            page = await context.newPage();

            // Anti-detecciÃ³n
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(90000);

            // PASO 1: Login en portal principal de SUNAT
            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            logger.info('Navegando a portal principal para login', { url: loginUrl });

            await page.goto(loginUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar formulario de login
            await page.waitForSelector('#txtRuc', { timeout: 30000 });

            // Completar formulario de login
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario_sol);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave_sol);

            logger.info('Formulario de login completado, enviando...', { rucConsultante });

            // Enviar login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
                page.click('#btnAceptar')
            ]);

            // Esperar a que la pÃ¡gina cargue despuÃ©s de login
            await page.waitForTimeout(3000);

            // PASO 2: Navegar a la URL de emisiÃ³n de facturas
            const emisionUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.3.1.1&s=ww1';
            logger.info('Login exitoso, navegando a portal de emisiÃ³n de facturas', { url: emisionUrl });

            await page.goto(emisionUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar la redirecciÃ³n de SUNAT
            logger.info('Esperando redirecciÃ³n de SUNAT...');

            try {
                await page.waitForURL(/ww1\.sunat\.gob\.pe|ol-ti-itemisionmype/, { timeout: 30000 });
                logger.info('RedirecciÃ³n a portal de emisiÃ³n detectada');
            } catch (e) {
                logger.warn('No se detectÃ³ redirecciÃ³n esperada, usando URL actual');
            }

            // Esperar a que la pÃ¡gina cargue completamente despuÃ©s de redirecciÃ³n
            await page.waitForTimeout(5000);

            // Capturar la URL final (incluye token de sesiÃ³n)
            const targetUrl = page.url();
            logger.info('URL de destino capturada (después de redirección)', { targetUrl });

            // PASO 3: Obtener todas las cookies de la sesión
            const cookies = await context.cookies();
            logger.info(`Obtenidas ${cookies.length} cookies de la sesión`);

            // Crear ID de sesión
            const sessionId = `emision_${rucConsultante}_${Date.now()}`;

            // Guardar cookies y datos en el proxySessions
            this.proxySessions.set(sessionId, {
                cookies,
                clienteRuc: cliente.ruc,
                clienteRazon: cliente.razonSocial,
                createdAt: Date.now()
            });

            // Cerrar browser de Playwright - ya no lo necesitamos
            await browser.close();
            browser = null;

            logger.info('Sesión de login capturada correctamente', {
                sessionId,
                rucConsultante,
                targetUrl,
                cookieCount: cookies.length
            });

            return {
                success: true,
                sessionId,
                targetUrl, // URL con token de sesión para navegarla en BrowserView
                cookies, // Cookies para inyectar en Electron
                clienteRuc: cliente.ruc,
                clienteRazon: cliente.razonSocial
            };

        } catch (error) {
            logger.error('Error en emisiÃ³n de facturas', {
                error: error.message,
                stack: error.stack,
                rucConsultante
            });

            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Emitir Boletas - Hace login y MANTIENE el browser activo para automatizaciÃ³n
     * URL especÃ­fica: https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.4.1.1&s=ww1
     * El browser se guarda en activeSessions para poder ejecutar automatizaciÃ³n
     */
    async emitirBoletas(rucConsultante) {
        let browser = null;
        let page = null;

        try {
            logger.info('Iniciando emisiÃ³n de boletas', { rucConsultante });

            // Obtener credenciales
            const credResult = await this.obtenerCredenciales(rucConsultante);
            if (!credResult.success) {
                return credResult;
            }
            const cliente = credResult.data;

            // Lanzar browser en modo VISIBLE para que el usuario vea el proceso
            browser = await chromium.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--start-maximized'
                ]
            });

            const context = await browser.newContext({
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1400, height: 900 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });
            page = await context.newPage();

            // Anti-detecciÃ³n
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(90000);

            // PASO 1: Login en portal principal de SUNAT
            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            logger.info('Navegando a portal principal para login', { url: loginUrl });

            await page.goto(loginUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar formulario de login
            await page.waitForSelector('#txtRuc', { timeout: 30000 });

            // Completar formulario de login
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario_sol);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave_sol);

            logger.info('Formulario de login completado, enviando...', { rucConsultante });

            // Enviar login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
                page.click('#btnAceptar')
            ]);

            // Esperar a que la pÃ¡gina cargue despuÃ©s de login
            await page.waitForTimeout(3000);

            // PASO 2: Navegar a la URL de emisiÃ³n de boletas
            const emisionUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.4.1.1&s=ww1';
            logger.info('Login exitoso, navegando a portal de emisiÃ³n de boletas', { url: emisionUrl });

            await page.goto(emisionUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar la redirecciÃ³n de SUNAT
            logger.info('Esperando redirecciÃ³n de SUNAT...');

            try {
                await page.waitForURL(/ww1\.sunat\.gob\.pe|ol-ti-itemisionboleta/, { timeout: 30000 });
                logger.info('RedirecciÃ³n a portal de emisiÃ³n detectada');
            } catch (e) {
                logger.warn('No se detectÃ³ redirecciÃ³n esperada, usando URL actual');
            }

            // Esperar a que el formulario de boleta cargue completamente
            await page.waitForTimeout(5000);

            try {
                await page.waitForSelector('#inicio\\.razonSocial', { timeout: 15000 });
                logger.info('Formulario de boleta cargado correctamente');
            } catch (e) {
                logger.warn('No se encontrÃ³ el formulario de boleta, puede requerir navegaciÃ³n adicional');
            }

            // Capturar URL final
            const targetUrl = page.url();
            logger.info('URL de destino capturada', { targetUrl });

            // Crear ID de sesiÃ³n
            const sessionId = `emision_boleta_${rucConsultante}_${Date.now()}`;

            // GUARDAR SESIÃ“N ACTIVA - NO cerrar el browser
            this.activeSessions.set(sessionId, {
                browser,
                context,
                page,
                ruc: rucConsultante,
                cliente: cliente.razonSocial,
                createdAt: new Date()
            });

            logger.info('SesiÃ³n de boletas guardada y activa', {
                sessionId,
                rucConsultante,
                targetUrl,
                activeSessions: this.activeSessions.size
            });

            return {
                success: true,
                sessionId,
                targetUrl,
                clienteRuc: cliente.ruc,
                clienteRazon: cliente.razonSocial,
                message: 'Browser abierto y listo para automatizaciÃ³n'
            };

        } catch (error) {
            logger.error('Error en emisiÃ³n de boletas', {
                error: error.message,
                stack: error.stack,
                rucConsultante
            });

            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Procesar una boleta en la sesiÃ³n activa
     */
    async procesarBoleta(sessionId, formConfig, item) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'SesiÃ³n no encontrada o expirada' };
        }

        const { page } = session;

        try {
            logger.info('Procesando boleta', { sessionId, item: item.descripcion });

            // Helper para seleccionar radio buttons
            const selectRadio = async (nameContains, selectYes) => {
                const radios = await page.$$('input[type="radio"]');
                for (const radio of radios) {
                    const name = await radio.getAttribute('name') || await radio.getAttribute('id') || '';
                    if (name.includes(nameContains)) {
                        const value = await radio.getAttribute('value');
                        const shouldClick = (selectYes && value === 'S') || (!selectYes && value === 'N');
                        if (shouldClick) {
                            await radio.click();
                            await page.waitForTimeout(300);
                            return true;
                        }
                    }
                }
                return false;
            };

            // PASO 1: Verificar que estamos en el formulario
            try {
                await page.waitForSelector('#inicio\\.razonSocial', { timeout: 10000 });
            } catch (e) {
                // Si no estÃ¡ el formulario, intentar recargar
                await page.reload();
                await page.waitForSelector('#inicio\\.razonSocial', { timeout: 15000 });
            }

            // PASO 2: Configurar opciones del formulario
            logger.info('Configurando opciones del formulario...');

            await selectRadio('esExportacion', formConfig.esExportacion);
            await page.fill('#inicio\\.razonSocial', formConfig.razonSocial || 'CLIENTES VARIOS');
            await selectRadio('pagoAnticipado', formConfig.pagoAnticipado);
            await selectRadio('tieneDescuentos', formConfig.tieneDescuentos);
            await selectRadio('tieneISC', formConfig.tieneISC);
            await selectRadio('operacionesGratuitas', formConfig.operacionesGratuitas);
            await page.waitForTimeout(500);

            // PASO 3: Continuar al detalle
            logger.info('Continuando al detalle...');
            await page.click('#inicio\\.botonGrabarDocumento_label');
            await page.waitForTimeout(2000);

            // PASO 4: Esperar tabla de items
            await page.waitForSelector('table.form-table-3', { timeout: 10000 });

            // PASO 5: Click para agregar item
            await page.click('table.form-table-3 > tbody > tr:nth-of-type(1) > td');
            await page.waitForTimeout(500);

            // Buscar y hacer click en botÃ³n de agregar
            const addButtons = await page.$$('span.dijitIcon');
            if (addButtons.length > 0) {
                await addButtons[0].click();
            }
            await page.waitForTimeout(1500);

            // PASO 6: Llenar datos del item
            logger.info('Llenando datos del item...');

            try {
                await page.waitForSelector('#item\\.cantidad', { timeout: 8000 });
            } catch (e) {
                // Intentar selector alternativo
                await page.waitForSelector('input[id*="cantidad"]', { timeout: 5000 });
            }

            await page.fill('#item\\.cantidad', String(item.cantidad));
            await page.fill('#item\\.descripcion', item.descripcion);
            await page.fill('#item\\.precioUnitario', String(item.precio));

            // Seleccionar tipo IGV gravado
            try {
                await page.click('#item\\.subTipoTB01');
            } catch (e) {
                logger.warn('No se pudo seleccionar tipo IGV');
            }
            await page.waitForTimeout(500);

            // PASO 7: Aceptar item
            logger.info('Aceptando item...');
            await page.click('#item\\.botonAceptar_label');
            await page.waitForTimeout(1500);

            // PASO 8: Grabar documento preliminar
            logger.info('Grabando documento preliminar...');
            await page.click('#boleta\\.botonGrabarDocumento_label');
            await page.waitForTimeout(2000);

            // PASO 9: Confirmar preliminar (si existe el botÃ³n)
            try {
                const confirmBtn = await page.$('#docsrel\\.botonGrabarDocumento_label');
                if (confirmBtn) {
                    await confirmBtn.click();
                    await page.waitForTimeout(2000);
                }
            } catch (e) {
                logger.info('BotÃ³n de confirmaciÃ³n no encontrado, continuando...');
            }

            // PASO 10: Emitir boleta final
            logger.info('Emitiendo boleta final...');
            try {
                await page.click('#boleta-preliminar\\.botonGrabarDocumento');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(3000);
            } catch (e) {
                logger.warn('BotÃ³n de emisiÃ³n final no encontrado');
            }

            // PASO 11: Cerrar modal de Ã©xito
            logger.info('Cerrando modal de Ã©xito...');
            try {
                const closeButtons = await page.$$('span[id*="Button"], button');
                for (const btn of closeButtons) {
                    const text = await btn.textContent();
                    if (text && (text.includes('Cerrar') || text.includes('Aceptar') || text.includes('OK'))) {
                        await btn.click();
                        break;
                    }
                }
            } catch (e) {
                // Intentar con Enter
                await page.keyboard.press('Enter');
            }
            await page.waitForTimeout(2000);

            logger.info('Boleta procesada correctamente', { descripcion: item.descripcion });

            return {
                success: true,
                message: `Boleta emitida: ${item.descripcion}`
            };

        } catch (error) {
            logger.error('Error procesando boleta', {
                error: error.message,
                item: item.descripcion
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Cerrar sesiÃ³n de boletas
     */
    async cerrarSesionBoletas(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'SesiÃ³n no encontrada' };
        }

        try {
            await session.browser.close();
            this.activeSessions.delete(sessionId);
            logger.info('SesiÃ³n de boletas cerrada', { sessionId });
            return { success: true };
        } catch (error) {
            logger.error('Error cerrando sesiÃ³n', { error: error.message });
            return { success: false, error: error.message };
        }
    }


}

// Instancia Ãºnica del handler
const cpeScrapingHandler = new CPEScrapingHandler();

/**
 * Configurar handlers IPC para el mÃ³dulo CPE
 */
function setupCPEScrapingIPC() {


    logger.info('Handlers IPC de CPE Scraping configurados');
}

module.exports = {
    CPEScrapingHandler,
    cpeScrapingHandler,
    setupCPEScrapingIPC
};


