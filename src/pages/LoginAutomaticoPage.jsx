import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, message, Tag, Input, Tooltip, Select } from 'antd';
import {
    LoginOutlined,
    ReloadOutlined,
    CopyOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    DragOutlined
} from '@ant-design/icons';
import { getCurrentPlanInfo } from '../config/plans';
import './LoginAutomaticoPage.css';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

const LoginAutomaticoPage = () => {
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedPortal, setSelectedPortal] = useState(1);
    const [config, setConfig] = useState(null);
    const planInfo = getCurrentPlanInfo();

    useEffect(() => {
        loadClients();
        initializeApp();
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

    const loadClients = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.invoke('clients:get-all');

            if (result.success) {
                const todosLosClientes = result.clients.map(client => ({ ...client, status: 'pending' }));
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

    // Mapeo de IDs a nombres de portales
    const portalNames = {
        1: 'Mis declaraciones y pagos (SOL)',
        2: 'Ventana Principal (SOL Portal)',
        3: 'Buzón Electrónico (SUNAT)'
    };

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

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        message.success(`¡Script de login para ${label} copiado al portapapeles!`);
    };

    const getBookmarkletCode = (record) => {
        const escapedRuc = record.ruc.replace(/'/g, "\\'");
        const escapedUser = record.usuario.replace(/'/g, "\\'");
        const escapedPass = (record.clave || '').replace(/'/g, "\\'");
        
        return `javascript:(function(){const d=document;const triggerInput=(el,val)=>{if(!el)return;el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};const btnRuc=d.getElementById('btnPorRuc')||d.querySelector('button[id=\"btnPorRuc\"]')||d.querySelector('.btn-ruc');if(btnRuc)btnRuc.click();setTimeout(function(){const r=d.getElementById('txtRuc')||d.querySelector('input[name=\"numRuc\"]')||d.querySelector('#txtRuc');const u=d.getElementById('txtUsuario')||d.querySelector('input[name=\"codUsuario\"]')||d.querySelector('#txtUsuario');const c=d.getElementById('txtContrasena')||d.getElementById('txtClave')||d.querySelector('input[name=\"codClave\"]')||d.querySelector('input[type=\"password\"]');triggerInput(r,'${escapedRuc}');triggerInput(u,'${escapedUser}');triggerInput(c,'${escapedPass}');setTimeout(function(){const b=d.getElementById('btnAceptar')||d.querySelector('button[type=\"submit\"]')||d.querySelector('#btnAceptar')||d.querySelector('.btn-primary')||d.getElementById('btnAceptar');if(b)b.click();},150);},250);})()`;
    };

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
            render: (text) => <Text strong>{text}</Text>
        },
        {
            title: 'Usuario SOL',
            dataIndex: 'usuario',
            key: 'usuario',
            width: 130,
        },
        {
            title: 'Login Mágico en Navegador (Cloud-Native)',
            key: 'actions',
            width: 480,
            render: (_, record) => {
                const portalUrl = config && config.portales ? config.portales[selectedPortal] || 'https://declaraciones.sunat.gob.pe/' : 'https://declaraciones.sunat.gob.pe/';
                const bookmarklet = getBookmarkletCode(record);

                return (
                    <Space size="middle">
                        <Tooltip title="Arrastra este botón azul a tu barra de marcadores del navegador (Chrome/Edge)">
                            <a
                                href={bookmarklet}
                                className="bookmarklet-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    message.warning('¡No hagas clic! Arrastra este botón a tu barra de marcadores/favoritos (Ctrl+Shift+B)');
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 14px',
                                    background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                                    color: 'white',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    border: '1px solid #1e40af',
                                    boxShadow: '0 2px 4px rgba(30, 64, 175, 0.2)',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <DragOutlined /> Login {record.empresa.substring(0, 10)}...
                            </a>
                        </Tooltip>

                        <Button
                            type="dashed"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(bookmarklet, record.empresa)}
                        >
                            Copiar Script
                        </Button>

                        <Button
                            type="primary"
                            ghost
                            icon={<GlobalOutlined />}
                            onClick={() => window.open(portalUrl, '_blank')}
                        >
                            Abrir SUNAT
                        </Button>
                    </Space>
                );
            }
        }
    ];

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
                            Acceso y auto-relleno inmediato en portales de SUNAT optimizado para entorno web
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

            {/* Guía de Uso del Bookmarklet */}
            <Card bordered={false} style={{ marginTop: 16, borderLeft: '5px solid #2563eb' }}>
                <Title level={4} style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <InfoCircleOutlined style={{ color: '#2563eb' }} /> Guía de Login Rápido (Bookmarklet Cloud-Native)
                </Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <Text strong style={{ display: 'block', marginBottom: '4px' }}>1. Mostrar Marcadores</Text>
                        <Paragraph style={{ margin: 0, fontSize: '13px' }} type="secondary">
                            Asegúrate de ver tu barra de marcadores en Chrome/Edge. Actívala presionando las teclas <Text code>Ctrl + Shift + B</Text>.
                        </Paragraph>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <Text strong style={{ display: 'block', marginBottom: '4px' }}>2. Arrastrar el Botón</Text>
                        <Paragraph style={{ margin: 0, fontSize: '13px' }} type="secondary">
                            <strong>Arrastra con el ratón</strong> el botón azul <Text strong>"Login [Empresa]"</Text> de tu cliente y suéltalo en la barra de marcadores.
                        </Paragraph>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <Text strong style={{ display: 'block', marginBottom: '4px' }}>3. Abrir y Hacer Clic</Text>
                        <Paragraph style={{ margin: 0, fontSize: '13px' }} type="secondary">
                            Haz clic en <Text strong>"Abrir SUNAT"</Text>. Una vez cargada la página de SUNAT, haz clic en el marcador guardado para auto-rellenar y entrar al instante.
                        </Paragraph>
                    </div>
                </div>
            </Card>

            {/* Portal Selection Card */}
            <Card bordered={false} style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px' }}>
                    <div style={{ flex: 1 }}>
                        <Text strong>Portal SUNAT Destino</Text>
                        <Select
                            value={selectedPortal}
                            onChange={setSelectedPortal}
                            placeholder="Seleccione un portal..."
                            loading={!config || portales.length === 0}
                            style={{ width: '100%', marginTop: 8 }}
                            size="large"
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
                    <div>
                        <Space size="middle">
                            <Search
                                placeholder="Buscar por RUC, empresa o usuario..."
                                allowClear
                                onSearch={handleSearch}
                                onChange={(e) => handleSearch(e.target.value)}
                                style={{ width: 350 }}
                                size="large"
                            />
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={loadClients}
                                loading={loading}
                                size="large"
                            >
                                Recargar
                            </Button>
                        </Space>
                    </div>
                </div>
            </Card>

            {/* Table Card */}
            <Card bordered={false} style={{ marginTop: 16 }}>
                <Table
                    columns={columns}
                    dataSource={filteredClients}
                    rowKey="ruc"
                    loading={loading}
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
