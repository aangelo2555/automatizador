import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Space, Typography, Button, Tag } from 'antd';
import {
    DashboardOutlined,
    UserOutlined,
    FileSearchOutlined,
    MailOutlined,
    DownloadOutlined,
    SettingOutlined,
    LogoutOutlined,
    BellOutlined,
    MoonOutlined,
    SunOutlined,
    CrownOutlined,
    TeamOutlined,
    CalculatorOutlined,
    FileTextOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentPlanInfo } from '../config/plans';
import './DashboardLayout.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const DashboardLayout = ({ children, currentPage, onNavigate }) => {
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [darkMode, setDarkMode] = useState(false); // Force Light Mode on startup

    // Force Light Mode cleanup on mount
    React.useEffect(() => {
        setDarkMode(false);
        localStorage.setItem('darkMode', 'false');
        document.documentElement.classList.remove('dark-mode');
    }, []);

    const planInfo = getCurrentPlanInfo();

    // Toggle dark mode
    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('darkMode', JSON.stringify(newMode));
        document.documentElement.classList.toggle('dark-mode', newMode);
    };

    // Menu items
    const menuItems = [
        {
            key: 'dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard',
        },
        {
            key: 'login-auto',
            icon: <TeamOutlined />,
            label: 'Login Automático',
        },
        {
            key: 'clientes',
            icon: <UserOutlined />,
            label: 'Gestión de Clientes',
        },
        {
            key: 'consulta-facturas',
            icon: <FileSearchOutlined />,
            label: 'Consultar Facturas',
        },
        {
            key: 'sire',
            icon: <DownloadOutlined />,
            label: 'Módulo SIRE',
            disabled: !planInfo.limites.sireEnabled,
        },
        {
            key: 'sire-ajustes',
            icon: <SettingOutlined />,
            label: 'SIRE Ajustes',
            disabled: !planInfo.limites.sireEnabled,
        },
        {
            key: 'buzon',
            icon: <MailOutlined />,
            label: 'Buzón Electrónico',
        },
        {
            key: 'configuracion',
            icon: <SettingOutlined />,
            label: 'Configuración',
        },
        {
            key: 'calculo',
            icon: <CalculatorOutlined />,
            label: 'Cálculo Tributario',
        },
        {
            key: 'boleta',
            icon: <FileTextOutlined />,
            label: 'Emitir Boletas',
        },
    ];

    // User dropdown menu
    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Mi Perfil',
        },
        {
            key: 'plan',
            icon: <CrownOutlined />,
            label: 'Mi Plan',
        },
        {
            type: 'divider',
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Cerrar Sesión',
            onClick: logout,
        },
    ];

    const handleMenuClick = (e) => {
        if (onNavigate) {
            onNavigate(e.key);
        }
    };

    return (
        <Layout className={`dashboard-layout ${darkMode ? 'dark' : ''}`} style={{ minHeight: '100vh' }}>
            <Sider
                collapsible
                collapsed={collapsed}
                onCollapse={setCollapsed}
                theme={darkMode ? 'dark' : 'light'}
                width={250}
                className="dashboard-sider"
            >
                <div className="logo-container">
                    {!collapsed ? (
                        <>
                            <CrownOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                            <Text strong style={{ marginLeft: 12, fontSize: 16 }}>
                                SUNAT Bot
                            </Text>
                        </>
                    ) : (
                        <CrownOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    )}
                </div>

                <Menu
                    theme={darkMode ? 'dark' : 'light'}
                    mode="inline"
                    selectedKeys={[currentPage]}
                    items={menuItems}
                    onClick={handleMenuClick}
                    className="dashboard-menu"
                />

                {/* Plan Badge en el sidebar - Solo mostrar si NO es Premium */}
                {planInfo.nombre !== 'Premium' && (
                    <div className="plan-badge-container">
                        <Tag
                            color={planInfo.color}
                            style={{
                                width: '100%',
                                textAlign: 'center',
                                padding: '8px 0',
                                borderRadius: 8,
                                fontSize: collapsed ? 10 : 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            onClick={() => onNavigate && onNavigate('plan')}
                        >
                            <CrownOutlined /> {!collapsed && `Mejorar Plan (${planInfo.nombre})`}
                        </Tag>
                    </div>
                )}
            </Sider>

            <Layout>
                <Header className="dashboard-header">
                    <div className="header-content">
                        <div className="header-left">
                            <Text strong style={{ fontSize: 18, color: '#1f1f1f' }}>
                                {menuItems.find(item => item.key === currentPage)?.label || 'Dashboard'}
                            </Text>
                        </div>

                        <div className="header-right">
                            <Space size="middle">
                                {/* Notificaciones */}
                                <Badge count={0} showZero={false}>
                                    <Button
                                        type="text"
                                        icon={<BellOutlined style={{ fontSize: 18, color: '#64748b' }} />}
                                        className="header-icon-btn"
                                    />
                                </Badge>

                                {/* Dark Mode Toggle */}
                                <Button
                                    type="text"
                                    icon={darkMode ? <SunOutlined style={{ fontSize: 18 }} /> : <MoonOutlined style={{ fontSize: 18, color: '#64748b' }} />}
                                    onClick={toggleDarkMode}
                                    className="header-icon-btn"
                                />

                                {/* User Dropdown */}
                                <Dropdown
                                    menu={{
                                        items: userMenuItems,
                                        onClick: handleMenuClick
                                    }}
                                    placement="bottomRight"
                                    trigger={['click']}
                                    getPopupContainer={(triggerNode) => triggerNode.parentNode}
                                >
                                    <div className="user-info-container">
                                        <Avatar
                                            style={{ backgroundColor: planInfo.color, verticalAlign: 'middle' }}
                                            icon={<UserOutlined />}
                                            size="large"
                                        />
                                        <div className="user-info" style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Text strong style={{ color: '#1f2937', fontSize: '14px', lineHeight: '1.2' }}>{user?.name || user?.nombre || 'Usuario'}</Text>
                                            <Text type="secondary" style={{ color: '#6b7280', fontSize: '11px', lineHeight: '1.2' }}>
                                                {planInfo.nombre === 'Premium' ? 'Plan Premium' : `Plan ${planInfo.nombre}`}
                                            </Text>
                                        </div>
                                    </div>
                                </Dropdown>
                            </Space>
                        </div>
                    </div>
                </Header>

                <Content className="dashboard-content">
                    <div className="content-wrapper">
                        {children}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default DashboardLayout;
