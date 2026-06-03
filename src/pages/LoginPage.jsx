import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, AutoComplete, Select, Space, message } from 'antd';
import { MailOutlined, LockOutlined, BankOutlined, KeyOutlined, UserOutlined, EyeOutlined, EyeInvisibleOutlined, CrownOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { PLANES } from '../config/plans';
import { motion } from 'framer-motion';
import './LoginPage.css';

const { Title, Text } = Typography;
const { Option } = Select;

const LoginPage = () => {
    const { login, register, recentEmails, loadRecentEmails } = useAuth();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [emailOptions, setEmailOptions] = useState([]);

    // Cargar emails recientes al montar
    useEffect(() => {
        if (loadRecentEmails) {
            loadRecentEmails();
        }
    }, []);

    // Actualizar opciones de autocompletado cuando cambian los emails recientes
    useEffect(() => {
        if (recentEmails && recentEmails.length > 0) {
            setEmailOptions(recentEmails.map(e => ({ value: e.email })));
        }
    }, [recentEmails]);

    const handleLogin = async (values) => {
        setLoading(true);
        try {
            const result = await login(values.email, values.password);

            if (result.success) {
                message.success(`¡Bienvenido ${result.user.name}!`);
            } else {
                message.error(result.error || 'Credenciales incorrectas');
            }
        } catch (error) {
            message.error('Error al iniciar sesión: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (values) => {
        setLoading(true);
        try {
            const result = await register(
                values.name,
                values.email,
                values.password,
                values.secretKey,
                values.plan || 'basico'
            );

            if (result.success) {
                message.success('¡Registro exitoso! Ahora puedes iniciar sesión.');
                setIsRegisterMode(false);
                form.setFieldsValue({ email: values.email, password: '' });
            } else {
                message.error(result.error || 'Error en el registro');
            }
        } catch (error) {
            message.error('Error al registrarse: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsRegisterMode(!isRegisterMode);
        form.resetFields();
    };

    const onFinish = (values) => {
        if (isRegisterMode) {
            handleRegister(values);
        } else {
            handleLogin(values);
        }
    };

    return (
        <div className="login-page-split">
            <motion.div
                className={`login-container-split ${isRegisterMode ? 'register-mode' : ''}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                {/* Panel Izquierdo - Formulario */}
                <div className="login-form-panel">
                    <div className="form-content">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <Title level={2} className="form-title">
                                {isRegisterMode ? 'Registrarse' : 'Iniciar Sesión'}
                            </Title>

                            <div className="logo-icon">
                                <BankOutlined />
                            </div>

                            <Text className="subtitle">
                                Automatizador SUNAT - Estudio Contable SANDUL
                            </Text>

                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={onFinish}
                                initialValues={{ plan: 'basico' }}
                                requiredMark={false}
                                className="login-form"
                            >
                                {isRegisterMode && (
                                    <Form.Item
                                        name="name"
                                        rules={[
                                            { required: true, message: 'Ingresa tu nombre' },
                                            { min: 3, message: 'Mínimo 3 caracteres' }
                                        ]}
                                    >
                                        <Input
                                            size="large"
                                            prefix={<UserOutlined className="input-icon" />}
                                            placeholder="Nombre completo"
                                            className="custom-input"
                                        />
                                    </Form.Item>
                                )}

                                <Form.Item
                                    name="email"
                                    rules={[
                                        { required: true, message: 'Ingresa tu correo electrónico' },
                                        { type: 'email', message: 'Correo inválido' }
                                    ]}
                                >
                                    {isRegisterMode ? (
                                        <Input
                                            size="large"
                                            prefix={<MailOutlined className="input-icon" />}
                                            placeholder="Correo electrónico"
                                            className="custom-input"
                                        />
                                    ) : (
                                        <AutoComplete
                                            options={emailOptions}
                                            filterOption={(inputValue, option) =>
                                                option.value.toLowerCase().includes(inputValue.toLowerCase())
                                            }
                                        >
                                            <Input
                                                size="large"
                                                prefix={<MailOutlined className="input-icon" />}
                                                placeholder="Correo electrónico"
                                                className="custom-input"
                                            />
                                        </AutoComplete>
                                    )}
                                </Form.Item>

                                <Form.Item
                                    name="password"
                                    rules={[
                                        { required: true, message: 'Ingresa tu contraseña' },
                                        { min: 4, message: 'Mínimo 4 caracteres' }
                                    ]}
                                >
                                    <Input.Password
                                        size="large"
                                        prefix={<LockOutlined className="input-icon" />}
                                        placeholder="Contraseña"
                                        className="custom-input"
                                        iconRender={(visible) =>
                                            visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                                        }
                                    />
                                </Form.Item>

                                {isRegisterMode && (
                                    <>
                                        <Form.Item
                                            name="plan"
                                            label={<span className="plan-label"><CrownOutlined style={{ marginRight: 8 }} />Selecciona tu Plan</span>}
                                        >
                                            <Select
                                                size="large"
                                                placeholder="Selecciona un plan"
                                                className="plan-select"
                                            >
                                                {Object.values(PLANES).map(plan => (
                                                    <Option key={plan.id} value={plan.id}>
                                                        <Space>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                width: 10,
                                                                height: 10,
                                                                borderRadius: '50%',
                                                                backgroundColor: plan.color
                                                            }} />
                                                            <strong>{plan.nombre}</strong>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                - {plan.descripcion}
                                                            </Text>
                                                        </Space>
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Form.Item>

                                        <Form.Item
                                            name="secretKey"
                                            rules={[
                                                { required: true, message: 'Ingresa la clave secreta proporcionada' }
                                            ]}
                                        >
                                            <Input.Password
                                                size="large"
                                                prefix={<KeyOutlined className="input-icon" />}
                                                placeholder="Clave secreta"
                                                className="custom-input"
                                                iconRender={(visible) =>
                                                    visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                                                }
                                            />
                                        </Form.Item>
                                    </>
                                )}

                                <Form.Item style={{ marginTop: 24 }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        size="large"
                                        loading={loading}
                                        className="submit-btn"
                                    >
                                        {isRegisterMode ? 'REGISTRARSE' : 'INGRESAR'}
                                    </Button>
                                </Form.Item>
                            </Form>
                        </motion.div>
                    </div>
                </div>

                {/* Panel Derecho - Bienvenida */}
                <div className="login-welcome-panel">
                    <motion.div
                        className="welcome-content"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <Title level={1} className="welcome-title">
                            ¡Hola!
                        </Title>
                        <Text className="welcome-text">
                            {isRegisterMode
                                ? '¿Ya tienes una cuenta? Inicia sesión para acceder al sistema'
                                : 'Regístrate con tu clave secreta para acceder al sistema'
                            }
                        </Text>
                        <Button
                            ghost
                            size="large"
                            className="toggle-btn"
                            onClick={toggleMode}
                        >
                            {isRegisterMode ? 'INICIAR SESIÓN' : 'REGISTRARSE'}
                        </Button>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
