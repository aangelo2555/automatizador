import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, setToken } from '../services/apiBridge';

/**
 * AuthContext - JWT-based authentication for web environment
 * Replaces Electron's IPC-based auth with HTTP/JWT calls via apiBridge
 */

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser usado dentro de AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentEmails, setRecentEmails] = useState([]);

    // Initialize authentication - check for existing JWT token
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = getToken();
                
                if (token) {
                    // Verify existing token
                    const result = await window.electronAPI.authCheckFlag();
                    if (result.success && result.authenticated) {
                        // Token is valid, restore user session
                        const savedUser = localStorage.getItem('currentUser');
                        if (savedUser) {
                            const userData = JSON.parse(savedUser);
                            setUser(userData);
                            setIsAuthenticated(true);
                        } else if (result.user) {
                            setUser(result.user);
                            setIsAuthenticated(true);
                            localStorage.setItem('currentUser', JSON.stringify(result.user));
                        }
                    } else {
                        // Token expired or invalid
                        setToken(null);
                        localStorage.removeItem('currentUser');
                        localStorage.removeItem('userPlan');
                    }
                }

                // Load recent emails for login form autocomplete
                await loadRecentEmails();
            } catch (error) {
                console.error('Error al inicializar auth:', error);
                setToken(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Load recent emails
    const loadRecentEmails = async () => {
        try {
            if (window.electronAPI?.authGetRecentEmails) {
                const result = await window.electronAPI.authGetRecentEmails();
                if (result.success) {
                    setRecentEmails(result.emails || []);
                }
            }
        } catch (error) {
            console.error('Error al cargar emails recientes:', error);
        }
    };

    // Login with JWT
    const login = async (email, password) => {
        try {
            if (!window.electronAPI?.authLogin) {
                throw new Error('API de autenticación no disponible');
            }

            const result = await window.electronAPI.authLogin({ email, password });

            if (result.success) {
                const userData = result.user;
                localStorage.setItem('currentUser', JSON.stringify(userData));
                localStorage.setItem('userPlan', userData.plan || 'basico');
                setUser(userData);
                setIsAuthenticated(true);
                await loadRecentEmails();
                return { success: true, user: userData };
            }

            return { success: false, error: result.error || 'Credenciales incorrectas' };
        } catch (error) {
            console.error('Error en login:', error);
            return { success: false, error: error.message };
        }
    };

    // Register with secret key and plan
    const register = async (name, email, password, secretKey, plan = 'basico') => {
        try {
            if (!window.electronAPI?.authRegister) {
                throw new Error('API de autenticación no disponible');
            }

            const result = await window.electronAPI.authRegister({
                name,
                email,
                password,
                secretKey,
                plan
            });

            if (result.success) {
                localStorage.setItem('userPlan', plan.toLowerCase());
            }

            return result;
        } catch (error) {
            console.error('Error en registro:', error);
            return { success: false, error: error.message };
        }
    };

    // Logout
    const logout = async () => {
        try {
            if (window.electronAPI?.authLogout) {
                await window.electronAPI.authLogout();
            }
            setToken(null);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userPlan');
            setUser(null);
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Error en logout:', error);
        }
    };

    const value = {
        isAuthenticated,
        user,
        loading,
        recentEmails,
        login,
        register,
        logout,
        loadRecentEmails,

        // Helpers
        get userName() {
            return user?.name || 'Usuario';
        },
        get userEmail() {
            return user?.email || '';
        }
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
