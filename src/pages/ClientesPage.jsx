import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, message, Tag, Popconfirm, Input, Tooltip } from 'antd';
import {
    UserOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    FileExcelOutlined,
    ReloadOutlined,
    DownloadOutlined,
    ImportOutlined
} from '@ant-design/icons';
import { getCurrentPlanInfo, canAddMoreClients } from '../config/plans';
import clientService from '../services/clientService';
import ClientFormModal from '../components/ClientFormModal';
import './ClientesPage.css';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

const ClientesPage = () => {
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const planInfo = getCurrentPlanInfo();

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        setLoading(true);
        try {
            const result = await clientService.getAll();

            if (result.success) {
                setClients(result.clients);
                setFilteredClients(result.clients);
                message.success(`${result.clients.length} clientes cargados`);
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
            client.usuario.toLowerCase().includes(lowerValue) ||
            (client.email && client.email.toLowerCase().includes(lowerValue))
        );
        setFilteredClients(filtered);
    };

    const handleAddClient = () => {
        const currentCount = clients.length;
        const limit = planInfo.limites.maxClientes;

        // Warning progresivo según porcentaje de uso
        if (limit !== Infinity) {
            const percentage = (currentCount / limit) * 100;

            if (percentage >= 100) {
                message.error({
                    content: `⛔ Límite alcanzado: ${currentCount}/${limit} clientes. Actualiza a un plan superior.`,
                    duration: 5
                });
                return;
            } else if (percentage >= 90) {
                message.warning({
                    content: `⚠️ Cerca del límite: ${currentCount}/${limit} clientes. Solo ${limit - currentCount} restantes.`,
                    duration: 4
                });
            } else if (percentage >= 75) {
                message.info({
                    content: `ℹ️ Usando ${Math.round(percentage)}% del límite (${currentCount}/${limit} clientes)`,
                    duration: 3
                });
            }
        }

        setEditingClient(null);
        setModalVisible(true);
    };

    const handleEditClient = (client) => {
        setEditingClient(client);
        setModalVisible(true);
    };

    const handleDeleteClient = async (ruc, empresa) => {
        try {
            const result = await clientService.delete(ruc);

            if (result.success) {
                message.success(`Cliente ${empresa} eliminado exitosamente`);
                loadClients();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            message.error('Error al eliminar cliente: ' + error.message);
        }
    };

    const handleSaveClient = async (values) => {
        setModalLoading(true);
        try {
            let result;

            if (editingClient) {
                // Actualizar
                result = await clientService.update(editingClient.ruc, values);
            } else {
                // Crear nuevo
                result = await clientService.add(values);
            }

            if (result.success) {
                message.success(editingClient ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente');
                setModalVisible(false);
                setEditingClient(null);
                loadClients();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            message.error(error.message);
        } finally {
            setModalLoading(false);
        }
    };

    const handleImportExcel = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.xlsm';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            setLoading(true);
            try {
                const result = await clientService.importExcel(file);

                if (result.success) {
                    message.success(result.message || 'Clientes importados exitosamente');
                    loadClients();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                message.error('Error al importar: ' + error.message);
            } finally {
                setLoading(false);
            }
        };
        input.click();
    };

    const columns = [
        {
            title: 'RUC',
            dataIndex: 'ruc',
            key: 'ruc',
            width: 130,
            render: (ruc) => <Text strong>{ruc}</Text>,
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
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            width: 200,
            render: (email) => email || <Text type="secondary">No configurado</Text>,
        },
        {
            title: 'Tipo',
            dataIndex: 'tipo',
            key: 'tipo',
            width: 100,
            render: (tipo) => (
                <Tag color={tipo === 'SIRE' ? 'blue' : 'green'}>
                    {tipo === 'SIRE' ? 'SIRE' : 'Normal'}
                </Tag>
            ),
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 120,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Editar">
                        <Button
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => handleEditClient(record)}
                            size="small"
                        />
                    </Tooltip>

                    <Popconfirm
                        title="¿Eliminar cliente?"
                        description={`¿Estás seguro de eliminar ${record.empresa}?`}
                        onConfirm={() => handleDeleteClient(record.ruc, record.empresa)}
                        okText="Sí, eliminar"
                        cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Eliminar">
                            <Button
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const canAddMore = canAddMoreClients(clients.length);
    const limitInfo = planInfo.limites.maxClientes === Infinity
        ? 'Ilimitado'
        : `${clients.length} / ${planInfo.limites.maxClientes}`;

    return (
        <div className="clientes-page">
            {/* Header Card */}
            <Card bordered={false} className="header-card">
                <div className="header-content">
                    <div className="header-left">
                        <Title level={2} style={{ margin: 0 }}>
                            <UserOutlined /> Gestión de Clientes
                        </Title>
                        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
                            Sistema completo de gestión de clientes sin dependencia de Excel
                        </Paragraph>
                    </div>
                    <div className="header-right">
                        <Space direction="vertical" size="small" align="end">
                            <Tag color={planInfo.color} style={{ fontSize: 14 }}>
                                Plan {planInfo.nombre}
                            </Tag>
                            <Text type="secondary">
                                Clientes: <strong>{limitInfo}</strong>
                            </Text>
                            {!canAddMore && (
                                <Text type="warning" style={{ fontSize: 12 }}>
                                    ⚠️ Límite alcanzado
                                </Text>
                            )}
                        </Space>
                    </div>
                </div>
            </Card>

            {/* Actions Card */}
            <Card bordered={false} style={{ marginTop: 16 }}>
                <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space wrap>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAddClient}
                            size="large"
                            disabled={!canAddMore}
                        >
                            Nuevo Cliente
                        </Button>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={loadClients}
                            loading={loading}
                            size="large"
                        >
                            Recargar
                        </Button>

                        <Button
                            icon={<ImportOutlined />}
                            onClick={handleImportExcel}
                            size="large"
                        >
                            Importar desde Excel
                        </Button>
                    </Space>

                    <Search
                        placeholder="Buscar por RUC, empresa, usuario o email..."
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
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Total: ${total} clientes`,
                    }}
                    scroll={{ x: 900 }}
                />
            </Card>

            {/* Info Card */}
            <Card bordered={false} style={{ marginTop: 16 }} className="info-card">
                <Title level={5}>
                    <UserOutlined /> Sistema de Gestión de Clientes
                </Title>
                <Paragraph>
                    ✅ Ya no necesitas editar archivos Excel manualmente
                </Paragraph>
                <ul>
                    <li>✅ <strong>Crear:</strong> Haz click en "Nuevo Cliente" para agregar un RUC</li>
                    <li>✏️ <strong>Editar:</strong> Click en el icono de editar para modificar datos</li>
                    <li>🗑️ <strong>Eliminar:</strong> Click en el icono de eliminar (con confirmación)</li>
                    <li>🔍 <strong>Buscar:</strong> Usa el campo de búsqueda para filtrar clientes</li>
                    <li>📥 <strong>Importar:</strong> Puedes importar tus Excel existentes una sola vez</li>
                    <li>🔒 <strong>Seguridad:</strong> Todas las credenciales SOL están encriptadas</li>
                </ul>
                <Paragraph type="secondary">
                    💡 <strong>Tip:</strong> Los cambios se guardan automáticamente y están disponibles
                    instantáneamente en todos los módulos (Login Auto, SIRE, CPE, etc.)
                </Paragraph>
            </Card>

            {/* Modal de Formulario */}
            <ClientFormModal
                visible={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingClient(null);
                }}
                onSave={handleSaveClient}
                editingClient={editingClient}
                loading={modalLoading}
            />
        </div>
    );
};

export default ClientesPage;
