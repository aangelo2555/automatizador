import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { UserOutlined, BankOutlined, LockOutlined, MailOutlined, KeyOutlined } from '@ant-design/icons';

const { Option } = Select;

const ClientFormModal = ({ visible, onCancel, onSave, editingClient, loading }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (visible) {
            if (editingClient) {
                // Modo edición - cargar datos
                form.setFieldsValue({
                    ruc: editingClient.ruc,
                    empresa: editingClient.empresa,
                    usuario: editingClient.usuario,
                    clave: '', // No mostrar clave por seguridad
                    email: editingClient.email || '',
                    tipo: editingClient.tipo || 'CLIENTES',
                    clienteId: editingClient.clienteId || '',
                    clienteSecret: '', // No mostrar secret por seguridad
                });
            } else {
                // Modo nuevo - limpiar form
                form.resetFields();
            }
        }
    }, [visible, editingClient, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // No enviar clave si está vacía (en modo edición)
            if (editingClient && !values.clave) {
                delete values.clave;
            }

            // No enviar clienteSecret si está vacío (en modo edición)
            if (editingClient && !values.clienteSecret) {
                delete values.clienteSecret;
            }

            onSave(values);
        } catch (error) {
            message.error('Por favor completa todos los campos requeridos');
        }
    };

    const validateRUC = (_, value) => {
        if (!value) {
            return Promise.reject(new Error('El RUC es requerido'));
        }
        if (value.length !== 11) {
            return Promise.reject(new Error('El RUC debe tener 11 dígitos'));
        }
        if (!/^\d+$/.test(value)) {
            return Promise.reject(new Error('El RUC solo debe contener números'));
        }
        return Promise.resolve();
    };

    const watchTipo = Form.useWatch('tipo', form);

    return (
        <Modal
            title={
                <span>
                    <UserOutlined /> {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                </span>
            }
            open={visible}
            onCancel={onCancel}
            onOk={handleSubmit}
            okText={editingClient ? 'Actualizar' : 'Crear'}
            cancelText="Cancelar"
            confirmLoading={loading}
            width={600}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    tipo: 'CLIENTES',
                }}
            >
                <Form.Item
                    label="RUC"
                    name="ruc"
                    rules={[
                        { validator: validateRUC }
                    ]}
                >
                    <Input
                        prefix={<BankOutlined />}
                        placeholder="20123456789"
                        maxLength={11}
                        disabled={!!editingClient} // No editable en modo edición
                    />
                </Form.Item>

                <Form.Item
                    label="Razón Social / Empresa"
                    name="empresa"
                    rules={[
                        { required: true, message: 'La razón social es requerida' }
                    ]}
                >
                    <Input
                        prefix={<BankOutlined />}
                        placeholder="EMPRESA SAC"
                    />
                </Form.Item>

                <Form.Item
                    label="Usuario SOL"
                    name="usuario"
                    rules={[
                        { required: true, message: 'El usuario SOL es requerido' }
                    ]}
                >
                    <Input
                        prefix={<UserOutlined />}
                        placeholder="usuario123"
                    />
                </Form.Item>

                <Form.Item
                    label={editingClient ? 'Clave SOL (dejar vacío para no cambiar)' : 'Clave SOL'}
                    name="clave"
                    rules={[
                        { required: !editingClient, message: 'La clave SOL es requerida' }
                    ]}
                >
                    <Input.Password
                        prefix={<LockOutlined />}
                        placeholder={editingClient ? '••••••••' : 'Contraseña SOL'}
                    />
                </Form.Item>

                <Form.Item
                    label="Email (Opcional)"
                    name="email"
                    rules={[
                        { type: 'email', message: 'Email inválido' }
                    ]}
                >
                    <Input
                        prefix={<MailOutlined />}
                        placeholder="contacto@empresa.com"
                    />
                </Form.Item>

                <Form.Item
                    label="Tipo de Cliente"
                    name="tipo"
                    rules={[
                        { required: true, message: 'El tipo es requerido' }
                    ]}
                >
                    <Select>
                        <Option value="CLIENTES">Normal (CLIENTES.xlsx)</Option>
                        <Option value="SIRE">SIRE (API_SIRE.xlsm)</Option>
                    </Select>
                </Form.Item>

                {/* Campos adicionales para tipo SIRE */}
                {watchTipo === 'SIRE' && (
                    <>
                        <Form.Item
                            label="Cliente ID (SIRE)"
                            name="clienteId"
                        >
                            <Input
                                prefix={<KeyOutlined />}
                                placeholder="Cliente ID para SIRE"
                            />
                        </Form.Item>

                        <Form.Item
                            label={editingClient ? 'Cliente Secret (dejar vacío para no cambiar)' : 'Cliente Secret (SIRE)'}
                            name="clienteSecret"
                        >
                            <Input.Password
                                prefix={<KeyOutlined />}
                                placeholder={editingClient ? '••••••••' : 'Cliente Secret'}
                            />
                        </Form.Item>
                    </>
                )}
            </Form>
        </Modal>
    );
};

export default ClientFormModal;
