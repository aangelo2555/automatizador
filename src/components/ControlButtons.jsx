import React from 'react';

const ControlButtons = ({
  onStartLogins,
  onStopSessions,
  onSelectFile,
  onCreateExample,
  isProcessing,
  hasActiveSessions,
  selectedCount
}) => {
  return (
    <div className="control-buttons">
      <button
        className="btn-primary"
        onClick={onStartLogins}
        disabled={isProcessing || selectedCount === 0}
        title={selectedCount === 0 ? 'Seleccione al menos un cliente' : 'Iniciar sesiones de login'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {isProcessing ? (
            <circle cx="12" cy="12" r="10">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          ) : (
            <polygon points="5 3 19 12 5 21 5 3" />
          )}
        </svg>
        {isProcessing ? 'Procesando...' : 'Iniciar Sesiones'}
      </button>

      <button
        className="btn-danger"
        onClick={onStopSessions}
        disabled={!hasActiveSessions}
        title={hasActiveSessions ? 'Cerrar todas las ventanas del navegador' : 'No hay sesiones activas para cerrar'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        Cerrar Sesiones
      </button>

      <button
        className="btn-secondary"
        onClick={onSelectFile}
        disabled={isProcessing}
        title="Seleccionar archivo Excel con clientes"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Seleccionar Excel
      </button>

      {selectedCount > 0 && (
        <div className="selected-count">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ControlButtons;
