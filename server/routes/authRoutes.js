/**
 * Auth Routes - JWT-based authentication (similar to SoftContable)
 * Replaces Electron's auth:login, auth:register, auth:logout IPC handlers
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'automatizador-sunat-secret-key-2026';
const SECRET_KEY = process.env.REGISTER_SECRET_KEY || 'SAN2025DUL';
const MAX_RECENT_EMAILS = 5;

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RECENT_EMAILS_FILE = path.join(DATA_DIR, 'recent_emails.json');

// Helper functions
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    logger.error('Error loading users:', e);
  }
  return [];
}

function saveUsers(users) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (e) {
    logger.error('Error saving users:', e);
    return false;
  }
}

function findUser(email) {
  return loadUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

function loadRecentEmails() {
  try {
    if (fs.existsSync(RECENT_EMAILS_FILE)) {
      return JSON.parse(fs.readFileSync(RECENT_EMAILS_FILE, 'utf8'));
    }
  } catch (e) { }
  return [];
}

function saveRecentEmail(email) {
  try {
    let emails = loadRecentEmails();
    emails = emails.filter(e => e.email.toLowerCase() !== email.toLowerCase());
    emails.unshift({
      email: email.toLowerCase(),
      lastUsed: new Date().toISOString()
    });
    emails = emails.slice(0, MAX_RECENT_EMAILS);
    fs.writeFileSync(RECENT_EMAILS_FILE, JSON.stringify(emails, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña son requeridos' });
    }
    
    const user = findUser(email);
    
    if (!user) {
      return res.json({ success: false, error: 'Credenciales incorrectas' });
    }
    
    // Support both plain text (legacy) and bcrypt passwords
    let passwordValid = false;
    if (user.passwordHash) {
      passwordValid = await bcrypt.compare(password, user.passwordHash);
    } else {
      // Legacy plain text comparison
      passwordValid = user.password === password;
    }
    
    if (!passwordValid) {
      return res.json({ success: false, error: 'Credenciales incorrectas' });
    }
    
    // Save recent email
    saveRecentEmail(email);
    
    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || 'basico'
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
    
    logger.info(`Login exitoso: ${email}`);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan || 'basico',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, secretKey, plan } = req.body;
    
    if (!name || !email || !password || !secretKey) {
      return res.status(400).json({ success: false, error: 'Todos los campos son requeridos' });
    }
    
    if (secretKey !== SECRET_KEY) {
      return res.json({ success: false, error: 'Clave secreta incorrecta' });
    }
    
    if (findUser(email)) {
      return res.json({ success: false, error: 'El correo ya está registrado' });
    }
    
    const users = loadUsers();
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: Date.now(),
      name,
      email: email.toLowerCase(),
      password, // Keep plain text for backward compatibility
      passwordHash, // Also store bcrypt hash
      plan: (plan || 'basico').toLowerCase(),
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    if (saveUsers(users)) {
      logger.info(`Usuario registrado: ${email} con plan: ${newUser.plan}`);
      return res.json({ success: true });
    }
    
    res.json({ success: false, error: 'Error al guardar usuario' });
  } catch (error) {
    logger.error('Error en registro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // JWT is stateless, client just removes the token
  logger.info('Logout realizado');
  res.json({ success: true });
});

// GET /api/auth/recent-emails
router.get('/recent-emails', (req, res) => {
  try {
    res.json({ success: true, emails: loadRecentEmails() });
  } catch (error) {
    res.json({ success: false, error: error.message, emails: [] });
  }
});

// GET /api/auth/verify - Verify token validity
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json({ success: false, authenticated: false });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, authenticated: true, user: decoded });
  } catch (error) {
    res.json({ success: false, authenticated: false });
  }
});

module.exports = router;
