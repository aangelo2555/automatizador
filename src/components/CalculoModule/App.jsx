/**
 * App.jsx - Componente raíz de la aplicación
 * 
 * Hub Fiscal 360° - Sistema de Cálculo Tributario SUNAT 2026
 */

import React from 'react';
import { TaxDashboard } from './components/TaxDashboard';
import './App.css';

function App() {
    return (
        <div className="app">
            <TaxDashboard />
        </div>
    );
}

export default App;
