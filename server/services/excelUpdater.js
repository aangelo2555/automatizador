const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Actualiza el archivo CLIENTES.xlsx para agregar columnas faltantes
 */
class ExcelUpdater {
  
  /**
   * Actualiza el Excel agregando columnas si faltan
   */
  async actualizarExcel(filePath = 'data/API_SIRE.xlsm') {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn('Archivo no existe, no se puede actualizar');
        return { success: false, error: 'Archivo no encontrado' };
      }

      logger.info('Verificando estructura del Excel', { filePath });

      // Leer archivo
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) {
        return { success: false, error: 'Excel vacío' };
      }

      const headers = jsonData[0];
      const columnasRequeridas = ['RUC', 'RAZON SOCIAL', 'USUARIO_SOL', 'CLAVE_SOL', 'CLIENTE_ID', 'CLIENTE_SECRET'];
      const columnasFaltantes = columnasRequeridas.filter(col => !headers.includes(col));

      if (columnasFaltantes.length === 0) {
        logger.info('Excel ya tiene todas las columnas necesarias');
        return { success: true, message: 'Excel actualizado' };
      }

      logger.info('Agregando columnas faltantes', { columnas: columnasFaltantes });

      // Agregar columnas faltantes
      columnasFaltantes.forEach(columna => {
        headers.push(columna);
      });

      // Actualizar primera fila
      jsonData[0] = headers;

      // Crear nuevo worksheet
      const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);

      // Reemplazar worksheet
      workbook.Sheets[sheetName] = newWorksheet;

      // Guardar archivo
      XLSX.writeFile(workbook, filePath);

      logger.info('Excel actualizado exitosamente', { 
        columnasAgregadas: columnasFaltantes.length 
      });

      return {
        success: true,
        message: `Se agregaron ${columnasFaltantes.length} columnas`,
        columnasAgregadas: columnasFaltantes
      };

    } catch (error) {
      logger.error('Error al actualizar Excel', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crea un backup del Excel antes de modificarlo
   */
  async crearBackup(filePath) {
    try {
      const backupPath = filePath.replace('.xlsx', `_backup_${Date.now()}.xlsx`);
      fs.copyFileSync(filePath, backupPath);
      logger.info('Backup creado', { backupPath });
      return { success: true, backupPath };
    } catch (error) {
      logger.error('Error al crear backup', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ExcelUpdater();
