// Frontend service for client management
// Communicates with backend IPC handlers

const clientService = {
    // Get all clients from storage
    getAll: async () => {
        try {
            const result = await window.electronAPI.invoke('clients:get-all');
            return result;
        } catch (error) {
            console.error('Error getting clients:', error);
            return { success: false, error: error.message };
        }
    },

    // Get single client by RUC
    get: async (ruc) => {
        try {
            const result = await window.electronAPI.invoke('clients:get', ruc);
            return result;
        } catch (error) {
            console.error('Error getting client:', error);
            return { success: false, error: error.message };
        }
    },

    // Add new client
    add: async (clientData) => {
        try {
            const result = await window.electronAPI.invoke('clients:add', clientData);
            return result;
        } catch (error) {
            console.error('Error adding client:', error);
            return { success: false, error: error.message };
        }
    },

    // Update existing client
    update: async (ruc, clientData) => {
        try {
            const result = await window.electronAPI.invoke('clients:update', ruc, clientData);
            return result;
        } catch (error) {
            console.error('Error updating client:', error);
            return { success: false, error: error.message };
        }
    },

    // Delete client
    delete: async (ruc) => {
        try {
            const result = await window.electronAPI.invoke('clients:delete', ruc);
            return result;
        } catch (error) {
            console.error('Error deleting client:', error);
            return { success: false, error: error.message };
        }
    },

    // Search clients
    search: async (query) => {
        try {
            const result = await window.electronAPI.invoke('clients:search', query);
            return result;
        } catch (error) {
            console.error('Error searching clients:', error);
            return { success: false, error: error.message };
        }
    },

    // Import from Excel file (web version)
    importExcel: async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const token = localStorage.getItem('authToken') || '';
            const response = await fetch('/api/upload/clients-excel', {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error importing from Excel:', error);
            return { success: false, error: error.message };
        }
    },

    // Get statistics
    getStats: async () => {
        try {
            const result = await window.electronAPI.invoke('clients:stats');
            return result;
        } catch (error) {
            console.error('Error getting stats:', error);
            return { success: false, error: error.message };
        }
    }
};

export default clientService;
