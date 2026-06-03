/**
 * ClientSelector - Selector de cliente para el módulo de Cálculo Tributario
 * 
 * Dropdown para seleccionar el cliente cuyos datos tributarios se mostrarán.
 */

import React, { useState, useEffect, useCallback } from 'react';
import clientService from '../../../../services/clientService';
import styles from './TaxDashboard.module.css';

const ClientSelector = ({ selectedClient, onClientChange, onClientsLoad }) => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Cargar clientes al montar
    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        setLoading(true);
        try {
            const result = await clientService.getAll();
            if (result.success) {
                setClients(result.clients || []);
                if (onClientsLoad) {
                    onClientsLoad(result.clients || []);
                }
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filtrar clientes por búsqueda
    const filteredClients = clients.filter(client => {
        const term = searchTerm.toLowerCase();
        return (
            client.ruc.includes(term) ||
            client.empresa.toLowerCase().includes(term)
        );
    });

    // Manejar selección de cliente
    const handleSelect = useCallback((client) => {
        onClientChange(client);
        setIsOpen(false);
        setSearchTerm('');
    }, [onClientChange]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest(`.${styles.clientSelectorContainer}`)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={styles.clientSelectorContainer}>
            <label className={styles.clientSelectorLabel}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
                Cliente
            </label>

            <div
                className={`${styles.clientSelectorDropdown} ${isOpen ? styles.open : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={styles.clientSelectorValue}>
                    {loading ? (
                        <span className={styles.loadingText}>Cargando...</span>
                    ) : selectedClient ? (
                        <>
                            <span className={styles.clientRuc}>{selectedClient.ruc}</span>
                            <span className={styles.clientName}>{selectedClient.empresa}</span>
                        </>
                    ) : (
                        <span className={styles.placeholderText}>Seleccionar cliente...</span>
                    )}
                </div>

                <svg
                    className={styles.dropdownArrow}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>

            {isOpen && (
                <div className={styles.clientSelectorMenu}>
                    <div className={styles.searchInputWrapper}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por RUC o empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={styles.searchInput}
                            autoFocus
                        />
                    </div>

                    <div className={styles.clientList}>
                        {filteredClients.length === 0 ? (
                            <div className={styles.noClients}>
                                {searchTerm ? 'No se encontraron resultados' : 'No hay clientes registrados'}
                            </div>
                        ) : (
                            filteredClients.map((client) => (
                                <div
                                    key={client.ruc}
                                    className={`${styles.clientItem} ${selectedClient?.ruc === client.ruc ? styles.selected : ''
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(client);
                                    }}
                                >
                                    <span className={styles.clientItemRuc}>{client.ruc}</span>
                                    <span className={styles.clientItemName}>{client.empresa}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientSelector;
