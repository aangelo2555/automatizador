/**
 * Config Routes - Application configuration
 * Replaces Electron's get-config IPC handler
 */

const express = require('express');
const router = express.Router();
const config = require('../services/config');

// GET /api/config
router.get('/', (req, res) => {
  res.json({
    success: true,
    config: {
      portales: config.PORTALES,
      playwright: config.PLAYWRIGHT
    }
  });
});

module.exports = router;
