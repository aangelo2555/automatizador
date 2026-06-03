import React, { useState, useMemo } from 'react';

const ClientTable = ({ clients, selectedClients, onSelectionChange, isProcessing }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const searchLower = searchTerm.toLowerCase().trim();
    return clients.filter(client =>
      client.ruc.includes(searchLower) ||
      client.empresa.toLowerCase().includes(searchLower)
    );
  }, [clients, searchTerm]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange([...new Set([...selectedClients, ...filteredClients.map(c => c.ruc)])]);
    } else {
      const filteredRucs = filteredClients.map(c => c.ruc);
      onSelectionChange(selectedClients.filter(ruc => !filteredRucs.includes(ruc)));
    }
  };

  const handleClientSelect = (ruc, checked) => {
    if (checked) {
      onSelectionChange([...selectedClients, ruc]);
    } else {
      onSelectionChange(selectedClients.filter(r => r !== ruc));
    }
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pendiente',
      processing: 'Procesando',
      success: 'Exitoso',
      error: 'Error'
    };
    return texts[status] || status;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        );
      case 'success':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'error':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  const filteredRucs = filteredClients.map(c => c.ruc);
  const selectedFilteredCount = selectedClients.filter(ruc => filteredRucs.includes(ruc)).length;
  const isAllSelected = filteredClients.length > 0 && selectedFilteredCount === filteredClients.length;
  const isIndeterminate = selectedFilteredCount > 0 && selectedFilteredCount < filteredClients.length;

  return (
    <div className="client-table">
      <div className="table-header">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Clientes ({clients.length})
        </h3>
        <div className="header-actions">
          <div className="search-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              pointerEvents: 'none'
            }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por RUC o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isProcessing}
              style={{ paddingLeft: '42px' }}
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')} title="Limpiar búsqueda">✕</button>
            )}
          </div>
          {searchTerm && (
            <span className="search-results">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {filteredClients.length} encontrados
            </span>
          )}
          <div className="select-all-container">
            <input
              type="checkbox"
              id="select-all"
              checked={isAllSelected}
              ref={input => { if (input) input.indeterminate = isIndeterminate; }}
              onChange={handleSelectAll}
              disabled={isProcessing || filteredClients.length === 0}
            />
            <label htmlFor="select-all">Seleccionar todos</label>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="clients-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th style={{ width: '50px' }}>N°</th>
              <th>Empresa</th>
              <th style={{ width: '120px' }}>RUC</th>
              <th style={{ width: '100px' }}>Usuario</th>
              <th style={{ width: '140px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.ruc}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.ruc)}
                    onChange={(e) => handleClientSelect(client.ruc, e.target.checked)}
                    disabled={isProcessing}
                    style={{ accentColor: '#667eea', width: '18px', height: '18px' }}
                  />
                </td>
                <td style={{ fontWeight: '700', color: '#6b7280' }}>{client.numero}</td>
                <td style={{
                  maxWidth: '250px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: '600'
                }} title={client.empresa}>
                  {client.empresa}
                </td>
                <td style={{
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#667eea'
                }}>
                  {client.ruc}
                </td>
                <td style={{ fontWeight: '600', color: '#4b5563' }}>{client.usuario}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className={`status-indicator status-${client.status}`}></span>
                    {getStatusIcon(client.status)}
                    <span style={{ fontWeight: '600' }}>{getStatusText(client.status)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {clients.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 20px', display: 'block', opacity: 0.3 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p style={{ fontWeight: '700', marginBottom: '10px', fontSize: '16px' }}>No hay clientes cargados</p>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>Seleccione un archivo Excel o cree uno de ejemplo</p>
          </div>
        )}

        {clients.length > 0 && filteredClients.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 20px', display: 'block', opacity: 0.3 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p style={{ fontWeight: '700', fontSize: '16px' }}>No se encontraron resultados</p>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>
              No hay coincidencias para "<strong>{searchTerm}</strong>"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientTable;
