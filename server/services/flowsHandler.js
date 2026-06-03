const fs = require('fs');
const path = require('path');
const userStorageManager = require('./userStorageManager');

const getFlowsDir = (ruc) => {
    let rootDir;
    if (userStorageManager.isInitialized()) {
        rootDir = userStorageManager.getUserFolderPath('flows');
    } else {
        rootDir = path.join(process.cwd(), 'server', 'data', 'flows');
    }
    const dir = path.join(rootDir, ruc);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const saveFlow = async ({ ruc, name, steps }) => {
    try {
        const dir = getFlowsDir(ruc);
        const safeName = name.replace(/[^a-z0-9áéíóúñ\s-_]/gi, '').trim();
        const filePath = path.join(dir, `${safeName}.json`);

        const flowData = {
            name: safeName,
            ruc,
            timestamp: new Date().toISOString(),
            steps
        };

        fs.writeFileSync(filePath, JSON.stringify(flowData, null, 2), 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        console.error('Flow Save Error:', error);
        return { success: false, error: error.message };
    }
};

const listFlows = async ({ ruc }) => {
    try {
        const dir = getFlowsDir(ruc);
        if (!fs.existsSync(dir)) return { success: true, flows: [] };

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        const flows = files.map(f => {
            try {
                const content = fs.readFileSync(path.join(dir, f), 'utf-8');
                return JSON.parse(content);
            } catch (e) { return null; }
        }).filter(Boolean);

        return { success: true, flows };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

const deleteFlow = async ({ ruc, name }) => {
    try {
        const dir = getFlowsDir(ruc);
        const safeName = name.replace(/[^a-z0-9áéíóúñ\s-_]/gi, '').trim();
        const filePath = path.join(dir, `${safeName}.json`);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

const importScript = async ({ filePath }) => {
    try {
        const boletaHandler = require('./boletaHandler'); // Lazy load to avoid circular deps if any
        const content = fs.readFileSync(filePath, 'utf-8');
        const steps = boletaHandler.parsePuppeteerScript(content);

        if (!steps || steps.length === 0) {
            return { success: false, error: 'No se encontraron pasos válidos en el script' };
        }
        return { success: true, steps };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = {
    saveFlow,
    listFlows,
    deleteFlow,
    importScript
};
