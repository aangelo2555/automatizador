/**
 * Handler para la carga de Ajustes Posteriores a SUNAT
 * Implementa la subida de archivos ZIP al endpoint de ajustes posteriores del SIRE
 */
// [WEB] Electron removed
const dialog = null;
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const logger = require('./logger');
const axios = require('axios');

class AjustesPosterioresHandler {
    constructor() {
        this.outputPath = path.join(process.cwd(), 'output');
        this.dataPath = path.join(process.cwd(), 'server', 'data');
        this.apiSirePath = path.join(this.dataPath, 'API_SIRE.xlsm');
    }

    /**
     * Configura los canales IPC para Ajustes Posteriores
     */
    setupIPC() {
        // [WEB] Electron IPC handlers disabled in web mode
    }

    /**
     * Obtiene las credenciales de autenticación desde API_SIRE.xlsm
     * Los tokens se encuentran en la columna A desde la fila 7
     * @returns {Object} - Credenciales de autenticación
     */
    async obtenerCredenciales() {
        try {
            // Verificar que existe el archivo API_SIRE.xlsm
            try {
                await fs.access(this.apiSirePath);
            } catch {
                throw new Error('No se encontró el archivo API_SIRE.xlsm en la carpeta data');
            }

            const workbook = XLSX.readFile(this.apiSirePath);

            // Buscar hoja de configuración (puede ser 'CONFIG', 'INICIO', o primera hoja)
            let configSheet = workbook.Sheets['CONFIG'] || workbook.Sheets['INICIO'] || workbook.Sheets[workbook.SheetNames[0]];

            if (!configSheet) {
                throw new Error('No se encontró hoja de configuración en API_SIRE.xlsm');
            }

            let token = null;
            let ruc = null;

            // Buscar token en columna A desde fila 7 (A7, A8, A9, etc.)
            // El token es el primer valor que parece un JWT (largo y empieza con 'ey')
            for (let row = 7; row <= 50; row++) {
                const cellAddress = `A${row}`;
                const cell = configSheet[cellAddress];

                if (cell && cell.v) {
                    const value = String(cell.v).trim();

                    // Detectar si parece un token JWT (normalmente empieza con 'ey' y es largo)
                    if (value.length > 50 && (value.startsWith('ey') || value.includes('.'))) {
                        token = value;
                        logger.info('Token encontrado en celda', { cellAddress, tokenLength: value.length });
                        break;
                    }
                }
            }

            // Si no se encontró en columna A, buscar en otras ubicaciones como fallback
            if (!token) {
                const posiblesUbicaciones = ['B2', 'D4', 'B5', 'C2'];
                for (const ubicacion of posiblesUbicaciones) {
                    const cellToken = configSheet[ubicacion];
                    if (cellToken && cellToken.v && String(cellToken.v).length > 50) {
                        const value = String(cellToken.v).trim();
                        if (value.startsWith('ey') || value.includes('.')) {
                            token = value;
                            logger.info('Token encontrado en celda (fallback)', { cellAddress: ubicacion });
                            break;
                        }
                    }
                }
            }

            // Buscar RUC en ubicaciones comunes
            const ubicacionesRuc = ['B3', 'D3', 'B4', 'C3', 'A3', 'A4'];
            for (const ubicacion of ubicacionesRuc) {
                const cellRuc = configSheet[ubicacion];
                if (cellRuc && cellRuc.v && /^\d{11}$/.test(String(cellRuc.v).trim())) {
                    ruc = String(cellRuc.v).trim();
                    break;
                }
            }

            if (!token) {
                logger.warn('No se encontró token de autenticación en API_SIRE.xlsm (columna A desde fila 7)');
            } else {
                logger.info('Token obtenido correctamente', { tokenLength: token.length, hasRuc: !!ruc });
            }

            return {
                token,
                ruc,
                success: !!token
            };

        } catch (error) {
            logger.error('Error al obtener credenciales', { error: error.message });
            throw error;
        }
    }

