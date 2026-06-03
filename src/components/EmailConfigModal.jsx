import React, { useState, useEffect } from 'react';
import './EmailConfigModal.css';

const EmailConfigModal = ({ isOpen, onClose, onSave }) => {
    const [emailUser, setEmailUser] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }

    useEffect(() => {
        if (isOpen) {
            loadCurrentConfig();
            setMessage(null);
        }
    }, [isOpen]);

    const loadCurrentConfig = async () => {
        try {
            const result = await window.electronAPI.getEmailConfig();
            if (result.success && result.config) {
                setEmailUser(result.config.user || '');
                // No cargamos la contraseña por seguridad, solo mostramos que existe
                if (result.config.hasPassword) {
                    setEmailPass(''); // Usuario deberá ingresar nueva contraseña si desea cambiar
                }
            }
        } catch (error) {
            console.error('Error cargando configuración:', error);
        }
    };

    const handleTest = async () => {
        if (!emailUser || !emailPass) {
            setMessage({ type: 'error', text: 'Por favor complete todos los campos' });
            return;
        }

        setTesting(true);
        setMessage(null);

        try {
            const result = await window.electronAPI.testEmailConfig({ user: emailUser, pass: emailPass });

            if (result.success) {
                setMessage({
                    type: 'success',
                    text: `✅ ${result.message || 'Email de prueba enviado correctamente'}`
                });
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || 'Error al enviar email de prueba'
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al probar configuración' });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!emailUser || !emailPass) {
            setMessage({ type: 'error', text: 'Por favor complete todos los campos' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const result = await window.electronAPI.updateEmailConfig({ user: emailUser, pass: emailPass });

            if (result.success) {
                setMessage({
                    type: 'success',
                    text: '✅ Configuración guardada correctamente'
                });

                // Llamar al callback de éxito después de un breve delay
                setTimeout(() => {
                    if (onSave) onSave();
                    onClose();
                }, 1500);
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || 'Error al guardar configuración'
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al guardar configuración' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading && !testing) {
            setEmailUser('');
            setEmailPass('');
            setMessage(null);
            setShowPassword(false);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="email-config-overlay" onClick={handleClose}>
            <div className="email-config-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="email-config-header">
                    <div className="email-config-title">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <h2>Configuración de Email</h2>
                    </div>
                    <button className="email-config-close" onClick={handleClose} disabled={loading || testing}>
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="email-config-content">
                    <p className="email-config-description">
                        Configure su cuenta de Gmail para enviar notificaciones automáticas del sistema.
                    </p>

                    {/* Email Field */}
                    <div className="email-config-field">
                        <label htmlFor="email-user">Correo de Gmail</label>
                        <input
                            id="email-user"
                            type="email"
                            value={emailUser}
                            onChange={(e) => setEmailUser(e.target.value)}
                            placeholder="ejemplo@gmail.com"
                            disabled={loading || testing}
                        />
                    </div>

                    {/* Password Field */}
                    <div className="email-config-field">
                        <label htmlFor="email-pass">Contraseña de Aplicación</label>
                        <div className="email-config-password-wrapper">
                            <input
                                id="email-pass"
                                type={showPassword ? 'text' : 'password'}
                                value={emailPass}
                                onChange={(e) => setEmailPass(e.target.value)}
                                placeholder="xxxx xxxx xxxx xxxx"
                                disabled={loading || testing}
                            />
                            <button
                                type="button"
                                className="email-config-toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                disabled={loading || testing}
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Help Text */}
                    <div className="email-config-help">
                        <div className="email-config-help-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                            </svg>
                            <strong>¿Cómo obtener una contraseña de aplicación?</strong>
                        </div>
                        <ol className="email-config-help-steps">
                            <li>Ve a <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Seguridad de Google</a></li>
                            <li>Activa la "Verificación en 2 pasos" si no está activa</li>
                            <li>Ve a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">Contraseñas de aplicaciones</a></li>
                            <li>Genera una contraseña para "Correo" → "Otro (nombre personalizado)"</li>
                            <li>Copia la contraseña de 16 caracteres y pégala arriba</li>
                        </ol>
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`email-config-message ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="email-config-footer">
                    <button
                        className="email-config-btn email-config-btn-secondary"
                        onClick={handleClose}
                        disabled={loading || testing}
                    >
                        Cancelar
                    </button>
                    <button
                        className="email-config-btn email-config-btn-test"
                        onClick={handleTest}
                        disabled={loading || testing || !emailUser || !emailPass}
                    >
                        {testing ? (
                            <>
                                <div className="email-config-spinner" />
                                Probando...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                Probar
                            </>
                        )}
                    </button>
                    <button
                        className="email-config-btn email-config-btn-primary"
                        onClick={handleSave}
                        disabled={loading || testing || !emailUser || !emailPass}
                    >
                        {loading ? (
                            <>
                                <div className="email-config-spinner" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Guardar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailConfigModal;
