/**
 * Automatizador SUNAT - Web Server
 * Express server that replaces Electron's main process
 * Exposes all IPC handlers as REST API endpoints
 */

// Prefer IPv4 for DNS resolution globally (prevents IPv6 connection timeouts for SMTP/Gmail in containers)
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const logger = require('./services/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── JWT Auth Setup ──
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'automatizador-sunat-secret-key-2026';

// Auth middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // Soporte para descargas/links directos con token en query string
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Acceso denegado. No hay token.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Automatically initialize storage services for this authenticated user
    if (userStorageManager) {
      try {
        userStorageManager.initializeForUser(decoded.id, decoded.email, decoded.plan || 'basico');
        
        if (clientStorage && typeof clientStorage.initializeForUser === 'function') {
          clientStorage.initializeForUser(decoded.id, decoded.plan || 'basico');
        }
        if (taxDataStorage && typeof taxDataStorage.initializeForUser === 'function') {
          taxDataStorage.initializeForUser(decoded.id);
        }
      } catch (storageErr) {
        logger.error('Failed to initialize user storage services in authMiddleware:', storageErr.message);
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
};

// Export for route files
app.set('JWT_SECRET', JWT_SECRET);
app.set('authMiddleware', authMiddleware);

// ── Ensure data directories exist ──
const dirs = ['server/data', 'output', 'descargas_cpe', 'descargas_buzon', 'sire', 'temp', 'uploads', 'logs'];
dirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Initialize users.json if it doesn't exist
const usersFile = path.join(process.cwd(), 'server', 'data', 'users.json');
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, '[]', 'utf8');
}
const recentEmailsFile = path.join(process.cwd(), 'server', 'data', 'recent_emails.json');
if (!fs.existsSync(recentEmailsFile)) {
  fs.writeFileSync(recentEmailsFile, '[]', 'utf8');
}

// ── Initialize storage services ──
let clientStorage, taxDataStorage, userStorageManager;
try {
  clientStorage = require('./services/clientStorageService');
  taxDataStorage = require('./services/taxDataStorageService');
  userStorageManager = require('./services/userStorageManager');
} catch (err) {
  logger.warn('Some storage services failed to load:', err);
}

// ── Mount API Routes ──
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const configRoutes = require('./routes/configRoutes');
const sireRoutes = require('./routes/sireRoutes');
const buzonRoutes = require('./routes/buzonRoutes');
const cpeRoutes = require('./routes/cpeRoutes');
const emailRoutes = require('./routes/emailRoutes');
const boletaRoutes = require('./routes/boletaRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Public routes
app.use('/api/auth', authRoutes);

app.get('/api/email-diagnostics', async (req, res) => {
  const dns = require('dns').promises;
  const net = require('net');
  const results = {
    dns: {},
    tcp465: null,
    tcp587: null
  };

  try {
    results.dns.smtp_gmail_com = await dns.resolve4('smtp.gmail.com');
  } catch (err) {
    results.dns.smtp_gmail_com_error = err.message;
  }

  try {
    results.dns.smtp_gmail_com_v6 = await dns.resolve6('smtp.gmail.com');
  } catch (err) {
    results.dns.smtp_gmail_com_v6_error = err.message;
  }

  const testConnection = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let completed = false;

      socket.setTimeout(5000);

      socket.connect(port, host, () => {
        completed = true;
        socket.destroy();
        resolve({ success: true });
      });

      socket.on('error', (err) => {
        if (!completed) {
          completed = true;
          resolve({ success: false, error: err.message });
        }
      });

      socket.on('timeout', () => {
        if (!completed) {
          completed = true;
          socket.destroy();
          resolve({ success: false, error: 'Timeout after 5000ms' });
        }
      });
    });
  };

  results.tcp465 = await testConnection('smtp.gmail.com', 465);
  results.tcp587 = await testConnection('smtp.gmail.com', 587);

  res.json({ success: true, results });
});

