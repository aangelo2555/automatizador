const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const pathResolver = require('./pathResolver');
const SireOrchestrator = require('./sireOrchestrator');
const excelReader = require('./excelReader');

class SireHandler {
  constructor() {
    this.excelSirePath = pathResolver.resolve('data/API_SIRE.xlsm');
    this.orchestrator = new SireOrchestrator();
  }

  /**
   * DEPRECATED: Ya no se usa API_SIRE.xlsm
   * Los clientes se gestionan desde "Gestión de Clientes"
   */
  async abrirExcelSire() {
    return {
      success: false,
      error: 'Esta función ya no está disponible. Los clientes ahora se gestionan desde "Gestión de Clientes".'
    };
  }

  /**
   * Ejecuta el proceso SIRE completo (JavaScript puro, sin Excel)
   * @param {Object} datos - Datos para la ejecución
   * @returns {Promise<Object>} Resultado de la operación
   */
  async ejecutarSire(datos) {
    try {
      const { ruc, empresa, proceso, periodoInicio, periodoFin, rangoActivo } = datos;

      logger.info('Ejecutando proceso SIRE (JavaScript)', {
        ruc,
        proceso,
        periodoInicio,
        periodoFin: rangoActivo ? periodoFin : 'N/A'
      });

      // Obtener credenciales de la empresa
      const credentials = await this.obtenerCredenciales(ruc);

      if (!credentials.success) {
        return {
          success: false,
          error: credentials.error
        };
      }

      // Preparar parámetros para el orquestador
      const params = {
        ruc,
        empresa,
        proceso,
        periodoInicio: parseInt(periodoInicio),
        periodoFin: rangoActivo ? parseInt(periodoFin) : parseInt(periodoInicio),
        rangoActivo,
        rangoActivo,
        credentials: credentials.data,
        plan: datos.plan // Pasar el plan al orquestador
      };

      // Ejecutar proceso
      const resultado = await this.orchestrator.ejecutarDescarga(params);

      if (resultado.success && resultado.excelPath) {
        // Abrir Excel automáticamente
        await this.orchestrator.abrirExcelGenerado(resultado.excelPath);
      }

      return resultado;

    } catch (error) {
      logger.error('Error en ejecutarSire', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene las credenciales de una empresa desde el clientStorage
   * @param {string} ruc - RUC de la empresa
   * @returns {Promise<Object>} Credenciales
   */
  async obtenerCredenciales(ruc) {
    try {
      const clientStorage = require('./clientStorageService');

      // Obtener cliente desde storage
      const cliente = clientStorage.getClient(ruc);

      if (!cliente) {
        return {
          success: false,
          error: `No se encontraron credenciales para el RUC ${ruc}. Agrega el cliente en "Gestión de Clientes".`
        };
      }

      // Verificar que sea de tipo SIRE
      if (cliente.tipo !== 'SIRE') {
        return {
          success: false,
          error: `El cliente ${ruc} no está configurado como SIRE. Edítalo en "Gestión de Clientes" y cambia el tipo a SIRE.`
        };
      }

      // Validar que tenga todos los campos necesarios
      if (!cliente.usuario || !cliente.clave) {
        return {
          success: false,
          error: `Faltan credenciales SOL para el RUC ${ruc}`
        };
      }

      if (!cliente.clienteId || !cliente.clienteSecret) {
        return {
          success: false,
          error: `Faltan Client ID y Client Secret para el RUC ${ruc}. Edita el cliente en "Gestión de Clientes" y agrega los datos de SIRE.`
        };
      }

      return {
        success: true,
        data: {
          ruc: cliente.ruc,
          usuario_sol: cliente.usuario,
          clave_sol: cliente.clave,
          client_id: cliente.clienteId,
          client_secret: cliente.clienteSecret
        }
      };

    } catch (error) {
      logger.error('Error al obtener credenciales', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crea un script VBS para ejecutar la macro de Excel
   * @param {Object} datos - Datos para la macro
   * @returns {string} Script VBS
   */
  crearScriptVBS(datos) {
    const { ruc, proceso, periodoInicio, periodoFin, rangoActivo } = datos;

    return `
Option Explicit

Dim objExcel, objWorkbook
Dim excelPath

excelPath = "${this.excelSirePath.replace(/\\/g, '\\\\')}"

' Crear instancia de Excel
Set objExcel = CreateObject("Excel.Application")
objExcel.Visible = True
objExcel.DisplayAlerts = False

' Abrir el archivo
Set objWorkbook = objExcel.Workbooks.Open(excelPath)

' Esperar a que se cargue
WScript.Sleep 2000

' Establecer valores en el formulario
On Error Resume Next

' Aquí puedes agregar código para interactuar con el UserForm
' Por ejemplo, establecer valores en celdas específicas
objWorkbook.Sheets("CONFIG").Range("A1").Value = "${ruc}"
objWorkbook.Sheets("CONFIG").Range("A2").Value = "${proceso}"
objWorkbook.Sheets("CONFIG").Range("A3").Value = "${periodoInicio}"
objWorkbook.Sheets("CONFIG").Range("A4").Value = "${rangoActivo ? periodoFin : ''}"

' Ejecutar la macro principal
objExcel.Run "EjecutarDescargaSIRE"

' Esperar a que termine
WScript.Sleep 5000

' Cerrar
objWorkbook.Save
objWorkbook.Close
objExcel.Quit

' Limpiar
Set objWorkbook = Nothing
Set objExcel = Nothing

WScript.Echo "Proceso SIRE completado"
`;
  }

  /**
   * Verifica si el archivo Excel SIRE existe
   * @returns {boolean} True si existe
   */
  verificarExcelSire() {
    return fs.existsSync(this.excelSirePath);
  }
}

module.exports = new SireHandler();
