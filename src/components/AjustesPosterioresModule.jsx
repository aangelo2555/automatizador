import { useState, useEffect, useRef } from 'react';
import './AjustesPosterioresModule.css';

const AjustesPosterioresModule = () => {
    const [datosEmpresa, setDatosEmpresa] = useState({
        ruc: '',
        razonSocial: '',
        anio: new Date().getFullYear().toString(),
        mes: (new Date().getMonth() + 1).toString().padStart(2, '0')
    });

    const [archivosZip, setArchivosZip] = useState([]);
    const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [alerts, setAlerts] = useState([]);
    const [resultadoUpload, setResultadoUpload] = useState(null);

    // Estados para búsqueda de clientes
    const [clientes, setClientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showClientesList, setShowClientesList] = useState(false);
    const [filteredClientes, setFilteredClientes] = useState([]);
    const searchRef = useRef(null);

    // Configuración de la API (según documentación SUNAT)
    const [configUpload, setConfigUpload] = useState({
        codOrigenEnvio: '2',      // 2 = Servicio web
        codProceso: '6',          // 6 = Cargar Ajuste posteriores del SIRE
        codTipoCorrelativo: '01', // 01 = Tipo envíos masivos
        codLibro: '080000'        // 080000 = RCE
    });

    useEffect(() => {
        initialize();
    }, []);

    // Filtrar clientes cuando cambia el término de búsqueda
    useEffect(() => {
        if (searchTerm.length > 0 && clientes.length > 0) {
            const term = searchTerm.toLowerCase();
            const filtered = clientes.filter(cliente =>
                cliente.ruc.toLowerCase().includes(term) ||
                cliente.empresa.toLowerCase().includes(term)
            ).slice(0, 10);
            setFilteredClientes(filtered);
            setShowClientesList(filtered.length > 0);
        } else {
            setFilteredClientes([]);
            setShowClientesList(false);
        }
    }, [searchTerm, clientes]);

    const initialize = async () => {
        try {
            setIsLoading(true);
            if (!window.electronAPI) {
                showAlert('Error: electronAPI no está disponible', 'error');
                return;
            }

            // Cargar lista de clientes
            await cargarListaClientes();

            // Cargar archivos ZIP del output
            await cargarArchivosZip();

        } catch (error) {
            showAlert('Error de inicialización: ' + error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const cargarListaClientes = async () => {
        try {
            const result = await window.electronAPI.invoke('cargar-clientes');
            if (result.success) {
                setClientes(result.clientes || []);
            }
        } catch (error) {
            console.error('Error al cargar clientes:', error);
        }
    };

    const cargarArchivosZip = async () => {
        try {
            const result = await window.electronAPI.invoke('listar-archivos-output');
            if (result.success) {
                // Filtrar solo archivos ZIP
                const archivosZipFiltrados = (result.archivos || []).filter(
                    archivo => archivo.tipo === '.zip'
                );
                setArchivosZip(archivosZipFiltrados);
            }
        } catch (error) {
            console.error('Error al cargar archivos:', error);
        }
    };

    const handleClienteSelect = (cliente) => {
        setDatosEmpresa(prev => ({ ...prev, ruc: cliente.ruc, razonSocial: cliente.empresa }));
        setSearchTerm('');
        setShowClientesList(false);
    };

    const handleInputChange = (field, value) => {
        setDatosEmpresa(prev => ({ ...prev, [field]: value }));
    };

    const handleConfigChange = (field, value) => {
        setConfigUpload(prev => ({ ...prev, [field]: value }));
    };

    const verificarRUC = async () => {
        const ruc = datosEmpresa.ruc.trim();
        if (!ruc || ruc.length !== 11) {
            showAlert('Ingrese un RUC válido de 11 dígitos', 'error');
            return;
        }
        try {
            setIsLoading(true);
            const result = await window.electronAPI.invoke('verificar-ruc', ruc);
            if (result.success) {
                handleInputChange('razonSocial', result.razonSocial);
                showAlert(result.message, 'success');
            } else {
                showAlert(result.error, 'error');
            }
        } catch (error) {
            showAlert('Error al verificar RUC: ' + error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const seleccionarArchivo = (archivo) => {
        setArchivoSeleccionado(archivo);
        setResultadoUpload(null);
    };

    const subirArchivoASunat = async () => {
        if (!archivoSeleccionado) {
            showAlert('Seleccione un archivo ZIP para subir', 'error');
            return;
        }

        if (!datosEmpresa.ruc || datosEmpresa.ruc.length !== 11) {
            showAlert('Ingrese un RUC válido de 11 dígitos', 'error');
            return;
        }

        try {
            setIsUploading(true);
            setUploadProgress(0);
            setResultadoUpload(null);

            const periodo = `${datosEmpresa.anio}${datosEmpresa.mes.padStart(2, '0')}`;

            showAlert(`Subiendo ${archivoSeleccionado.nombre} a SUNAT...`, 'info');

            const result = await window.electronAPI.invoke('subir-ajustes-posteriores', {
                nombreArchivo: archivoSeleccionado.nombre,
                numRuc: datosEmpresa.ruc,
                perTributario: periodo,
                codOrigenEnvio: configUpload.codOrigenEnvio,
                codProceso: configUpload.codProceso,
                codTipoCorrelativo: configUpload.codTipoCorrelativo,
                codLibro: configUpload.codLibro
            });

            setUploadProgress(100);

            if (result.success) {
                setResultadoUpload({
                    success: true,
                    message: result.message || 'Archivo subido correctamente',
                    response: result.response
                });
                showAlert('✅ ' + (result.message || 'Archivo subido correctamente'), 'success');
            } else {
                setResultadoUpload({
                    success: false,
                    error: result.error,
                    errorCode: result.errorCode,
                    details: result.details
                });
                showAlert('❌ Error: ' + result.error, 'error');
            }

        } catch (error) {
            setResultadoUpload({
                success: false,
                error: error.message
            });
            showAlert('❌ Error: ' + error.message, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const showAlert = (message, type = 'info') => {
        const id = Date.now();
        setAlerts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeAlert(id), 5000);
    };

    const removeAlert = (id) => {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Filtrar archivos por RUC si está seleccionado
    const getArchivosFiltrados = () => {
        if (!datosEmpresa.ruc) return archivosZip;
        return archivosZip.filter(archivo =>
            archivo.nombre.includes(datosEmpresa.ruc)
        );
    };

    return (
        <div className="ajustes-posteriores-module">
            <div className="ajustes-posteriores-header">
                <div className="header-content">
                    <h2>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Ajustes Posteriores SUNAT
                    </h2>
                    <p className="subtitle">Carga de Ajustes Posteriores al SIRE</p>
                </div>
            </div>

            {/* Alertas */}
            <div className="alerts-container">
                {alerts.map(alert => (
                    <div key={alert.id} className={`alert alert-${alert.type}`}>
                        <span>{alert.message}</span>
                        <button onClick={() => removeAlert(alert.id)} className="alert-close">×</button>
                    </div>
                ))}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>Cargando...</p>
                    </div>
                </div>
            )}

            <div className="ajustes-posteriores-content">
                {/* Datos de Empresa */}
                <div className="form-section">
                    <h3>📊 Datos de la Empresa</h3>
                    <div className="form-row">
                        <div className="form-group cliente-search-container" ref={searchRef}>
                            <label>RUC / Buscar Empresa:</label>
                            <div className="search-input-wrapper">
                                <input
                                    type="text"
                                    value={searchTerm || datosEmpresa.ruc}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSearchTerm(value);
                                        if (/^\d*$/.test(value)) {
                                            handleInputChange('ruc', value.substring(0, 11));
                                        }
                                    }}
                                    onFocus={() => {
                                        if (searchTerm.length > 0 && filteredClientes.length > 0) {
                                            setShowClientesList(true);
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setShowClientesList(false), 200)}
                                    maxLength="50"
                                    placeholder="Buscar por RUC o nombre..."
                                />
                                {showClientesList && filteredClientes.length > 0 && (
                                    <div className="clientes-dropdown">
                                        {filteredClientes.map((cliente, idx) => (
                                            <div key={idx} className="cliente-item" onMouseDown={() => handleClienteSelect(cliente)}>
                                                <span className="cliente-ruc">{cliente.ruc}</span>
                                                <span className="cliente-empresa">{cliente.empresa}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Razón Social:</label>
                            <input
                                type="text"
                                value={datosEmpresa.razonSocial}
                                onChange={(e) => handleInputChange('razonSocial', e.target.value)}
                                placeholder="Razón social"
                                readOnly
                            />
                        </div>
                        <div className="form-group small-field">
                            <label>Año:</label>
                            <input
                                type="text"
                                value={datosEmpresa.anio}
                                onChange={(e) => handleInputChange('anio', e.target.value.replace(/\D/g, '').substring(0, 4))}
                                maxLength="4"
                                placeholder="2025"
                            />
                        </div>
                        <div className="form-group small-field">
                            <label>Mes:</label>
                            <input
                                type="text"
                                value={datosEmpresa.mes}
                                onChange={(e) => handleInputChange('mes', e.target.value.replace(/\D/g, '').substring(0, 2))}
                                maxLength="2"
                                placeholder="01"
                            />
                        </div>
                        <div>
                            <label>&nbsp;</label>
                            <button className="btn btn-success" onClick={verificarRUC}>🔍 Verificar RUC</button>
                        </div>
                    </div>
                </div>

                {/* Configuración de Upload */}
                <div className="form-section">
                    <h3>⚙️ Configuración de Carga</h3>
                    <div className="form-row config-row">
                        <div className="form-group">
                            <label>Origen Envío:</label>
                            <select
                                value={configUpload.codOrigenEnvio}
                                onChange={(e) => handleConfigChange('codOrigenEnvio', e.target.value)}
                            >
                                <option value="2">2 - Servicio Web</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Código Proceso:</label>
                            <select
                                value={configUpload.codProceso}
                                onChange={(e) => handleConfigChange('codProceso', e.target.value)}
                            >
                                <option value="6">6 - Cargar Ajuste Posteriores SIRE</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Tipo Correlativo:</label>
                            <select
                                value={configUpload.codTipoCorrelativo}
                                onChange={(e) => handleConfigChange('codTipoCorrelativo', e.target.value)}
                            >
                                <option value="01">01 - Tipo envíos masivos</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Código Libro:</label>
                            <select
                                value={configUpload.codLibro}
                                onChange={(e) => handleConfigChange('codLibro', e.target.value)}
                            >
                                <option value="080000">080000 - RCE</option>
                                <option value="140000">140000 - RVIE</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Lista de archivos ZIP */}
                <div className="form-section">
                    <h3>📁 Archivos ZIP Disponibles</h3>
                    <div className="archivos-actions">
                        <button className="btn btn-secondary" onClick={cargarArchivosZip}>
                            🔄 Actualizar Lista
                        </button>
                        <span className="archivo-count">
                            {getArchivosFiltrados().length} archivo(s) encontrado(s)
                            {datosEmpresa.ruc && ` para RUC ${datosEmpresa.ruc}`}
                        </span>
                    </div>

                    <div className="archivos-lista">
                        {getArchivosFiltrados().length === 0 ? (
                            <div className="no-archivos">
                                <p>No hay archivos ZIP disponibles en la carpeta output.</p>
                                <p>Genere archivos desde la pestaña <strong>"SIRE Ajustes"</strong> primero.</p>
                            </div>
                        ) : (
                            getArchivosFiltrados().map((archivo, idx) => (
                                <div
                                    key={idx}
                                    className={`archivo-item ${archivoSeleccionado?.nombre === archivo.nombre ? 'selected' : ''}`}
                                    onClick={() => seleccionarArchivo(archivo)}
                                >
                                    <div className="archivo-icon">📦</div>
                                    <div className="archivo-info">
                                        <div className="archivo-nombre">{archivo.nombre}</div>
                                        <div className="archivo-detalles">
                                            <span>{formatFileSize(archivo.tamaño)}</span>
                                            <span>•</span>
                                            <span>{formatDate(archivo.fechaModificacion)}</span>
                                        </div>
                                    </div>
                                    {archivoSeleccionado?.nombre === archivo.nombre && (
                                        <div className="archivo-check">✓</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sección de Upload */}
                {archivoSeleccionado && (
                    <div className="form-section upload-section">
                        <h3>📤 Subir a SUNAT</h3>
                        <div className="upload-info">
                            <div className="selected-file">
                                <strong>Archivo seleccionado:</strong> {archivoSeleccionado.nombre}
                            </div>
                            <div className="upload-metadata">
                                <span><strong>RUC:</strong> {datosEmpresa.ruc || 'No especificado'}</span>
                                <span><strong>Periodo:</strong> {datosEmpresa.anio}{datosEmpresa.mes.padStart(2, '0')}</span>
                                <span><strong>Libro:</strong> {configUpload.codLibro === '080000' ? 'RCE' : 'RVIE'}</span>
                            </div>
                        </div>

                        {isUploading && (
                            <div className="upload-progress">
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                                <span className="progress-text">{uploadProgress}%</span>
                            </div>
                        )}

                        <button
                            className="btn btn-primary btn-large"
                            onClick={subirArchivoASunat}
                            disabled={isUploading || !datosEmpresa.ruc}
                        >
                            {isUploading ? '⏳ Subiendo...' : '📤 Subir Archivo a SUNAT'}
                        </button>

                        {/* Resultado del upload */}
                        {resultadoUpload && (
                            <div className={`upload-result ${resultadoUpload.success ? 'success' : 'error'}`}>
                                <h4>{resultadoUpload.success ? '✅ Carga Exitosa' : '❌ Error en la Carga'}</h4>
                                {resultadoUpload.success ? (
                                    <p>{resultadoUpload.message}</p>
                                ) : (
                                    <>
                                        <p><strong>Error:</strong> {resultadoUpload.error}</p>
                                        {resultadoUpload.errorCode && (
                                            <p><strong>Código:</strong> {resultadoUpload.errorCode}</p>
                                        )}
                                        {resultadoUpload.details && (
                                            <pre className="error-details">{JSON.stringify(resultadoUpload.details, null, 2)}</pre>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Información de la API */}
                <div className="form-section info-section">
                    <h3>ℹ️ Información del Servicio</h3>
                    <div className="api-info">
                        <p><strong>Servicio:</strong> Cargar comprobantes en ajustes posteriores</p>
                        <p><strong>URL:</strong> api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros/rvierce/receptorajustesposteriores/web/ajustesposteriores/upload</p>
                        <p><strong>Protocolo:</strong> TUS (resumable uploads)</p>
                        <p><strong>Formato archivo:</strong> ZIP (contiene archivo TXT)</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AjustesPosterioresModule;
