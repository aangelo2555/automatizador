import React, { useState, useEffect } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import esES from 'antd/locale/es_ES';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import ClientesPage from './pages/ClientesPage';
import LoginAutomaticoPage from './pages/LoginAutomaticoPage';
import DashboardLayout from './layouts/DashboardLayout';
import { theme } from './theme';

// Importaciones de módulos existentes
import PortalSelector from './components/PortalSelector';
import ClientTable from './components/ClientTable';
import ControlButtons from './components/ControlButtons';
import LogPanel from './components/LogPanel';
import SireModule from './components/SireModule';
import SireAjustesModule from './components/SireAjustesModule';
import BuzonElectronicoModule from './components/BuzonElectronicoModule';
import ConsultaFacturaModule from './components/ConsultaFacturaModule';
import EmailConfigModal from './components/EmailConfigModal';
import WhatsAppConfigModal from './components/WhatsAppConfigModal';
import BoletaModule from './components/BoletaModule';
import TaxDashboard from './components/CalculoModule/components/TaxDashboard/TaxDashboard';

import Swal from 'sweetalert2';
import './App.css';

// Componente principal interno (requiere AuthContext)
function AppContent() {
    const { isAuthenticated, loading } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [darkMode, setDarkMode] = useState(false); // Force Light Mode on startup

    // Estados originales del sistema
    const [clients, setClients] = useState([]);
    const [selectedClients, setSelectedClients] = useState([]);
    const [selectedPortal, setSelectedPortal] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasActiveSessions, setHasActiveSessions] = useState(false);
    const [logs, setLogs] = useState([]);
    const [currentExcelPath, setCurrentExcelPath] = useState('data/CLIENTES.xlsx');
    const [config, setConfig] = useState(null);
    const [showEmailConfig, setShowEmailConfig] = useState(false);
    const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);

    // Sincronizar dark mode
    useEffect(() => {
        document.documentElement.classList.toggle('dark-mode', darkMode);
    }, [darkMode]);

    // Inicializar app
    useEffect(() => {
        if (isAuthenticated) {
            initializeApp();
            setupEventListeners();
        }

        return () => {
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('login-started');
                window.electronAPI.removeAllListeners('login-completed');
                window.electronAPI.removeAllListeners('login-process-completed');
            }
        };
    }, [isAuthenticated]);

    const initializeApp = async () => {
        try {
            const configResult = await window.electronAPI.getConfig();
            if (configResult.success) {
                setConfig(configResult.config);
            }
            await loadClients();
        } catch (error) {
            addLog('Error al inicializar: ' + error.message, 'error');
        }
    };

    const setupEventListeners = () => {
        if (!window.electronAPI) return;

        window.electronAPI.onLoginStarted((event, data) => {
            addLog(`Iniciando login para ${data.empresa} (${data.ruc})`, 'info');
            updateClientStatus(data.ruc, 'processing');
        });

        window.electronAPI.onLoginCompleted((event, result) => {
            if (result.success) {
                addLog(`✓ Login exitoso: ${result.empresa} (${result.ruc})`, 'success');
                updateClientStatus(result.ruc, 'success');
                setHasActiveSessions(true);
            } else {
                addLog(`✗ Login fallido: ${result.empresa || result.ruc} - ${result.error}`, 'error');
                updateClientStatus(result.ruc, 'error');
            }
        });

        window.electronAPI.onLoginProcessCompleted(() => {
            setIsProcessing(false);
            addLog('Proceso completado', 'info');
            checkActiveSessions();

            Swal.fire({
                title: 'Proceso Completado',
                text: 'Todas las sesiones han sido procesadas',
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#2563eb'
            });
        });
    };

    const loadClients = async () => {
        try {
            addLog('Cargando clientes desde almacenamiento...', 'info');
            const result = await window.electronAPI.invoke('clients:get-all');

            if (result.success) {
                // Cargar TODOS los clientes sin filtrar por tipo
                const todosLosClientes = result.clients;
                setClients(todosLosClientes.map(client => ({ ...client, status: 'pending' })));
                addLog(`${todosLosClientes.length} clientes cargados`, 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            addLog('Error al cargar clientes: ' + error.message, 'error');
        }
    };

    // DEPRECATED: Ya no se necesita seleccionar archivo Excel
    const selectExcelFile = async () => {
        addLog('Esta función ya no está disponible. Los clientes se gestionan en "Gestión de Clientes".', 'warning');
    };

    const startLogins = async () => {
        if (selectedClients.length === 0) {
            Swal.fire({
                title: 'Atención',
                text: 'Seleccione al menos un cliente',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return;
        }

        const clientsToProcess = clients.filter(client => selectedClients.includes(client.ruc));

        try {
            setIsProcessing(true);
            setClients(prev => prev.map(client => ({
                ...client,
                status: selectedClients.includes(client.ruc) ? 'pending' : client.status
            })));

            addLog(`Iniciando proceso para ${clientsToProcess.length} clientes`, 'info');

            const result = await window.electronAPI.startLogins({
                clients: clientsToProcess,
                portalId: selectedPortal,
                options: {}
            });

            if (!result.success) throw new Error(result.error);
        } catch (error) {
            setIsProcessing(false);
            addLog('Error al iniciar: ' + error.message, 'error');
        }
    };

    const stopAllSessions = async () => {
        try {
            const result = await Swal.fire({
                title: '¿Cerrar todas las sesiones?',
                text: 'Se cerrarán todas las ventanas del navegador',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, cerrar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626'
            });

            if (result.isConfirmed) {
                const stopResult = await window.electronAPI.stopAllSessions();

                if (stopResult.success) {
                    setIsProcessing(false);
                    setHasActiveSessions(false);
                    addLog(stopResult.message, 'info');
                    setClients(prev => prev.map(client => ({ ...client, status: 'pending' })));
                }
            }
        } catch (error) {
            addLog('Error al cerrar sesiones: ' + error.message, 'error');
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
    };

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, message, type }]);
    };

    const clearLogs = () => setLogs([]);

    const handleClientSelection = (selectedRucs) => setSelectedClients(selectedRucs);

    // Renderizar contenido según página actual
    // NOTA: Todos los módulos se mantienen montados para preservar estado al cambiar de pestaña
    const renderContent = () => {
        return (
            <>
                {/* Dashboard */}
                <div style={{ display: currentPage === 'dashboard' ? 'block' : 'none' }}>
                    <DashboardPage onNavigate={setCurrentPage} />
                </div>

                {/* Login Automático */}
                <div style={{ display: currentPage === 'login-auto' ? 'block' : 'none' }}>
                    <LoginAutomaticoPage />
                </div>

                {/* Gestión de Clientes */}
                <div style={{ display: currentPage === 'clientes' ? 'block' : 'none' }}>
                    <ClientesPage />
                </div>

                {/* Consulta Facturas */}
                <div style={{ display: currentPage === 'consulta-facturas' ? 'block' : 'none' }}>
                    <ConsultaFacturaModule />
                </div>

                {/* Módulo SIRE */}
                <div style={{ display: currentPage === 'sire' ? 'block' : 'none' }}>
                    <SireModule />
                </div>

                {/* SIRE Ajustes */}
                <div style={{ display: currentPage === 'sire-ajustes' ? 'block' : 'none' }}>
                    <SireAjustesModule />
                </div>

                {/* Buzón Electrónico */}
                <div style={{ display: currentPage === 'buzon' ? 'block' : 'none' }}>
                    <BuzonElectronicoModule />
                </div>

                {/* Cálculo Tributario */}
                <div style={{ display: currentPage === 'calculo' ? 'block' : 'none' }}>
                    <TaxDashboard />
                </div>

                {/* Emitir Boletas */}
                <div style={{ display: currentPage === 'boleta' ? 'flex' : 'none', flexDirection: 'column', flex: 1, height: '100%' }}>
                    <BoletaModule />
                </div>

                {/* Configuración */}
                <div style={{ display: currentPage === 'configuracion' ? 'block' : 'none' }}>
                    <ConfiguracionPage />
                </div>

                {/* Perfil */}
                <div style={{ display: currentPage === 'profile' ? 'block' : 'none' }}>
                    <ConfiguracionPage initialTab="perfil" />
                </div>

                {/* Plan */}
                <div style={{ display: currentPage === 'plan' ? 'block' : 'none' }}>
                    <ConfiguracionPage initialTab="plan" />
                </div>
            </>
        );
    };

    // Si está cargando, mostrar loading
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh'
            }}>
                Cargando...
            </div>
        );
    }

    // Si no está autenticado, mostrar login
    if (!isAuthenticated) {
        return <LoginPage />;
    }

    // Si está autenticado, mostrar dashboard
    return (
        <>
            <DashboardLayout
                currentPage={currentPage}
                onNavigate={setCurrentPage}
            >
                {renderContent()}
            </DashboardLayout>

            {/* Modales de configuración */}
            <EmailConfigModal
                isOpen={showEmailConfig}
                onClose={() => setShowEmailConfig(false)}
                onSave={() => addLog('Configuración de email actualizada', 'success')}
            />

            <WhatsAppConfigModal
                isOpen={showWhatsAppConfig}
                onClose={() => setShowWhatsAppConfig(false)}
            />
        </>
    );
}

// Componente principal con providers
function App() {
    const [darkMode, setDarkMode] = useState(false); // Force Light Mode on startup

    return (
        <ConfigProvider
            locale={esES}
            theme={{
                algorithm: darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: theme.token,
                components: theme.components,
            }}
        >
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </ConfigProvider>
    );
}

export default App;
