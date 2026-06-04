const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Cargar variables de entorno
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = null;
        this.configured = false;
        this.emailUser = null;

        // Sistema de tracking para evitar emails duplicados
        this.trackingFile = path.join(process.cwd(), 'email_tracking.json');
        this.trackingData = this.cargarTracking();

        // Auto-configurar si existen las credenciales en .env
        this.autoConfigurar();
    }

    /**
     * Auto-configurar el servicio si existen credenciales en .env
     */
    autoConfigurar() {
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_PASS;

        if (user && pass && user !== 'tu-email@gmail.com') {
            logger.info('📧 Configurando email service automáticamente desde .env...');
            const result = this.configurar(user, pass);
            if (result.success) {
                logger.info('✅ Email service configurado automáticamente');
            } else {
                logger.warn('⚠️ No se pudo configurar email service', { error: result.error });
            }
        } else {
            logger.info('ℹ️ Email service no configurado (credenciales no encontradas en .env)');
        }
    }

    /**
     * Configurar el servicio de email con credenciales de Gmail
     * @param {string} user - Email de Gmail
     * @param {string} pass - Contraseña de aplicación de Gmail
     */
    configurar(user, pass) {
        try {
            this.transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: user,
                    pass: pass
                },
                tls: {
                    rejectUnauthorized: false
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000
            });

            this.emailUser = user;
            this.configured = true;
            logger.info('✅ Servicio de email configurado para:', { user });
            return { success: true, message: 'Email configurado correctamente' };
        } catch (error) {
            logger.error('❌ Error configurando email', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Recargar la configuración del servicio de email desde las variables de entorno
     * Útil para aplicar cambios sin reiniciar la aplicación
     */
    reloadConfiguration() {
        try {
            // Re-leer las variables de entorno (ya fueron actualizadas por envManager)
            const user = process.env.EMAIL_USER;
            const pass = process.env.EMAIL_PASS;

            if (user && pass && user !== 'tu-email@gmail.com') {
                logger.info('🔄 Recargando configuración de email...');
                const result = this.configurar(user, pass);
                if (result.success) {
                    logger.info('✅ Email service reconfigurado exitosamente');
                    return { success: true, message: 'Configuración recargada correctamente' };
                } else {
                    return result;
                }
            } else {
                logger.warn('⚠️ No se encontraron credenciales válidas para recargar');
                return { success: false, error: 'Credenciales no válidas o no configuradas' };
            }
        } catch (error) {
            logger.error('❌ Error recargando configuración de email', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Verificar la configuración actual enviando un email de prueba
     * @param {string} destinatario - Email al que enviar la prueba (por defecto, al mismo usuario)
     */
    async testConfiguration(destinatario = null) {
        try {
            this.verificarConfiguracion();

            const emailDestino = destinatario || this.emailUser;
            const asunto = '✅ Test de Configuración - SUNAT Bot';
            const mensaje = `
¡Configuración exitosa!

Este es un email de prueba enviado desde el Sistema SUNAT Bot para verificar que la configuración del servicio de email está funcionando correctamente.

✅ Servicio de email: Gmail
📧 Email configurado: ${this.emailUser}
🕐 Fecha y hora: ${new Date().toLocaleString('es-PE')}

Si recibes este mensaje, significa que tu configuración es correcta y el sistema puede enviar notificaciones por correo electrónico.

---
Sistema SUNAT Bot
            `.trim();

            const mensajeHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">✅ Configuración Exitosa</h1>
        </div>

        <!-- Content -->
        <div style="padding: 30px 25px;">
            <p style="margin: 0 0 20px 0; color: #333; font-size: 15px;">¡Excelente!</p>
            
            <p style="margin: 0 0 20px 0; color: #333; font-size: 15px;">
                Este es un email de prueba enviado desde el <strong>Sistema SUNAT Bot</strong> para verificar que la configuración del servicio de email está funcionando correctamente.
            </p>

            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0; color: #15803d; font-size: 14px;">
                    ✅ <strong>Servicio de email:</strong> Gmail
                </p>
                <p style="margin: 8px 0 0 0; color: #15803d; font-size: 14px;">
                    📧 <strong>Email configurado:</strong> ${this.emailUser}
                </p>
                <p style="margin: 8px 0 0 0; color: #15803d; font-size: 14px;">
                    🕐 <strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-PE')}
                </p>
            </div>

            <p style="margin: 0; color: #333; font-size: 15px;">
                Si recibes este mensaje, significa que tu configuración es correcta y el sistema puede enviar notificaciones por correo electrónico.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; color: #999; font-size: 12px;">
                Sistema SUNAT Bot - Email de Prueba
            </p>
        </div>

    </div>
</body>
</html>
            `.trim();

            const result = await this.enviarEmail(emailDestino, asunto, mensaje, mensajeHTML);

            if (result.success) {
                logger.info('✅ Email de prueba enviado correctamente');
                return {
                    success: true,
                    message: `Email de prueba enviado a ${emailDestino}`,
                    messageId: result.messageId
                };
            } else {
                return result;
            }
        } catch (error) {
            logger.error('❌ Error enviando email de prueba', { error: error.message });
            return {
                success: false,
                error: error.message,
                needsConfiguration: error.message.includes('no está configurado')
            };
        }
    }

    /**
     * Verificar si el servicio está configurado
     */
    verificarConfiguracion() {
        if (!this.configured || !this.transporter) {
            throw new Error('El servicio de email no está configurado. Use configurar() primero.');
        }
    }

    /**
     * Cargar el archivo de tracking de emails
     * @returns {Object} Datos de tracking
     */
    cargarTracking() {
        try {
            if (fs.existsSync(this.trackingFile)) {
                const data = fs.readFileSync(this.trackingFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            logger.warn('⚠️ Error cargando tracking de emails', { error: error.message });
        }
        return {};
    }

    /**
     * Guardar el archivo de tracking
     */
    guardarTracking() {
        try {
            fs.writeFileSync(this.trackingFile, JSON.stringify(this.trackingData, null, 2), 'utf8');
        } catch (error) {
            logger.error('❌ Error guardando tracking', { error: error.message });
        }
    }

    /**
     * Generar hash único para un conjunto de mensajes
     * @param {Array} mensajes - Array de mensajes
     * @returns {string} Hash único
     */
    generarHashMensajes(mensajes) {
        const crypto = require('crypto');
        const idsOrdenados = mensajes.map(m => m.id).sort().join('|');
        return crypto.createHash('md5').update(idsOrdenados).digest('hex');
    }

    /**
     * Verificar si se debe enviar email (evitar duplicados)
     * @param {string} ruc - RUC del cliente
     * @param {Array} mensajes - Mensajes a enviar
     * @returns {boolean} True si se debe enviar
     */
    debeEnviarEmail(ruc, mensajes) {
        if (!this.trackingData[ruc]) {
            return true; // Primera vez, siempre enviar
        }

        const hashActual = this.generarHashMensajes(mensajes);
        const hashAnterior = this.trackingData[ruc].lastSentHash;

        // Enviar solo si hay cambios en los mensajes
        return hashActual !== hashAnterior;
    }

    /**
     * Registrar que se envió un email
     * @param {string} ruc - RUC del cliente
     * @param {Array} mensajes - Mensajes enviados
     */
    registrarEmailEnviado(ruc, mensajes) {
        this.trackingData[ruc] = {
            lastSentHash: this.generarHashMensajes(mensajes),
            lastSentDate: new Date().toISOString(),
            mensajesIds: mensajes.map(m => m.id),
            cantidadMensajes: mensajes.length
        };
        this.guardarTracking();
    }


    /**
     * Enviar email básico
     * @param {string} destinatario - Email del destinatario
     * @param {string} asunto - Asunto del email
     * @param {string} mensaje - Cuerpo del mensaje (texto plano)
     * @param {string} mensajeHTML - Cuerpo del mensaje (HTML, opcional)
     */
    async enviarEmail(destinatario, asunto, mensaje, mensajeHTML = null) {
        try {
            this.verificarConfiguracion();

            const mailOptions = {
                from: `"SUNAT Bot" <${this.emailUser}>`,
                to: destinatario,
                subject: asunto,
                text: mensaje,
                html: mensajeHTML || `<p>${mensaje.replace(/\n/g, '<br>')}</p>`
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('✅ Email enviado', { messageId: info.messageId });

            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            // Si es error de configuración, no mostrar en rojo (no es crítico)
            if (error.message.includes('no está configurado')) {
                // Silencioso - solo retornar failure
                return {
                    success: false,
                    error: error.message,
                    needsConfiguration: true
                };
            }

            // Si es otro tipo de error (envío fallido, etc), sí mostrar
            logger.error('❌ Error enviando email', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enviar email con archivos adjuntos
     * @param {string} destinatario - Email del destinatario
     * @param {string} asunto - Asunto del email
     * @param {string} mensaje - Cuerpo del mensaje
     * @param {Array} archivos - Array de objetos {nombre, ruta} o solo rutas
     */
    async enviarEmailConAdjuntos(destinatario, asunto, mensaje, archivos = [], mensajeHTMLOverride = null) {
        try {
            this.verificarConfiguracion();

            // Verificar que los archivos existan
            const adjuntosValidos = [];
            for (const archivo of archivos) {
                const rutaArchivo = typeof archivo === 'string' ? archivo : archivo.ruta;

                if (fs.existsSync(rutaArchivo)) {
                    const adjunto = {
                        path: rutaArchivo
                    };

                    // Si viene con propiedades extra (como cid o filename), las mantenemos
                    if (typeof archivo === 'object') {
                        if (archivo.filename) adjunto.filename = archivo.filename;
                        if (archivo.cid) adjunto.cid = archivo.cid;
                    } else {
                        adjunto.filename = path.basename(rutaArchivo);
                    }

                    adjuntosValidos.push(adjunto);
                } else {
                    logger.warn('⚠️ Archivo no encontrado', { rutaArchivo });
                }
            }

            const mailOptions = {
                from: `"SUNAT Bot" <${this.emailUser}>`,
                to: destinatario,
                subject: asunto,
                text: mensaje,
                html: mensajeHTMLOverride || `<p>${mensaje.replace(/\n/g, '<br>')}</p>`,
                attachments: adjuntosValidos
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('✅ Email enviado con adjuntos', { adjuntos: adjuntosValidos.length, messageId: info.messageId });

            return {
                success: true,
                messageId: info.messageId,
                adjuntosEnviados: adjuntosValidos.length
            };
        } catch (error) {
            logger.error('❌ Error enviando email con adjuntos', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enviar alerta de nuevas facturas
     * @param {string} destinatario - Email del destinatario
     * @param {object} cliente - Datos del cliente
     * @param {number} cantidad - Cantidad de facturas nuevas
     */
    async enviarAlertaFacturas(destinatario, cliente, cantidad) {
        const asunto = `🔔 Nuevas Facturas Detectadas - ${cliente.empresa || cliente.ruc}`;
        const mensaje = `
Estimado usuario,

Se han detectado ${cantidad} facturas nuevas en el buzón de SUNAT para:

📋 RUC: ${cliente.ruc}
🏢 Empresa: ${cliente.empresa || 'N/A'}

Por favor revise el buzón electrónico de SUNAT para más detalles.

---
Este es un mensaje automático del Sistema SUNAT Bot
Fecha: ${new Date().toLocaleString('es-PE')}
    `.trim();

        const mensajeHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">🔔 Nuevas Facturas Detectadas</h2>
        <p>Estimado usuario,</p>
        <p>Se han detectado <strong>${cantidad}</strong> facturas nuevas en el buzón de SUNAT para:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>📋 RUC:</strong> ${cliente.ruc}</p>
          <p style="margin: 5px 0;"><strong>🏢 Empresa:</strong> ${cliente.empresa || 'N/A'}</p>
        </div>
        <p>Por favor revise el buzón electrónico de SUNAT para más detalles.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Este es un mensaje automático del Sistema SUNAT Bot<br>
          Fecha: ${new Date().toLocaleString('es-PE')}
        </p>
      </div>
    `;

        return await this.enviarEmail(destinatario, asunto, mensaje, mensajeHTML);
    }

    /**
     * Enviar alerta de nuevos mensajes del buzón electrónico
     * @param {string} destinatario - Email del destinatario
     * @param {object} cliente - Datos del cliente {ruc, empresa}
     * @param {Array} mensajes - Array con los mensajes [{id, asunto, fecha, tieneAdjunto}]
     * @returns {Promise<Object>} Resultado del envío
     */
    async enviarAlertaMensajesBuzon(destinatario, cliente, mensajes) {
        const cantidad = mensajes.length;
        const asunto = `📬 ${cantidad} Nuevo${cantidad > 1 ? 's' : ''} Mensaje${cantidad > 1 ? 's' : ''} en Buzón SUNAT - ${cliente.empresa || cliente.ruc}`;

        // Generar tabla HTML de mensajes
        const filasHTML = mensajes.map((msg, idx) => `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 8px; text-align: center; color: #666;">${idx + 1}</td>
                <td style="padding: 12px 8px;">
                    <div style="font-weight: 500; color: #333; margin-bottom: 4px;">${msg.asunto || 'Sin asunto'}</div>
                    <div style="font-size: 12px; color: #999;">ID: ${msg.id}</div>
                </td>
                <td style="padding: 12px 8px; color: #666; font-size: 14px;">${msg.fecha || 'Sin fecha'}</td>
                <td style="padding: 12px 8px; text-align: center;">
                    ${msg.tieneAdjunto ? '<span style="color: #4caf50; font-size: 18px;">📎</span>' : '<span style="color: #ccc;">-</span>'}
                </td>
            </tr>
        `).join('');

        const mensaje = `
Estimado usuario,

Se han detectado ${cantidad} nuevo${cantidad > 1 ? 's' : ''} mensaje${cantidad > 1 ? 's' : ''} en el Buzón Electrónico de SUNAT para:

📋 RUC: ${cliente.ruc}
🏢 Empresa: ${cliente.empresa || 'N/A'}

MENSAJES DETECTADOS:
${mensajes.map((m, i) => `${i + 1}. ${m.asunto || 'Sin asunto'} ${m.tieneAdjunto ? '📎' : ''}\n   Fecha: ${m.fecha || 'Sin fecha'}\n   ID: ${m.id}`).join('\n\n')}

Por favor acceda al sistema para revisar los detalles completos.

---
Este es un mensaje automático del Sistema SUNAT Bot
Fecha: ${new Date().toLocaleString('es-PE')}
        `.trim();

        const mensajeHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 650px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
                📬 Buzón Electrónico SUNAT
            </h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Nuevos mensajes detectados
            </p>
        </div>

        <!-- Contenido -->
        <div style="padding: 30px 25px;">
            
            <!-- Saludo -->
            <p style="margin: 0 0 20px 0; color: #333; font-size: 15px;">Estimado usuario,</p>
            
            <!-- Alerta -->
            <div style="background: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
                <p style="margin: 0; color: #1565c0; font-size: 16px; font-weight: 500;">
                    Se ${cantidad > 1 ? 'han' : 'ha'} detectado <strong>${cantidad}</strong> nuevo${cantidad > 1 ? 's' : ''} mensaje${cantidad > 1 ? 's' : ''} en su buzón
                </p>
            </div>

            <!-- Info del Cliente -->
            <div style="background: #fafafa; padding: 18px; border-radius: 8px; margin-bottom: 25px;">
                <div style="margin-bottom: 10px;">
                    <span style="color: #666; font-size: 13px;">📋 RUC:</span>
                    <strong style="color: #333; font-size: 15px; margin-left: 8px;">${cliente.ruc}</strong>
                </div>
                <div>
                    <span style="color: #666; font-size: 13px;">🏢 Empresa:</span>
                    <strong style="color: #333; font-size: 15px; margin-left: 8px;">${cliente.empresa || 'N/A'}</strong>
                </div>
            </div>

            <!-- Título de tabla -->
            <h3 style="color: #333; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">
                Mensajes Recibidos:
            </h3>

            <!-- Tabla de Mensajes -->
            <div style="overflow-x: auto; margin-bottom: 25px;">
                <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 12px 8px; text-align: center; color: #666; font-size: 13px; font-weight: 600; border-bottom: 2px solid #ddd;">#</th>
                            <th style="padding: 12px 8px; text-align: left; color: #666; font-size: 13px; font-weight: 600; border-bottom: 2px solid #ddd;">Asunto</th>
                            <th style="padding: 12px 8px; text-align: left; color: #666; font-size: 13px; font-weight: 600; border-bottom: 2px solid #ddd;">Fecha</th>
                            <th style="padding: 12px 8px; text-align: center; color: #666; font-size: 13px; font-weight: 600; border-bottom: 2px solid #ddd;">Adjunto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHTML}
                    </tbody>
                </table>
            </div>

            <!-- Instrucciones -->
            <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0; color: #e65100; font-size: 14px;">
                    💡 <strong>Importante:</strong> Acceda al sistema para revisar los detalles completos de cada mensaje.
                </p>
            </div>

        </div>

        <!-- Footer -->
        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 5px 0; color: #999; font-size: 12px;">
                Este es un mensaje automático del Sistema SUNAT Bot
            </p>
            <p style="margin: 0; color: #bbb; font-size: 11px;">
                Fecha: ${new Date().toLocaleString('es-PE', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
        </div>

    </div>
</body>
</html>
        `.trim();

        return await this.enviarEmail(destinatario, asunto, mensaje, mensajeHTML);
    }


    /**
     * Enviar reporte de procesamiento de facturas
     * @param {string} destinatario - Email del destinatario
     * @param {Array} facturas - Array de facturas procesadas
     * @param {Array} archivos - Archivos para adjuntar
     */
    async enviarReporteFacturas(destinatario, facturas, archivos = []) {
        const asunto = `📊 Reporte de Facturas Procesadas - ${new Date().toLocaleDateString('es-PE')}`;

        const mensaje = `
Reporte de Facturas Procesadas

Se han procesado ${facturas.length} documentos:

${facturas.map((f, i) => `${i + 1}. ${f.serie}-${f.numero} | ${f.fechaEmision || 'N/A'} | S/. ${f.monto || 'N/A'}`).join('\n')}

Los archivos PDF/XML se encuentran adjuntos a este correo.

---
Sistema SUNAT Bot
Fecha: ${new Date().toLocaleString('es-PE')}
    `.trim();

        const listaHTML = facturas.map((f, i) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px;">${i + 1}</td>
        <td style="padding: 8px;"><strong>${f.serie}-${f.numero}</strong></td>
        <td style="padding: 8px;">${f.fechaEmision || 'N/A'}</td>
        <td style="padding: 8px; text-align: right;"><strong>S/. ${f.monto || 'N/A'}</strong></td>
      </tr>
    `).join('');

        const mensajeHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #1976d2;">📊 Reporte de Facturas Procesadas</h2>
        <p>Se han procesado <strong>${facturas.length}</strong> documentos:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #1976d2; color: white;">
              <th style="padding: 10px; text-align: left;">#</th>
              <th style="padding: 10px; text-align: left;">Documento</th>
              <th style="padding: 10px; text-align: left;">Fecha</th>
              <th style="padding: 10px; text-align: right;">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${listaHTML}
          </tbody>
        </table>
        <p>Los archivos PDF/XML se encuentran adjuntos a este correo.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Sistema SUNAT Bot<br>
          Fecha: ${new Date().toLocaleString('es-PE')}
        </p>
      </div>
    `;

        return await this.enviarEmailConAdjuntos(destinatario, asunto, mensaje, archivos);
    }

    /**
     * Enviar notificación de error
     * @param {string} destinatario - Email del destinatario
     * @param {string} error - Mensaje de error
     * @param {object} contexto - Contexto adicional del error
     */
    async enviarNotificacionError(destinatario, error, contexto = {}) {
        const asunto = `⚠️ Error en SUNAT Bot - ${new Date().toLocaleString('es-PE')}`;

        const mensaje = `
⚠️ SE HA DETECTADO UN ERROR

Error: ${error}

Contexto:
${Object.entries(contexto).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Fecha: ${new Date().toLocaleString('es-PE')}

Por favor revise el sistema.

---
Sistema SUNAT Bot - Notificación Automática
    `.trim();

        return await this.enviarEmail(destinatario, asunto, mensaje);
    }

    /**
     * Enviar detalle de factura por email
     * @param {string} destinatario - Email del destinatario
     * @param {object} facturaData - Datos de la factura
     */
    async enviarFacturaEmail(destinatario, facturaData) {
        const { rucEmisor, tipoComprobante, serie, numero, fechaEmision, importeTotal, razonSocial, consultante, estado, html } = facturaData;
        const tipoLabel = tipoComprobante === '01' ? 'Factura' : 'Boleta';
        const docId = `${serie}-${numero}`;
        const estadoStr = estado || 'NO DEFINIDO';

        const asunto = `📄 ${tipoLabel} ${docId} [${estadoStr}] - ${razonSocial || rucEmisor}`;

        // Color del estado
        let estadoColor = '#64748b'; // gris default
        let estadoBg = '#f1f5f9';
        if (estadoStr.includes('ACEPTADO') || estadoStr.includes('ACTIVO')) {
            estadoColor = '#166534'; // verde
            estadoBg = '#dcfce7';
        } else if (estadoStr.includes('ANULADO') || estadoStr.includes('BAJA')) {
            estadoColor = '#991b1b'; // rojo
            estadoBg = '#fee2e2';
        }

        // Construir mensaje texto plano
        const mensaje = `
Detalle del Comprobante Electrónico

Estado: ${estadoStr}

Consultante: ${consultante?.empresa || 'Desconocido'} (${consultante?.ruc || 'N/A'})

Datos del Emisor:
Razón Social: ${razonSocial || 'N/A'}
RUC: ${rucEmisor}

Datos del Comprobante:
Tipo: ${tipoLabel}
Número: ${docId}
Fecha de Emisión: ${fechaEmision || 'No disponible'}
Importe Total: ${importeTotal || 'No disponible'}

(Ver detalle completo en el HTML adjunto o visualización del correo)

---
Sistema SUNAT Bot
Fecha de consulta: ${new Date().toLocaleString('es-PE')}
        `.trim();

        // Construir HTML bonito
        // Insertamos el HTML original del scraping dentro de nuestro contenedor.
        // Hacemos un poco de sanitización básica de estilos para asegurar que se vea bien en email.
        const facturaDetalleHTML = html ?
            `<div class="factura-original" style="background: white; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; overflow-x: auto;">
                ${html}
             </div>` :
            `<p style="color: red;">No se pudo recuperar el detalle visual del comprobante.</p>`;

        const mensajeHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Estilos básicos para asegurar que la tabla original se vea al menos decente */
        .factura-original table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-family: Arial, sans-serif; }
        .factura-original td, .factura-original th { padding: 8px; border: 1px solid #eee; font-size: 12px; }
        .factura-original b { font-weight: 700; color: #333; }
        /* Ocultar elementos no deseados del modal original si los hubiera */
        .btn, button, .close { display: none !important; }
    </style>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 24px; text-align: center; color: white;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">COMPROBANTE ELECTRÓNICO</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">${tipoLabel.toUpperCase()}</h1>
            <div style="font-size: 20px; margin-top: 4px; font-weight: 500;">${docId}</div>
            
            <!-- Estado Badge -->
            <div style="margin-top: 15px;">
                <span style="background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
                    ${estadoStr}
                </span>
            </div>
        </div>

        <!-- Consultante Info -->
        <div style="background: #eff6ff; padding: 12px 24px; border-bottom: 1px solid #dbeafe;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Consultado por</div>
            <div style="color: #1e3a8a; font-weight: 600; font-size: 14px; margin-top: 2px;">
                ${consultante?.empresa || 'N/A'} <span style="font-weight: 400; color: #64748b;">(RUC: ${consultante?.ruc || 'N/A'})</span>
            </div>
        </div>

        <!-- Contenido Principal: HTML Original del Comprobante -->
        <div style="padding: 24px;">
            ${facturaDetalleHTML}
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                Este correo fue enviado automáticamente por el <strong>Sistema SUNAT Bot</strong><br>
                ${new Date().toLocaleString('es-PE')}
            </p>
        </div>

    </div>
</body>
</html>
        `.trim();

        return await this.enviarEmail(destinatario, asunto, mensaje, mensajeHTML);
    }
}

// Exportar instancia única
module.exports = new EmailService();
