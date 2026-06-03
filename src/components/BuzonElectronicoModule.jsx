import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import './BuzonElectronicoModule.css';

/**
 * Módulo Buzón Electrónico
 * Permite consultar notificaciones y mensajes del buzón SUNAT por cliente
 */
function BuzonElectronicoModule() {
    // Estados
    const [clientes, setClientes] = useState([]);
    const [clientesFiltrados, setClientesFiltrados] = useState([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [mensajes, setMensajes] = useState([]);
    const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingClientes, setLoadingClientes] = useState(true);
    const [error, setError] = useState(null);
    const [sesionActiva, setSesionActiva] = useState(null);
    const [descargando, setDescargando] = useState(false);
    const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);

    // Estados para sección de constancias
    const [constancias, setConstancias] = useState([]);
    const [loadingConstancias, setLoadingConstancias] = useState(false);
    const [mostrarConstancias, setMostrarConstancias] = useState(false);

    const dropdownRef = useRef(null);
    const searchRef = useRef(null);

    // Cargar clientes al montar
    useEffect(() => {
        cargarClientes();

        // Listener para progreso del buzón
        const handleProgreso = (event, data) => {
            console.log('Progreso buzón:', data);
        };

        window.electronAPI.onBuzonProgreso(handleProgreso);

        return () => {
            window.electronAPI.removeAllListeners('buzon:progreso');
        };
    }, []);

    // Filtrar clientes cuando cambia la búsqueda
    useEffect(() => {
        if (busqueda.trim() === '') {
            setClientesFiltrados([]);
            setShowDropdown(false);
        } else {
            const filtrados = clientes.filter(c =>
                c.empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
                c.ruc.includes(busqueda)
            );
            setClientesFiltrados(filtrados);
            setShowDropdown(filtrados.length > 0);
        }
    }, [busqueda, clientes]);

    // Click fuera del dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                searchRef.current && !searchRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /**
     * Carga la lista de clientes desde el Excel
     */
    const cargarClientes = async () => {
        try {
            setLoadingClientes(true);
            const result = await window.electronAPI.buzonObtenerClientes();

            if (result.success) {
                setClientes(result.clientes);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Error al cargar clientes: ' + err.message);
        } finally {
            setLoadingClientes(false);
        }
    };

    /**
     * Selecciona un cliente del dropdown
     */
    const seleccionarCliente = (cliente) => {
        setClienteSeleccionado(cliente);
        setBusqueda(cliente.empresa);
        setShowDropdown(false);
        setMensajes([]);
        setMensajeSeleccionado(null);
        setSesionActiva(null);
    };

    /**
     * Consulta el buzón del cliente seleccionado
     */
    const consultarBuzon = async () => {
        if (!clienteSeleccionado) {
            Swal.fire({
                title: 'Atención',
                text: 'Por favor seleccione un cliente primero',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setMensajes([]);
            setMensajeSeleccionado(null);

            const result = await window.electronAPI.buzonConsultar({
                ruc: clienteSeleccionado.ruc
            });

            if (result.success) {
                setMensajes(result.mensajes || []);
                setSesionActiva({
                    browserId: result.browserId,
                    cliente: result.cliente
                });

                // ACTUALIZAR ESTADÍSTICAS
                try {
                    const mensajesNoLeidos = (result.mensajes || []).filter(m => m.estado === 'no_leido').length;
                    // Aquí establecemos el valor absoluto, no incrementamos
                    await window.electronAPI.invoke('user:update-stats', {
                        key: 'buzonPendientes',
                        value: mensajesNoLeidos,
                        isIncrement: false
                    });
                } catch (statError) {
                    console.error('Error actualizando stats:', statError);
                }

                if (result.mensajes.length === 0) {
                    Swal.fire({
                        title: 'Sin mensajes',
                        text: 'El buzón no contiene mensajes o no se pudieron extraer',
                        icon: 'info',
                        confirmButtonColor: '#3b82f6'
                    });
                }
            } else {
                setError(result.error);
                Swal.fire({
                    title: 'Error',
                    text: result.error,
                    icon: 'error',
                    confirmButtonColor: '#3b82f6'
                });
            }
        } catch (err) {
            setError(err.message);
            Swal.fire({
                title: 'Error',
                text: err.message,
                icon: 'error',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Descarga un adjunto del mensaje
     */
    const descargarAdjunto = async () => {
        if (!sesionActiva || !mensajeSeleccionado) {
            Swal.fire({
                title: 'Atención',
                text: 'Debe tener una sesión activa y un mensaje seleccionado',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        try {
            setDescargando(true);

            const result = await window.electronAPI.buzonDescargarAdjunto({
                browserId: sesionActiva.browserId,
                mensajeId: mensajeSeleccionado.id
            });

            if (result.success) {
                Swal.fire({
                    title: 'Descarga exitosa',
                    html: `Archivo guardado en:<br/><code>${result.ruta}</code>`,
                    icon: 'success',
                    confirmButtonColor: '#3b82f6'
                });
            } else {
                Swal.fire({
                    title: 'Error en descarga',
                    text: result.error,
                    icon: 'error',
                    confirmButtonColor: '#3b82f6'
                });
            }
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: err.message,
                icon: 'error',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            setDescargando(false);
        }
    };

    const [enviandoEmail, setEnviandoEmail] = useState(false);

    /**
     * Helper para descargar adjunto automáticamente sin mostrar alertas de éxito
     */
    const descargarAdjuntoSilencioso = async () => {
        if (!sesionActiva || !mensajeSeleccionado) return [];

        try {
            const result = await window.electronAPI.buzonDescargarAdjunto({
                browserId: sesionActiva.browserId,
                mensajeId: mensajeSeleccionado.id
            });

            // Usar el array 'archivos' si existe, para obtener rutas limpias sin HTML
            if (result.success && result.archivos && result.archivos.length > 0) {
                // Devolvemos TODAS las rutas de los archivos descargados
                return result.archivos.map(a => a.ruta);
            }
            return [];
        } catch (err) {
            console.error('Error descarga silenciosa:', err);
            return [];
        }
    };

    /**
     * Envía notificación del mensaje por WhatsApp (y Email si se solicitó)
     * AHORA INCLUYE DESCARGA AUTOMÁTICA Y ENVÍO DE ADJUNTO
     */
    const enviarPorWhatsApp = async () => {
        if (!clienteSeleccionado || !mensajeSeleccionado) {
            Swal.fire({
                title: 'Atención',
                text: 'Debe seleccionar un cliente y un mensaje',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        if (!clienteSeleccionado.whatsapp) {
            Swal.fire({
                title: 'Sin WhatsApp',
                text: 'El cliente no tiene número de WhatsApp configurado en el Excel',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        // Verificar conexión WA
        const statusResult = await window.electronAPI.getWhatsAppStatus();
        if (!statusResult.success || !statusResult.status.isReady) {
            Swal.fire({
                title: 'WhatsApp no conectado',
                text: 'Por favor conecta WhatsApp desde el botón en el header',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        try {
            setEnviandoWhatsApp(true);
            let archivosPaths = [];

            // 1. Descargar adjunto automáticamente si existe
            if (mensajeSeleccionado.tieneAdjunto) {
                const adjuntos = await descargarAdjuntoSilencioso();
                if (adjuntos && Array.isArray(adjuntos)) {
                    archivosPaths = adjuntos;
                }

                if (archivosPaths.length === 0) {
                    console.warn('No se pudo descargar el adjunto para envío automático');
                }
            }

            // 2. Enviar por WhatsApp
            let waResult = { success: true };
            const caption = `📨 *Buzón SUNAT*\n\nEstimado cliente,\nNuevo mensaje SUNAT:\n\n• *Asunto:* ${mensajeSeleccionado.asunto}\n• *Fecha:* ${formatearFecha(mensajeSeleccionado.fecha)}\n\n${archivosPaths.length > 0 ? '📎 Se adjuntan documentos oficiales.' : ''}`;

            if (archivosPaths.length > 0) {
                // Enviar PRIMER archivo
                const res1 = await window.electronAPI.sendWhatsAppFile({
                    phone: clienteSeleccionado.whatsapp,
                    filePath: archivosPaths[0],
                    caption: caption
                });
                if (!res1.success) waResult = res1;

                // Enviar RESTO
                for (let i = 1; i < archivosPaths.length; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    const resNext = await window.electronAPI.sendWhatsAppFile({
                        phone: clienteSeleccionado.whatsapp,
                        filePath: archivosPaths[i],
                        caption: ''
                    });
                    if (!resNext.success) console.warn(`Error enviando archivo ${i}:`, resNext.error);
                }
            } else {
                waResult = await window.electronAPI.sendWhatsAppMessage({
                    phone: clienteSeleccionado.whatsapp,
                    message: caption
                });
            }

            if (waResult.success) {
                Swal.fire({
                    title: 'Enviado',
                    text: `Mensaje y ${archivosPaths.length} documento(s) enviados por WhatsApp.`,
                    icon: 'success',
                    confirmButtonColor: '#3b82f6'
                });
            } else {
                throw new Error(waResult.error || 'Error al enviar WhatsApp');
            }

        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: err.message,
                icon: 'error',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            setEnviandoWhatsApp(false);
        }
    };

    /**
     * Enviar por Email (Botón dedicado)
     */
    const enviarPorEmail = async () => {
        if (!clienteSeleccionado || !mensajeSeleccionado) return;

        if (!clienteSeleccionado.email) {
            Swal.fire({
                title: 'Sin Email',
                text: 'El cliente no tiene correo configurado.',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        const { value: emailDestino } = await Swal.fire({
            title: 'Enviar por Email',
            input: 'email',
            inputLabel: 'Destinatario',
            inputValue: clienteSeleccionado.email,
            showCancelButton: true,
            confirmButtonText: 'Enviar'
        });

        if (!emailDestino) return;

        try {
            setEnviandoEmail(true);
            let archivosPaths = [];

            // 1. Descargar adjunto automáticamente si existe y no se ha descargado
            if (mensajeSeleccionado.tieneAdjunto) {
                const adjuntos = await descargarAdjuntoSilencioso();
                if (adjuntos && Array.isArray(adjuntos)) {
                    archivosPaths = adjuntos;
                }
            }

            // 2. Enviar Email
            const result = await window.electronAPI.invoke('email:enviar-con-adjuntos', {
                destinatario: emailDestino,
                asunto: `Documento Buzón SUNAT: ${mensajeSeleccionado.asunto}`,
                mensaje: `Estimado Cliente,\n\nAdjunto encontrará los documentos relacionados a la notificación de SUNAT:\n\n${mensajeSeleccionado.asunto}\n\nFecha: ${mensajeSeleccionado.fecha}`,
                archivos: archivosPaths
            });

            if (result.success) {
                Swal.fire('Enviado', `Correo enviado a ${emailDestino}`, 'success');
            } else {
                throw new Error(result.error);
            }

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo enviar el correo: ' + err.message, 'error');
        } finally {
            setEnviandoEmail(false);
        }
    };

    /**
     * Carga las constancias descargadas para el cliente seleccionado
     */
    const cargarConstancias = async () => {
        if (!clienteSeleccionado) {
            Swal.fire({
                title: 'Atención',
                text: 'Por favor seleccione un cliente primero',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        try {
            setLoadingConstancias(true);
            const result = await window.electronAPI.buzonListarConstancias({
                ruc: clienteSeleccionado.ruc
            });

            if (result.success) {
                setConstancias(result.constancias || []);
                setMostrarConstancias(true);
            } else {
                Swal.fire({
                    title: 'Error',
                    text: result.error,
                    icon: 'error',
                    confirmButtonColor: '#3b82f6'
                });
            }
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: err.message,
                icon: 'error',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            setLoadingConstancias(false);
        }
    };

    /**
     * Abre una constancia en el visor del sistema
     */
    const abrirConstancia = async (ruta) => {
        try {
            const result = await window.electronAPI.buzonAbrirConstancia({ ruta });
            if (!result.success) {
                Swal.fire({
                    title: 'Error',
                    text: result.error,
                    icon: 'error',
                    confirmButtonColor: '#3b82f6'
                });
            }
        } catch (err) {
            console.error('Error al abrir constancia:', err);
        }
    };
    /**
     * Cierra la sesión activa del buzón
     */
    const cerrarSesion = async () => {
        if (!sesionActiva) return;

        const confirmacion = await Swal.fire({
            title: '¿Cerrar sesión?',
            text: 'Se cerrará la conexión con el buzón SUNAT',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444'
        });

        if (!confirmacion.isConfirmed) return;

        try {
            await window.electronAPI.buzonCerrarSesion({
                browserId: sesionActiva.browserId
            });

            setSesionActiva(null);
            setMensajes([]);
            setMensajeSeleccionado(null);

            Swal.fire({
                title: 'Sesión cerrada',
                text: 'La conexión con el buzón ha sido cerrada',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Error al cerrar sesión:', err);
        }
    };

    /**
     * Formatea la fecha para mostar
     */
    const formatearFecha = (fecha) => {
        if (!fecha) return 'Sin fecha';
        return fecha;
    };

    return (
        <div className="buzon-electronico-module">
            {/* Header */}
            <div className="buzon-header">
                <h2>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Buzón Electrónico SUNAT
                </h2>
                <p>Consulta notificaciones y mensajes del buzón electrónico de tus clientes</p>
            </div>

            {/* Controls */}
            <div className="buzon-controls">
                <div className="buzon-search-group" ref={searchRef}>
                    <label>Buscar cliente por RUC o nombre</label>
                    <div className="buzon-search-input-wrapper">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="buzon-search-input"
                            placeholder="Ingrese RUC o nombre de empresa..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            onFocus={() => busqueda && setShowDropdown(true)}
                        />

                        {showDropdown && clientesFiltrados.length > 0 && (
                            <div className="buzon-client-dropdown" ref={dropdownRef}>
                                {clientesFiltrados.map((cliente, index) => (
                                    <div
                                        key={cliente.ruc}
                                        className="buzon-client-item"
                                        onClick={() => seleccionarCliente(cliente)}
                                    >
                                        <div className="empresa">{cliente.empresa}</div>
                                        <div className="ruc">RUC: {cliente.ruc}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="buzon-actions-row">
                    <button
                        className="buzon-btn buzon-btn-primary"
                        onClick={consultarBuzon}
                        disabled={loading || !clienteSeleccionado}
                    >
                        {loading ? (
                            <>
                                <div className="buzon-spinner" style={{ width: 18, height: 18, margin: 0 }}></div>
                                Consultando...
                            </>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Consultar Buzón
                            </>
                        )}
                    </button>

                    {clienteSeleccionado && (
                        <button
                            className="buzon-btn buzon-btn-secondary"
                            onClick={cargarConstancias}
                            disabled={loadingConstancias}
                        >
                            {loadingConstancias ? (
                                <>
                                    <div className="buzon-spinner" style={{ width: 14, height: 14, margin: 0 }}></div>
                                    Cargando...
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                    Ver Constancias
                                </>
                            )}
                        </button>
                    )}

                    {sesionActiva && (
                        <>
                            <div className="buzon-session-info">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                Sesión: {sesionActiva.cliente?.empresa.substring(0, 15)}...
                            </div>
                            <button
                                className="buzon-btn buzon-btn-danger"
                                onClick={cerrarSesion}
                                title="Cerrar Sesión"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="buzon-error">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Constancias Modal */}
            {mostrarConstancias && (
                <div className="buzon-constancias-modal">
                    <div className="buzon-constancias-container">
                        <div className="buzon-constancias-header">
                            <h3>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                Constancias Descargadas - {clienteSeleccionado?.empresa}
                            </h3>
                            <button
                                className="buzon-constancias-close"
                                onClick={() => setMostrarConstancias(false)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="buzon-constancias-content">
                            {constancias.length === 0 ? (
                                <div className="buzon-constancias-empty">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <p>No hay constancias descargadas para este RUC</p>
                                    <span>Descargue adjuntos del buzón para verlos aquí</span>
                                </div>
                            ) : (
                                <div className="buzon-constancias-list">
                                    {constancias.map((constancia, index) => (
                                        <div key={index} className="buzon-constancia-item">
                                            <div className="buzon-constancia-icon">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                    <line x1="16" y1="13" x2="8" y2="13" />
                                                    <line x1="16" y1="17" x2="8" y2="17" />
                                                </svg>
                                            </div>
                                            <div className="buzon-constancia-info">
                                                <div className="buzon-constancia-nombre" title={constancia.nombre}>
                                                    {constancia.nombre.length > 50
                                                        ? constancia.nombre.substring(0, 50) + '...'
                                                        : constancia.nombre}
                                                </div>
                                                <div className="buzon-constancia-meta">
                                                    <span>{constancia.fecha}</span>
                                                    <span>•</span>
                                                    <span>{constancia.tamano}</span>
                                                </div>
                                            </div>
                                            <button
                                                className="buzon-btn buzon-btn-primary buzon-btn-sm"
                                                onClick={() => abrirConstancia(constancia.ruta)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                                Ver
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="buzon-constancias-footer">
                            <span>Total: {constancias.length} constancia(s)</span>
                            <button
                                className="buzon-btn buzon-btn-secondary"
                                onClick={() => setMostrarConstancias(false)}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="buzon-content">
                {/* Messages Panel */}
                <div className="buzon-messages-panel">
                    <div className="buzon-messages-header">
                        <h3>Mensajes del Buzón</h3>
                        {mensajes.length > 0 && (
                            <span className="buzon-messages-count">{mensajes.length}</span>
                        )}
                    </div>

                    <div className="buzon-messages-list">
                        {loading ? (
                            <div className="buzon-loading">
                                <div className="buzon-spinner"></div>
                                <p>Conectando al buzón SUNAT...</p>
                            </div>
                        ) : mensajes.length === 0 ? (
                            <div className="buzon-empty-state">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                                <h4>Sin mensajes</h4>
                                <p>Seleccione un cliente y consulte su buzón para ver los mensajes</p>
                            </div>
                        ) : (
                            mensajes.map((mensaje, index) => (
                                <div
                                    key={mensaje.id || index}
                                    className={`buzon-message-item ${mensaje.estado === 'no_leido' ? 'no-leido' : ''} ${mensajeSeleccionado?.id === mensaje.id ? 'selected' : ''}`}
                                    onClick={() => setMensajeSeleccionado(mensaje)}
                                >
                                    <div className="buzon-message-asunto">
                                        {mensaje.asunto || 'Sin asunto'}
                                    </div>
                                    <div className="buzon-message-meta">
                                        <span className="buzon-message-fecha">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            {formatearFecha(mensaje.fecha)}
                                        </span>
                                        {mensaje.tieneAdjunto && (
                                            <span className="buzon-message-adjunto">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                </svg>
                                                Adjunto
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail Panel */}
                <div className="buzon-detail-panel">
                    {mensajeSeleccionado ? (
                        <>
                            <div className="buzon-detail-header">
                                <h3>{mensajeSeleccionado.asunto}</h3>
                                <div className="buzon-detail-info">
                                    <span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                            <line x1="16" y1="2" x2="16" y2="6" />
                                            <line x1="8" y1="2" x2="8" y2="6" />
                                            <line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                        {formatearFecha(mensajeSeleccionado.fecha)}
                                    </span>
                                    <span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v6l4 2" />
                                        </svg>
                                        {mensajeSeleccionado.estado === 'leido' ? 'Leído' : 'No leído'}
                                    </span>
                                </div>
                            </div>

                            <div className="buzon-detail-content">
                                {mensajeSeleccionado.tieneAdjunto && (
                                    <div className="buzon-attachments">
                                        <h4>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                            </svg>
                                            Archivos Adjuntos
                                        </h4>
                                        <div className="buzon-attachment-item">
                                            <div className="buzon-attachment-info">
                                                <div className="buzon-attachment-icon">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                        <polyline points="14 2 14 8 20 8" />
                                                    </svg>
                                                </div>
                                                <span className="buzon-attachment-name">Documento adjunto</span>
                                            </div>
                                            <button
                                                className="buzon-btn buzon-btn-primary buzon-btn-download"
                                                onClick={descargarAdjunto}
                                                disabled={descargando || !sesionActiva}
                                            >
                                                {descargando ? (
                                                    <>
                                                        <div className="buzon-spinner" style={{ width: 14, height: 14, margin: 0 }}></div>
                                                        Descargando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                        Descargar
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <div style={{ marginLeft: '10px' }}>
                                            <button
                                                className="buzon-btn buzon-btn-success"
                                                onClick={enviarPorWhatsApp}
                                                disabled={enviandoWhatsApp || !clienteSeleccionado?.whatsapp}
                                                title={clienteSeleccionado?.whatsapp ? `Enviar a ${clienteSeleccionado.whatsapp}` : 'Cliente sin número de WhatsApp'}
                                            >
                                                {enviandoWhatsApp ? (
                                                    <>
                                                        <div className="buzon-spinner" style={{ width: 14, height: 14, margin: 0 }}></div>
                                                        Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                                        </svg>
                                                        WhatsApp
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <div style={{ marginLeft: '20px' }}>
                                            <button
                                                className="buzon-btn"
                                                style={{ backgroundColor: '#6b7280', color: 'white', borderColor: '#4b5563' }}
                                                onClick={enviarPorEmail}
                                                disabled={enviandoEmail || !clienteSeleccionado?.email}
                                                title={clienteSeleccionado?.email ? `Enviar a ${clienteSeleccionado.email}` : 'Cliente sin Email'}
                                            >
                                                {enviandoEmail ? (
                                                    <>
                                                        <div className="buzon-spinner" style={{ width: 14, height: 14, margin: 0 }}></div>
                                                        Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                                            <polyline points="22,6 12,13 2,6"></polyline>
                                                        </svg>
                                                        Email
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!mensajeSeleccionado.tieneAdjunto && (
                                    <p>Este mensaje no contiene archivos adjuntos.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="buzon-detail-placeholder">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            <p>Seleccione un mensaje de la lista para ver su contenido</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BuzonElectronicoModule;
