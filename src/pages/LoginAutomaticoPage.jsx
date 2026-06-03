import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, message, Tag, Input, Tooltip, Select } from 'antd';
import {
    LoginOutlined,
    PlayCircleOutlined,
    StopOutlined,
    ReloadOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import { getCurrentPlanInfo } from '../config/plans';
import './LoginAutomaticoPage.css';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

const LoginAutomaticoPage = () => {
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [selectedClients, setSelectedClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasActiveSessions, setHasActiveSessions] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedPortal, setSelectedPortal] = useState(1);
    const [config, setConfig] = useState(null);
    const planInfo = getCurrentPlanInfo();

    useEffect(() => {
        loadClients();
        initializeApp();
        setupEventListeners();

        return () => {
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('login-started');
                window.electronAPI.removeAllListeners('login-completed');
                window.electronAPI.removeAllListeners('login-process-completed');
            }
        };
    }, []);

    const initializeApp = async () => {
        try {
            const configResult = await window.electronAPI.getConfig();
            if (configResult.success) {
                setConfig(configResult.config);
            }
        } catch (error) {
            console.error('Error al inicializar:', error);
        }
    };

    const setupEventListeners = () => {
        if (!window.electronAPI) return;

        window.electronAPI.onLoginStarted((event, data) => {
            updateClientStatus(data.ruc, 'processing');
        });

        window.electronAPI.onLoginCompleted((event, result) => {
            if (result.success) {
                updateClientStatus(result.ruc, 'success');
                setHasActiveSessions(true);
            } else {
                updateClientStatus(result.ruc, 'error');
            }
        });

        window.electronAPI.onLoginProcessCompleted(() => {
            setIsProcessing(false);
            checkActiveSessions();
            message.success('Proceso completado - Todas las sesiones procesadas');
        });
    };

    const loadClients = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.invoke('clients:get-all');

            if (result.success) {
                // Cargar TODOS los clientes sin filtrar por tipo
                const todosLosClientes = result.clients
                    .map(client => ({ ...client, status: 'pending' }));
                setClients(todosLosClientes);
                setFilteredClients(todosLosClientes);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            message.error('Error al cargar clientes: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (value) => {
        setSearchText(value);
        if (!value) {
            setFilteredClients(clients);
            return;
        }

        const lowerValue = value.toLowerCase();
        const filtered = clients.filter(client =>
            client.ruc.includes(lowerValue) ||
            client.empresa.toLowerCase().includes(lowerValue) ||
            client.usuario.toLowerCase().includes(lowerValue)
        );
        setFilteredClients(filtered);
    };

    const startLogins = async () => {
        if (selectedClients.length === 0) {
            message.warning('Seleccione al menos un cliente');
            return;
        }

        const clientsToProcess = clients.filter(client => selectedClients.includes(client.ruc));

        try {
            setIsProcessing(true);
            setClients(prev => prev.map(client => ({
                ...client,
                status: selectedClients.includes(client.ruc) ? 'pending' : client.status
            })));

            message.info(`Iniciando proceso para ${clientsToProcess.length} clientes`);

            const result = await window.electronAPI.startLogins({
                clients: clientsToProcess,
                portalId: selectedPortal,
                options: {}
            });

            if (!result.success) throw new Error(result.error);
        } catch (error) {
            setIsProcessing(false);
            message.error('Error al iniciar: ' + error.message);
        }
    };

    const stopAllSessions = async () => {
        try {
            const stopResult = await window.electronAPI.stopAllSessions();

            if (stopResult.success) {
                setIsProcessing(false);
                setHasActiveSessions(false);
                message.success(stopResult.message);
                setClients(prev => prev.map(client => ({ ...client, status: 'pending' })));
            }
        } catch (error) {
            message.error('Error al cerrar sesiones: ' + error.message);
        }
    };

    const checkActiveSessions = async () => {
        try {
            const result = await window.electronAPI.getActiveSessions();
            if (result.success) {
                setHasActiveSessions(result.sessions && result.sessions.length > 0);
            }
        } catch (error) {
            console.error('Error al verificar sesiones:', error);
        }
    };

    const updateClientStatus = (ruc, status) => {
        setClients(prev => prev.map(client =>
            client.ruc === ruc ? { ...client, status } : client
        ));
        setFilteredClients(prev => prev.map(client =>
            client.ruc === ruc ? { ...client, status } : client
        ));
    };

    const getStatusTag = (status) => {
        const statusConfig = {
            pending: { icon: <ClockCircleOutlined />, text: 'Pendiente', color: 'default' },
            processing: { icon: <LoadingOutlined spin />, text: 'Procesando', color: 'processing' },
            success: { icon: <CheckCircleOutlined />, text: 'Exitoso', color: 'success' },
            error: { icon: <CloseCircleOutlined />, text: 'Error', color: 'error' }
        };

        const config = statusConfig[status] || statusConfig.pending;
        return (
            <Tag icon={config.icon} color={config.color}>
                {config.text}
            </Tag>
        );
    };

    // Mapeo de IDs a nombres de portales (hardcodeado)
    const portalNames = {
        1: 'Mis declaraciones y pagos',
        2: 'Ventana Principal',
        3: 'Buzón Electrónico'
    };

    // Siempre usar nombres hardcodeados, filtrar portal 4 explícitamente
    const portales = config && config.portales
        ? Object.keys(config.portales)
            .filter(id => parseInt(id) !== 4) // Excluir portal 4
            .map(id => ({
                value: parseInt(id),
                label: portalNames[id] || `Portal ${id}`
            }))
        : Object.entries(portalNames).map(([id, label]) => ({
            value: parseInt(id),
            label
        }));

    const columns = [
        {
            title: 'RUC',
            dataIndex: 'ruc',
            key: 'ruc',
            width: 130,
            render: (ruc) => <Text strong code>{ruc}</Text>,
        },
        {
            title: 'Empresa',
            dataIndex: 'empresa',
            key: 'empresa',
            ellipsis: true,
        },
        {
            title: 'Usuario SOL',
            dataIndex: 'usuario',
            key: 'usuario',
            width: 150,
        },
        {
            title: 'Estado',
            key: 'status',
            width: 140,
            render: (_, record) => getStatusTag(record.status),
        },
    ];

    const rowSelection = {
        selectedRowKeys: selectedClients,
        onChange: (selectedRowKeys) => setSelectedClients(selectedRowKeys),
        getCheckboxProps: () => ({
            disabled: isProcessing,
        }),
    };

    return (
        <div className="login-automatico-page">
            {/* Header Card */}
            <Card bordered={false} className="header-card">
                <div className="header-content">
                    <div className="header-left">
                        <Title level={2} style={{ margin: 0 }}>
                            <LoginOutlined /> Login Automático
                        </Title>
                        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
                            Gestiona tus clientes y operaciones SUNAT de forma automatizada
                        </Paragraph>
                    </div>
                    <div className="header-right">
                        <Space direction="vertical" size="small" align="end">
                            <Tag color={planInfo.color} style={{ fontSize: 14 }}>
                                Plan {planInfo.nombre}
                            </Tag>
                            <Text type="secondary">
                                Clientes: <strong>{clients.length}</strong>
                            </Text>
                        </Space>
                    </div>
                </div>
            </Card>

            {/* Portal Selection Card */}
            <Card bordered={false} style={{ marginTop: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                        <Text strong>Portal SUNAT</Text>
                        <Select
                            value={selectedPortal}
                            onChange={setSelectedPortal}
                            placeholder="Seleccione un portal..."
                            loading={!config || portales.length === 0}
                            style={{ width: '100%', marginTop: 8 }}
                            size="large"
                            disabled={isProcessing}
                            notFoundContent="No hay portales configurados"
                            getPopupContainer={triggerNode => triggerNode.parentNode}
                        >
                            {portales.map(portal => (
                                <Select.Option key={portal.value} value={portal.value}>
                                    {portal.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </div>
                </Space>
            </Card>

            {/* Actions Card */}
            <Card bordered={false} style={{ marginTop: 16 }}>
                <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space wrap>
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={startLogins}
                            size="large"
                            disabled={selectedClients.length === 0 || isProcessing}
                            loading={isProcessing}
                        >
                            Iniciar Sesiones ({selectedClients.length})
                        </Button>

                        <Button
                            danger
                            icon={<StopOutlined />}
                            onClick={stopAllSessions}
                            size="large"
                            disabled={!hasActiveSessions}
                        >
                            Cerrar Sesiones
                        </Button>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={loadClients}
                            loading={loading}
                            size="large"
                        >
                            Recargar
                        </Button>
                    </Space>

                    <Search
                        placeholder="Buscar por RUC, empresa o usuario..."
                        allowClear
                        onSearch={handleSearch}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{ width: 350 }}
                        size="large"
                    />
                </Space>
            </Card>

            {/* Table Card */}
            <Card bordered={false} style={{ marginTop: 16 }}>
                <Table
                    columns={columns}
                    dataSource={filteredClients}
                    rowKey="ruc"
                    loading={loading}
                    rowSelection={rowSelection}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} clientes`,
                    }}
                    scroll={{ x: 900 }}
                />
            </Card>
        </div>
    );
};

export default LoginAutomaticoPage;
