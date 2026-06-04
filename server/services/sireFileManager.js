const fs = require('fs');
const path = require('path');
// [WEB] Electron removed
const logger = require('./logger');

/**
 * Gestor de archivos SIRE descargados
 */
class SireFileManager {
  get outputDir() {
    const userStorageManager = require('./userStorageManager');
    if (userStorageManager && userStorageManager.isInitialized()) {
      const userDir = userStorageManager.getUserFolderPath('sire-files');
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      return userDir;
    }
    const defaultDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    return defaultDir;
  }

  constructor() {
    logger.info('SireFileManager inicializado');
  }

  /**
   * Obtiene la lista de archivos SIRE descargados
   */
  async listarArchivos() {
    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
        return { success: true, archivos: [] };
      }

      // FunciÃ³n para recorrer directorios recursivamente
      const getAllFiles = (dirPath, arrayOfFiles) => {
        const files = fs.readdirSync(dirPath);

        arrayOfFiles = arrayOfFiles || [];

        files.forEach((file) => {
          const fullPath = path.join(dirPath, file);
          if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
          } else {
            // Solo procesar archivos Excel relevantes
            if (file.endsWith('.xlsx') && (file.includes('RCE_') || file.includes('RVIE_'))) {
              arrayOfFiles.push(fullPath);
            }
          }
        });

        return arrayOfFiles;
      };

      const allFiles = getAllFiles(this.outputDir, []);

      const archivos = allFiles.map(filePath => {
        const stats = fs.statSync(filePath);
        const file = path.basename(filePath);

        // Obtener nombre relativo (para abrir/eliminar)
        // Ejemplo: "20606080134\RCE_...xlsx"
        const relativePath = path.relative(this.outputDir, filePath).replace(/\\/g, '/');

        // Extraer informaciÃ³n del nombre del archivo
        // Formato: RCE_20123456789_202401_timestamp.xlsx
        const parts = file.replace('.xlsx', '').split('_');
        const tipo = parts[0]; // RCE o RVIE
        const ruc = parts[1];
        const periodo = parts[2];

        return {
          nombre: relativePath, // Usar ruta relativa como nombre identificador
          nombreDisplay: file, // Nombre solo del archivo para mostrar
          ruta: filePath,
          tipo: tipo,
          ruc: ruc,
          periodo: periodo,
          fechaCreacion: stats.birthtime,
          tamano: stats.size,
          tamanoFormateado: this.formatearTamano(stats.size)
        };
      })
        .sort((a, b) => b.fechaCreacion - a.fechaCreacion); // MÃ¡s recientes primero

      logger.info('Archivos SIRE listados', { cantidad: archivos.length });

      return {
        success: true,
        archivos: archivos
      };

    } catch (error) {
      logger.error('Error al listar archivos SIRE', { error: error.message });
      return {
        success: false,
        error: error.message,
        archivos: []
      };
    }
  }

  /**
   * Abre un archivo SIRE especÃ­fico
   */
  async abrirArchivo(nombreArchivo) {
    try {
      const normalizedNombre = nombreArchivo.replace(/\\/g, path.sep).replace(/\//g, path.sep);
      const filePath = path.join(this.outputDir, normalizedNombre);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      if (process.env.NODE_ENV === 'production' || process.platform !== 'win32') {
        logger.info('Entorno web/producción detectado. Omitiendo apertura de archivo local:', { nombreArchivo });
        return { success: true, message: 'Omitido en nube' };
      }

      const { exec } = require('child_process');
      const comando = process.platform === 'win32'
        ? `start "" "${filePath}"`
        : process.platform === 'darwin'
          ? `open "${filePath}"`
          : `xdg-open "${filePath}"`;

      exec(comando, (error) => {
        if (error) {
          logger.error('Error al abrir archivo', { error: error.message });
        }
      });

      logger.info('Archivo SIRE abierto', { archivo: nombreArchivo });

      return { success: true, message: 'Archivo abierto' };

    } catch (error) {
      logger.error('Error al abrir archivo SIRE', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Elimina un archivo SIRE
   */
  async eliminarArchivo(nombreArchivo) {
    try {
      const normalizedNombre = nombreArchivo.replace(/\\/g, path.sep).replace(/\//g, path.sep);
      const filePath = path.join(this.outputDir, normalizedNombre);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      fs.unlinkSync(filePath);
      logger.info('Archivo SIRE eliminado', { archivo: nombreArchivo });

      return { success: true, message: 'Archivo eliminado' };

    } catch (error) {
      logger.error('Error al eliminar archivo SIRE', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Formatea el tamaÃ±o del archivo
   */
  formatearTamano(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new SireFileManager();