// Protected routes
app.use('/api/clients', authMiddleware, clientRoutes);
app.use('/api/config', authMiddleware, configRoutes);
app.use('/api/sire', authMiddleware, sireRoutes);
app.use('/api/buzon', authMiddleware, buzonRoutes);
app.use('/api/cpe', authMiddleware, cpeRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/boleta', authMiddleware, boletaRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);

// ── Generic IPC Bridge Endpoint ──
// This catches any IPC channel calls from the apiBridge that don't have dedicated routes
app.post('/api/ipc/:channel', authMiddleware, async (req, res) => {
  const { channel } = req.params;
  const args = req.body.args || [];
  
  logger.info(`[IPC Bridge] Channel: ${channel}`, { args: args.length });
  
  try {
    // Route to appropriate handler based on channel
    let result = { success: false, error: `Canal IPC no implementado en web: ${channel}` };
    
    // Client storage handlers
    if (channel === 'clients:get-all' && clientStorage) {
      const clients = clientStorage.getAllClients();
      result = { success: true, clients };
    } else if (channel === 'clients:get' && clientStorage) {
      const client = clientStorage.getClient(args[0]);
      result = { success: !!client, client };
    } else if (channel === 'clients:add' && clientStorage) {
      result = clientStorage.addClient(args[0]);
    } else if (channel === 'clients:update' && clientStorage) {
      result = clientStorage.updateClient(args[0], args[1]);
    } else if (channel === 'clients:delete' && clientStorage) {
      result = clientStorage.deleteClient(args[0]);
    } else if (channel === 'clients:search' && clientStorage) {
      const clients = clientStorage.searchClients(args[0]);
      result = { success: true, clients };
    } else if (channel === 'clients:stats' && clientStorage) {
      result = clientStorage.getStats();
    } else if (channel === 'clients:import-excel' && clientStorage) {
      result = await clientStorage.importFromExcel(args[0]);
    }
    // Tax data handlers
    else if (channel === 'taxData:save' && taxDataStorage) {
      result = await taxDataStorage.saveTaxData(args[0].ruc, args[0].regimeType, args[0].data);
    } else if (channel === 'taxData:load' && taxDataStorage) {
      result = await taxDataStorage.loadTaxData(args[0].ruc, args[0].regimeType);
    } else if (channel === 'taxData:load-all' && taxDataStorage) {
      result = await taxDataStorage.loadAllClientData(args[0].ruc);
    } else if (channel === 'taxData:delete' && taxDataStorage) {
      result = await taxDataStorage.deleteTaxData(args[0].ruc, args[0].regimeType);
    } else if (channel === 'taxData:get-clients-with-data' && taxDataStorage) {
      result = await taxDataStorage.getClientsWithData();
    } else if (channel === 'taxData:stats' && taxDataStorage) {
      result = await taxDataStorage.getStats();
    }
    // Flows handlers
    else if (channel === 'flows:save') {
      const flowsHandler = require('./services/flowsHandler');
      result = await flowsHandler.saveFlow(args[0]);
    } else if (channel === 'flows:list') {
      const flowsHandler = require('./services/flowsHandler');
      result = await flowsHandler.listFlows(args[0]);
    } else if (channel === 'flows:delete') {
      const flowsHandler = require('./services/flowsHandler');
      result = await flowsHandler.deleteFlow(args[0]);
    } else if (channel === 'flows:import-script') {
      const flowsHandler = require('./services/flowsHandler');
      result = await flowsHandler.importScript(args[0]);
    }
    // Boleta config handlers
    else if (channel === 'boleta-config:save') {
      const boletaConfigHandler = require('./services/boletaConfigHandler');
      result = await boletaConfigHandler.saveConfig(args[0].ruc, args[0].config);
    } else if (channel === 'boleta-config:load') {
      const boletaConfigHandler = require('./services/boletaConfigHandler');
      result = await boletaConfigHandler.loadConfig(args[0].ruc);
    } else if (channel === 'boleta-config:list') {
      const boletaConfigHandler = require('./services/boletaConfigHandler');
      result = await boletaConfigHandler.listConfigs();
    } else if (channel === 'boleta-config:delete') {
      const boletaConfigHandler = require('./services/boletaConfigHandler');
      result = await boletaConfigHandler.deleteConfig(args[0].ruc);
    } else if (channel === 'boleta:connect') {
      const boletaHandler = require('./services/boletaHandler');
      result = await boletaHandler.connectInternal(args[0].ruc);
    } else if (channel === 'boleta:process-internal') {
      const boletaHandler = require('./services/boletaHandler');
      result = await boletaHandler.processInternalBatch(args[0].ruc, args[0].items, args[0].flow);
    } else if (channel === 'boleta:close-session') {
      const boletaHandler = require('./services/boletaHandler');
      result = await boletaHandler.closeSession(args[0].ruc);
    }
    // PDF & Excel handlers
    else if (channel === 'pdf:merge-files') {
      const pdfMerger = require('./services/pdfMergerService');
      result = await pdfMerger.mergeInPairs(args[0].inputFiles, args[0].outputDir);
    } else if (channel === 'excel:get-sheets') {
      const excelReader = require('./services/excelReader');
      const sheets = excelReader.getSheets(args[0]);
      result = { success: true, sheets };
    } else if (channel === 'excel:read-sheet') {
      const excelReader = require('./services/excelReader');
      const data = excelReader.readSheet(args[0].filePath, args[0].sheetName);
      result = { success: true, data };
    }
    // Email handlers
    else if (channel === 'email:enviar-con-adjuntos') {
      const emailService = require('./services/emailService');
      result = await emailService.enviarEmailConAdjuntos(args[0].destinatario, args[0].asunto, args[0].mensaje, args[0].archivos);
    } else if (channel === 'email:enviar-factura') {
      const emailService = require('./services/emailService');
      result = await emailService.enviarFacturaEmail(args[0].destinatario, args[0].facturaData);
    }
    // CPE Scraping handlers
    else if (channel === 'cpe-scraping-consultar-masivo') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.consultarMasivo(args[0].sessionId, args[0].listaComprobantes, args[0].cliente);
    } else if (channel === 'cpe-scraping-cerrar-todas') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.cerrarTodasLasSesiones();
    } else if (channel === 'cpe-emitir-boletas') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.emitirBoletas(args[0].rucConsultante);
    } else if (channel === 'cpe-listar-constancias') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.listarConstancias(args[0].rucConsultante);
    } else if (channel === 'cpe-visualizar-facturas') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.visualizarFacturas(args[0].rucConsultante);
    } else if (channel === 'cpe-emitir-facturas') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.emitirFacturas(args[0].rucConsultante);
    } else if (channel === 'cpe-procesar-boleta') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.procesarBoleta(args[0].sessionId, args[0].formConfig, args[0].item);
    } else if (channel === 'cpe-cerrar-sesion-boletas') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.cerrarSesionBoletas(args[0].sessionId);
    } else if (channel === 'cpe-obtener-credenciales') {
      const { cpeScrapingHandler } = require('./services/cpeScrapingHandler');
      result = await cpeScrapingHandler.obtenerCredenciales(args[0].rucConsultante);
    }
    // SIRE Ajustes handlers
    else if (channel === 'sire-ajustes-init') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      const datosIniciales = await sireAjustesHandler.cargarDatosIniciales();
      result = { success: true, datos: datosIniciales };
    } else if (channel === 'verificar-ruc') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.verificarRUC(args[0]);
    } else if (channel === 'completar-datos') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.completarDatos(args[0].nombreHoja, args[0].datosEmpresa);
    } else if (channel === 'cambiar-vista') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.cambiarVista(args[0]);
    } else if (channel === 'generar-archivo') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.generarArchivo(args[0].nombreHoja, args[0].rutaDestino);
    } else if (channel === 'generar-archivo-desde-tabla') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.generarArchivoDesdeTabla(
        args[0].nombreHoja,
        args[0].rutaDestino,
        args[0].datosTabla,
        args[0].datosEmpresa,
        args[0].correlativo,
        args[0].indicadorCont,
        args[0].indicadorMoned,
        args[0].comprobPago
      );
    } else if (channel === 'listar-archivos-output') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      const archivos = await sireAjustesHandler.listarArchivosOutput(args[0].ruc, args[0].rutaBase);
      result = { success: true, archivos };
    } else if (channel === 'leer-archivo-xlsx-output') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.leerArchivoXlsxOutput(args[0].nombreArchivo, args[0].ruc, args[0].rutaBase);
    } else if (channel === 'seleccionar-carpeta-destino') {
      const path = require('path');
      let folderPath;
      if (userStorageManager.isInitialized()) {
        folderPath = userStorageManager.getUserFolderPath('sire-files');
      } else {
        folderPath = path.join(process.cwd(), 'server', 'data', 'sire-files');
      }
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      result = { success: true, ruta: folderPath };
    } else if (channel === 'cargar-datos-hoja') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.cargarDatosHoja(args[0].nombreHoja);
    } else if (channel === 'cargar-clientes') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.cargarClientes();
    } else if (channel === 'guardar-datos-editados') {
      const sireAjustesHandler = require('./services/sireAjustesHandler');
      result = await sireAjustesHandler.guardarDatosEditados(args[0].nombreHoja, args[0].datosEditados);
    }
    // User storage / stats handlers
    else if (channel === 'user:initialize' && userStorageManager) {
      result = userStorageManager.initializeForUser(args[0].userId, args[0].email, args[0].plan);
    } else if (channel === 'user:get-current' && userStorageManager) {
      result = userStorageManager.getCurrentUser();
    } else if (channel === 'user:migrate-legacy' && userStorageManager) {
      result = await userStorageManager.migrateLegacyData(args[0].userId);
    } else if (channel === 'user:storage-stats' && userStorageManager) {
      result = { success: true, stats: userStorageManager.getUserStorageStats() };
    } else if (channel === 'user:get-stats' && userStorageManager) {
      result = { success: true, stats: userStorageManager.getStats() };
    } else if (channel === 'user:update-stats' && userStorageManager) {
      result = { success: true, stats: userStorageManager.updateStats(args[0].key, args[0].value, args[0].isIncrement) };
    }
    
    res.json(result);
  } catch (error) {
    logger.error(`[IPC Bridge] Error in channel ${channel}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Serve Frontend (Production) ──
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // SPA fallback - serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ── Start Server ──
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Automatizador SUNAT Web Server running on port ${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Frontend: ${fs.existsSync(distPath) ? 'Serving from dist/' : 'Use vite dev server on :3000'}`);
});

module.exports = app;
