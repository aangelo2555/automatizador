import React, { useState } from 'react';
import { Card, Tabs, Typography, Space, Divider } from 'antd';
import {
    MailOutlined,
    WhatsAppOutlined,
    CrownOutlined,
    UserOutlined
} from '@ant-design/icons';
import EmailConfigModal from '../components/EmailConfigModal';
import WhatsAppConfigModal from '../components/WhatsAppConfigModal';
import { getCurrentPlanInfo } from '../config/plans';
import { useAuth } from '../contexts/AuthContext';
import './ConfiguracionPage.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const ConfiguracionPage = ({ initialTab = "servicios" }) => {
    const { user, updatePlan, updateUserName } = useAuth();
    const planInfo = getCurrentPlanInfo();
    const [showEmailConfig, setShowEmailConfig] = useState(false);
    const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);

    return (
        <div className="configuracion-page">
            <Card bordered={false}>
                <Title level={2}>Configuración</Title>
                <Paragraph type="secondary">
                    Configura los servicios y ajustes de la aplicación
                </Paragraph>

                <Divider />

                <Tabs defaultActiveKey={initialTab} size="large">
                    <TabPane
                        tab={
                            <span>
                                <MailOutlined />
                                Servicios de Notificación
                            </span>
                        }
                        key="servicios"
                    >
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            {/* Email Service */}
                            <Card
                                title={
                                    <Space>
                                        <MailOutlined style={{ color: '#1890ff' }} />
                                        <span>Servicio de Email (Gmail)</span>
                                    </Space>
                                }
                                extra={
                                    <a onClick={() => setShowEmailConfig(true)}>
                                        Configurar
                                    </a>
                                }
                                bordered={false}
                                className="service-card"
                            >
                                <Paragraph>
                                    Configura tu cuenta de Gmail para enviar notificaciones automáticas
                                    a tus clientes. Se requiere una contraseña de aplicación.
                                </Paragraph>
                                <Text type="secondary">
                                    <strong>Funciones:</strong> Envío de reportes de facturas, alertas de
                                    buzón electrónico, notificaciones de descargas
                                </Text>
                            </Card>

                            {/* WhatsApp Service */}
                            <Card
                                title={
                                    <Space>
                                        <WhatsAppOutlined style={{ color: '#25D366' }} />
                                        <span>Servicio de WhatsApp</span>
                                    </Space>
                                }
                                extra={
                                    <a onClick={() => setShowWhatsAppConfig(true)}>
                                        Configurar
                                    </a>
                                }
                                bordered={false}
                                className="service-card"
                            >
                                <Paragraph>
                                    Conecta tu cuenta de WhatsApp para enviar archivos directamente a tus
                                    clientes (PDF, XML, CDR). Requiere escanear código QR.
                                </Paragraph>
                                <Text type="secondary">
                                    <strong>Funciones:</strong> Envío de comprobantes, reportes SIRE,
                                    documentos del buzón
                                </Text>
                            </Card>
                        </Space>
                    </TabPane>

                    <TabPane
                        tab={
                            <span>
                                <CrownOutlined />
                                Mi Plan
                            </span>
                        }
                        key="plan"
                    >
                        <Card bordered={false}>
                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                <div>
                                    <Title level={4}>Plan Actual: {planInfo.nombre}</Title>
                                    <Paragraph type="secondary">
                                        {planInfo.descripcion}
                                    </Paragraph>
                                </div>

                                <div>
                                    <Title level={5}>Características de tu plan:</Title>
                                    <ul>
                                        {planInfo.caracteristicas.map((feature, index) => (
                                            <li key={index}>{feature}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <Title level={5}>Límites:</Title>
                                    <ul>
                                        <li>
                                            Máximo de clientes:{' '}
                                            {planInfo.limites.maxClientes === Infinity
                                                ? 'Ilimitado'
                                                : planInfo.limites.maxClientes}
                                        </li>
                                        <li>
                                            Módulo SIRE:{' '}
                                            {planInfo.limites.sireEnabled ? 'Habilitado ✓' : 'No disponible'}
                                        </li>
                                        <li>
                                            WhatsApp integrado:{' '}
                                            {planInfo.limites.whatsappEnabled ? 'Habilitado ✓' : 'No disponible'}
                                        </li>
                                    </ul>
                                </div>
                            </Space>
                        </Card>
                    </TabPane>

                    <TabPane
                        tab={
                            <span>
                                <UserOutlined />
                                Perfil
                            </span>
                        }
                        key="perfil"
                    >
                        <Card bordered={false}>
                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                <div>
                                    <Title level={4}>Información del Usuario</Title>
                                    <Paragraph>
                                        <strong>Nombre:</strong> {user?.name || user?.nombre || 'Usuario'}
                                    </Paragraph>
                                    <Paragraph>
                                        <strong>Plan:</strong> {planInfo.nombre}
                                    </Paragraph>
                                    <Paragraph>
                                        <strong>Rol:</strong> Contador
                                    </Paragraph>
                                </div>

                                <div>
                                    <Title level={5}>Acerca de la Aplicación</Title>
                                    <Paragraph>
                                        <strong>Versión:</strong> 1.0.0
                                    </Paragraph>
                                    <Paragraph>
                                        <strong>Sistema:</strong> Automatizador SUNAT - Electron Desktop
                                    </Paragraph>
                                </div>
                            </Space>
                        </Card>
                    </TabPane>
                </Tabs>
            </Card>

            {/* Modales */}
            <EmailConfigModal
                isOpen={showEmailConfig}
                onClose={() => setShowEmailConfig(false)}
                onSave={() => {
                    setShowEmailConfig(false);
                }}
            />

            <WhatsAppConfigModal
                isOpen={showWhatsAppConfig}
                onClose={() => setShowWhatsAppConfig(false)}
            />
        </div>
    );
};

export default ConfiguracionPage;