    /**
     * Sube un archivo ZIP a SUNAT usando el endpoint de ajustes posteriores
     * @param {Object} params - Parámetros de subida
     * @returns {Object} - Resultado de la operación
     */
    async subirArchivoASunat(params) {
        const {
            nombreArchivo,
            numRuc,
            perTributario,
            codOrigenEnvio = '2',
            codProceso = '6',
            codTipoCorrelativo = '01',
            codLibro = '080000'
        } = params;

        try {
            logger.info('Iniciando subida de ajustes posteriores', { nombreArchivo, numRuc, perTributario });

            // Verificar que existe el archivo ZIP
            const rutaArchivo = path.join(this.outputPath, nombreArchivo);
            try {
                await fs.access(rutaArchivo);
            } catch {
                return { success: false, error: `No se encontró el archivo: ${nombreArchivo}` };
            }

            // Leer el archivo
            const archivoBuffer = await fs.readFile(rutaArchivo);

            // Obtener credenciales
            let credenciales;
            try {
                credenciales = await this.obtenerCredenciales();
            } catch (credError) {
                logger.warn('No se pudieron obtener credenciales', { error: credError.message });
                return {
                    success: false,
                    error: 'No se encontró token de autenticación. Verifique que API_SIRE.xlsm contenga las credenciales.'
                };
            }

            if (!credenciales.token) {
                return {
                    success: false,
                    error: 'Token de autenticación no encontrado en API_SIRE.xlsm. Asegúrese de que el archivo contenga un token válido.'
                };
            }

            logger.info('Token obtenido', { tokenLength: credenciales.token.length, tokenPreview: credenciales.token.substring(0, 50) + '...' });

            // Generar nombre de archivo para importación
            const nomArchivoImportacion = nombreArchivo.replace('.zip', '');

            // URL base de la API
            const apiUrl = 'https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/receptorajustesposteriores/web/ajustesposteriores/upload';

            // Construir metadata según especificación SUNAT TUS
            const filenameBase64 = Buffer.from(nombreArchivo).toString('base64');
            const filetypeBase64 = Buffer.from('zip').toString('base64');
            const numRucBase64 = Buffer.from(numRuc).toString('base64');
            const perTributarioBase64 = Buffer.from(perTributario).toString('base64');
            const codOrigenEnvioBase64 = Buffer.from(codOrigenEnvio).toString('base64');
            const codProcesoBase64 = Buffer.from(codProceso).toString('base64');
            const codTipoCorrelativoBase64 = Buffer.from(codTipoCorrelativo).toString('base64');
            const nomArchivoImportacionBase64 = Buffer.from(nomArchivoImportacion).toString('base64');
            const codLibroBase64 = Buffer.from(codLibro).toString('base64');

            const metadata = `filename ${filenameBase64},filetype ${filetypeBase64},numRuc ${numRucBase64},perTributario ${perTributarioBase64},codOrigenEnvio ${codOrigenEnvioBase64},codProceso ${codProcesoBase64},codTipoCorrelativo ${codTipoCorrelativoBase64},nomArchivoImportacion ${nomArchivoImportacionBase64},codLibro ${codLibroBase64}`;

            logger.info('Metadata construida', {
                filename: nombreArchivo,
                numRuc,
                perTributario,
                codProceso,
                codLibro,
                fileSize: archivoBuffer.length
            });

            // Headers para TUS POST inicial
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${credenciales.token}`,
                'Upload-Metadata': metadata,
                'Tus-Resumable': '1.0.0',
                'Upload-Length': archivoBuffer.length.toString()
            };

            logger.info('Enviando POST a SUNAT', { url: apiUrl, fileSize: archivoBuffer.length });

            try {
                // Paso 1: Crear recurso TUS (POST sin body)
                const responsePost = await axios.post(apiUrl, null, {
                    headers: headers,
                    timeout: 120000, // 2 minutos
                    validateStatus: (status) => true
                });

                logger.info('Respuesta POST recibida', {
                    status: responsePost.status,
                    statusText: responsePost.statusText,
                    headers: responsePost.headers,
                    data: typeof responsePost.data === 'string' ? responsePost.data.substring(0, 500) : responsePost.data
                });

                // Manejar diferentes respuestas
                if (responsePost.status === 201 || responsePost.status === 200) {
                    // TUS: Recurso creado, verificar si hay location para PATCH
                    const uploadLocation = responsePost.headers['location'];
                    if (uploadLocation) {
                        // Construir URL completa si es relativa
                        let fullUploadUrl = uploadLocation;
                        if (uploadLocation.startsWith('/')) {
                            fullUploadUrl = `https://api-sire.sunat.gob.pe${uploadLocation}`;
                        }

                        logger.info('Recurso TUS creado, subiendo contenido', {
                            location: uploadLocation,
                            fullUrl: fullUploadUrl
                        });
                        return await this.subirContenidoPatch(fullUploadUrl, archivoBuffer, credenciales.token);
                    } else {
                        // Sin location - asumir éxito directo
                        return {
                            success: true,
                            message: 'Archivo procesado correctamente por SUNAT',
                            response: responsePost.data || { status: 'OK' }
                        };
                    }
                } else if (responsePost.status === 204) {
                    return {
                        success: true,
                        message: 'Archivo subido correctamente a SUNAT',
                        response: { status: 'OK' }
                    };
                } else if (responsePost.status === 401 || responsePost.status === 403) {
                    return {
                        success: false,
                        error: 'Error de autenticación. El token puede haber expirado. Genere un nuevo token en Postman y actualícelo en API_SIRE.xlsm',
                        errorCode: responsePost.status.toString()
                    };
                } else if (responsePost.status === 422) {
                    const errorData = responsePost.data;
                    return {
                        success: false,
                        error: errorData?.msg || 'Error de validación en SUNAT',
                        errorCode: errorData?.cod || '422',
                        details: errorData
                    };
                } else {
                    return {
                        success: false,
                        error: `Error de SUNAT. Código: ${responsePost.status}. ${responsePost.statusText || ''}`,
                        errorCode: responsePost.status.toString(),
                        details: responsePost.data
                    };
                }

            } catch (requestError) {
                logger.error('Error en solicitud HTTP', {
                    error: requestError.message,
                    code: requestError.code
                });

                if (requestError.code === 'ECONNABORTED' || requestError.message.includes('timeout')) {
                    return {
                        success: false,
                        error: 'Tiempo de espera agotado (120s). El servidor de SUNAT no respondió. Verifique su conexión a internet o intente más tarde.',
                        errorCode: 'TIMEOUT'
                    };
                }

                if (requestError.code === 'ECONNREFUSED' || requestError.code === 'ENOTFOUND') {
                    return {
                        success: false,
                        error: 'No se pudo conectar con SUNAT. Verifique su conexión a internet.',
                        errorCode: requestError.code
                    };
                }

                throw requestError;
            }

        } catch (error) {
            logger.error('Error en subida de ajustes posteriores', {
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sube el contenido del archivo usando PATCH (paso 2 de TUS)
     */
    async subirContenidoPatch(uploadLocation, archivoBuffer, token) {
        try {
            const headersPatch = {
                'Content-Type': 'application/offset+octet-stream',
                'Authorization': `Bearer ${token}`,
                'Tus-Resumable': '1.0.0',
                'Upload-Offset': '0',
                'Content-Length': archivoBuffer.length.toString()
            };

            logger.info('Subiendo contenido con PATCH', {
                location: uploadLocation,
                size: archivoBuffer.length
            });

            const responsePatch = await axios.patch(uploadLocation, archivoBuffer, {
                headers: headersPatch,
                timeout: 180000, // 3 minutos para archivos grandes
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                validateStatus: (status) => true
            });

            logger.info('Respuesta PATCH recibida', {
                status: responsePatch.status,
                data: responsePatch.data
            });

            if (responsePatch.status === 204 || responsePatch.status === 200) {
                return {
                    success: true,
                    message: 'Archivo subido correctamente a SUNAT',
                    response: responsePatch.data || { status: 'OK' }
                };
            } else if (responsePatch.status === 422) {
                const errorData = responsePatch.data;
                return {
                    success: false,
                    error: errorData?.msg || 'Error de validación al subir archivo',
                    errorCode: errorData?.cod || '422',
                    details: errorData
                };
            } else {
                return {
                    success: false,
                    error: `Error al subir contenido. Código: ${responsePatch.status}`,
                    errorCode: responsePatch.status.toString(),
                    details: responsePatch.data
                };
            }

        } catch (error) {
            logger.error('Error en PATCH', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Valida los parámetros antes de la subida
     * @param {Object} params - Parámetros a validar
     * @returns {Object} - Resultado de validación
     */
    validarParametros(params) {
        const errores = [];

        if (!params.nombreArchivo) {
            errores.push('El nombre del archivo es requerido');
        }

        if (!params.numRuc || !/^\d{11}$/.test(params.numRuc)) {
            errores.push('El RUC debe tener 11 dígitos');
        }

        if (!params.perTributario || !/^\d{6}$/.test(params.perTributario)) {
            errores.push('El periodo tributario debe tener formato YYYYMM');
        }

        if (errores.length > 0) {
            return { valid: false, errors: errores };
        }

        return { valid: true };
    }
}

module.exports = new AjustesPosterioresHandler();
