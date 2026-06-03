const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class EnvManager {
    constructor() {
        this.envPath = path.join(process.cwd(), '.env');
    }

    /**
     * Lee el archivo .env y retorna los valores parseados
     * @returns {Object} Objeto con las variables de entorno
     */
    readEnvFile() {
        try {
            if (!fs.existsSync(this.envPath)) {
                logger.warn('⚠️ Archivo .env no encontrado');
                return {};
            }

            const content = fs.readFileSync(this.envPath, 'utf8');
            const env = {};

            // Parsear línea por línea
            const lines = content.split('\n');
            for (const line of lines) {
                // Ignorar comentarios y líneas vacías
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;

                // Buscar el primer = para separar key y value
                const equalIndex = trimmed.indexOf('=');
                if (equalIndex === -1) continue;

                const key = trimmed.substring(0, equalIndex).trim();
                const value = trimmed.substring(equalIndex + 1).trim();

                env[key] = value;
            }

            return env;
        } catch (error) {
            logger.error('❌ Error leyendo archivo .env', { error: error.message });
            throw error;
        }
    }

    /**
     * Actualiza variables específicas en el archivo .env preservando formato y comentarios
     * @param {Object} updates - Objeto con las variables a actualizar {KEY: value}
     */
    updateEnvFile(updates) {
        try {
            let content = '';

            // Si el archivo existe, leer el contenido actual
            if (fs.existsSync(this.envPath)) {
                content = fs.readFileSync(this.envPath, 'utf8');
            } else {
                // Si no existe, crear estructura básica
                content = `# Variables de Entorno - SUNAT BOT\n\n## Email Service (Gmail)\n`;
            }

            const lines = content.split('\n');
            const updatedKeys = new Set();

            // Recorrer líneas y actualizar las que correspondan
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Saltar comentarios y líneas vacías
                if (!line || line.startsWith('#')) continue;

                const equalIndex = line.indexOf('=');
                if (equalIndex === -1) continue;

                const key = line.substring(0, equalIndex).trim();

                // Si esta key está en los updates, reemplazar
                if (updates.hasOwnProperty(key)) {
                    lines[i] = `${key}=${updates[key]}`;
                    updatedKeys.add(key);
                }
            }

            // Agregar las keys que no existían
            for (const [key, value] of Object.entries(updates)) {
                if (!updatedKeys.has(key)) {
                    // Buscar la sección de Email Service para agregar allí
                    const emailSectionIndex = lines.findIndex(l => l.includes('## Email Service'));
                    if (emailSectionIndex !== -1) {
                        // Insertar después de la sección
                        lines.splice(emailSectionIndex + 1, 0, `${key}=${value}`);
                    } else {
                        // Si no hay sección, agregar al final
                        lines.push(`${key}=${value}`);
                    }
                }
            }

            // Escribir de vuelta
            const newContent = lines.join('\n');
            fs.writeFileSync(this.envPath, newContent, 'utf8');

            logger.info('✅ Archivo .env actualizado correctamente');
            return { success: true };
        } catch (error) {
            logger.error('❌ Error actualizando archivo .env', { error: error.message });
            throw error;
        }
    }

    /**
     * Valida el formato de la configuración de email
     * @param {string} user - Email del usuario
     * @param {string} pass - Contraseña de aplicación
     * @returns {Object} {valid: boolean, error?: string}
     */
    validateEmailConfig(user, pass) {
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user)) {
            return { valid: false, error: 'Formato de email inválido' };
        }

        // Validar que la contraseña no esté vacía
        if (!pass || pass.trim().length === 0) {
            return { valid: false, error: 'La contraseña de aplicación es requerida' };
        }

        // Validar longitud mínima de la contraseña (las de Google son de 16 chars sin espacios)
        const passWithoutSpaces = pass.replace(/\s/g, '');
        if (passWithoutSpaces.length < 16) {
            return {
                valid: false,
                error: 'La contraseña de aplicación debe tener al menos 16 caracteres (sin espacios)'
            };
        }

        return { valid: true };
    }

    /**
     * Obtiene la configuración actual de email (sin exponer la contraseña completa)
     * @returns {Object} {user: string, hasPassword: boolean}
     */
    getCurrentEmailConfig() {
        try {
            const env = this.readEnvFile();
            return {
                user: env.EMAIL_USER || '',
                hasPassword: !!(env.EMAIL_PASS && env.EMAIL_PASS.length > 0),
                // Mostrar solo los primeros 4 caracteres de la contraseña para referencia
                passwordHint: env.EMAIL_PASS ? env.EMAIL_PASS.substring(0, 4) + '****' : ''
            };
        } catch (error) {
            logger.error('❌ Error obteniendo configuración de email', { error: error.message });
            return {
                user: '',
                hasPassword: false,
                passwordHint: ''
            };
        }
    }

    /**
     * Actualiza la configuración de email en el archivo .env
     * @param {string} user - Email del usuario
     * @param {string} pass - Contraseña de aplicación
     * @returns {Object} {success: boolean, error?: string}
     */
    updateEmailConfig(user, pass) {
        try {
            // Validar antes de guardar
            const validation = this.validateEmailConfig(user, pass);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Actualizar .env
            this.updateEnvFile({
                EMAIL_USER: user,
                EMAIL_PASS: pass
            });

            // También actualizar process.env para que tome efecto inmediatamente
            process.env.EMAIL_USER = user;
            process.env.EMAIL_PASS = pass;

            logger.info('✅ Configuración de email actualizada', { user });
            return { success: true };
        } catch (error) {
            logger.error('❌ Error actualizando configuración de email', { error: error.message });
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EnvManager();
