import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import './SireModule.css';
import './SireHeaderStyles.css';

const SireModule = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedRuc, setSelectedRuc] = useState('');
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [proceso, setProceso] = useState('Generar RCE');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [rangoActivo, setRangoActivo] = useState(false);
  const [periodos, setPeriodos] = useState([]);
  const [archivosDescargados, setArchivosDescargados] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [diaInicio, setDiaInicio] = useState('1');
  const [diaFin, setDiaFin] = useState('31');
  const [isLoading, setIsLoading] = useState(false);

  // Estados para búsqueda de RUC
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredEmpresas, setFilteredEmpresas] = useState([]);

  useEffect(() => {
    generarPeriodos();
    cargarEmpresas();
    cargarArchivosDescargados();
  }, []);

  const generarPeriodos = () => {
    const anioInicio = 2023;
    const anioFin = 2026;
    const mesFin = 6; // Junio 2026

    const listaPeriodos = [];

    // Generar períodos desde 2023 hasta junio 2026
    for (let anio = anioInicio; anio <= anioFin; anio++) {
      const mesLimite = anio === anioFin ? mesFin : 12;

      for (let mes = 1; mes <= mesLimite; mes++) {
        const periodo = `${anio}${mes.toString().padStart(2, '0')}`;
        listaPeriodos.push(periodo);
      }
    }

    setPeriodos(listaPeriodos);
    if (listaPeriodos.length > 0) {
      setPeriodoInicio(listaPeriodos[listaPeriodos.length - 1]);
      setPeriodoFin(listaPeriodos[listaPeriodos.length - 1]);
    }
  };

  const cargarEmpresas = async () => {
    try {
      // Cargar empresas desde clientStorage (tipo SIRE)
      const result = await window.electronAPI.invoke('clients:get-all');

      if (result.success && result.clients && result.clients.length > 0) {
        // Filtrar solo clientes tipo SIRE
        const clientesSIRE = result.clients.filter(c => c.tipo === 'SIRE');

        if (clientesSIRE.length === 0) {
          console.warn('No hay clientes tipo SIRE');
          setEmpresas([]);
          alert('⚠️ No hay clientes tipo SIRE configurados\n\n' +
            'Para usar el módulo SIRE:\n' +
            '1. Ve a "Gestión de Clientes"\n' +
            '2. Crea o edita un cliente\n' +
            '3. Selecciona "Tipo: SIRE"\n' +
            '4. Agrega Client ID y Client Secret\n\n' +
            'También puedes importar tus clientes desde el Excel API_SIRE.xlsm usando el botón "Importar desde Excel".');
          return;
        }

        const empresasData = clientesSIRE.map(client => ({
          ruc: client.ruc,
          razonSocial: client.empresa
        }));

        setEmpresas(empresasData);
        setSelectedRuc(empresasData[0].ruc);
        setSelectedEmpresa(empresasData[0].razonSocial);
      } else {
        console.error('Error al cargar empresas desde storage:', result.error);
        setEmpresas([]);
        alert('⚠️ No se pudieron cargar las empresas\n\n' +
          'Error: ' + (result.error || 'Desconocido'));
      }
    } catch (error) {
      console.error('Error al cargar empresas:', error);
      setEmpresas([]);
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar empresas',
        text: error.message,
        confirmButtonColor: '#667eea'
      });
    }
  };

  const handleRucChange = (e) => {
    const ruc = e.target.value;
    setSelectedRuc(ruc);
    const empresa = empresas.find(emp => emp.ruc === ruc);
    if (empresa) {
      setSelectedEmpresa(empresa.razonSocial);
    }
  };

  // Manejar cambios en el input de búsqueda
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Filtrar empresas por RUC o nombre
    if (value.trim() === '') {
      setFilteredEmpresas(empresas);
    } else {
      const filtered = empresas.filter(emp =>
        emp.ruc.includes(value) ||
        emp.razonSocial.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredEmpresas(filtered);
    }

    setShowSuggestions(true);
  };

  // Manejar selección de empresa del dropdown
  const handleSelectEmpresa = (empresa) => {
    setSelectedRuc(empresa.ruc);
    setSelectedEmpresa(empresa.razonSocial);
    setSearchTerm(empresa.ruc); // Solo mostrar el RUC
    setShowSuggestions(false);
  };

  // Inicializar empresas filtradas cuando se cargan las empresas
  useEffect(() => {
    setFilteredEmpresas(empresas);
  }, [empresas]);

  // Cerrar sugerencias al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.ruc-search-wrapper')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const abrirExcelSire = async () => {
    try {
      const result = await window.electronAPI.abrirExcelSire();
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Excel SIRE abierto',
          text: 'El archivo se abrió correctamente',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al abrir Excel',
          text: result.error,
          confirmButtonColor: '#667eea'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#667eea'
      });
    }
  };

  const cargarArchivosDescargados = async () => {
    try {
      console.log('🔍 Cargando archivos descargados...');
      const result = await window.electronAPI.listarArchivosSire();
      console.log('📦 Resultado de listarArchivosSire:', result);

      if (result.success) {
        console.log(`✅ ${result.archivos.length} archivos encontrados`);
        setArchivosDescargados(result.archivos || []);
      } else {
        console.error('❌ Error al listar archivos:', result.error);
        setArchivosDescargados([]);
      }
    } catch (error) {
      console.error('❌ Error al cargar archivos:', error);
      setArchivosDescargados([]);
    }
  };

  const abrirArchivoDescargado = async (nombreArchivo) => {
    try {
      const result = await window.electronAPI.abrirArchivoSire(nombreArchivo);
      if (!result.success) {
        Swal.fire({
          icon: 'error',
          title: 'Error al abrir archivo',
          text: result.error,
          confirmButtonColor: '#667eea'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#667eea'
      });
    }
  };

  const eliminarArchivoDescargado = async (nombreArchivo) => {
    const confirmResult = await Swal.fire({
      icon: 'question',
      title: '¿Eliminar archivo?',
      text: `¿Está seguro de eliminar ${nombreArchivo}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (!confirmResult.isConfirmed) return;

    try {
      const result = await window.electronAPI.eliminarArchivoSire(nombreArchivo);
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Archivo eliminado',
          text: 'El archivo se eliminó correctamente',
          timer: 2000,
          showConfirmButton: false
        });
        cargarArchivosDescargados();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al eliminar',
          text: result.error,
          confirmButtonColor: '#667eea'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#667eea'
      });
    }
  };

  /**
   * Enviar archivo SIRE por Email
   */
  const handleEnviarSIREEmail = async (archivo) => {
    const { value: emailDestino } = await Swal.fire({
      title: 'Enviar por Email',
      input: 'email',
      inputLabel: 'Correo de destino',
      inputPlaceholder: 'ejemplo@correo.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      confirmButtonColor: '#667eea'
    });

    if (!emailDestino) return;

    Swal.fire({
      title: 'Enviando...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.electronAPI.invoke('email:enviar-con-adjuntos', {
        destinatario: emailDestino,
        asunto: `Archivo SIRE - ${archivo.nombreDisplay || archivo.nombre}`,
        mensaje: `Adjunto: ${archivo.nombreDisplay || archivo.nombre}\n\nTipo: ${archivo.tipo}\nRUC: ${archivo.ruc}\nPeriodo: ${formatearPeriodo(archivo.periodo)}\nFecha: ${formatearFecha(archivo.fechaCreacion)}\nTamaño: ${archivo.tamanoFormateado}`,
        archivos: [archivo.ruta]
      });

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: '✅ Enviado',
          text: `Email enviado a ${emailDestino}`,
          confirmButtonColor: '#667eea'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.error,
          confirmButtonColor: '#667eea'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#667eea'
      });
    }
  };

  /**
   * Enviar archivo SIRE por WhatsApp
   */
  const handleEnviarSIREWhatsApp = async (archivo) => {
    // Verificar WhatsApp conectado
    const statusResult = await window.electronAPI.getWhatsAppStatus();
    if (!statusResult.success || !statusResult.status.isReady) {
      Swal.fire({
        icon: 'warning',
        title: 'WhatsApp no conectado',
        text: 'Por favor conecta WhatsApp desde el botón en el header',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    const { value: phoneNumber } = await Swal.fire({
      title: 'Enviar por WhatsApp',
      input: 'text',
      inputLabel: 'Número de WhatsApp',
      inputPlaceholder: '51987654321',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      confirmButtonColor: '#667eea'
    });

    if (!phoneNumber) return;

    Swal.fire({
      title: 'Enviando...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.electronAPI.sendWhatsAppFile({
        phone: phoneNumber,
        filePath: archivo.ruta,
        caption: `📊 Archivo SIRE\n\nArchivo: ${archivo.nombreDisplay || archivo.nombre}\nTipo: ${archivo.tipo}\nRUC: ${archivo.ruc}\nPeriodo: ${formatearPeriodo(archivo.periodo)}\nFecha: ${formatearFecha(archivo.fechaCreacion)}\nTamaño: ${archivo.tamanoFormateado}`
      });

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: '✅ Enviado',
          text: 'Archivo enviado por WhatsApp',
          confirmButtonColor: '#667eea'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.error,
          confirmButtonColor: '#667eea'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#667eea'
      });
    }
  };






  const formatearFecha = (fecha) => {
    const date = new Date(fecha);
    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearPeriodo = (periodo) => {
    if (!periodo || periodo.length !== 6) return periodo;
    return `${periodo.substring(4, 6)}/${periodo.substring(0, 4)}`;
  };

  const archivosFiltrados = archivosDescargados.filter(archivo => {
    // Debug: Log para ver qué está pasando
    if (archivosDescargados.length > 0 && archivo === archivosDescargados[0]) {
      console.log('🔍 Debug filtrado:', {
        selectedRuc,
        selectedRucType: typeof selectedRuc,
        archivoRuc: archivo.ruc,
        archivoRucType: typeof archivo.ruc,
        sonIguales: String(archivo.ruc) === String(selectedRuc),
        filtroTipo
      });
    }

    // Filtrar por RUC seleccionado (convertir ambos a string para comparar)
    if (selectedRuc && String(archivo.ruc) !== String(selectedRuc)) {
      return false;
    }

    // Filtrar por tipo
    if (filtroTipo === 'TODOS') return true;
    return archivo.tipo === filtroTipo;
  });

  // Debug: Mostrar cuántos archivos quedaron después del filtrado
  console.log(`📊 Archivos después del filtrado: ${archivosFiltrados.length} de ${archivosDescargados.length}`);

  const ejecutarDescargaSire = async () => {
    if (!selectedRuc) {
      Swal.fire({
        icon: 'warning',
        title: 'RUC requerido',
        text: 'Por favor seleccione un RUC',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    if (!periodoInicio) {
      Swal.fire({
        icon: 'warning',
        title: 'Período requerido',
        text: 'Por favor seleccione un período',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    if (rangoActivo && periodoFin < periodoInicio) {
      Swal.fire({
        icon: 'error',
        title: 'Rango inválido',
        text: 'El período final no puede ser menor que el período inicial',
        confirmButtonColor: '#667eea'
      });
      return;
    }

    const datos = {
      ruc: selectedRuc,
      empresa: selectedEmpresa,
      proceso: proceso,
      periodoInicio: periodoInicio,
      periodoFin: rangoActivo ? periodoFin : periodoInicio,
      rangoActivo: rangoActivo,
      diaInicio: parseInt(diaInicio),
      diaFin: rangoActivo ? parseInt(diaFin) : parseInt(diaInicio)
    };

    try {
      setIsLoading(true);
      const result = await window.electronAPI.ejecutarSire(datos);
      setIsLoading(false);

      if (result.success) {
        // ACTUALIZAR ESTADÍSTICAS
        try {
          // Incrementamos por 1 proceso de descarga exitoso
          await window.electronAPI.invoke('user:update-stats', {
            key: 'descargasMes',
            value: 1,
            isIncrement: true
          });
        } catch (statError) {
          console.error('Error actualizando stats:', statError);
        }

        Swal.fire({
          icon: 'success',
          title: 'Proceso SIRE completado',
          html: `
            <div style="text-align: left; padding: 15px;">
              <div style="margin-bottom: 12px;">
                <strong style="color: #667eea;">📊 Registros:</strong> 
                <span style="font-size: 18px; font-weight: bold;">${result.totalRegistros}</span>
              </div>
              <div style="margin-bottom: 12px;">
                <strong style="color: #667eea;">📁 Períodos:</strong> 
                <span style="font-size: 18px; font-weight: bold;">${result.periodosProcesados}</span>
              </div>
              <div style="margin-bottom: 12px;">
                <strong style="color: #667eea;">💾 Archivo:</strong>
                <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; margin-top: 6px; font-family: monospace; font-size: 11px; word-break: break-all;">
                  ${result.excelPath}
                </div>
              </div>
            </div>
          `,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#667eea',
          width: '600px'
        });
        cargarArchivosDescargados();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error en el proceso',
          text: result.error,
          confirmButtonColor: '#667eea'
        });
      }
    } catch (error) {
      setIsLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#667eea'
      });
    }
  };

  return (
    <div className="sire-module">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Procesando descarga SIRE...</p>
          </div>
        </div>
      )}

      <div className="sire-header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Módulo SIRE - Descarga Masiva
        </h2>
        <p className="sire-subtitle">Registro de Compras y Ventas Electrónico</p>
      </div>

      <div className="sire-form">
        <div className="form-group">
          <label>Proceso:</label>
          <select
            value={proceso}
            onChange={(e) => setProceso(e.target.value)}
            className="sire-select"
          >
            <option value="Generar RCE">Generar RCE (Registro de Compras)</option>
            <option value="Generar RVIE">Generar RVIE (Registro de Ventas)</option>
          </select>
        </div>

        <div className="form-group ruc-search-container">
          <label>RUC:</label>
          <div className="ruc-search-wrapper">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Buscar por RUC o nombre de empresa..."
              className="sire-select ruc-search-input"
            />
            {showSuggestions && filteredEmpresas.length > 0 && (
              <div className="ruc-suggestions">
                {filteredEmpresas.map(emp => (
                  <div
                    key={emp.ruc}
                    className="ruc-suggestion-item"
                    onClick={() => handleSelectEmpresa(emp)}
                  >
                    <div className="suggestion-ruc">{emp.ruc}</div>
                    <div className="suggestion-nombre">{emp.razonSocial}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Razón Social:</label>
          <div className="empresa-display">{selectedEmpresa}</div>
        </div>

        <div className="form-group">
          <label>Período Inicio:</label>
          <div className="periodo-con-dia">
            <select
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="sire-select periodo-select"
            >
              {periodos.map(periodo => (
                <option key={periodo} value={periodo}>
                  {periodo.substring(0, 4)}-{periodo.substring(4, 6)}
                </option>
              ))}
            </select>
            <select
              value={diaInicio}
              onChange={(e) => setDiaInicio(e.target.value)}
              className="sire-select dia-select"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => (
                <option key={dia} value={dia}>
                  Día {dia}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rangoActivo}
              onChange={(e) => setRangoActivo(e.target.checked)}
            />
            Rango de períodos
          </label>
        </div>

        {rangoActivo && (
          <div className="form-group">
            <label>Período Fin:</label>
            <div className="periodo-con-dia">
              <select
                value={periodoFin}
                onChange={(e) => setPeriodoFin(e.target.value)}
                className="sire-select periodo-select"
              >
                {periodos.map(periodo => (
                  <option key={periodo} value={periodo}>
                    {periodo.substring(0, 4)}-{periodo.substring(4, 6)}
                  </option>
                ))}
              </select>
              <select
                value={diaFin}
                onChange={(e) => setDiaFin(e.target.value)}
                className="sire-select dia-select"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => (
                  <option key={dia} value={dia}>
                    Día {dia}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="sire-buttons">
          <button onClick={ejecutarDescargaSire} className="btn-primary" disabled={isLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isLoading ? 'Procesando...' : 'Ejecutar Descarga'}
          </button>

          <button onClick={abrirExcelSire} className="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Abrir Excel SIRE
          </button>
        </div>
      </div>

      <div className="sire-info">
        <p>💡 <strong>Nota:</strong> Este módulo descarga automáticamente los registros de compras y ventas desde SUNAT.</p>
      </div>

      <div className="sire-descargas">
        <div className="descargas-header">
          <h3>📁 Archivos Descargados</h3>
          <div className="descargas-filtros">
            <button
              className={filtroTipo === 'TODOS' ? 'filtro-activo' : ''}
              onClick={() => setFiltroTipo('TODOS')}
            >
              Todos ({archivosDescargados.length})
            </button>
            <button
              className={filtroTipo === 'RCE' ? 'filtro-activo' : ''}
              onClick={() => setFiltroTipo('RCE')}
            >
              RCE ({archivosDescargados.filter(a => a.tipo === 'RCE').length})
            </button>
            <button
              className={filtroTipo === 'RVIE' ? 'filtro-activo' : ''}
              onClick={() => setFiltroTipo('RVIE')}
            >
              RVIE ({archivosDescargados.filter(a => a.tipo === 'RVIE').length})
            </button>
            <button
              className="btn-refresh"
              onClick={cargarArchivosDescargados}
              title="Actualizar lista"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="descargas-lista">
          {archivosFiltrados.length === 0 ? (
            <div className="descargas-vacio">
              <p>📭 {archivosDescargados.length === 0
                ? 'No hay archivos descargados'
                : `No hay archivos ${filtroTipo === 'TODOS' ? '' : filtroTipo + ' '}para el RUC seleccionado`}
              </p>
              <p className="texto-secundario">
                {archivosDescargados.length === 0
                  ? 'Usa "EJECUTAR DESCARGA" para descargar archivos SIRE'
                  : 'Prueba seleccionando otro RUC o cambiando el filtro'}
              </p>
            </div>
          ) : (
            <div className="descargas-grid">
              {archivosFiltrados.map((archivo, index) => (
                <div key={index} className="descarga-card">
                  <div className="descarga-tipo">
                    <span className={`tipo-badge ${archivo.tipo.toLowerCase()}`}>
                      {archivo.tipo}
                    </span>
                  </div>
                  <div className="descarga-info">
                    <div className="descarga-ruc">
                      <strong>RUC:</strong> {archivo.ruc}
                    </div>
                    <div className="descarga-periodo">
                      <strong>Período:</strong> {formatearPeriodo(archivo.periodo)}
                    </div>
                    <div className="descarga-fecha">
                      <strong>Descargado:</strong> {formatearFecha(archivo.fechaCreacion)}
                    </div>
                    <div className="descarga-tamano">
                      <strong>Tamaño:</strong> {archivo.tamanoFormateado}
                    </div>
                  </div>
                  <div className="descarga-acciones">
                    <button
                      className="btn-abrir"
                      onClick={() => abrirArchivoDescargado(archivo.nombre)}
                      title="Abrir archivo"
                    >
                      📂 Abrir
                    </button>
                    <button
                      className="btn-email"
                      onClick={() => handleEnviarSIREEmail(archivo)}
                      title="Enviar por Gmail"
                      style={{ padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      ✉️
                    </button>
                    <button
                      className="btn-whatsapp"
                      onClick={() => handleEnviarSIREWhatsApp(archivo)}
                      title="Enviar por WhatsApp"
                      style={{ padding: '8px 12px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      📱
                    </button>
                    <button
                      className="btn-eliminar"
                      onClick={() => eliminarArchivoDescargado(archivo.nombre)}
                      title="Eliminar archivo"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SireModule;
