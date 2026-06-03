// Tema y configuración de diseño para Ant Design
export const theme = {
    // Paleta de colores moderna 2025
    colors: {
        primary: '#1890ff',
        secondary: '#722ed1',
        success: '#52c41a',
        warning: '#faad14',
        error: '#ff4d4f',
        info: '#13c2c2',

        // Gradientes
        gradientPrimary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        gradientSecondary: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        gradientSuccess: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',

        // Fondos
        bgLight: '#f0f2f5',
        bgDark: '#141414',
        bgCard: '#ffffff',
        bgCardDark: '#1f1f1f',

        // Bordes
        border: '#d9d9d9',
        borderDark: '#434343',
    },

    // Configuración de Ant Design
    token: {
        colorPrimary: '#1890ff',
        colorSuccess: '#52c41a',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        colorInfo: '#13c2c2',

        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 14,

        // Espaciado
        marginXS: 8,
        marginSM: 12,
        margin: 16,
        marginMD: 20,
        marginLG: 24,
        marginXL: 32,

        // Sombras
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.12)',
    },

    // Configuración tema oscuro
    darkToken: {
        colorBgContainer: '#1f1f1f',
        colorBgElevated: '#141414',
        colorBorder: '#434343',
        colorText: 'rgba(255, 255, 255, 0.85)',
        colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    },

    // Configuración de componentes
    components: {
        Layout: {
            headerBg: '#001529',
            headerHeight: 64,
            siderBg: '#001529',
        },
        Menu: {
            darkItemBg: '#001529',
            darkItemSelectedBg: '#1890ff',
        },
        Card: {
            borderRadiusLG: 12,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        },
        Button: {
            borderRadius: 8,
            controlHeight: 40,
            fontWeight: 500,
        },
        Table: {
            borderRadius: 8,
            headerBg: '#fafafa',
        }
    }
};

// Configuración de animaciones
export const animations = {
    // Duración
    fast: '0.2s',
    normal: '0.3s',
    slow: '0.5s',

    // Easings
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',

    // Presets de Framer Motion
    fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 }
    },
    slideUp: {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.3 }
    },
    scaleIn: {
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.9 },
        transition: { duration: 0.2 }
    }
};

// Breakpoints responsive
export const breakpoints = {
    xs: 480,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1600,
};

// Helper para media queries
export const mediaQuery = {
    xs: `@media (max-width: ${breakpoints.xs}px)`,
    sm: `@media (max-width: ${breakpoints.sm}px)`,
    md: `@media (max-width: ${breakpoints.md}px)`,
    lg: `@media (max-width: ${breakpoints.lg}px)`,
    xl: `@media (max-width: ${breakpoints.xl}px)`,
    xxl: `@media (max-width: ${breakpoints.xxl}px)`,
};
