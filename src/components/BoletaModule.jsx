import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Table, Input, Upload, message, Progress, Space, InputNumber, Select, Typography, Divider, Radio, Form, Row, Col, Tabs } from 'antd';
import { UploadOutlined, PlayCircleOutlined, PlusOutlined, DeleteOutlined, FileTextOutlined, SettingOutlined, CloseCircleOutlined, ReloadOutlined, SaveOutlined, FolderOpenOutlined, CalculatorOutlined } from '@ant-design/icons';
import Swal from 'sweetalert2';
import './ConsultaFacturaModule.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// =========================================================================
// EMISIÓN ESPECÍFICA TAB COMPONENT (Clean Layout)
// =========================================================================
const EmisionEspecificaTab = ({ allClientes, sessionId, runScript, waitForCondition, isRecording, toggleRecording, recordedSteps, setRecordedSteps }) => {
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [clientesFiltrados, setClientesFiltrados] = useState([]);
    const [items, setItems] = useState([
        { key: '1', cantidad: 1, descripcion: '', precioUnitario: 0, tipoIGV: 'CON_IGV' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEmitting, setIsEmitting] = useState(false);
    const [customFlow, setCustomFlow] = useState(null); // Validated JSON flow
    const [savedFlows, setSavedFlows] = useState({}); // { "name": { steps: [] } }
    const searchRef = useRef(null);

    // Filter clients
    useEffect(() => {
        if (busqueda.trim() === '') {
            setClientesFiltrados([]);
        } else {
            const term = busqueda.toLowerCase();
            setClientesFiltrados(
                allClientes
                    .filter(c => c.empresa.toLowerCase().includes(term) || c.ruc.includes(term))
                    .slice(0, 10)
            );
        }
    }, [busqueda, allClientes]);

    // Click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Flow Management (File Based) ---
    const loadSavedFlows = async (ruc) => {
        try {
            const res = await window.electronAPI.invoke('flows:list', { ruc });
            if (res.success) {
                const map = {};
                res.flows.forEach(f => map[f.name] = f);
                setSavedFlows(map);
            }
        } catch (e) { console.error('Load Flows Error', e); }
    };

    const handleSaveRecordedFlow = async () => {
        if (recordedSteps.length === 0) return message.warning('No hay pasos grabados');
        const { value: name } = await Swal.fire({
            title: 'Guardar Flujo',
            input: 'text',
            inputLabel: 'Nombre del flujo (ej: Boleta Sin DNI)',
            showCancelButton: true,
            inputValidator: (value) => { if (!value) return 'Escribe un nombre'; }
        });

        if (name) {
            const res = await window.electronAPI.invoke('flows:save', {
                ruc: clienteSeleccionado.ruc,
                name,
                steps: recordedSteps
            });

            if (res.success) {
                message.success('Flujo guardado correctamente');
                loadSavedFlows(clienteSeleccionado.ruc); // Reload
            } else {
                Swal.fire('Error', res.error, 'error');
            }
        }
    };

    const handleDeleteFlow = async (name) => {
        const res = await window.electronAPI.invoke('flows:delete', { ruc: clienteSeleccionado.ruc, name });
        if (res.success) {
            message.success('Flujo eliminado');
            loadSavedFlows(clienteSeleccionado.ruc);
            if (customFlow && customFlow.name === name) setCustomFlow(null);
        }
    };

    const handleLoadFlow = (name) => {
        const flow = savedFlows[name];
        if (flow) {
            setCustomFlow(flow);
            setRecordedSteps(flow.steps || []); // Optional: load into recorder view?
            message.success(`Flujo "${name}" cargado`);
        }
    };

    const handleFlowUpload = (file) => {
        const isJs = file.name.endsWith('.js');

        if (isJs) {
            // Import Puppeteer Script via Backend
            // We use an async IIFE to handle the upload side-effect without delaying the return
            (async () => {
                try {
                    const filePath = file.path;
                    if (!filePath) {
                        message.error('No se pudo determinar ruta del archivo');
                        return;
                    }

                    const res = await window.electronAPI.invoke('flows:import-script', { filePath });
                    if (res.success) {
                        setCustomFlow({ name: 'Script Importado (.js)', steps: res.steps });
                        message.success(`Script importado: ${res.steps.length} pasos`);
                        // Update UI
                        setRecordedSteps(res.steps);
                    } else {
                        message.error('Error importando script: ' + res.error);
                    }
                } catch (e) {
                    console.error(e);
                    message.error('Error interno importing script');
                }
            })();

            return false; // Prevent auto upload immediately
        }

        // Standard JSON logic (Legacy)
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const json = JSON.parse(e.target.result);
                if (json && json.steps) {
                    setCustomFlow({ name: 'Importado (.json)', steps: json.steps });
                    message.success('Flujo (.json) importado');
                }
            } catch (err) { message.error('JSON inválido'); }
        };
        reader.readAsText(file);
        return false;
    };

    const handleSelectCliente = async (cliente) => {
        setClienteSeleccionado(cliente);
        setBusqueda(`${cliente.empresa} - ${cliente.ruc}`);
        setShowDropdown(false);
        setSavedFlows({});
        setCustomFlow(null);
        setItems([{ key: '1', cantidad: 1, descripcion: '', precioUnitario: 0, tipoIGV: 'CON_IGV' }]);

        // Auto Load
        try {
            setIsLoading(true);
            // Load Items Config
            const result = await window.electronAPI.boletaConfigLoad({ ruc: cliente.ruc });
            if (result.success && result.exists && result.config.items) {
                const loadedItems = (result.config.items || []).map((item, idx) => ({
                    key: `loaded_${idx}`,
                    cantidad: item.cantidad || 1,
                    descripcion: item.descripcion || '',
                    precioUnitario: item.precioUnitario || 0,
                    tipoIGV: item.tipoIGV || 'CON_IGV'
                }));
                if (loadedItems.length > 0) setItems(loadedItems);
            }

            // Load Flows from Files
            await loadSavedFlows(cliente.ruc);

        } catch (e) { } finally { setIsLoading(false); }
    };

    const calcularSubtotal = (cantidad, precioUnitario, tipoIGV) => {
        const base = cantidad * precioUnitario;
        return tipoIGV === 'CON_IGV' ? base * 1.18 : base;
    };

    const calcularTotal = () => {
        return items.reduce((sum, item) => {
            return sum + calcularSubtotal(item.cantidad || 0, item.precioUnitario || 0, item.tipoIGV);
        }, 0);
    };

    const updateItem = (key, field, value) => {
        setItems(prev => prev.map(item =>
            item.key === key ? { ...item, [field]: value } : item
        ));
    };

    const addRow = () => {
        setItems(prev => [...prev, {
            key: Date.now().toString(),
            cantidad: 1,
            descripcion: '',
            precioUnitario: 0,
            tipoIGV: 'CON_IGV'
        }]);
    };

    const deleteRow = (key) => {
        if (items.length <= 1) {
            message.warning('Debe haber al menos un item');
            return;
        }
        setItems(prev => prev.filter(item => item.key !== key));
    };

    // SAVE EVERYTHING (Items + Flows)
    const performSave = async (newFlows = null) => {
        if (!clienteSeleccionado) return;
        try {
            const config = {
                clienteNombre: clienteSeleccionado.empresa,
                items: items.map(({ key, ...rest }) => rest),
                savedFlows: newFlows || savedFlows
            };
            const result = await window.electronAPI.boletaConfigSave({
                ruc: clienteSeleccionado.ruc,
                config
            });
            if (result.success) {
                if (newFlows) setSavedFlows(newFlows);
                return true;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            message.error(`Error: ${error.message}`);
            return false;
        }
    };

    const handleGuardarItems = async () => {
        if (await performSave()) Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500 });
    };

    const handleCargar = async () => {
        if (!clienteSeleccionado) return message.error('Seleccione un cliente primero');
        try {
            setIsLoading(true);
            const result = await window.electronAPI.boletaConfigLoad({ ruc: clienteSeleccionado.ruc });
            if (result.success && result.exists) {
                const config = result.config;
                // Load Items
                const loadedItems = (config.items || []).map((item, idx) => ({
                    key: `loaded_${idx}`,
                    cantidad: item.cantidad || 1,
                    descripcion: item.descripcion || '',
                    precioUnitario: item.precioUnitario || 0,
                    tipoIGV: item.tipoIGV || 'CON_IGV'
                }));
                if (loadedItems.length > 0) setItems(loadedItems);

                // Load Flows
                if (config.savedFlows) {
                    setSavedFlows(config.savedFlows);
                }

                message.success('Configuración cargada');
            } else {
                message.info('No hay configuración guardada');
            }
        } catch (error) {
            message.error(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };



    // Helper: Find step by keyword
    const findStep = (steps, keywords) => {
        if (!steps) return null;
        return steps.find(s => {
            if (!s.selectors) return false;
            // Check if any selector in the list contains one of the keywords
            return s.selectors.some(group => group.some(sel => keywords.some(k => sel.includes(k))));
        });
    };

    const handleEmitirBoletas = async () => {
        if (!sessionId) return Swal.fire('Error', 'Conecte al Portal SUNAT en la pestaña "Estándar" primero', 'error');
        if (items.length === 0) return;

        const validItems = items.filter(i => i.descripcion && i.precioUnitario > 0);
        if (validItems.length === 0) return Swal.fire('Error', 'Ingrese al menos un item válido', 'error');

        setIsEmitting(true);
        const hideLoading = message.loading('Iniciando Emisión Inteligente (Backend)...', 0);

        try {
            // Prepare backend payload
            // We use the recorded flow if available, otherwise backend will likely fail or need robust default
            let flowToSend = customFlow && customFlow.steps ? customFlow.steps : null;

            // Hardcoded fallback flow for "Standard" emission if recording is missing
            // This ensures basic functionality works out of the box
            if (!flowToSend) {
                flowToSend = [
                    { type: 'click', selectors: [['#inicio\\.ruc\\.show .dijitArrowButtonInner'], ['text/▼']], keywords: ['dropdown'] },
                    { type: 'click', selectors: [['#inicio\\.tipoDocumento_popup0'], ['text/SIN DOCUMENTO']], keywords: ['SIN DOCUMENTO'] },
                    { type: 'click', selectors: [['#inicio\\.botonGrabarDocumento_label'], ['text/Continuar']], keywords: ['Continuar'] },

                    { type: 'click', selectors: [['#boleta\\.addItemButton_label'], ['text/Adicionar']], keywords: ['Adicionar'] },
                    // ... Wait handled by auto-wait
                    { type: 'type', value: '{item.cantidad}', selectors: [['#item\\.cantidad']], keywords: ['Cantidad'] },
                    { type: 'type', value: '{item.descripcion}', selectors: [['#item\\.descripcion']], keywords: ['Descripcion'] },
                    { type: 'type', value: '{item.precioUnitario}', selectors: [['#item\\.precioUnitario']], keywords: ['Precio'] },

                    { type: 'click', selectors: [['#item\\.botonAceptar_label'], ['text/Aceptar']], keywords: ['Aceptar'] }
                ];
            }

            const result = await window.electronAPI.invoke('boleta:process-internal', {
                ruc: clienteSeleccionado.ruc,
                items: validItems,
                flow: flowToSend
            });

            if (result.success) {
                message.success('Emisión finalizada correctamente');
                Swal.fire('Proceso Completado', `Se procesaron ${result.results.length} items.`, 'success');
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error(error);
            Swal.fire('Error en Emisión', error.message, 'error');
        } finally {
            if (hideLoading) hideLoading();
            setIsEmitting(false);
        }
    };

    // Helper: Find element in a specific document
    // (Deprecated: Logic moved to Backend)

    // --- END OF AUTOMATION LOGIC ---

    const columns = [
        { title: '#', key: 'i', width: 40, render: (_, __, i) => i + 1 },
        { title: 'Cant', dataIndex: 'cantidad', width: 70, render: (v, r) => <InputNumber size="small" min={1} value={v} onChange={x => updateItem(r.key, 'cantidad', x)} /> },
        { title: 'Descripción', dataIndex: 'descripcion', render: (v, r) => <Input size="small" value={v} onChange={e => updateItem(r.key, 'descripcion', e.target.value)} /> },
        { title: 'Precio', dataIndex: 'precioUnitario', width: 80, render: (v, r) => <InputNumber size="small" min={0} step={0.1} value={v} onChange={x => updateItem(r.key, 'precioUnitario', x)} /> },
        { title: 'IGV', dataIndex: 'tipoIGV', width: 100, render: (v, r) => <Select size="small" value={v} onChange={x => updateItem(r.key, 'tipoIGV', x)} options={[{ label: '18%', value: 'CON_IGV' }, { label: '0%', value: 'SIN_IGV' }]} /> },
        { title: 'Subt', width: 80, render: (_, r) => <Text type="secondary" style={{ fontSize: 11 }}>{calcularSubtotal(r.cantidad, r.precioUnitario, r.tipoIGV).toFixed(2)}</Text> },
        { title: '', width: 30, render: (_, r) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => deleteRow(r.key)} /> }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            {/* Config Card */}
            <Card size="small" title="📁 Configuración por Cliente" bodyStyle={{ padding: 10 }}>
                <div ref={searchRef} style={{ position: 'relative', marginBottom: 8 }}>
                    <Input placeholder="Buscar empresa por nombre o RUC..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} prefix={<FileTextOutlined />} size="small" />
                    {showDropdown && clientesFiltrados.length > 0 && (
                        <div style={{ position: 'absolute', zIndex: 1000, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4, width: '100%', maxHeight: 150, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                            {clientesFiltrados.map((c, i) => (
                                <div key={i} onClick={() => handleSelectCliente(c)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                                    {c.empresa} <span style={{ color: '#999' }}>({c.ruc})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions Toolbar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', justifyContent: 'space-between', background: '#f5f5f5', padding: 5, borderRadius: 4 }}>
                    <Space size={2}>
                        <Button size="small" icon={<FolderOpenOutlined />} onClick={handleCargar} disabled={!clienteSeleccionado}>Cargar</Button>
                        <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleGuardarItems} disabled={!clienteSeleccionado}>Guardar</Button>
                    </Space>

                    <Space size={2}>
                        {/* Recorder Controls */}
                        <Button
                            size="small"
                            type={isRecording ? 'primary' : 'default'}
                            danger={isRecording}
                            icon={isRecording ? <div style={{ width: 8, height: 8, background: '#fff', borderRadius: 1 }} /> : <div style={{ width: 8, height: 8, background: 'red', borderRadius: '50%' }} />}
                            onClick={toggleRecording}
                            disabled={!sessionId}
                            style={{ borderColor: '#ff4d4f', color: isRecording ? '#fff' : '#ff4d4f' }}
                        >
                            {isRecording ? `DETENER (${recordedSteps.length})` : 'GRABAR'}
                        </Button>

                        {/* Save Recorded Flow */}
                        {recordedSteps.length > 0 && !isRecording && (
                            <Button size="small" type="dashed" icon={<SaveOutlined />} onClick={handleSaveRecordedFlow}>Guardar Flujo</Button>
                        )}
                    </Space>

                    <Space size={2}>
                        {/* Flow Selector */}
                        <Select
                            size="small"
                            style={{ width: 140 }}
                            placeholder="Seleccionar Flujo"
                            value={customFlow ? customFlow.name : undefined}
                            onChange={handleLoadFlow}
                            dropdownMatchSelectWidth={false}
                        >
                            {Object.keys(savedFlows).map(name => (
                                <Select.Option key={name} value={name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{name}</span>
                                        <DeleteOutlined style={{ color: 'red', fontSize: 10 }} onClick={(e) => { e.stopPropagation(); handleDeleteFlow(name); }} />
                                    </div>
                                </Select.Option>
                            ))}
                        </Select>

                        <Upload beforeUpload={handleFlowUpload} showUploadList={false}>
                            <Button size="small" icon={<UploadOutlined />} />
                        </Upload>
                    </Space>
                </div>
                {customFlow && <div style={{ marginTop: 4, fontSize: 11, color: '#52c41a' }}>✅ Flujo Activo: {customFlow.name || 'Personalizado'} ({customFlow.steps.length} pasos)</div>}

            </Card>

            {/* Table Card */}
            <Card size="small" title="📝 Items a Emitir" extra={<Button size="small" icon={<PlusOutlined />} onClick={addRow} />} bodyStyle={{ padding: 0 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <Table columns={columns} dataSource={items} pagination={false} size="small" rowKey="key" />
                </div>
                <div style={{ padding: 10, borderTop: '1px solid #f0f0f0', textAlign: 'right', background: '#fafafa' }}>
                    <Text strong style={{ fontSize: 16, color: '#1890ff' }}>Total: S/ {calcularTotal().toFixed(2)}</Text>
                </div>
            </Card>

            <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={handleEmitirBoletas} loading={isEmitting} disabled={!sessionId} block style={{ background: sessionId ? '#52c41a' : undefined }}>
                {isEmitting ? 'Emitiendo...' : 'Emitir Boleta'}
            </Button>
            {!sessionId && <div style={{ textAlign: 'center', fontSize: 11, color: '#ff4d4f' }}>⚠️ Desconectado (Ir a pestaña Estándar)</div>}
        </div>
    );
};

// =========================================================================
// MAIN BOLETA MODULE
// =========================================================================
const BoletaModule = () => {
    const [activeTab, setActiveTab] = useState('estandar');

    // Legacy State for Standard Tab
    const [boletas, setBoletas] = useState([{ key: '1', cantidad: '1', precio: '10.00', unidad: 'UNIDAD', descripcion: 'PRODUCTO EJEMPLO' }]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [conectandoLoading, setConectandoLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [formConfig, setFormConfig] = useState({ esExportacion: 'N', tipoDocumento: '-', numeroDocumento: '', razonSocial: 'CLIENTES VARIOS', pagoAnticipado: 'N', emisorItinerante: 'N', consignarDireccion: 'N', tipoMoneda: 'PEN', tieneDescuentos: 'N', tieneISC: 'N', operacionesGratuitas: 'N', otrosCargos: 'N', tipoComprobante: '03' });

    // Global State
    const [allClientes, setAllClientes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [clientesFiltrados, setClientesFiltrados] = useState([]);

    const webviewRef = useRef(null);
    const searchRef = useRef(null);

    // Initial Load
    useEffect(() => { loadClientes(); }, []);
    useEffect(() => {
        if (busqueda.trim() === '') setClientesFiltrados([]);
        else setClientesFiltrados(allClientes.filter(c => c.empresa.toLowerCase().includes(busqueda.toLowerCase()) || c.ruc.includes(busqueda)).slice(0, 10));
    }, [busqueda, allClientes]);

    const loadClientes = async () => {
        const result = await window.electronAPI.invoke('clients:get-all');
        if (result.success) setAllClientes(result.clients);
    };

    const handleSelectCliente = (c) => {
        setClienteSeleccionado(c);
        setBusqueda(`${c.empresa} - ${c.ruc}`);
        setShowDropdown(false);
    };

    // Helper functions
    const runScript = async (code) => {
        try {
            return await webviewRef.current.executeJavaScript(code);
        } catch (e) {
            console.error('ExecuteJS Error:', e);
            return null;
        }
    };

    const waitForCondition = async (check, ms = 20000) => {
        const start = Date.now();
        while (Date.now() - start < ms) {
            const res = await runScript(check);
            if (res) return true;
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    };

    // Helper: Traverse Frames and Inject
    const injectRecorder = async () => {
        const script = `
            (function() {
                if (window.__recorderInjected) return;
                window.__recorderInjected = true;
                
                function getSelectors(el) {
                    const sels = [];
                    // 1. ID
                    if (el.id) sels.push(['#' + el.id.replace(/\\./g, '\\\\\\\\.')]);
                    // 2. Text / Aria
                    if (el.textContent && el.textContent.length < 50) sels.push(['text/' + el.textContent.trim()]);
                    if (el.getAttribute('aria-label')) sels.push(['aria/' + el.getAttribute('aria-label')]);
                    // 3. Name
                    if (el.name) sels.push(['pierce/[name="' + el.name + '"]']);
                    // 4. Class (approx)
                    if (el.className && typeof el.className === 'string') {
                        const classes = el.className.split(' ').filter(c => c && !c.includes('dijit')); 
                        if(classes.length) sels.push(['pierce/.' + classes.join('.')]); // simple class
                    }
                    return sels;
                }

                function handler(e) {
                    // Check if recording is active in this window or any parent
                    if (!window.__recording) return; 
                    
                    const el = e.target;
                    const eventData = {
                        type: e.type,
                        selectors: getSelectors(el),
                        value: el.value,
                        tagName: el.tagName
                    };
                    // Send to host
                    console.log('__RECORDER__:' + JSON.stringify(eventData));
                }

                function attach(doc) {
                    doc.addEventListener('click', handler, true);
                    doc.addEventListener('change', handler, true);
                    doc.addEventListener('input', handler, true);
                }

                function traverse(win) {
                    try {
                        attach(win.document);
                        const frames = win.frames;
                        for (let i = 0; i < frames.length; i++) {
                            // Only traverse direct children to avoid excessive recursion/security blocks
                            try { attach(frames[i].document); } catch(e){}
                        }
                    } catch (e) { }
                }

                // Global flags
                window.__startRec = () => { window.__recording = true; };
                window.__stopRec = () => { window.__recording = false; };
                
                traverse(window);
                window.__startRec(); // Auto start if injected
                console.log('__RECORDER_READY__');
            })();
        `;
        await runScript(script);
    };

    const handleAbrirPortal = async () => {
        if (!clienteSeleccionado) return message.error('Seleccione un cliente');
        setConectandoLoading(true);
        try {
            const wv = webviewRef.current;
            if (wv && typeof wv.loadURL === 'function') {
                const cred = await window.electronAPI.invoke('cpe-obtener-credenciales', { rucConsultante: clienteSeleccionado.ruc });
                if (!cred.success) throw new Error(cred.error);
                const { ruc, usuario_sol, clave_sol } = cred.data;

                wv.loadURL('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm');

                // Console Message Listener for Recorder
                if (!wv._consoleAttached) {
                    wv.addEventListener('console-message', (e) => {
                        if (e.message.startsWith('__RECORDER__:')) {
                            try {
                                const data = JSON.parse(e.message.replace('__RECORDER__:', ''));
                                // Debounce
                                setRecordedSteps(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.type === data.type && JSON.stringify(last.selectors) === JSON.stringify(data.selectors)) return prev;

                                    const niceStep = {
                                        type: data.type === 'click' ? 'click' : 'type',
                                        selectors: data.selectors,
                                        ...(data.type !== 'click' ? { value: data.value } : {}),
                                        keywords: data.selectors.flat().map(s => s.replace(/^(#|text\/|aria\/|pierce\/|xpath\/)/, ''))
                                    };
                                    return [...prev, niceStep];
                                });
                            } catch (err) { console.error('Rec Parse Error', err); }
                        }
                    });

                    // Re-inject on navigation if recording
                    wv.addEventListener('did-navigate', () => {
                        if (isRecording) setTimeout(injectRecorder, 1000);
                    });
                    wv.addEventListener('did-finish-load', () => {
                        if (isRecording) setTimeout(injectRecorder, 1000);
                    });

                    wv._consoleAttached = true;
                }

                await new Promise(r => wv.addEventListener('did-finish-load', r, { once: true }));

                await waitForCondition(`!!document.getElementById('txtRuc')`, 10000);
                await runScript(`document.getElementById('txtRuc').value='${ruc}'; document.getElementById('txtUsuario').value='${usuario_sol}'; document.getElementById('txtContrasena').value='${clave_sol}';`);
                await runScript(`const b = document.getElementById('btnAceptar') || document.querySelector('button[type="submit"]'); if(b) b.click();`);


                if (await waitForCondition(`document.body.innerText.includes('Bienvenido') || !!document.querySelector('.nombre_usuario_fijo')`, 20000)) {
                    await runScript(`window.location.href = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.4.1.1&s=ww1'`);
                    setSessionId(`session_${ruc}`);
                    Swal.fire({ icon: 'success', title: 'Conectado', timer: 1500 });
                } else {
                    throw new Error('No se pudo ingresar');
                }
            } else {
                // Web Browser / Railway Flow: Connect via server-side Playwright
                const res = await window.electronAPI.invoke('boleta:connect', { ruc: clienteSeleccionado.ruc });
                if (res.success) {
                    setSessionId(res.sessionId);
                    Swal.fire({ icon: 'success', title: 'Conectado (Nube)', text: 'Sesión de boletas iniciada en el servidor', timer: 2000 });
                } else {
                    throw new Error(res.error);
                }
            }
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        } finally {
            setConectandoLoading(false);
        }
    };

    // Recorder State in Parent
    const [isRecording, setIsRecording] = useState(false);
    const [recordedSteps, setRecordedSteps] = useState([]);

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop
            await runScript('try{window.__stopRec()}catch(e){}');
            setIsRecording(false);
            message.info(`Grabación detenida. ${recordedSteps.length} pasos capturados.`);
        } else {
            // Start
            if (!sessionId) return message.error('Debe estar conectado');
            setRecordedSteps([]);
            await injectRecorder();
            setIsRecording(true);
            message.success('🔴 Grabando... Realice el proceso ahora.');
        }
    };

    // Legacy Process
    const handleProcessBatch = async () => { /* ... existing legacy code ... */ };

    return (
        <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Title level={4}><FileTextOutlined /> Emisión de Boletas</Title>

            <div style={{ display: 'flex', flex: 1, gap: 16, overflow: 'hidden' }}>
                {/* LEFT COLUMN: TABS */}
                <div style={{ width: 420, display: 'flex', flexDirection: 'column' }}>
                    <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ flex: 1 }}>
                        <TabPane tab="📋 Estándar" key="estandar">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflowY: 'auto', paddingRight: 5 }}>
                                {/* Shared Login Card (Visual copy for Standard) */}
                                <Card size="small" title="🏢 Empresa Emisora">
                                    <div style={{ position: 'relative', marginBottom: 8 }}>
                                        <Input placeholder="Buscar empresa..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} size="small" />
                                        {showDropdown && clientesFiltrados.length > 0 && (
                                            <div style={{ position: 'absolute', zIndex: 1000, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4, width: '100%', maxHeight: 150, overflowY: 'auto' }}>
                                                {clientesFiltrados.map((c, i) => (
                                                    <div key={i} onClick={() => handleSelectCliente(c)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>{c.empresa}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                     <Button type="primary" onClick={handleAbrirPortal} loading={conectandoLoading} disabled={!clienteSeleccionado || sessionId} block size="small">Abrir Portal SUNAT</Button>
                                     {sessionId && <Button size="small" danger block style={{ marginTop: 5 }} onClick={async () => {
                                         const wv = webviewRef.current;
                                         if (wv && typeof wv.loadURL === 'function') {
                                             wv.loadURL('about:blank');
                                         } else {
                                             await window.electronAPI.invoke('boleta:close-session', { ruc: clienteSeleccionado.ruc });
                                         }
                                         setSessionId(null);
                                     }}>Cerrar Sesión</Button>}
                                 </Card>
 
                                 {/* Opciones SUNAT (Legacy) */}
                                 <Card size="small" title="⚙️ Opciones SUNAT" bodyStyle={{ padding: 8 }}>
                                     <Form layout="vertical" size="small">
                                         <Form.Item label="Tip. Doc"><Select value={formConfig.tipoDocumento} onChange={v => setFormConfig({ ...formConfig, tipoDocumento: v })}><Option value="-">SIN DOC</Option><Option value="1">DNI</Option><Option value="6">RUC</Option></Select></Form.Item>
                                         <Form.Item label="Moneda"><Select value={formConfig.tipoMoneda} onChange={v => setFormConfig({ ...formConfig, tipoMoneda: v })}><Option value="PEN">Soles</Option><Option value="USD">Dólares</Option></Select></Form.Item>
                                     </Form>
                                 </Card>
 
                                 {/* Items (Legacy) */}
                                 <Card size="small" title="📋 Items" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setBoletas(p => [...p, { key: Date.now().toString(), cantidad: '1', precio: '1', descripcion: 'ITEM' }])} />}>
                                     <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                                         {boletas.map((b, idx) => (
                                             <div key={b.key} style={{ borderBottom: '1px solid #eee', padding: 4, display: 'flex', gap: 4 }}>
                                                 <InputNumber size="small" style={{ width: 40 }} value={b.cantidad} onChange={v => { const n = [...boletas]; n[idx].cantidad = v; setBoletas(n) }} />
                                                 <Input size="small" style={{ flex: 1 }} value={b.descripcion} onChange={e => { const n = [...boletas]; n[idx].descripcion = e.target.value; setBoletas(n) }} />
                                                 <InputNumber size="small" style={{ width: 50 }} value={b.precio} onChange={v => { const n = [...boletas]; n[idx].precio = v; setBoletas(n) }} />
                                             </div>
                                         ))}
                                     </div>
                                 </Card>
                             </div>
                         </TabPane>
 
                         <TabPane tab="⚡ Emisión Específica" key="especifica">
                             <EmisionEspecificaTab
                                 allClientes={allClientes}
                                 sessionId={sessionId}
                                 runScript={runScript}
                                 waitForCondition={waitForCondition}
                                 isRecording={isRecording}
                                 toggleRecording={toggleRecording}
                                 recordedSteps={recordedSteps}
                             />
                         </TabPane>
                     </Tabs>
                 </div>
 
                 {/* RIGHT COLUMN: WEBVIEW or Status Info (Always Visible) */}
                 <div style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
                     <div style={{ padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #eee', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                         <span>🌐 <b>Portal SUNAT</b> {sessionId ? '(Conectado)' : '(Desconectado)'}</span>
                         <Space>
                             <Button size="small" icon={<ReloadOutlined />} onClick={() => {
                                 const wv = webviewRef.current;
                                 if (wv && typeof wv.reload === 'function') wv.reload();
                             }} />
                         </Space>
                     </div>
                     {webviewRef.current && typeof webviewRef.current.loadURL === 'function' ? (
                         <webview ref={webviewRef} src="about:blank" style={{ width: '100%', flex: 1 }} allowpopups="true" partition="persist:sunat" webpreferences="contextIsolation=no, nodeIntegration=no" />
                     ) : (
                         <div style={{ padding: 20, textAlign: 'center', margin: 'auto' }}>
                             <div style={{ fontSize: 48, color: sessionId ? '#52c41a' : '#bfbfbf', marginBottom: 16 }}>
                                 🌐
                             </div>
                             <h3>Control de Sesión de Navegador (Servidor)</h3>
                             <p style={{ color: '#8c8c8c', maxWidth: 300, margin: '0 auto 16px', fontSize: 13 }}>
                                 {sessionId 
                                     ? `Sesión activa para RUC: ${clienteSeleccionado?.ruc || ''}. Las boletas se emitirán en segundo plano usando Playwright.` 
                                     : 'No hay ninguna sesión activa. Seleccione un cliente y haga clic en "Abrir Portal SUNAT" para iniciar sesión en la nube.'}
                             </p>
                             {sessionId && (
                                 <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, padding: '8px 16px', display: 'inline-block', color: '#389e0d', fontWeight: 'bold' }}>
                                     ● CONECTADO EN NUBE
                                 </div>
                             )}
                         </div>
                     )}
                 </div>
            </div>
        </div>
    );
};

export default BoletaModule;
