// Configuración de planes del sistema
export const PLANES = {
  BASICO: {
    id: 'basico',
    nombre: 'Básico',
    descripcion: 'Plan básico para contadores pequeños',
    color: '#1890ff',
    caracteristicas: [
      'Hasta 10 clientes RUC',
      'Consulta de facturas',
      'Login automático SUNAT',
      'Soporte por email'
    ],
    limites: {
      maxClientes: 10,
      consultasMensuales: 500,
      sireEnabled: false,
      buzonEnabled: true,
      whatsappEnabled: false
    }
  },
  VIP: {
    id: 'vip',
    nombre: 'VIP',
    descripcion: 'Plan ideal para contadores profesionales',
    color: '#722ed1',
    caracteristicas: [
      'Hasta 50 clientes RUC',
      'Todas las funciones de Básico',
      'Módulo SIRE completo',
      'Buzón electrónico',
      'Soporte prioritario'
    ],
    limites: {
      maxClientes: 50,
      consultasMensuales: 5000,
      sireEnabled: true,
      buzonEnabled: true,
      whatsappEnabled: true
    }
  },
  PREMIUM: {
    id: 'premium',
    nombre: 'Premium',
    descripcion: 'Plan completo para estudios contables',
    color: '#faad14',
    caracteristicas: [
      'Clientes ilimitados',
      'Todas las funciones',
      'Módulo SIRE + Ajustes',
      'WhatsApp integrado',
      'Procesamiento paralelo 10x',
      'Soporte 24/7'
    ],
    limites: {
      maxClientes: Infinity,
      consultasMensuales: Infinity,
      sireEnabled: true,
      buzonEnabled: true,
      whatsappEnabled: true,
      ajustesPosterioresEnabled: true,
      maxBrowsersConcurrentes: 10
    }
  }
};

// Helper para obtener plan actual del usuario
export const getCurrentUserPlan = () => {
  const savedPlan = localStorage.getItem('userPlan');
  return savedPlan || 'basico';
};

// Helper para actualizar plan del usuario
export const setCurrentUserPlan = (planId) => {
  if (!PLANES[planId.toUpperCase()]) {
    throw new Error(`Plan inválido: ${planId}`);
  }
  localStorage.setItem('userPlan', planId.toLowerCase());
};

// Helper para verificar si el usuario puede acceder a una función
export const canAccessFeature = (feature) => {
  const currentPlan = getCurrentUserPlan();
  const plan = PLANES[currentPlan.toUpperCase()];
  
  switch(feature) {
    case 'sire':
      return plan.limites.sireEnabled;
    case 'buzon':
      return plan.limites.buzonEnabled;
    case 'whatsapp':
      return plan.limites.whatsappEnabled;
    case 'ajustes-posteriores':
      return plan.limites.ajustesPosterioresEnabled || false;
    default:
      return true;
  }
};

// Helper para verificar límite de clientes
export const canAddMoreClients = (currentClientCount) => {
  const currentPlan = getCurrentUserPlan();
  const plan = PLANES[currentPlan.toUpperCase()];
  return currentClientCount < plan.limites.maxClientes;
};

// Helper para obtener info del plan actual
export const getCurrentPlanInfo = () => {
  const currentPlan = getCurrentUserPlan();
  return PLANES[currentPlan.toUpperCase()];
};
