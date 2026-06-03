import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Typography, Space, Tag, Button } from 'antd';
import {
    UserOutlined,
    FileSearchOutlined,
    DownloadOutlined,
    MailOutlined,
    RiseOutlined,
    CrownOutlined
} from '@ant-design/icons';
import { getCurrentPlanInfo, canAccessFeature } from '../config/plans';
import { motion } from 'framer-motion';
import './DashboardPage.css';

const { Title, Text, Paragraph } = Typography;

const DashboardPage = ({ onNavigate }) => {
    const planInfo = getCurrentPlanInfo();
    const [stats, setStats] = useState({
        totalClientes: 0,
        consultasHoy: 0,
        descargasMes: 0,
        buzonPendientes: 0
    });

    // Cargar estadísticas
    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            // Obtener clientes desde storage
            const clientsResult = await window.electronAPI.invoke('clients:get-all');

            // Obtener estadísticas de uso
            const statsResult = await window.electronAPI.invoke('user:get-stats');

            setStats(prev => ({
                ...prev,
                totalClientes: clientsResult.success ? clientsResult.clients.length : 0,
                consultasHoy: statsResult.success ? statsResult.stats.consultasHoy : 0,
                descargasMes: statsResult.success ? statsResult.stats.descargasMes : 0,
                buzonPendientes: statsResult.success ? statsResult.stats.buzonPendientes : 0
            }));
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    };

    // Calcular uso del plan
    const calculatePlanUsage = () => {
        const { maxClientes } = planInfo.limites;
        if (maxClientes === Infinity) return 0;
        return Math.round((stats.totalClientes / maxClientes) * 100);
    };

    // Handler para navegación
    const handleNavigate = (page) => {
        if (onNavigate) {
            onNavigate(page);
        }
    };

    return (
        <div className="dashboard-page">
            {/* Tarjeta de bienvenida */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="welcome-card" bordered={false}>
                    <Row gutter={[24, 24]} align="middle">
                        <Col flex="1">
                            <Space direction="vertical" size="small">
                                <Title level={2} style={{ margin: 0 }}>
                                    ¡Bienvenido al Automatizador SUNAT!
                                </Title>
                                <Paragraph type="secondary" style={{ margin: 0, fontSize: 16 }}>
                                    Gestiona tus clientes y operaciones SUNAT de forma automatizada
                                </Paragraph>
                            </Space>
                        </Col>
                        <Col>
                            <Tag
                                color={planInfo.color}
                                style={{
                                    padding: '8px 20px',
                                    fontSize: 16,
                                    fontWeight: 600,
                                    borderRadius: 8
                                }}
                            >
                                <CrownOutlined /> Plan {planInfo.nombre}
                            </Tag>
                        </Col>
                    </Row>
                </Card>
            </motion.div>

            {/* Tarjetas de estadísticas - Ahora clickeables */}
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                    >
                        <Card
                            bordered={false}
                            className="stat-card stat-card-blue stat-card-clickable"
                            onClick={() => handleNavigate('clientes')}
                            hoverable
                        >
                            <Statistic
                                title="Total de Clientes"
                                value={stats.totalClientes}
                                prefix={<UserOutlined />}
                                suffix={
                                    planInfo.limites.maxClientes !== Infinity && (
                                        <Text type="secondary" style={{ fontSize: 14 }}>
                                            / {planInfo.limites.maxClientes}
                                        </Text>
                                    )
                                }
                            />
                            {planInfo.limites.maxClientes !== Infinity && (
                                <Progress
                                    percent={calculatePlanUsage()}
                                    size="small"
                                    strokeColor={planInfo.color}
                                    style={{ marginTop: 8 }}
                                />
                            )}
                        </Card>
                    </motion.div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                    >
                        <Card
                            bordered={false}
                            className="stat-card stat-card-green stat-card-clickable"
                            onClick={() => handleNavigate('consulta-facturas')}
                            hoverable
                        >
                            <Statistic
                                title="Consultas Hoy"
                                value={stats.consultasHoy}
                                prefix={<FileSearchOutlined />}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Card>
                    </motion.div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                    >
                        <Card
                            bordered={false}
                            className="stat-card stat-card-purple stat-card-clickable"
                            onClick={() => handleNavigate('sire')}
                            hoverable
                        >
                            <Statistic
                                title="Descargas este Mes"
                                value={stats.descargasMes}
                                prefix={<DownloadOutlined />}
                                valueStyle={{ color: '#722ed1' }}
                            />
                        </Card>
                    </motion.div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                    >
                        <Card
                            bordered={false}
                            className="stat-card stat-card-orange stat-card-clickable"
                            onClick={() => handleNavigate('buzon')}
                            hoverable
                        >
                            <Statistic
                                title="Buzón Pendientes"
                                value={stats.buzonPendientes}
                                prefix={<MailOutlined />}
                                valueStyle={{ color: '#fa8c16' }}
                            />
                        </Card>
                    </motion.div>
                </Col>
            </Row>

            {/* Información del plan */}
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col xs={24} lg={12}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                    >
                        <Card
                            title={
                                <Space>
                                    <CrownOutlined style={{ color: planInfo.color }} />
                                    <span>Tu Plan {planInfo.nombre}</span>
                                </Space>
                            }
                            bordered={false}
                        >
                            <Paragraph type="secondary">{planInfo.descripcion}</Paragraph>

                            <Title level={5}>Características:</Title>
                            <ul>
                                {planInfo.caracteristicas.map((feature, index) => (
                                    <li key={index}>{feature}</li>
                                ))}
                            </ul>

                            {planInfo.nombre !== 'Premium' && (
                                <Button type="primary" block style={{ marginTop: 16 }}>
                                    Mejorar Plan
                                </Button>
                            )}
                        </Card>
                    </motion.div>
                </Col>

                <Col xs={24} lg={12}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                    >
                        <Card
                            title={
                                <Space>
                                    <RiseOutlined />
                                    <span>Accesos Rápidos</span>
                                </Space>
                            }
                            bordered={false}
                        >
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                <Button
                                    type="default"
                                    block
                                    size="large"
                                    icon={<FileSearchOutlined />}
                                    onClick={() => handleNavigate('consulta-facturas')}
                                >
                                    Consultar Facturas
                                </Button>

                                {canAccessFeature('sire') && (
                                    <Button
                                        type="default"
                                        block
                                        size="large"
                                        icon={<DownloadOutlined />}
                                        onClick={() => handleNavigate('sire')}
                                    >
                                        Descargar SIRE
                                    </Button>
                                )}

                                <Button
                                    type="default"
                                    block
                                    size="large"
                                    icon={<MailOutlined />}
                                    onClick={() => handleNavigate('buzon')}
                                >
                                    Revisar Buzón
                                </Button>

                                <Button
                                    type="default"
                                    block
                                    size="large"
                                    icon={<UserOutlined />}
                                    onClick={() => handleNavigate('clientes')}
                                >
                                    Gestionar Clientes
                                </Button>
                            </Space>
                        </Card>
                    </motion.div>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;

