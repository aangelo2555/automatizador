/**
 * Upload Routes - File upload handling
 * Replaces Electron's dialog.showOpenDialog for file selection
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../services/logger');

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.xlsm', '.csv', '.pdf', '.xml', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${ext}`));
    }
  }
});

// POST /api/upload/excel - Upload Excel file
router.post('/excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
    }
    logger.info(`Archivo subido: ${req.file.originalname} -> ${req.file.path}`);
    res.json({
      success: true,
      filePath: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/upload/clients-excel - Upload and import clients from Excel
router.post('/clients-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
    }
    const excelReader = require('../services/excelReader');
    const clients = await excelReader.readClients(req.file.path);
    
    // Import clients into the active user's clientStorageService
    const clientStorage = require('../services/clientStorageService');
    const userStorageManager = require('../services/userStorageManager');
    
    // Ensure UserStorageManager and clientStorage are initialized for this user
    userStorageManager.initializeForUser(req.user.id, req.user.email, req.user.plan || 'basico');
    clientStorage.initializeForUser(req.user.id, req.user.plan || 'basico');
    
    const importResult = clientStorage.importClients(clients);
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkErr) {
      logger.warn('Error deleting temp upload file:', unlinkErr);
    }
    
    res.json({ success: true, ...importResult });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    logger.error('Error importing clients from Excel upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/upload/generic - Upload any allowed file
router.post('/generic', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
    }
    res.json({
      success: true,
      filePath: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
