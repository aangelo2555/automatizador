const { chromium } = require('playwright');
const logger = require('./logger');
const config = require('./config');
const clientStorage = require('./clientStorageService');

class BoletaHandler {
    constructor() {
        this.activeSessions = new Map(); // ruc -> { browser, page }
    }

    /**
     * Parse a Puppeteer/Recorder script (file content) into a JSON Flow
     */
    parsePuppeteerScript(scriptContent) {
        const steps = [];
        const lines = scriptContent.split('\n');
        const locatorRegex = /locator\(['"`](.*?)['"`]\)/g;

        let currentSelectors = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            let match;
            while ((match = locatorRegex.exec(line)) !== null) {
                let sel = match[1];
                if (sel.startsWith('::-p-xpath')) sel = 'xpath/' + sel.replace('::-p-xpath(', '').slice(0, -1);
                else if (sel.startsWith('::-p-text')) sel = 'text/' + sel.replace('::-p-text(', '').slice(0, -1);
                else if (sel.startsWith('::-p-aria')) sel = 'aria/' + sel.replace('::-p-aria(', '').slice(0, -1);
                else if (sel.includes(':scope >>>')) sel = sel.split('>>>')[1].trim();

                sel = sel.replace(/\\"/g, '"');
                if (sel.includes('>>>>')) continue;

                currentSelectors.push([sel]);
            }

            if (line.includes('.click(')) {
                if (currentSelectors.length > 0) {
                    steps.push({ type: 'click', selectors: [...currentSelectors], keywords: [] });
                    currentSelectors = [];
                }
            } else if (line.includes('.fill(') || line.includes('.type(')) {
                const valMatch = line.match(/\.(fill|type)\(['"`](.*?)['"`]\)/);
                const val = valMatch ? valMatch[2] : '';
                if (currentSelectors.length > 0) {
                    steps.push({ type: 'type', selectors: [...currentSelectors], value: val, keywords: [] });
                    currentSelectors = [];
                }
            } else if (line.includes('keyboard.down') && line.includes('Enter')) {
                steps.push({ type: 'press', value: 'Enter', selectors: [], keywords: ['Enter'] });
            }
        }
        return steps;
    }

    /**
     * Connect to SUNAT using Playwright and navigate to Boleta page
     */
    async connectInternal(ruc) {
        try {
            logger.info(`Iniciando conexión de Boletas para RUC: ${ruc}...`);

            const cliente = clientStorage.getClient(ruc);
            if (!cliente) {
                throw new Error(`No se encontró el cliente con RUC ${ruc} en la base de datos`);
            }

            const usuario_sol = cliente.usuario;
            const clave_sol = cliente.clave;

            if (!usuario_sol || !clave_sol) {
                throw new Error(`El cliente ${ruc} no tiene credenciales SOL configuradas`);
            }

            await this.closeSession(ruc);

            logger.info('Lanzando Chromium...');
            const browser = await chromium.launch({
                headless: config.PLAYWRIGHT.headless,
                slowMo: config.PLAYWRIGHT.slowMo,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--start-maximized'],
                viewport: null
            });

            const context = await browser.newContext({ viewport: null });
            const page = await context.newPage();
            page.setDefaultTimeout(20000);

            logger.info('Navegando a login SUNAT...');
            await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            logger.info('Rellenando credenciales...');
            await page.waitForSelector('#txtRuc', { state: 'visible', timeout: 20000 });
            await page.fill('#txtRuc', ruc);
            await page.fill('#txtUsuario', usuario_sol);
            await page.fill('#txtContrasena', clave_sol);
            
            logger.info('Haciendo clic en iniciar sesión...');
            await page.click('#btnAceptar');

            logger.info('Esperando carga de bienvenida...');
            await page.waitForSelector('text=Bienvenido, .nombre_usuario_fijo', { timeout: 30000 }).catch(() => {
                logger.warn('No se encontró el selector de bienvenida, continuando...');
            });

            logger.info('Navegando a Emisión de Boletas...');
            await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.4.1.1&s=ww1', {
                waitUntil: 'networkidle',
                timeout: 60000
            });

            this.activeSessions.set(ruc, { browser, page });
            logger.info(`Sesión de Boleta activa guardada para RUC: ${ruc}`);

            return { success: true, sessionId: ruc };

        } catch (error) {
            logger.error('Error al conectar al portal de boletas:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Close active session for a RUC
     */
    async closeSession(ruc) {
        try {
            const session = this.activeSessions.get(ruc);
            if (session) {
                logger.info(`Cerrando sesión de boletas para RUC: ${ruc}`);
                await session.browser.close().catch(() => {});
                this.activeSessions.delete(ruc);
            }
            return { success: true };
        } catch (error) {
            logger.error(`Error al cerrar sesión para RUC ${ruc}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Close all active sessions
     */
    async closeAllSessions() {
        try {
            for (const ruc of this.activeSessions.keys()) {
                await this.closeSession(ruc);
            }
            return { success: true, message: 'Todas las sesiones de boletas cerradas' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute a JSON Flow on the active Playwright page
     */
    async processInternalBatch(ruc, items, flow) {
        let session = this.activeSessions.get(ruc);
        if (!session) {
            logger.info(`Sesión no encontrada para RUC ${ruc}. Conectando automáticamente...`);
            const conn = await this.connectInternal(ruc);
            if (!conn.success) return conn;
            session = this.activeSessions.get(ruc);
        }

        const results = [];
        let errors = 0;

        try {
            const { page } = session;
            logger.info(`Iniciando emisión de boletas en lote para ${items.length} items...`);

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                logger.info(`Procesando boleta ${i + 1}/${items.length}`);

                const res = await this.executeFlow(page, flow, item);
                results.push({ ...item, status: res.success ? 'success' : 'error', error: res.error });
                if (!res.success) errors++;

                await page.waitForTimeout(1000);
            }

            return { success: true, results, errors };

        } catch (error) {
            logger.error('Error procesando lote de boletas:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute steps from JSON using Playwright
     */
    async executeFlow(page, flow, itemData) {
        try {
            if (!flow || !flow.length) return { success: false, error: 'Flujo vacío' };

            const resolveValue = (val) => {
                if (typeof val !== 'string') return val;
                if (val.startsWith('{') && val.endsWith('}')) {
                    const key = val.slice(1, -1);
                    const prop = key.split('.')[1];
                    if (itemData[prop] !== undefined) return itemData[prop].toString();
                }
                return val;
            };

            for (const step of flow) {
                const selectors = step.selectors ? step.selectors.map(s => s[0]) : [];
                if (selectors.length === 0 && step.keywords) {
                    selectors.push(`text/${step.keywords[0]}`);
                }
                if (selectors.length === 0) continue;

                const actionType = step.type;
                const valueToType = (actionType === 'type' || actionType === 'change') ? resolveValue(step.value) : null;

                let success = false;
                const frames = page.frames();

                for (const frame of frames) {
                    for (let selector of selectors) {
                        try {
                            let pwSelector = selector;
                            if (selector.startsWith('xpath/')) {
                                pwSelector = 'xpath=' + selector.replace('xpath/', '');
                            } else if (selector.startsWith('text/')) {
                                pwSelector = `text=${selector.replace('text/', '')}`;
                            } else if (selector.startsWith('aria/')) {
                                pwSelector = `role=${selector.replace('aria/', '')}`;
                            } else if (selector.startsWith('pierce/')) {
                                pwSelector = selector.replace('pierce/', '');
                            }

                            const handle = await frame.waitForSelector(pwSelector, { timeout: 1000, state: 'visible' }).catch(() => null);
                            if (handle) {
                                if (actionType === 'click') {
                                    await handle.click();
                                } else if (actionType === 'type' || actionType === 'change') {
                                    await handle.fill('');
                                    await handle.type(valueToType);
                                } else if (actionType === 'press') {
                                    await handle.press(step.value || 'Enter');
                                }
                                success = true;
                                break;
                            }
                        } catch (e) {
                            // Selector failed in this frame, try next
                        }
                    }
                    if (success) break;
                }

                if (!success) {
                    logger.warn(`No se pudo ejecutar paso ${step.type} en ningún frame`);
                }
                await page.waitForTimeout(500);
            }

            return { success: true };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = new BoletaHandler();
