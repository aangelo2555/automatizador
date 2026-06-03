const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Use process.cwd() instead of Electron's app.getPath()
const logDir = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'automatizador-sunat-web' },
  transports: [
    // File transport with daily rotation
    new winston.transports.File({
      filename: path.join(logDir, 'automatizador.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Console for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Redact sensitive information
logger.redactSensitive = (message, data = {}) => {
  const redactedData = { ...data };
  if (redactedData.clave) {
    redactedData.clave = '***REDACTED***';
  }
  if (redactedData.password) {
    redactedData.password = '***REDACTED***';
  }
  return logger.info(message, redactedData);
};

module.exports = logger;

