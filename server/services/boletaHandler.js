// [WEB] Electron removed
const logger = require('./logger');

class BoletaHandler {
    constructor() {
        this.targetWebContents = null;
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
                // Convert recorder syntax to our syntax
                if (sel.startsWith('::-p-xpath')) sel = 'xpath/' + sel.replace('::-p-xpath(', '').slice(0, -1);
                else if (sel.startsWith('::-p-text')) sel = 'text/' + sel.replace('::-p-text(', '').slice(0, -1);
                else if (sel.startsWith('::-p-aria')) sel = 'aria/' + sel.replace('::-p-aria(', '').slice(0, -1);
                else if (sel.includes(':scope >>>')) sel = sel.split('>>>')[1].trim();

                // Unescape
                sel = sel.replace(/\\"/g, '"');

                // IGNORE COMPLEX PUPPETEER CHAINS (>>>>) as they are hard to emulate efficiently.
                // We typically have Alternative Selectors (IDs) in the same group that work better.
                if (sel.includes('>>>>')) continue; // Skip this specific selector, rely on others

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
     * Connect to the INTERNAL active Webview (EmisiÃ³n EspecÃ­fica)
     * Instead of using ports/CDP, we use Electron's internal process manager.
     */
    async connectInternal() {
        try {
            logger.info('Buscando WebContents interno de SUNAT...');

            // 1. Get all webContents
            const all = webContents.getAllWebContents();

            // 2. Find the one that matches SUNAT URL and is NOT the main window
            // The SUNAT webview usually has 'sunat.gob.pe'. The specific URL might vary.
            // We ignore devtools and the main renderer (which is usually file:// or localhost:3000)
            const sunatContents = all.find(wc => {
                const url = wc.getURL();
                return url && url.includes('sunat.gob.pe') && !url.includes('devtools://');
            });

            if (!sunatContents) {
                const available = all.map(wc => wc.getURL()).join(', ');
                logger.warn('URLs disponibles: ' + available);
                throw new Error('No se encontrÃ³ la pestaÃ±a de "EmisiÃ³n EspecÃ­fica" cargada. Por favor navegue a la opciÃ³n de emisiÃ³n en el portal.');
            }

            this.targetWebContents = sunatContents;
            logger.info(`Objetivo encontrado: ${this.targetWebContents.getTitle()} [ID: ${this.targetWebContents.id}]`);
            return { success: true };

        } catch (error) {
            logger.error('Error conectando internamente:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute a JSON Flow on the internal page
     */
    async processInternalBatch(items, jsonFlow) {
        if (!this.targetWebContents || this.targetWebContents.isDestroyed()) {
            const conn = await this.connectInternal();
            if (!conn.success) return conn;
        }

        const results = [];
        let errors = 0;

        try {
            logger.info(`Iniciando Batch Interno (Nativo): ${items.length} items`);

            // Iterate items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                logger.info(`Procesando item ${i + 1}/${items.length}`);

                // Execute the Flow for this item
                const res = await this.executeFlow(jsonFlow, item);

                results.push({ ...item, status: res.success ? 'success' : 'error', error: res.error });
                if (!res.success) errors++;

                // Small delay between boletas
                await new Promise(r => setTimeout(r, 1000));
            }

            return { success: true, results, errors };

        } catch (e) {
            logger.error('Error fatal procesando batch interno:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Engine to execute steps from JSON using Electron Internal Injection
     */
    async executeFlow(flow, itemData) {
        try {
            if (!flow || !flow.length) return { success: false, error: 'Flujo vacÃ­o' };

            // Helper to replace variables {item.foo} in values
            const resolveValue = (val) => {
                if (typeof val !== 'string') return val;
                if (val.startsWith('{') && val.endsWith('}')) {
                    const key = val.slice(1, -1); // item.cantidad
                    const prop = key.split('.')[1]; // cantidad
                    if (itemData[prop] !== undefined) return itemData[prop].toString();
                }
                return val;
            };

            for (const step of flow) {
                // Determine selectors
                // Step.selectors is array of groups: [['#id'], ['xpath/...']]
                const selectors = step.selectors ? step.selectors.map(s => s[0]) : [];
                // Add keyword fallback?
                if (selectors.length === 0 && step.keywords) {
                    selectors.push(`text/${step.keywords[0]}`);
                }

                if (selectors.length === 0) continue;

                // Action Logic
                const actionType = step.type;
                const valueToType = (actionType === 'type' || actionType === 'change') ? resolveValue(step.value) : null;

                // Find and Execute in Frames
                const success = await this.findAndExecInFrames(selectors, actionType, valueToType);

                if (!success) {
                    logger.warn(`No se pudo ejecutar paso ${step.type} en selectores: ${selectors.join(', ')}`);
                    // Continue or fail? Continue to be resilient like finding "No thanks" popups.
                    continue;
                }

                // Wait logic simulation
                await new Promise(r => setTimeout(r, 500));
            }

            return { success: true };

        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Recursively search frames and execute action if element found
     */
    async findAndExecInFrames(selectors, actionType, value) {
        // Retry configuration
        const MAX_RETRIES = 10;
        const RETRY_DELAY = 800;

        // Helper to flatten frame tree
        const getAllFrames = (root) => {
            let list = [root];
            for (const child of root.frames) list = list.concat(getAllFrames(child));
            return list;
        };

        // Define the script to run in the renderer
        const injectionScript = (sels, type, val) => {
            // Robust Deep Query (Shadow DOM support)
            const queryDeep = (root, selector) => {
                let found = root.querySelector(selector);
                if (found) return found;
                // Walk shadow roots
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
                while (walker.nextNode()) {
                    const el = walker.currentNode;
                    if (el.shadowRoot) {
                        found = queryDeep(el.shadowRoot, selector);
                        if (found) return found;
                    }
                }
                return null;
            };

            const findEl = (s) => {
                try {
                    // XPATH (No Shadow DOM support easily)
                    if (s.startsWith('xpath/')) {
                        return document.evaluate(s.replace('xpath/', ''), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    }
                    // TEXT
                    if (s.startsWith('text/')) {
                        const t = s.replace('text/', '');
                        if (t === 'undefined') return null;
                        const x = `//*[contains(text(), '${t}')]`;
                        const r = document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        if (r.singleNodeValue) return r.singleNodeValue;
                        return document.evaluate(`//*[@value='${t}' or @placeholder='${t}' or @aria-label='${t}']`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    }
                    // ARIA
                    if (s.startsWith('aria/')) {
                        const k = s.replace('aria/', '');
                        return document.querySelector(`[aria-label="${k}"], [aria-description="${k}"], [role="${k}"]`);
                    }

                    // CSS / ID
                    let css = s.startsWith('pierce/') ? s.replace('pierce/', '') : s;

                    // 1. Try ID direct (Fastest)
                    if (css.startsWith('#') && css.includes('.')) {
                        const id = css.substring(1).replace(/\\./g, '.');
                        const el = document.getElementById(id);
                        if (el) return el;
                    }

                    // 2. Try Standard Query (Light DOM)
                    try {
                        const el = document.querySelector(css);
                        if (el) return el;
                    } catch (e) { }

                    // 3. Try Deep Query (Shadow DOM) - Expensive but necessary for some components
                    // Only do this if plain query failed
                    return queryDeep(document.body, css);

                } catch (e) { return null; }
            };

            // Trigger events
            const triggerEvents = (el) => {
                const makeEvent = (name) => new Event(name, { bubbles: true, cancelable: true });
                el.dispatchEvent(makeEvent('focus'));
                el.dispatchEvent(makeEvent('mouseover'));
                el.dispatchEvent(makeEvent('mousedown'));
                el.dispatchEvent(makeEvent('mouseup'));
                el.dispatchEvent(makeEvent('change'));
            };

            for (const sel of sels) {
                const el = findEl(sel);
                if (el && el.style.display !== 'none') {
                    if (type === 'click') {
                        triggerEvents(el);
                        el.click();
                    } else if (type === 'type' || type === 'change') {
                        el.focus();
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (nativeInputValueSetter && el instanceof window.HTMLInputElement) {
                            nativeInputValueSetter.call(el, val);
                        } else {
                            el.value = val;
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.blur();
                    } else if (type === 'press') {
                        const target = document.activeElement || document.body;
                        target.dispatchEvent(new KeyboardEvent('keydown', { key: val, code: val, which: 13, bubbles: true }));
                        target.dispatchEvent(new KeyboardEvent('keypress', { key: val, code: val, which: 13, bubbles: true }));
                        target.dispatchEvent(new KeyboardEvent('keyup', { key: val, code: val, which: 13, bubbles: true }));
                    }
                    return true;
                }
            }
            return false;
        };

        const code = `(${injectionScript.toString()})(${JSON.stringify(selectors)}, "${actionType}", ${JSON.stringify(value)})`;

        // RETRY LOOP
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (this.targetWebContents.isDestroyed()) return false;

            // Update frames
            const frames = getAllFrames(this.targetWebContents.mainFrame);

            // DEBUG LOGGING ONCE
            if (attempt === 0) {
                // Check ready state of main
                const ready = await this.targetWebContents.executeJavaScript('document.readyState').catch(() => 'unknown');
                logger.info(`Estado Pagina: ${ready} | Frames: ${frames.length}`);

                // LOG BODY PREVIEW to verify content
                for (let i = 0; i < frames.length; i++) {
                    try {
                        // Print first 200 chars of body text to see what frame contains
                        const snippet = await frames[i].executeJavaScript('document.body ? document.body.innerText.substring(0, 100).replace(/\\n/g, " ") : "No Body"').catch(() => 'Blocked');
                        const url = frames[i].url;
                        logger.info(`Frame ${i} [${url.substring(0, 30)}...]: "${snippet}..."`);
                    } catch (e) { }
                }
            }

            for (const frame of frames) {
                const res = await frame.executeJavaScript(code).catch(e => null);
                if (res === true) return true;
            }

            await new Promise(r => setTimeout(r, RETRY_DELAY));
        }

        return false;
    }

}

module.exports = new BoletaHandler();

