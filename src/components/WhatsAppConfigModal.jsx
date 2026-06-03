import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import './WhatsAppConfigModal.css';

const WhatsAppConfigModal = ({ isOpen, onClose }) => {
    // Estados del servicio (sincronizados con el backend)
    const [state, setState] = useState('disconnected');
    const [qrCode, setQrCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState(null);
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [loadingProgress, setLoadingProgress] = useState(null);
    const [batchProgress, setBatchProgress] = useState(null);
    const [healthStatus, setHealthStatus] = useState(null);
    const qrCanvasRef = useRef(null);
    const statusCheckInterval = useRef(null);

    useEffect(() => {
        if (isOpen) {
            checkStatus();
            setupEventListeners();
            startStatusPolling();
        }
        return () => {
            removeEventListeners();
            stopStatusPolling();
        };
    }, [isOpen]);

    // Render QR code when qrCode changes
    useEffect(() => {
        if (qrCode && qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, qrCode, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) console.error('Error generating QR:', error);
            });
        }
    }, [qrCode]);

    /**
     * Configurar listeners de eventos del backend
     */
    const setupEventListeners = () => {
        // Evento: QR Code generado
        window.electronAPI.onWhatsAppQR((event, qr) => {
            console.log('📱 QR Code recibido');
            setQrCode(qr);
            setState('authenticating');
            setLoading(false);
        });

        // Evento: WhatsApp listo
        window.electronAPI.onWhatsAppReady((event, data) => {
            console.log('✅ WhatsApp conectado', data);
            setState('ready');
            setQrCode(null);
            setLoading(false);
            setMessage({ type: 'success', text: '✅ WhatsApp conectado exitosamente' });
        });

        // Evento: Desconectado
        window.electronAPI.onWhatsAppDisconnected((event, data) => {
            console.log('⚠️ WhatsApp desconectado:', data);
            setState('disconnected');
            setQrCode(null);

            if (data.willReconnect) {
                setMessage({ type: 'warning', text: '⚠️ Desconectado. Reintentando conexión...' });
            } else {
                setMessage({ type: 'error', text: '❌ WhatsApp desconectado' });
            }
        });

        // Evento: Fallo de autenticación
        window.electronAPI.onWhatsAppAuthFailure((event, msg) => {
            console.log('❌ Fallo autenticación:', msg);
            setState('error');
            setLoading(false);
            setMessage({ type: 'error', text: '❌ Fallo de autenticación. Limpia la sesión y vuelve a intentar.' });
        });

        // Evento: Cambio de estado
        if (window.electronAPI.onWhatsAppStateChanged) {
            window.electronAPI.onWhatsAppStateChanged((event, data) => {
                console.log('🔄 Estado cambió:', data);
                setState(data.state);

                if (data.state === 'error' && data.metadata?.reason) {
                    setMessage({ type: 'error', text: `❌ Error: ${data.metadata.reason}` });
                }
            });
        }

        // Evento: Error
        if (window.electronAPI.onWhatsAppError) {
            window.electronAPI.onWhatsAppError((event, error) => {
                console.error('❌ Error de WhatsApp:', error);
                setMessage({ type: 'error', text: `❌ ${error.message}` });
            });
        }

        // Evento: Progreso de carga
        if (window.electronAPI.onWhatsAppLoading) {
            window.electronAPI.onWhatsAppLoading((event, data) => {
                setLoadingProgress(data);
            });
        }

        // Evento: Progreso de envío en lote
        if (window.electronAPI.onWhatsAppBatchProgress) {
            window.electronAPI.onWhatsAppBatchProgress((event, data) => {
                setBatchProgress(data);
            });
        }
    };

    const removeEventListeners = () => {
        if (window.electronAPI.removeAllListeners) {
            window.electronAPI.removeAllListeners('whatsapp:qr');
            window.electronAPI.removeAllListeners('whatsapp:ready');
            window.electronAPI.removeAllListeners('whatsapp:disconnected');
            window.electronAPI.removeAllListeners('whatsapp:auth-failure');
            window.electronAPI.removeAllListeners('whatsapp:state-changed');
            window.electronAPI.removeAllListeners('whatsapp:error');
            window.electronAPI.removeAllListeners('whatsapp:loading');
            window.electronAPI.removeAllListeners('whatsapp:batch-progress');
        }
    };

    /**
     * Iniciar polling de estado cada 5 segundos
     */
    const startStatusPolling = () => {
        statusCheckInterval.current = setInterval(() => {
            checkStatus();
        }, 5000);
    };

    const stopStatusPolling = () => {
        if (statusCheckInterval.current) {
            clearInterval(statusCheckInterval.current);
            statusCheckInterval.current = null;
        }
    };

    /**
     * Verificar estado actual del servicio
     */
    const checkStatus = async () => {
        try {
            const result = await window.electronAPI.getWhatsAppStatus();
            if (result.success) {
                setState(result.status.state || 'disconnected');
                setHealthStatus(result.status.lastHealthCheck);

                if (result.status.hasQR && result.status.state === 'authenticating') {
                    const qrResult = await window.electronAPI.getWhatsAppQR();
                    if (qrResult.success) {
                        setQrCode(qrResult.qr);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking status:', error);
        }
    };

    /**
     * Inicializar WhatsApp
     */
    const handleInitialize = async () => {
        setLoading(true);
        setMessage(null);
        setState('initializing');

        try {
            const result = await window.electronAPI.initializeWhatsApp();
            if (result.success) {
                setMessage({ type: 'info', text: result.message });
            } else {
                setMessage({ type: 'error', text: result.error });
                setState('disconnected');
                setLoading(false);
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al inicializar WhatsApp' });
            setState('disconnected');
            setLoading(false);
        }
    };

    /**
     * Cerrar sesión
     */
    const handleLogout = async () => {
        setLoading(true);
        setMessage(null);

        try {
            const result = await window.electronAPI.logoutWhatsApp();
            if (result.success) {
                setState('disconnected');
                setQrCode(null);
                setHealthStatus(null);
                setMessage({ type: 'success', text: '✅ Sesión cerrada correctamente' });
            } else {
                setMessage({ type: 'error', text: result.error });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al cerrar sesión' });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Limpiar sesión completamente
     */
    const handleClearSession = async () => {
        if (!confirm('¿Estás seguro de que deseas eliminar la sesión de WhatsApp? Tendrás que escanear el QR nuevamente.')) {
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            // Primero hacer logout
            await window.electronAPI.logoutWhatsApp();

            // Esperar un momento
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Llamar a clearSession si existe
            if (window.electronAPI.clearWhatsAppSession) {
                const result = await window.electronAPI.clearWhatsAppSession();
                if (result.success) {
                    setState('disconnected');
                    setQrCode(null);
                    setHealthStatus(null);
                    setMessage({ type: 'success', text: '✅ Sesión eliminada. Puedes conectar nuevamente.' });
                } else {
                    setMessage({ type: 'error', text: result.error });
                }
            } else {
                setMessage({ type: 'success', text: '✅ Sesión cerrada. Reinicia la app para limpiar completamente.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al limpiar sesión' });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Enviar mensaje de prueba
     */
    const handleTest = async () => {
        if (state !== 'ready') {
            setMessage({ type: 'error', text: 'Primero debes conectar WhatsApp' });
            return;
        }

        setTesting(true);
        setMessage(null);

        try {
            const result = await window.electronAPI.sendWhatsAppTest();
            if (result.success) {
                setMessage({ type: 'success', text: `✅ ${result.message}` });
            } else {
                setMessage({ type: 'error', text: result.error });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al enviar mensaje de prueba' });
        } finally {
            setTesting(false);
        }
    };

    /**
     * Enviar mensaje personalizado de prueba
     */
    const handleSendCustomTest = async () => {
        if (!testPhone || !testMessage) {
            setMessage({ type: 'error', text: 'Ingresa número y mensaje para probar' });
            return;
        }

        setTesting(true);
        setMessage(null);

        try {
            const result = await window.electronAPI.sendWhatsAppMessage({
                phone: testPhone,
                message: testMessage
            });

            if (result.success) {
                setMessage({ type: 'success', text: '✅ Mensaje enviado correctamente' });
                setTestMessage('');
            } else {
                setMessage({ type: 'error', text: result.error });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al enviar mensaje' });
        } finally {
            setTesting(false);
        }
    };

    const handleClose = () => {
        if (!loading && !testing) {
            setMessage(null);
            onClose();
        }
    };

    /**
     * Obtener icono según el estado
     */
    const getStateIcon = () => {
        switch (state) {
            case 'ready': return '✅';
            case 'authenticating': return '📱';
            case 'initializing': return '⏳';
            case 'connecting': return '🔄';
            case 'reconnecting': return '🔄';
            case 'error': return '❌';
            default: return '⭕';
        }
    };

    /**
     * Obtener texto del estado
     */
    const getStateText = () => {
        switch (state) {
            case 'ready': return 'Conectado';
            case 'authenticating': return 'Esperando escaneo de QR';
            case 'initializing': return 'Inicializando...';
            case 'connecting': return 'Conectando...';
            case 'reconnecting': return 'Reconectando...';
            case 'error': return 'Error';
            default: return 'Desconectado';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="whatsapp-config-overlay" onClick={handleClose}>
            <div className="whatsapp-config-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="whatsapp-config-header">
                    <div className="whatsapp-config-title">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <h2>Configuración de WhatsApp</h2>
                    </div>
                    <button className="whatsapp-config-close" onClick={handleClose} disabled={loading || testing}>
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="whatsapp-config-content">
                    {/* Status Indicator */}
                    <div className={`whatsapp-status whatsapp-status-${state}`}>
                        <div className="status-icon">{getStateIcon()}</div>
                        <div className="status-text">
                            <strong>Estado:</strong> {getStateText()}
                        </div>
                    </div>

                    {/* Loading Progress */}
                    {loadingProgress && (
                        <div className="whatsapp-loading-progress">
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${loadingProgress.percent}%` }} />
                            </div>
                            <p>{loadingProgress.message} ({loadingProgress.percent}%)</p>
                        </div>
                    )}

                    {/* Batch Progress */}
                    {batchProgress && (
                        <div className="whatsapp-batch-progress">
                            <p>📤 Enviando {batchProgress.current} de {batchProgress.total} a {batchProgress.phone}</p>
                        </div>
                    )}

                    {/* Health Status */}
                    {state === 'ready' && healthStatus && (
                        <div className="whatsapp-health-status">
                            <small>
                                {healthStatus.status === 'healthy' ? '💚' : '🔴'}
                                {' '}Último chequeo: {new Date(healthStatus.timestamp).toLocaleTimeString('es-PE')}
                            </small>
                        </div>
                    )}

                    {/* QR Code Display */}
                    {state === 'authenticating' && qrCode && (
                        <div className="whatsapp-qr-section">
                            <h3>Escanea el código QR</h3>
                            <div className="qr-code-container">
                                <canvas ref={qrCanvasRef} />
                            </div>
                            <div className="qr-instructions">
                                <p><strong>Pasos para conectar:</strong></p>
                                <ol>
                                    <li>Abre WhatsApp en tu teléfono</li>
                                    <li>Toca <strong>Menú</strong> o <strong>Configuración</strong></li>
                                    <li>Toca <strong>Dispositivos vinculados</strong></li>
                                    <li>Toca <strong>Vincular un dispositivo</strong></li>
                                    <li>Escanea este código QR</li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {/* Ready State - Test Section */}
                    {state === 'ready' && (
                        <div className="whatsapp-test-section">
                            <h3>✅ WhatsApp conectado</h3>
                            <p className="test-description">
                                Envía un mensaje de prueba o desconecta la sesión.
                            </p>

                            <div className="test-field">
                                <label htmlFor="test-phone">Número de prueba (opcional)</label>
                                <input
                                    id="test-phone"
                                    type="text"
                                    value={testPhone}
                                    onChange={(e) => setTestPhone(e.target.value)}
                                    placeholder="51987654321"
                                    disabled={testing}
                                />
                            </div>

                            <div className="test-field">
                                <label htmlFor="test-message">Mensaje de prueba</label>
                                <textarea
                                    id="test-message"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    placeholder="Escribe un mensaje de prueba..."
                                    rows="3"
                                    disabled={testing}
                                />
                            </div>

                            <div className="test-buttons">
                                <button
                                    className="btn-test-self"
                                    onClick={handleTest}
                                    disabled={testing}
                                >
                                    {testing ? '⏳ Enviando...' : '📱 Probar (a mí mismo)'}
                                </button>
                                {testPhone && testMessage && (
                                    <button
                                        className="btn-test-custom"
                                        onClick={handleSendCustomTest}
                                        disabled={testing}
                                    >
                                        {testing ? '⏳ Enviando...' : '💬 Enviar mensaje'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Disconnected State - Instructions */}
                    {state === 'disconnected' && (
                        <div className="whatsapp-disconnected-section">
                            <h3>📱 ¿Qué es WhatsApp Service?</h3>
                            <p>
                                Conecta tu cuenta de WhatsApp para enviar notificaciones automáticas a tus clientes:
                            </p>
                            <ul>
                                <li>✅ Notificaciones de facturas procesadas</li>
                                <li>📊 Envío de documentos SIRE generados</li>
                                <li>📨 Alertas del buzón electrónico</li>
                                <li>🔔 Reportes de procesos automatizados</li>
                            </ul>
                            <p className="help-note">
                                <strong>Nota:</strong> Necesitarás escanear un código QR con tu WhatsApp móvil. La sesión se mantendrá activa.
                            </p>
                        </div>
                    )}

                    {/* Error State - Troubleshooting */}
                    {state === 'error' && (
                        <div className="whatsapp-error-section">
                            <h3>❌ Error de conexión</h3>
                            <p>
                                Si tienes problemas persistentes, intenta:
                            </p>
                            <ul>
                                <li>Limpiar la sesión y volver a conectar</li>
                                <li>Verificar tu conexión a internet</li>
                                <li>Cerrar WhatsApp Web en otros dispositivos</li>
                            </ul>
                        </div>
                    )}

                    {/* Message */}
                    {message && (
                        <div className={`whatsapp-config-message whatsapp-message-${message.type}`}>
                            {message.text}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="whatsapp-config-footer">
                    <button
                        className="whatsapp-btn whatsapp-btn-secondary"
                        onClick={handleClose}
                        disabled={loading || testing}
                    >
                        Cerrar
                    </button>

                    {state === 'disconnected' && (
                        <button
                            className="whatsapp-btn whatsapp-btn-primary"
                            onClick={handleInitialize}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="whatsapp-spinner" />
                                    Inicializando...
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                    </svg>
                                    Conectar WhatsApp
                                </>
                            )}
                        </button>
                    )}

                    {state === 'ready' && (
                        <>
                            <button
                                className="whatsapp-btn whatsapp-btn-danger"
                                onClick={handleLogout}
                                disabled={loading}
                            >
                                {loading ? '⏳ Cerrando...' : '🔌 Desconectar'}
                            </button>
                        </>
                    )}

                    {(state === 'error' || state === 'ready') && (
                        <button
                            className="whatsapp-btn whatsapp-btn-warning"
                            onClick={handleClearSession}
                            disabled={loading}
                        >
                            {loading ? '⏳ Limpiando...' : '🗑️ Limpiar Sesión'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppConfigModal;
