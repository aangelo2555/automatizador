const path = require('path');
const fs = require('fs');

/**
 * Path resolver for web environment (no Electron)
 * Resolves paths relative to the project root (process.cwd())
 */

const isProduction = process.env.NODE_ENV === 'production';
const ROOT_DIR = process.cwd();

/**
 * Get the base data directory
 */
function getDataDir() {
  return path.join(ROOT_DIR, 'server', 'data');
}

/**
 * Get the output directory
 */
function getOutputDir() {
  const dir = path.join(ROOT_DIR, 'output');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the descargas_cpe directory
 */
function getDescargasCpeDir() {
  const dir = path.join(ROOT_DIR, 'descargas_cpe');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the descargas_buzon directory
 */
function getDescargasBuzonDir() {
  const dir = path.join(ROOT_DIR, 'descargas_buzon');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the SIRE directory
 */
function getSireDir() {
  const dir = path.join(ROOT_DIR, 'sire');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the temp directory
 */
function getTempDir() {
  const dir = path.join(ROOT_DIR, 'temp');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the uploads directory
 */
function getUploadsDir() {
  const dir = path.join(ROOT_DIR, 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the logs directory
 */
function getLogsDir() {
  const dir = path.join(ROOT_DIR, 'logs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Resolve a resource path (replaces Electron's app.getPath)
 */
function resolve(...segments) {
  return path.join(ROOT_DIR, ...segments);
}

module.exports = {
  ROOT_DIR,
  getDataDir,
  getOutputDir,
  getDescargasCpeDir,
  getDescargasBuzonDir,
  getSireDir,
  getTempDir,
  getUploadsDir,
  getLogsDir,
  resolve
};

