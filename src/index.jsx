import React from 'react'
import ReactDOM from 'react-dom/client'

// Import API Bridge FIRST - this injects window.electronAPI
import './services/apiBridge'

import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)