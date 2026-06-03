import { useState, useEffect, useRef } from 'react';
import './SireAjustesModule.css';
import './SireHeaderStyles.css';
import './SireAjustesHeaderFix.css';
import './SireAjustesLayoutFix.css';
import './SireAjustesAlertsFix.css';

// Componente para la vista de RVIE COMPLEMENTA - TABLA UNIFICADA 57 COLUMNAS
const RvieComplementaView = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, archivosOutput, onCargarDesdeOutput, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [correlativo, setCorrelativo] = useState('01'); // N° Correlativo para el nombre del archivo (2 dígitos)
  const [showArchivoSelector, setShowArchivoSelector] = useState(false);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);

  // Inicializar datos editables cuando cambian los datos de la hoja
  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RVIE COMPLEMENTA:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RVIE COMPLEMENTA',
        datosEmpresa
      );

      // Agregar valores por defecto para campos faltantes
      const camposDefault = {
        col4_carSunat: '', col5_fecEmision: '', col6_fecVence: '', col7_tipo: '',
        col8_serie: '', col9_numInicial: '', col10_numFinal: '', col11_tipoDoc: '',
        col12_numDocCliente: '', col13_razonSocialCliente: '', col14_valorExportacion: '',
        col15_baseImponibleGravada: '', col16_descuentoBaseImponible: '', col17_igvIpm: '',
        col18_descuentoIgvIpm: '', col19_operacionExonerada: '', col20_operacionInafecta: '',
        col21_isc: '', col22_baseImponibleIvap: '', col23_ivap: '', col24_icbper: '',
        col25_otrosTributos: '', col26_importeTotal: '', col27_codigoMoneda: 'PEN',
        col28_tipoCambio: '', col29_fecEmisionRef: '', col30_tipoRef: '', col31_serieRef: '',
        col32_numeroRef: '', col33_identificacionContrato: '', col34_tipoNcNd: '',
        col35_estadoComprobante: '', col36_usoInterno: '', col37_valorOpGratuitas: '',
        col38_tipoOperacion: '', col39_inconsistencias: '', col40_usoInternoSunat: ''
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RVIE COMPLEMENTA:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  // Función para crear datos de ejemplo con 57 columnas según estructura SUNAT
  const crearDatosEjemplo = () => {
    const rucEmpresa = datosEmpresa?.ruc || '10062237584';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || 'GUTIERREZ';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '08').padStart(2, '0')}`;

    return [{
      // ID
      id: '01',
      // 1-2: Datos del Generador o Sujeto Obligado
      col1_ruc: rucEmpresa,                    // 1 - RUC (11 caracteres)
      col2_razonSocial: razonSocialEmpresa,    // 2 - Nombres y Apellidos y/o Razón Social (1500 caracteres)
      // 3-4: Periodo y CAR
      col3_periodo: periodo,                    // 3 - Periodo YYYYMM (6 caracteres)
      col4_carSunat: '',                        // 4 - CAR - SUNAT Tabla 7 (27 caracteres, ej: 1045751207001E0010000000193)
      // 5-11: Datos del Comprobante de pago
      col5_fecEmision: '',                      // 5 - Fec. Emisión (dd/mm/yyyy)
      col6_fecVence: '',                        // 6 - Fec. Vence (dd/mm/yyyy)
      col7_tipo: '01',                          // 7 - Tipo (01=Factura, 03=Boleta)
      col8_serie: 'F001',                       // 8 - Serie (4 caracteres)
      col9_numInicial: '',                      // 9 - Num Inicial (8 caracteres)
      col10_numFinal: '',                       // 10 - Num Final (8 caracteres)
      col11_tipoDoc: '6',                       // 11 - Tipo Doc (6=RUC, 1=DNI)
      // 12-13: Datos del Cliente
      col12_numDocCliente: '',                  // 12 - Número Doc (15 caracteres)
      col13_razonSocialCliente: '',             // 13 - Apellidos y Nombres y/o Razón Social
      // 14-21: Valores monetarios
      col14_valorExportacion: '',               // 14 - Valor Facturado de la Exportación
      col15_baseImponibleGravada: '',           // 15 - Base Imponible de la operación Gravada
      col16_descuentoBaseImponible: '',         // 16 - Descuento de Base Imponible
      col17_igvIpm: '',                         // 17 - IGV / IPM
      col18_descuentoIgvIpm: '',                // 18 - Descuento del IGV y/o IPM
      col19_operacionExonerada: '',             // 19 - Operación Exonerada
      col20_operacionInafecta: '',              // 20 - Operación Inafecta
      col21_isc: '',                            // 21 - ISC
      // 22-28: Más valores y moneda
      col22_baseImponibleIvap: '',              // 22 - Base Imponible Operación Gravada IVAP
      col23_ivap: '',                           // 23 - IVAP
      col24_icbper: '',                         // 24 - ICBPER
      col25_otrosTributos: '',                  // 25 - Otros Tributos, Cargos y Descuentos
      col26_importeTotal: '',                   // 26 - Importe Total
      col27_codigoMoneda: 'PEN',                // 27 - Código Moneda (PEN/USD)
      col28_tipoCambio: '',                     // 28 - Tipo de Cambio
      // 29-32: Documento de Referencia o que modifica
      col29_fecEmisionRef: '',                  // 29 - Fec. Emisión
      col30_tipoRef: '',                        // 30 - Tipo
      col31_serieRef: '',                       // 31 - Serie
      col32_numeroRef: '',                      // 32 - Número
      // 33-36: Identificación y estados
      col33_identificacionContrato: '',         // 33 - Identificación del contrato
      col34_tipoNcNd: '',                       // 34 - Tipo NC o ND
      col35_estadoComprobante: '',              // 35 - Estado Comprobante de pago
      col36_usoInterno: '',                     // 36 - Uso interno
      // 37-40: Valores adicionales
      col37_valorOpGratuitas: '',               // 37 - Valor OP Gratuitas
      col38_tipoOperacion: '',                  // 38 - Tipo Operación
      col39_inconsistencias: '',                // 39 - Inconsistencias
      col40_usoInternoSunat: '',                // 40 - Uso interno SUNAT
      // 41-57: Libre Utilización
      col41_libre: '', col42_libre: '', col43_libre: '', col44_libre: '',
      col45_libre: '', col46_libre: '', col47_libre: '', col48_libre: '',
      col49_libre: '', col50_libre: '', col51_libre: '', col52_libre: '',
      col53_libre: '', col54_libre: '', col55_libre: '', col56_libre: '', col57_libre: ''
    }];
  };

  // Actualizar celda
  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) =>
      idx === rowIndex ? { ...row, [field]: value } : row
    ));
  };

  // Agregar fila
  const addRow = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_ruc: rucEmpresa, col2_razonSocial: razonSocialEmpresa,
      col3_periodo: periodo, col4_carSunat: '',
      col5_fecEmision: '', col6_fecVence: '', col7_tipo: '', col8_serie: '',
      col9_numInicial: '', col10_numFinal: '', col11_tipoDoc: '',
      col12_numDocCliente: '', col13_razonSocialCliente: '',
      col14_valorExportacion: '', col15_baseImponibleGravada: '', col16_descuentoBaseImponible: '',
      col17_igvIpm: '', col18_descuentoIgvIpm: '', col19_operacionExonerada: '',
      col20_operacionInafecta: '', col21_isc: '',
      col22_baseImponibleIvap: '', col23_ivap: '', col24_icbper: '',
      col25_otrosTributos: '', col26_importeTotal: '', col27_codigoMoneda: 'PEN', col28_tipoCambio: '',
      col29_fecEmisionRef: '', col30_tipoRef: '', col31_serieRef: '', col32_numeroRef: '',
      col33_identificacionContrato: '', col34_tipoNcNd: '', col35_estadoComprobante: '', col36_usoInterno: '',
      col37_valorOpGratuitas: '', col38_tipoOperacion: '', col39_inconsistencias: '', col40_usoInternoSunat: '',
      col41_libre: '', col42_libre: '', col43_libre: '', col44_libre: '', col45_libre: '',
      col46_libre: '', col47_libre: '', col48_libre: '', col49_libre: '', col50_libre: '',
      col51_libre: '', col52_libre: '', col53_libre: '', col54_libre: '', col55_libre: '',
      col56_libre: '', col57_libre: ''
    };
    setEditableData(prev => [...prev, newRow]);
  };

  // Eliminar fila
  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  // Guardar datos
  const guardarDatos = async () => {
    if (!editableData || editableData.length === 0) {
      alert('No hay datos para guardar');
      return;
    }
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RVIE COMPLEMENTA',
        datosEditados: { datosUnificados: editableData }
      });
      if (result.success) {
        alert(`✅ ${result.message}\nFilas guardadas: ${result.filasGuardadas || editableData.length}`);
      } else {
        alert(`❌ Error al guardar: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error de comunicación: ${error.message}`);
    }
  };

  // Completar datos
  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  // Generar archivo TXT y ZIP desde los datos de la tabla
  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla para generar el archivo');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino primero');
      return;
    }
    // Llamar a onGenerarArchivo pasando los datos de la tabla y el correlativo
    console.log('Generando archivo con correlativo:', correlativo);
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { correlativo: correlativo });
    }
  };

  // Cargar datos desde archivo XLSX del output
  const cargarDesdeArchivo = async (nombreArchivo) => {
    try {
      setCargandoArchivo(true);
      const result = await window.electronAPI.invoke('leer-archivo-xlsx-output', {
        nombreArchivo,
        ruc: datosEmpresa.ruc
      });

      if (result.success && result.hojas) {
        // Obtener la primera hoja con datos
        const primeraHoja = result.nombresHojas[0];
        const datosHoja = result.hojas[primeraHoja];

        if (datosHoja && datosHoja.rows && datosHoja.rows.length > 0) {
          // Los datos empiezan en la fila 5 (índice 4 después de headers)
          // Fila 1: Periodo, Fila 2: RUC, Fila 3: Empresa, Fila 4: Headers, Fila 5+: Datos
          const filaDatos = datosHoja.rows.length > 3 ? datosHoja.rows.slice(3) : datosHoja.rows;

          // Mapear los datos del XLSX a la estructura de la tabla
          const datosConvertidos = filaDatos.map((row, idx) => ({
            id: String(idx + 1).padStart(2, '0'),
            col1_ruc: row[0] || datosEmpresa?.ruc || '',
            col2_razonSocial: row[1] || datosEmpresa?.razonSocial || '',
            col3_periodo: row[2] || `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`,
            col4_carSunat: row[3] || '',
            col5_fecEmision: row[4] || '',
            col6_fecVence: row[5] || '',
            col7_tipo: row[6] || '',
            col8_serie: row[7] || '',
            col9_numInicial: row[8] || '',
            col10_numFinal: row[9] || '',
            col11_tipoDoc: row[10] || '',
            col12_numDocCliente: row[11] || '',
            col13_razonSocialCliente: row[12] || '',
            col14_valorExportacion: row[13] || '',
            col15_baseImponibleGravada: row[14] || '',
            col16_descuentoBaseImponible: row[15] || '',
            col17_igvIpm: row[16] || '',
            col18_descuentoIgvIpm: row[17] || '',
            col19_operacionExonerada: row[18] || '',
            col20_operacionInafecta: row[19] || '',
            col21_isc: row[20] || '',
            col22_baseImponibleIvap: row[21] || '',
            col23_ivap: row[22] || '',
            col24_icbper: row[23] || '',
            col25_otrosTributos: row[24] || '',
            col26_importeTotal: row[25] || '',
            col27_codigoMoneda: row[26] || 'PEN',
            col28_tipoCambio: row[27] || '',
            col29_fecEmisionRef: row[28] || '',
            col30_tipoRef: row[29] || '',
            col31_serieRef: row[30] || '',
            col32_numeroRef: row[31] || '',
            col33_identificacionContrato: row[32] || '',
            col34_tipoNcNd: row[33] || '',
            col35_estadoComprobante: row[34] || '',
            col36_usoInterno: row[35] || '',
            col37_valorOpGratuitas: row[36] || '',
            col38_tipoOperacion: row[37] || '',
            col39_inconsistencias: row[38] || '',
            col40_usoInternoSunat: row[39] || '',
            col41_libre: row[40] || '', col42_libre: row[41] || '', col43_libre: row[42] || '',
            col44_libre: row[43] || '', col45_libre: row[44] || '', col46_libre: row[45] || '',
            col47_libre: row[46] || '', col48_libre: row[47] || '', col49_libre: row[48] || '',
            col50_libre: row[49] || '', col51_libre: row[50] || '', col52_libre: row[51] || '',
            col53_libre: row[52] || '', col54_libre: row[53] || '', col55_libre: row[54] || '',
            col56_libre: row[55] || '', col57_libre: row[56] || ''
          })).filter(row => row.col1_ruc || row.col4_carSunat || row.col5_fecEmision); // Filtrar filas vacías

          if (datosConvertidos.length > 0) {
            setEditableData(datosConvertidos);
            alert(`✅ Se cargaron ${datosConvertidos.length} registros desde ${nombreArchivo}`);
          } else {
            alert('⚠️ El archivo no contiene datos válidos para cargar');
          }
        } else {
          alert('⚠️ El archivo está vacío o no tiene el formato esperado');
        }
      } else {
        alert(`❌ Error al leer archivo: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      alert(`❌ Error al cargar archivo: ${error.message}`);
    } finally {
      setCargandoArchivo(false);
      setShowArchivoSelector(false);
    }
  };

  // Obtener archivos RVIE filtrados por RUC
  const getArchivosRVIE = () => {
    if (!archivosOutput || !datosEmpresa?.ruc) return [];
    return archivosOutput.filter(archivo =>
      archivo.nombre.includes(datosEmpresa.ruc) &&
      archivo.nombre.toUpperCase().includes('RVIE') &&
      ['.xlsx', '.xls', '.xlsm'].includes(archivo.tipo?.toLowerCase())
    );
  };

  return (
    <div className="rvie-complementa-view">
      {/* Header con datos de empresa y correlativo */}
      <div className="rvie-header">
        <div className="empresa-info">
          <div className="info-item"><strong>EMPRESA:</strong> {datosEmpresa?.ruc || ''} - {datosEmpresa?.razonSocial || 'Sin razón social'}</div>
          <div className="info-item"><strong>PERIODO:</strong> {datosEmpresa?.anio || ''}{(datosEmpresa?.mes || '').padStart(2, '0')}</div>
          <div className="info-item">
            <strong>N° CORRELATIVO:</strong>
            <input
              type="text"
              value={correlativo}
              onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={(e) => {
                // Al perder foco, formatear con padding si es necesario
                const val = e.target.value.replace(/\D/g, '');
                if (val.length === 1) {
                  setCorrelativo(val.padStart(2, '0'));
                } else if (val.length === 0) {
                  setCorrelativo('01');
                }
              }}
              className="correlativo-input"
              maxLength="2"
              placeholder="01"
              style={{ width: '50px', marginLeft: '8px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}
            />
          </div>
        </div>
      </div>

      {/* Selector de archivos para cargar */}
      {showArchivoSelector && (
        <div className="archivo-selector-overlay">
          <div className="archivo-selector-modal">
            <div className="archivo-selector-header">
              <h4>📥 Seleccionar archivo para cargar</h4>
              <button className="btn btn-secondary btn-small" onClick={() => setShowArchivoSelector(false)}>✕</button>
            </div>
            <div className="archivo-selector-content">
              {getArchivosRVIE().length === 0 ? (
                <p className="no-archivos">No hay archivos RVIE disponibles para el RUC {datosEmpresa?.ruc}</p>
              ) : (
                <div className="archivos-lista">
                  {getArchivosRVIE().map((archivo, idx) => (
                    <div
                      key={idx}
                      className="archivo-item-selectable"
                      onClick={() => cargarDesdeArchivo(archivo.nombre)}
                    >
                      <span className="archivo-icon">📊</span>
                      <div className="archivo-info-select">
                        <div className="archivo-nombre">{archivo.nombre}</div>
                        <div className="archivo-fecha">Modificado: {new Date(archivo.fechaModificacion).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cargandoArchivo && <div className="cargando-archivo">⏳ Cargando datos...</div>}
          </div>
        </div>
      )}

      {/* Acciones principales */}
      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-info action-btn-main" onClick={() => setShowArchivoSelector(true)}>📥 CARGAR DESDE OUTPUT</button>
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      {/* Tabla Unificada 57 Columnas */}
      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RVIE COMPLEMENTA - Estructura Completa (57 Columnas)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-57cols">
            <table className="rvie-table editable-table">
              <thead>
                {/* Fila de grupos principales */}
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th colSpan="2" className="th-group th-generador">Datos del Generador o Sujeto Obligado</th>
                  <th rowSpan="2" className="th-periodo">3<br />Periodo<br />YYYYMM</th>
                  <th rowSpan="2" className="th-car">4<br />CAR-SUNAT<br />(Tabla 7)</th>
                  <th colSpan="7" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th colSpan="2" className="th-group th-cliente">Datos del Cliente</th>
                  <th colSpan="8" className="th-group th-valores">Valores Monetarios</th>
                  <th colSpan="7" className="th-group th-valores2">Valores Adicionales</th>
                  <th colSpan="4" className="th-group th-referencia">Documento de Referencia o que modifica</th>
                  <th colSpan="4" className="th-group th-estados">Identificación y Estados</th>
                  <th colSpan="4" className="th-group th-adicional">Valores Adicionales</th>
                  <th colSpan="17" className="th-group th-libre">Libre Utilización (41-57)</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                {/* Fila de columnas individuales */}
                <tr className="header-cols">
                  <th className="th-num">1<br />RUC</th>
                  <th className="th-num">2<br />Nombres y Apellidos y/o Razón Social</th>
                  <th className="th-num">5<br />Fec. Emisión</th>
                  <th className="th-num">6<br />Fec. Vence</th>
                  <th className="th-num">7<br />Tipo</th>
                  <th className="th-num">8<br />Serie</th>
                  <th className="th-num">9<br />Num Inicial</th>
                  <th className="th-num">10<br />Num Final</th>
                  <th className="th-num">11<br />Tipo Doc</th>
                  <th className="th-num">12<br />Número Doc</th>
                  <th className="th-num">13<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">14<br />Valor Facturado Exportación</th>
                  <th className="th-num">15<br />Base Imponible Gravada</th>
                  <th className="th-num">16<br />Descuento Base Imponible</th>
                  <th className="th-num">17<br />IGV/IPM</th>
                  <th className="th-num">18<br />Descuento IGV y/o IPM</th>
                  <th className="th-num">19<br />Operación Exonerada</th>
                  <th className="th-num">20<br />Operación Inafecta</th>
                  <th className="th-num">21<br />ISC</th>
                  <th className="th-num">22<br />Base Imponible IVAP</th>
                  <th className="th-num">23<br />IVAP</th>
                  <th className="th-num">24<br />ICBPER</th>
                  <th className="th-num">25<br />Otros Tributos, Cargos y Descuentos</th>
                  <th className="th-num">26<br />Importe Total</th>
                  <th className="th-num">27<br />Código Moneda</th>
                  <th className="th-num">28<br />Tipo de Cambio</th>
                  <th className="th-num">29<br />Fec. Emisión</th>
                  <th className="th-num">30<br />Tipo</th>
                  <th className="th-num">31<br />Serie</th>
                  <th className="th-num">32<br />Número</th>
                  <th className="th-num">33<br />Identificación del contrato</th>
                  <th className="th-num">34<br />Tipo NC o ND</th>
                  <th className="th-num">35<br />Estado Comprobante de pago</th>
                  <th className="th-num">36<br />Uso interno</th>
                  <th className="th-num">37<br />Valor OP Gratuitas</th>
                  <th className="th-num">38<br />Tipo Operación</th>
                  <th className="th-num">39<br />Inconsistencias</th>
                  <th className="th-num">40<br />Uso interno SUNAT</th>
                  {[...Array(17)].map((_, i) => <th key={i} className="th-num th-libre-col">{41 + i}</th>)}
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_ruc || ''} onChange={(e) => updateCell(idx, 'col1_ruc', e.target.value)} className="table-input" maxLength="11" /></td>
                    <td><input type="text" value={row.col2_razonSocial || ''} onChange={(e) => updateCell(idx, 'col2_razonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col3_periodo || ''} onChange={(e) => updateCell(idx, 'col3_periodo', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col4_carSunat || ''} onChange={(e) => updateCell(idx, 'col4_carSunat', e.target.value)} className="table-input input-car" maxLength="27" placeholder="Ej: 1045751207001E0010000000193" /></td>
                    <td><input type="text" value={row.col5_fecEmision || ''} onChange={(e) => updateCell(idx, 'col5_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col6_fecVence || ''} onChange={(e) => updateCell(idx, 'col6_fecVence', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col7_tipo || ''} onChange={(e) => updateCell(idx, 'col7_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col8_serie || ''} onChange={(e) => updateCell(idx, 'col8_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col9_numInicial || ''} onChange={(e) => updateCell(idx, 'col9_numInicial', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col10_numFinal || ''} onChange={(e) => updateCell(idx, 'col10_numFinal', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col11_tipoDoc || ''} onChange={(e) => updateCell(idx, 'col11_tipoDoc', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col12_numDocCliente || ''} onChange={(e) => updateCell(idx, 'col12_numDocCliente', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col13_razonSocialCliente || ''} onChange={(e) => updateCell(idx, 'col13_razonSocialCliente', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col14_valorExportacion || ''} onChange={(e) => updateCell(idx, 'col14_valorExportacion', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col15_baseImponibleGravada || ''} onChange={(e) => updateCell(idx, 'col15_baseImponibleGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col16_descuentoBaseImponible || ''} onChange={(e) => updateCell(idx, 'col16_descuentoBaseImponible', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col17_igvIpm || ''} onChange={(e) => updateCell(idx, 'col17_igvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col18_descuentoIgvIpm || ''} onChange={(e) => updateCell(idx, 'col18_descuentoIgvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col19_operacionExonerada || ''} onChange={(e) => updateCell(idx, 'col19_operacionExonerada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col20_operacionInafecta || ''} onChange={(e) => updateCell(idx, 'col20_operacionInafecta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col21_isc || ''} onChange={(e) => updateCell(idx, 'col21_isc', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col22_baseImponibleIvap || ''} onChange={(e) => updateCell(idx, 'col22_baseImponibleIvap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col23_ivap || ''} onChange={(e) => updateCell(idx, 'col23_ivap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col24_icbper || ''} onChange={(e) => updateCell(idx, 'col24_icbper', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col25_otrosTributos || ''} onChange={(e) => updateCell(idx, 'col25_otrosTributos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_importeTotal || ''} onChange={(e) => updateCell(idx, 'col26_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col27_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col27_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col28_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col28_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col29_fecEmisionRef || ''} onChange={(e) => updateCell(idx, 'col29_fecEmisionRef', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col30_tipoRef || ''} onChange={(e) => updateCell(idx, 'col30_tipoRef', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col31_serieRef || ''} onChange={(e) => updateCell(idx, 'col31_serieRef', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col32_numeroRef || ''} onChange={(e) => updateCell(idx, 'col32_numeroRef', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col33_identificacionContrato || ''} onChange={(e) => updateCell(idx, 'col33_identificacionContrato', e.target.value)} className="table-input" maxLength="50" /></td>
                    <td><input type="text" value={row.col34_tipoNcNd || ''} onChange={(e) => updateCell(idx, 'col34_tipoNcNd', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col35_estadoComprobante || ''} onChange={(e) => updateCell(idx, 'col35_estadoComprobante', e.target.value)} className="table-input" maxLength="20" /></td>
                    <td><input type="text" value={row.col36_usoInterno || ''} onChange={(e) => updateCell(idx, 'col36_usoInterno', e.target.value)} className="table-input" /></td>
                    <td><input type="text" value={row.col37_valorOpGratuitas || ''} onChange={(e) => updateCell(idx, 'col37_valorOpGratuitas', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col38_tipoOperacion || ''} onChange={(e) => updateCell(idx, 'col38_tipoOperacion', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col39_inconsistencias || ''} onChange={(e) => updateCell(idx, 'col39_inconsistencias', e.target.value)} className="table-input" /></td>
                    <td><input type="text" value={row.col40_usoInternoSunat || ''} onChange={(e) => updateCell(idx, 'col40_usoInternoSunat', e.target.value)} className="table-input" /></td>
                    {[...Array(17)].map((_, i) => (
                      <td key={i}><input type="text" value={row[`col${41 + i}_libre`] || ''} onChange={(e) => updateCell(idx, `col${41 + i}_libre`, e.target.value)} className="table-input input-small" /></td>
                    ))}
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="59" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// FUNCIÓN ROBUSTA PARA EXTRAER DATOS DEL XLSX POR POSICIÓN DE COLUMNA
// El formato SIRE tiene una estructura fija conocida:
// Columna 0: Ruc
// Columna 1: Razon Social  
// Columna 2: Periodo
// Columna 3: CAR SUNAT
// Columna 4: Fecha de emision
// Columna 5: Fecha Vcto/Pago
// Columna 6: Tipo CP/Doc.
// Columna 7: Serie del CDP
// Columna 8: Nro CP o Doc.
// Columna 9: Nro Final (Rango)
// ... y así sucesivamente
// ============================================================================

// Mapeo por POSICIÓN de columna para RVIE (índice → campo de la tabla)
const MAPEO_POSICION_RVIE = {
  0: 'col1_ruc',                    // Ruc
  1: 'col2_razonSocial',            // Razon Social
  2: 'col3_periodo',                // Periodo
  3: 'col4_carSunat',               // CAR SUNAT
  4: 'col5_fecEmision',             // Fecha de emision
  5: 'col6_fecVence',               // Fecha Vcto/Pago
  6: 'col7_tipo',                   // Tipo CP/Doc.
  7: 'col8_serie',                  // Serie del CDP
  8: 'col9_numInicial',             // Nro CP o Doc.
  9: 'col10_numFinal',              // Nro Final (Rango)
  10: 'col11_tipoDoc',              // Tipo Doc Identidad
  11: 'col12_numDocCliente',        // Nro Doc Identidad
  12: 'col13_razonSocialCliente',   // Apellidos Nombres/ Razón Social
  13: 'col14_valorExportacion',     // Valor Facturado Exportación
  14: 'col15_baseImponibleGravada', // BI Gravada
  15: 'col16_descuentoBaseImponible', // Dscto BI
  16: 'col17_igvIpm',               // IGV / IPM
  17: 'col18_descuentoIgvIpm',      // Dscto IGV / IPM
  18: 'col19_operacionExonerada',   // Mto Exonerado
  19: 'col20_operacionInafecta',    // Mto Inafecto
  20: 'col21_isc',                  // ISC
  21: 'col22_baseImponibleIvap',    // BI Grav IVAP
  22: 'col23_ivap',                 // IVAP
  23: 'col24_icbper',               // ICBPER
  24: 'col25_otrosTributos',        // Otros Tributos
  25: 'col26_importeTotal',         // Total CP
  26: 'col27_codigoMoneda',         // Moneda
  27: 'col28_tipoCambio',           // Tipo Cambio
  28: 'col29_fecEmisionRef',        // Fecha Emisión (Doc Modificado)
  29: 'col30_tipoRef',              // Tipo CP Modificado
  30: 'col31_serieRef',             // Serie CP Modificado
  31: 'col32_numeroRef',            // Nro CP Modificado
  32: 'col33_identificacionContrato', // ID Proyecto
  33: 'col34_tipoNcNd',             // Tipo de Nota
  34: 'col35_estadoComprobante',    // Est. Comp
  35: 'col36_usoInterno',           // Valor FOB
  36: 'col37_valorOpGratuitas',     // Valor OP Gratuitas
  37: 'col38_tipoOperacion',        // Tipo Operación
  38: 'col39_inconsistencias',      // DAM / CP
  39: 'col40_usoInternoSunat'       // CLU
};

// Mapeo por POSICIÓN de columna para RCE
const MAPEO_POSICION_RCE = {
  0: 'col1_ruc',
  1: 'col2_razonSocial',
  2: 'col3_periodo',
  3: 'col4_carSunat',
  4: 'col5_fecEmision',
  5: 'col6_fecVence',
  6: 'col7_tipo',
  7: 'col8_serie',
  8: 'col9_damODsi',
  9: 'col10_numInicial',
  10: 'col11_numFinal',
  11: 'col12_tipoDoc',
  12: 'col13_numDoc',
  13: 'col14_razonSocialProveedor',
  14: 'col15_baseImponibleGravada',
  15: 'col16_igvGravada',
  16: 'col17_baseImponibleGravadaExport',
  17: 'col18_igvGravadaExport',
  18: 'col19_baseImponibleNoGravada',
  19: 'col20_igvNoGravada',
  20: 'col21_adquisicionesNoGravadas',
  21: 'col22_isc',
  22: 'col23_icbper',
  23: 'col24_otrosTributos',
  24: 'col25_importeTotal',
  25: 'col26_codigoMoneda',
  26: 'col27_tipoCambio',
  27: 'col28_fecEmisionRef',
  28: 'col29_tipoRef',
  29: 'col30_serieRef',
  30: 'col31_damODsiRef',
  31: 'col32_numeroRef',
  32: 'col33_clasificacionBsSs',
  33: 'col34_identificacionContrato',
  34: 'col35_porcentajeParticipacion',
  35: 'col36_impuestoMateriaBeneficio',
  36: 'col37_carCpModificar'
};

// Función ROBUSTA para extraer datos de una fila del Excel
// Usa tanto el mapeo por posición como por nombre de header
const extraerDatosDeFilaExcel = (rowObject, headers, rowData, tipoHoja, datosEmpresa) => {
  console.log('🔧 ========== EXTRACCIÓN DE DATOS XLSX ==========');
  console.log('🔧 Tipo de hoja:', tipoHoja);
  console.log('🔧 Headers:', headers);
  console.log('🔧 rowData (array):', rowData);
  console.log('🔧 rowObject:', rowObject);

  const resultado = {
    id: '',
    col1_ruc: datosEmpresa?.ruc || '',
    col2_razonSocial: datosEmpresa?.razonSocial || '',
    col3_periodo: `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`,
  };

  // Seleccionar el mapeo por posición según el tipo de hoja
  const mapeoPosicion = tipoHoja.includes('RCE') ? MAPEO_POSICION_RCE : MAPEO_POSICION_RVIE;

  // MÉTODO 1: Extraer por POSICIÓN usando rowData (array)
  if (rowData && Array.isArray(rowData) && rowData.length > 0) {
    console.log('🔧 Usando MÉTODO 1: Extracción por posición de columna');

    rowData.forEach((valor, idx) => {
      const campo = mapeoPosicion[idx];
      if (campo && valor !== undefined && valor !== null && valor !== '') {
        resultado[campo] = String(valor).trim();
        console.log(`✅ Pos[${idx}] → ${campo} = "${valor}"`);
      }
    });
  }
  // MÉTODO 2: Extraer por NOMBRE de header usando rowObject
  else if (rowObject && Object.keys(rowObject).length > 0) {
    console.log('🔧 Usando MÉTODO 2: Extracción por nombre de header');

    Object.entries(rowObject).forEach(([header, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        // Buscar el campo correspondiente en el mapeo por posición
        // usando el índice del header
        const headerIndex = headers?.indexOf(header);
        if (headerIndex !== -1) {
          const campo = mapeoPosicion[headerIndex];
          if (campo) {
            resultado[campo] = String(valor).trim();
            console.log(`✅ Header[${headerIndex}] "${header}" → ${campo} = "${valor}"`);
          }
        }
      }
    });
  }

  console.log('🔧 Resultado final:', resultado);
  console.log('🔧 ================================================');

  return resultado;
};

// Mapeo de columnas del Excel (XLSX) a campos de la tabla RVIE
// Formato: 'Nombre en XLSX': 'campo_en_tabla'
const MAPEO_COLUMNAS_RVIE = {
  // Datos del Generador o Sujeto Obligado
  'Ruc': 'col1_ruc',
  'RUC': 'col1_ruc',
  'Razon Social': 'col2_razonSocial',
  'Razón Social': 'col2_razonSocial',

  // Periodo y CAR
  'Periodo': 'col3_periodo',
  'PERIODO YYYYMM': 'col3_periodo',
  'CAR SUNAT': 'col4_carSunat',
  'CAR - SUNAT': 'col4_carSunat',
  'CAR-SUNAT(TABLA 7)': 'col4_carSunat',
  'CAR-SUNAT': 'col4_carSunat',

  // Datos del Comprobante de pago
  'Fecha de emisión': 'col5_fecEmision',
  'Fecha de emision': 'col5_fecEmision',
  'Fec. Emisión': 'col5_fecEmision',
  'Fec.Emisión': 'col5_fecEmision',
  'Fecha Vcto/Pago': 'col6_fecVence',
  'Fec. Vence': 'col6_fecVence',
  'Fec.Vence': 'col6_fecVence',
  'Tipo CP/Doc.': 'col7_tipo',
  'Tipo CP/Doc': 'col7_tipo',
  'Tipo': 'col7_tipo',
  'Serie del CDP': 'col8_serie',
  'Serie': 'col8_serie',
  'Nro CP o Doc.': 'col9_numInicial',
  'Nro CP o Doc': 'col9_numInicial',
  'Nro Inicial': 'col9_numInicial',
  'Num Inicial': 'col9_numInicial',
  'Nro Final (Rango)': 'col10_numFinal',
  'Nro Final': 'col10_numFinal',
  'Num Final': 'col10_numFinal',

  // Datos del Cliente
  'Tipo Doc Identidad': 'col11_tipoDoc',
  'Tipo Doc': 'col11_tipoDoc',
  'Nro Doc Identidad': 'col12_numDocCliente',
  'Nro Doc': 'col12_numDocCliente',
  'Número Doc': 'col12_numDocCliente',
  'Apellidos Nombres/ Razón Social': 'col13_razonSocialCliente',
  'Apellidos Nombres/Razón Social': 'col13_razonSocialCliente',
  'Razón Social cliente': 'col13_razonSocialCliente',
  'Razon Social cliente': 'col13_razonSocialCliente',

  // Valores monetarios
  'Valor Facturado Exportación': 'col14_valorExportacion',
  'Valor Facturado Exportacion': 'col14_valorExportacion',
  'Valor Export.': 'col14_valorExportacion',
  'BI Gravada': 'col15_baseImponibleGravada',
  'Base Imp.Gravada': 'col15_baseImponibleGravada',
  'Base Imponible Gravada': 'col15_baseImponibleGravada',
  'Dscto BI': 'col16_descuentoBaseImponible',
  'Desc. Base Imp.': 'col16_descuentoBaseImponible',
  'Descuento BI': 'col16_descuentoBaseImponible',
  'IGV / IPM': 'col17_igvIpm',
  'IGV/IPM': 'col17_igvIpm',
  'Dscto IGV / IPM': 'col18_descuentoIgvIpm',
  'Dscto IGV/IPM': 'col18_descuentoIgvIpm',
  'Op. Exonerada': 'col19_operacionExonerada',
  'Mto Exonerado': 'col19_operacionExonerada',
  'Operación Exonerada': 'col19_operacionExonerada',
  'Op. Inafecta': 'col20_operacionInafecta',
  'Mto Inafecto': 'col20_operacionInafecta',
  'Operación Inafecta': 'col20_operacionInafecta',
  'ISC': 'col21_isc',
  'BI Grav IVAP': 'col22_baseImponibleIvap',
  'Base Imp.IVAP': 'col22_baseImponibleIvap',
  'Base Imponible IVAP': 'col22_baseImponibleIvap',
  'IVAP': 'col23_ivap',
  'ICBPER': 'col24_icbper',
  'Otros Tributos': 'col25_otrosTributos',
  'Total CP': 'col26_importeTotal',
  'Importe Total': 'col26_importeTotal',

  // Moneda y Tipo de Cambio
  'Moneda': 'col27_codigoMoneda',
  'Código Moneda': 'col27_codigoMoneda',
  'Tipo Cambio': 'col28_tipoCambio',
  'Tipo de Cambio': 'col28_tipoCambio',

  // Documento de Referencia o que modifica
  'Fecha Emisión': 'col29_fecEmisionRef',
  'Fec. Emisión Doc Modificado': 'col29_fecEmisionRef',
  'Doc Modificado': 'col29_fecEmisionRef',
  'Tipo CP Modificado': 'col30_tipoRef',
  'Tipo Ref': 'col30_tipoRef',
  'Serie CP Modificado': 'col31_serieRef',
  'Serie Ref': 'col31_serieRef',
  'Nro CP Modificado': 'col32_numeroRef',
  'Número Ref': 'col32_numeroRef',
  'Número': 'col32_numeroRef',

  // Identificación y estados
  'ID Proyecto Operadores Atribución': 'col33_identificacionContrato',
  'Identificación Contrato': 'col33_identificacionContrato',
  'Tipo de Nota': 'col34_tipoNcNd',
  'Tipo NC o ND': 'col34_tipoNcNd',
  'Est. Comp': 'col35_estadoComprobante',
  'Estado Comprobante': 'col35_estadoComprobante',
  'Valor FOB Embarcado': 'col36_usoInterno',
  'Uso interno': 'col36_usoInterno',

  // Valores adicionales
  'Valor OP Gratuitas': 'col37_valorOpGratuitas',
  'Tipo Operación': 'col38_tipoOperacion',
  'DAM / CP': 'col39_inconsistencias',
  'Inconsistencias': 'col39_inconsistencias',
  'CLU': 'col40_usoInternoSunat',
  'Uso interno SUNAT': 'col40_usoInternoSunat'
};

// Mapeo de columnas del Excel (XLSX) a campos de la tabla RCE
// Formato: 'Nombre en XLSX': 'campo_en_tabla'
const MAPEO_COLUMNAS_RCE = {
  // Datos del Generador o Sujeto Obligado
  'Ruc': 'col1_ruc',
  'RUC': 'col1_ruc',
  'Razon Social': 'col2_razonSocial',
  'Razón Social': 'col2_razonSocial',

  // Periodo y CAR
  'Periodo': 'col3_periodo',
  'PERIODO YYYYMM': 'col3_periodo',
  'CAR SUNAT': 'col4_carSunat',
  'CAR - SUNAT': 'col4_carSunat',
  'CAR-SUNAT(TABLA 7)': 'col4_carSunat',
  'CAR-SUNAT': 'col4_carSunat',

  // Datos del Comprobante de pago
  'Fecha de emisión': 'col5_fecEmision',
  'Fecha de emision': 'col5_fecEmision',
  'Fec. Emisión': 'col5_fecEmision',
  'Fec.Emisión': 'col5_fecEmision',
  'Fecha Vcto/Pago': 'col6_fecVence',
  'Fec. Vence': 'col6_fecVence',
  'Fec.Vence': 'col6_fecVence',
  'Tipo CP/Doc.': 'col7_tipo',
  'Tipo CP/Doc': 'col7_tipo',
  'Tipo': 'col7_tipo',
  'Serie del CDP': 'col8_serie',
  'Serie': 'col8_serie',
  'Nro CP o Doc.': 'col9_numInicial',
  'Nro CP o Doc': 'col9_numInicial',
  'Nro Inicial': 'col9_numInicial',
  'Num Inicial': 'col9_numInicial',
  'Nro Final (Rango)': 'col10_numFinal',
  'Nro Final': 'col10_numFinal',
  'Num Final': 'col10_numFinal',

  // Datos del Proveedor
  'Tipo Doc Identidad': 'col11_tipoDoc',
  'Tipo Doc': 'col11_tipoDoc',
  'Nro Doc Identidad': 'col12_numDoc',
  'Nro Doc': 'col12_numDoc',
  'Número Doc': 'col12_numDoc',
  'Apellidos Nombres/ Razón Social': 'col13_razonSocialProveedor',
  'Apellidos Nombres/Razón Social': 'col13_razonSocialProveedor',
  'Razón Social cliente': 'col13_razonSocialProveedor',
  'Razon Social cliente': 'col13_razonSocialProveedor',

  // Valores monetarios - Adquisiciones Gravadas
  'Valor Facturado Exportación': 'col14_valorExportacion',
  'Valor Export.': 'col14_valorExportacion',
  'BI Gravada': 'col15_baseImponibleGravada',
  'Base Imp.Gravada': 'col15_baseImponibleGravada',
  'Base Imponible Gravada': 'col15_baseImponibleGravada',
  'Dscto BI': 'col16_descuentoBaseImponible',
  'Desc. Base Imp.': 'col16_descuentoBaseImponible',
  'IGV / IPM': 'col17_igvIpm',
  'IGV/IPM': 'col17_igvIpm',
  'Dscto IGV / IPM': 'col18_descuentoIgvIpm',
  'Dscto IGV/IPM': 'col18_descuentoIgvIpm',
  'Op. Exonerada': 'col19_operacionExonerada',
  'Mto Exonerado': 'col19_operacionExonerada',
  'Op. Inafecta': 'col20_operacionInafecta',
  'Mto Inafecto': 'col20_operacionInafecta',
  'ISC': 'col21_isc',
  'BI Grav IVAP': 'col22_baseImponibleIvap',
  'Base Imp.IVAP': 'col22_baseImponibleIvap',
  'IVAP': 'col23_ivap',
  'ICBPER': 'col24_icbper',
  'Otros Tributos': 'col25_otrosTributos',
  'Total CP': 'col26_importeTotal',
  'Importe Total': 'col26_importeTotal',

  // Moneda y Tipo de Cambio
  'Moneda': 'col27_codigoMoneda',
  'Código Moneda': 'col27_codigoMoneda',
  'Tipo Cambio': 'col28_tipoCambio',
  'Tipo de Cambio': 'col28_tipoCambio',

  // Documento de Referencia
  'Fecha Emisión': 'col29_fecEmisionRef',
  'Fec. Emisión Doc Modificado': 'col29_fecEmisionRef',
  'Tipo CP Modificado': 'col30_tipoRef',
  'Tipo Ref': 'col30_tipoRef',
  'Serie CP Modificado': 'col31_serieRef',
  'Serie Ref': 'col31_serieRef',
  'Nro CP Modificado': 'col32_numeroRef',
  'Número Ref': 'col32_numeroRef',
  'Número': 'col32_numeroRef',

  // Campos adicionales RCE
  'Clasificación Bs y Ss': 'col33_clasificacionBsSs',
  'Identificación Contrato': 'col34_identificacionContrato',
  'Porcentaje Participación': 'col35_porcentajeParticipacion',
  'Impuesto Materia Beneficio': 'col36_impuestoMateriaBeneficio',
  'CAR CP a Modificar': 'col37_carCpModificar',
  'Libre Utilización': 'col38_libre',
  'Tipo Nota': 'col39_tipoNota',
  'Est. Comp': 'col40_estComp',
  'Estado Comprobante': 'col40_estComp',
  'Incal': 'col41_incal'
};

// Función para obtener el mapeo según el tipo de hoja
const obtenerMapeoColumnas = (nombreHoja) => {
  if (nombreHoja.includes('RVIE')) {
    return MAPEO_COLUMNAS_RVIE;
  } else if (nombreHoja.includes('RCE')) {
    return MAPEO_COLUMNAS_RCE;
  }
  return MAPEO_COLUMNAS_RVIE; // Por defecto
};

// Componente para la vista de RVIE REEMPLAZA - TABLA 34 COLUMNAS (33 + 1 libre)
const RvieReemplazaView = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [indicadorCont, setIndicadorCont] = useState('1'); // 1 = SI (tiene contenido), 0 = NO
  const [indicadorMoned, setIndicadorMoned] = useState('1'); // 1 = PEN, 2 = USD

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RVIE REEMPLAZA:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RVIE REEMPLAZA',
        datosEmpresa
      );

      // Agregar valores por defecto para campos faltantes
      const camposDefault = {
        col4_carSunat: '', col5_fecEmision: '', col6_fecVence: '', col7_tipo: '',
        col8_serie: '', col9_numInicial: '', col10_numFinal: '', col11_tipoDoc: '',
        col12_numDocCliente: '', col13_razonSocialCliente: '', col14_valorExportacion: '',
        col15_baseImponibleGravada: '', col16_descuentoBaseImponible: '', col17_igvIpm: '',
        col18_descuentoIgvIpm: '', col19_operacionExonerada: '', col20_operacionInafecta: '',
        col21_isc: '', col22_baseImponibleIvap: '', col23_ivap: '', col24_icbper: '',
        col25_otrosTributos: '', col26_importeTotal: '', col27_codigoMoneda: 'PEN',
        col28_tipoCambio: '', col29_fecEmisionRef: '', col30_tipoRef: '', col31_serieRef: '',
        col32_numeroRef: '', col33_identificacionContrato: '', col34_libre: ''
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      // Agregar la nueva fila
      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RVIE REEMPLAZA:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  // Estructura RVIE REEMPLAZA: 34 columnas (33 + 1 libre)
  const crearDatosEjemplo = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;

    return [{
      id: '01',
      // 1-2: Datos del Generador o Sujeto Obligado
      col1_ruc: rucEmpresa,
      col2_razonSocial: razonSocialEmpresa,
      // 3-4: Periodo y CAR
      col3_periodo: periodo,
      col4_carSunat: '',
      // 5-12: Datos del Comprobante de pago
      col5_fecEmision: '',
      col6_fecVence: '',
      col7_tipo: '',
      col8_serie: '',
      col9_numInicial: '',
      col10_numFinal: '',
      col11_tipoDoc: '',
      col12_numDoc: '',
      // 13: Datos del Cliente
      col13_razonSocialCliente: '',
      // 14-24: Valores monetarios
      col14_valorExportacion: '',
      col15_baseImponibleGravada: '',
      col16_descuentoBaseImponible: '',
      col17_igvIpm: '',
      col18_descuentoIgvIpm: '',
      col19_operacionExonerada: '',
      col20_operacionInafecta: '',
      col21_isc: '',
      col22_baseImponibleIvap: '',
      col23_ivap: '',
      col24_icbper: '',
      // 25-28: Otros valores y moneda
      col25_otrosTributos: '',
      col26_importeTotal: '',
      col27_codigoMoneda: 'PEN',
      col28_tipoCambio: '',
      // 29-32: Documento de Referencia
      col29_fecEmisionRef: '',
      col30_tipoRef: '',
      col31_serieRef: '',
      col32_numeroRef: '',
      // 33: Identificación del contrato
      col33_identificacionContrato: '',
      // 34: Campo libre (1 columna para completar 34 columnas totales)
      col34_libre: ''
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) =>
      idx === rowIndex ? { ...row, [field]: value } : row
    ));
  };

  const addRow = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_ruc: rucEmpresa, col2_razonSocial: razonSocialEmpresa,
      col3_periodo: periodo, col4_carSunat: '',
      col5_fecEmision: '', col6_fecVence: '', col7_tipo: '', col8_serie: '',
      col9_numInicial: '', col10_numFinal: '', col11_tipoDoc: '', col12_numDoc: '',
      col13_razonSocialCliente: '',
      col14_valorExportacion: '', col15_baseImponibleGravada: '', col16_descuentoBaseImponible: '',
      col17_igvIpm: '', col18_descuentoIgvIpm: '', col19_operacionExonerada: '',
      col20_operacionInafecta: '', col21_isc: '', col22_baseImponibleIvap: '',
      col23_ivap: '', col24_icbper: '', col25_otrosTributos: '', col26_importeTotal: '',
      col27_codigoMoneda: 'PEN', col28_tipoCambio: '',
      col29_fecEmisionRef: '', col30_tipoRef: '', col31_serieRef: '', col32_numeroRef: '',
      col33_identificacionContrato: '', col34_libre: ''
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    if (!editableData || editableData.length === 0) {
      alert('No hay datos para guardar');
      return;
    }
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RVIE REEMPLAZA',
        datosEditados: { datosUnificados: editableData }
      });
      if (result.success) {
        alert(`✅ ${result.message}\nFilas guardadas: ${result.filasGuardadas || editableData.length}`);
      } else {
        alert(`❌ Error al guardar: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  // Generar archivo TXT y ZIP desde los datos de la tabla
  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla para generar el archivo');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino primero');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { indicadorCont, indicadorMoned });
    }
  };

  return (
    <div className="rvie-complementa-view">
      <div className="rvie-header">
        <div className="empresa-info">
          <div className="info-item"><strong>Tipo de hoja:</strong> RVIE REEMPLAZA</div>
          <div className="info-item"><strong>Empresa:</strong> {datosEmpresa?.ruc || ''} - {datosEmpresa?.razonSocial || 'Sin razón social'}</div>
          <div className="info-item"><strong>Periodo:</strong> {datosEmpresa?.anio || ''}{(datosEmpresa?.mes || '').padStart(2, '0')}</div>
        </div>
      </div>

      {/* Indicadores para generación de archivo */}
      <div className="rvie-indicadores">
        <div className="indicador-group">
          <label><strong>INDICADOR CONT:</strong></label>
          <select value={indicadorCont} onChange={(e) => setIndicadorCont(e.target.value)} className="indicador-select">
            <option value="1">1 = SI (Tiene contenido)</option>
            <option value="0">0 = NO (Sin contenido)</option>
          </select>
        </div>
        <div className="indicador-group">
          <label><strong>INDICADOR MONED:</strong></label>
          <select value={indicadorMoned} onChange={(e) => setIndicadorMoned(e.target.value)} className="indicador-select">
            <option value="1">1 = PEN (Soles)</option>
            <option value="2">2 = USD (Dólares)</option>
          </select>
        </div>
      </div>

      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RVIE REEMPLAZA - Estructura Completa (34 Columnas: 33 + 1 libre)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-34cols">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th colSpan="2" className="th-group th-generador">Datos del Generador o Sujeto Obligado</th>
                  <th rowSpan="2" className="th-periodo">3<br />Periodo<br />YYYYMM</th>
                  <th rowSpan="2" className="th-car">4<br />CAR-SUNAT<br />(Tabla 7)</th>
                  <th colSpan="8" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th className="th-group th-cliente">Datos del Cliente</th>
                  <th colSpan="11" className="th-group th-valores">Valores Monetarios</th>
                  <th colSpan="4" className="th-group th-valores2">Otros Valores y Moneda</th>
                  <th colSpan="4" className="th-group th-referencia">Documento de Referencia o que modifica</th>
                  <th rowSpan="2" className="th-estados">33<br />Identificación<br />del Contrato</th>
                  <th rowSpan="2" className="th-libre">34<br />Libre</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">1<br />RUC</th>
                  <th className="th-num">2<br />Razón Social</th>
                  <th className="th-num">5<br />Fec. Emisión</th>
                  <th className="th-num">6<br />Fec. Vence</th>
                  <th className="th-num">7<br />Tipo</th>
                  <th className="th-num">8<br />Serie</th>
                  <th className="th-num">9<br />Num Inicial</th>
                  <th className="th-num">10<br />Num Final</th>
                  <th className="th-num">11<br />Tipo Doc</th>
                  <th className="th-num">12<br />Número Doc</th>
                  <th className="th-num">13<br />Razón Social Cliente</th>
                  <th className="th-num">14<br />Valor Export.</th>
                  <th className="th-num">15<br />Base Imp. Gravada</th>
                  <th className="th-num">16<br />Desc. Base Imp.</th>
                  <th className="th-num">17<br />IGV/IPM</th>
                  <th className="th-num">18<br />Desc. IGV</th>
                  <th className="th-num">19<br />Op. Exonerada</th>
                  <th className="th-num">20<br />Op. Inafecta</th>
                  <th className="th-num">21<br />ISC</th>
                  <th className="th-num">22<br />Base Imp. IVAP</th>
                  <th className="th-num">23<br />IVAP</th>
                  <th className="th-num">24<br />ICBPER</th>
                  <th className="th-num">25<br />Otros Tributos</th>
                  <th className="th-num">26<br />Importe Total</th>
                  <th className="th-num">27<br />Moneda</th>
                  <th className="th-num">28<br />Tipo Cambio</th>
                  <th className="th-num">29<br />Fec. Emisión</th>
                  <th className="th-num">30<br />Tipo</th>
                  <th className="th-num">31<br />Serie</th>
                  <th className="th-num">32<br />Número</th>
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_ruc || ''} onChange={(e) => updateCell(idx, 'col1_ruc', e.target.value)} className="table-input" maxLength="11" /></td>
                    <td><input type="text" value={row.col2_razonSocial || ''} onChange={(e) => updateCell(idx, 'col2_razonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col3_periodo || ''} onChange={(e) => updateCell(idx, 'col3_periodo', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col4_carSunat || ''} onChange={(e) => updateCell(idx, 'col4_carSunat', e.target.value)} className="table-input input-car" maxLength="27" /></td>
                    <td><input type="text" value={row.col5_fecEmision || ''} onChange={(e) => updateCell(idx, 'col5_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col6_fecVence || ''} onChange={(e) => updateCell(idx, 'col6_fecVence', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col7_tipo || ''} onChange={(e) => updateCell(idx, 'col7_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col8_serie || ''} onChange={(e) => updateCell(idx, 'col8_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col9_numInicial || ''} onChange={(e) => updateCell(idx, 'col9_numInicial', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col10_numFinal || ''} onChange={(e) => updateCell(idx, 'col10_numFinal', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col11_tipoDoc || ''} onChange={(e) => updateCell(idx, 'col11_tipoDoc', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col12_numDoc || ''} onChange={(e) => updateCell(idx, 'col12_numDoc', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col13_razonSocialCliente || ''} onChange={(e) => updateCell(idx, 'col13_razonSocialCliente', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col14_valorExportacion || ''} onChange={(e) => updateCell(idx, 'col14_valorExportacion', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col15_baseImponibleGravada || ''} onChange={(e) => updateCell(idx, 'col15_baseImponibleGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col16_descuentoBaseImponible || ''} onChange={(e) => updateCell(idx, 'col16_descuentoBaseImponible', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col17_igvIpm || ''} onChange={(e) => updateCell(idx, 'col17_igvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col18_descuentoIgvIpm || ''} onChange={(e) => updateCell(idx, 'col18_descuentoIgvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col19_operacionExonerada || ''} onChange={(e) => updateCell(idx, 'col19_operacionExonerada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col20_operacionInafecta || ''} onChange={(e) => updateCell(idx, 'col20_operacionInafecta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col21_isc || ''} onChange={(e) => updateCell(idx, 'col21_isc', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col22_baseImponibleIvap || ''} onChange={(e) => updateCell(idx, 'col22_baseImponibleIvap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col23_ivap || ''} onChange={(e) => updateCell(idx, 'col23_ivap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col24_icbper || ''} onChange={(e) => updateCell(idx, 'col24_icbper', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col25_otrosTributos || ''} onChange={(e) => updateCell(idx, 'col25_otrosTributos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_importeTotal || ''} onChange={(e) => updateCell(idx, 'col26_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col27_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col27_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col28_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col28_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col29_fecEmisionRef || ''} onChange={(e) => updateCell(idx, 'col29_fecEmisionRef', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col30_tipoRef || ''} onChange={(e) => updateCell(idx, 'col30_tipoRef', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col31_serieRef || ''} onChange={(e) => updateCell(idx, 'col31_serieRef', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col32_numeroRef || ''} onChange={(e) => updateCell(idx, 'col32_numeroRef', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col33_identificacionContrato || ''} onChange={(e) => updateCell(idx, 'col33_identificacionContrato', e.target.value)} className="table-input" maxLength="50" /></td>
                    <td><input type="text" value={row.col34_libre || ''} onChange={(e) => updateCell(idx, 'col34_libre', e.target.value)} className="table-input input-small" /></td>
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="37" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para RVIE AJUSTES POST 1 - TABLA 50 COLUMNAS (33 + 17 libre)
const RvieAjustesPost1View = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [indicadorCont, setIndicadorCont] = useState('1'); // 1 = SI (tiene contenido), 0 = NO
  const [indicadorMoned, setIndicadorMoned] = useState('1'); // 1 = PEN, 2 = USD
  const [correlativo, setCorrelativo] = useState('01'); // N° Correlativo para el nombre del archivo

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RVIE AJUSTES POST 1:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RVIE AJUSTES POST 1',
        datosEmpresa
      );

      // Agregar valores por defecto para campos faltantes
      const camposDefault = {
        col4_carSunat: '', col5_fecEmision: '', col6_fecVence: '', col7_tipo: '',
        col8_serie: '', col9_numInicial: '', col10_numFinal: '', col11_tipoDoc: '',
        col12_numDocCliente: '', col13_razonSocialCliente: '', col14_valorExportacion: '',
        col15_baseImponibleGravada: '', col16_descuentoBaseImponible: '', col17_igvIpm: '',
        col18_descuentoIgvIpm: '', col19_operacionExonerada: '', col20_operacionInafecta: '',
        col21_isc: '', col22_baseImponibleIvap: '', col23_ivap: '', col24_icbper: '',
        col25_otrosTributos: '', col26_importeTotal: '', col27_codigoMoneda: 'PEN',
        col28_tipoCambio: '', col29_fecEmisionRef: '', col30_tipoRef: '', col31_serieRef: '',
        col32_numeroRef: '', col33_identificacionContrato: ''
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RVIE AJUSTES POST 1:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  // Estructura RVIE AJUSTES POST 1: 50 columnas según imagen (1-33 + 41-57)
  const crearDatosEjemplo = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;

    return [{
      id: '01',
      // 1-2: Datos del Generador o Sujeto Obligado
      col1_ruc: rucEmpresa,
      col2_razonSocial: razonSocialEmpresa,
      // 3-4: Periodo y CAR
      col3_periodo: periodo,
      col4_carSunat: '',
      // 5-11: Datos del Comprobante de pago
      col5_fecEmision: '',
      col6_fecVence: '',
      col7_tipo: '',
      col8_serie: '',
      col9_numInicial: '',
      col10_numFinal: '',
      col11_tipoDoc: '',
      // 12-13: Datos del Cliente
      col12_numDoc: '',
      col13_razonSocialCliente: '',
      // 14-21: Valores monetarios
      col14_valorExportacion: '',
      col15_baseImponibleGravada: '',
      col16_descuentoBaseImponible: '',
      col17_igvIpm: '',
      col18_descuentoIgvIpm: '',
      col19_operacionExonerada: '',
      col20_operacionInafecta: '',
      col21_isc: '',
      // 22-26: Más valores
      col22_baseImponibleIvap: '',
      col23_ivap: '',
      col24_icbper: '',
      col25_otrosTributos: '',
      col26_importeTotal: '',
      // 27-28: Moneda
      col27_codigoMoneda: 'PEN',
      col28_tipoCambio: '',
      // 29-32: Documento de Referencia
      col29_fecEmisionRef: '',
      col30_tipoRef: '',
      col31_serieRef: '',
      col32_numeroRef: '',
      // 33: Identificación del contrato
      col33_identificacionContrato: '',
      // 41-57: Libre Utilización
      col41_libre: '', col42_libre: '', col43_libre: '', col44_libre: '', col45_libre: '',
      col46_libre: '', col47_libre: '', col48_libre: '', col49_libre: '', col50_libre: '',
      col51_libre: '', col52_libre: '', col53_libre: '', col54_libre: '', col55_libre: '',
      col56_libre: '', col57_libre: ''
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) =>
      idx === rowIndex ? { ...row, [field]: value } : row
    ));
  };

  const addRow = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_ruc: rucEmpresa, col2_razonSocial: razonSocialEmpresa,
      col3_periodo: periodo, col4_carSunat: '',
      col5_fecEmision: '', col6_fecVence: '', col7_tipo: '', col8_serie: '',
      col9_numInicial: '', col10_numFinal: '', col11_tipoDoc: '',
      col12_numDoc: '', col13_razonSocialCliente: '',
      col14_valorExportacion: '', col15_baseImponibleGravada: '', col16_descuentoBaseImponible: '',
      col17_igvIpm: '', col18_descuentoIgvIpm: '', col19_operacionExonerada: '',
      col20_operacionInafecta: '', col21_isc: '', col22_baseImponibleIvap: '',
      col23_ivap: '', col24_icbper: '', col25_otrosTributos: '', col26_importeTotal: '',
      col27_codigoMoneda: 'PEN', col28_tipoCambio: '',
      col29_fecEmisionRef: '', col30_tipoRef: '', col31_serieRef: '', col32_numeroRef: '',
      col33_identificacionContrato: '',
      col41_libre: '', col42_libre: '', col43_libre: '', col44_libre: '', col45_libre: '',
      col46_libre: '', col47_libre: '', col48_libre: '', col49_libre: '', col50_libre: '',
      col51_libre: '', col52_libre: '', col53_libre: '', col54_libre: '', col55_libre: '',
      col56_libre: '', col57_libre: ''
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    if (!editableData || editableData.length === 0) {
      alert('No hay datos para guardar');
      return;
    }
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RVIE AJUSTES POST 1',
        datosEditados: { datosUnificados: editableData }
      });
      if (result.success) {
        alert(`✅ ${result.message}\nFilas guardadas: ${result.filasGuardadas || editableData.length}`);
      } else {
        alert(`❌ Error al guardar: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  // Generar archivo TXT y ZIP desde los datos de la tabla
  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla para generar el archivo');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino primero');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { indicadorCont, indicadorMoned, correlativo });
    }
  };

  return (
    <div className="rvie-complementa-view">
      <div className="rvie-header">
        <div className="empresa-info">
          <div className="info-item"><strong>Tipo de hoja:</strong> RVIE AJUSTES POST 1</div>
          <div className="info-item"><strong>Empresa:</strong> {datosEmpresa?.ruc || ''} - {datosEmpresa?.razonSocial || 'Sin razón social'}</div>
          <div className="info-item"><strong>Periodo:</strong> {datosEmpresa?.anio || ''}{(datosEmpresa?.mes || '').padStart(2, '0')}</div>
        </div>
      </div>

      {/* Indicadores para generación de archivo */}
      <div className="rvie-indicadores">
        <div className="indicador-group">
          <label><strong>INDICADOR CONT:</strong></label>
          <select value={indicadorCont} onChange={(e) => setIndicadorCont(e.target.value)} className="indicador-select">
            <option value="1">1 = SI (Tiene contenido)</option>
            <option value="0">0 = NO (Sin contenido)</option>
          </select>
        </div>
        <div className="indicador-group">
          <label><strong>INDICADOR MONED:</strong></label>
          <select value={indicadorMoned} onChange={(e) => setIndicadorMoned(e.target.value)} className="indicador-select">
            <option value="1">1 = PEN (Soles)</option>
            <option value="2">2 = USD (Dólares)</option>
          </select>
        </div>
        <div className="indicador-group">
          <label><strong>N° CORRELATIVO:</strong></label>
          <input
            type="text"
            value={correlativo}
            onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              if (val.length === 1) setCorrelativo(val.padStart(2, '0'));
              else if (val.length === 0) setCorrelativo('01');
            }}
            className="correlativo-input"
            maxLength="2"
            placeholder="01"
          />
        </div>
      </div>

      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RVIE AJUSTES POST 1 - Estructura (50 Columnas: 1-33 + 41-57)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-50cols">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th colSpan="2" className="th-group th-generador">Datos del Generador o Sujeto Obligado</th>
                  <th rowSpan="2" className="th-periodo">3<br />Periodo<br />YYYYMM</th>
                  <th rowSpan="2" className="th-car">4<br />CAR-SUNAT<br />(Tabla 7)</th>
                  <th colSpan="7" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th colSpan="2" className="th-group th-cliente">Datos del Cliente</th>
                  <th colSpan="8" className="th-group th-valores">Valores Monetarios</th>
                  <th colSpan="5" className="th-group th-valores2">Más Valores</th>
                  <th colSpan="2" className="th-group th-moneda">Moneda</th>
                  <th colSpan="4" className="th-group th-referencia">Documento de Referencia o que modifica</th>
                  <th rowSpan="2" className="th-estados">33<br />Identificación<br />del Contrato</th>
                  <th colSpan="17" className="th-group th-libre">Libre Utilización (41-57)</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">1<br />RUC</th>
                  <th className="th-num">2<br />Nombres y Apellidos y/o Razón Social</th>
                  <th className="th-num">5<br />Fec. Emisión</th>
                  <th className="th-num">6<br />Fec. Vence</th>
                  <th className="th-num">7<br />Tipo</th>
                  <th className="th-num">8<br />Serie</th>
                  <th className="th-num">9<br />Num Inicial</th>
                  <th className="th-num">10<br />Num Final</th>
                  <th className="th-num">11<br />Tipo Doc</th>
                  <th className="th-num">12<br />Número Doc</th>
                  <th className="th-num">13<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">14<br />Valor Facturado Exportación</th>
                  <th className="th-num">15<br />Base Imponible Gravada</th>
                  <th className="th-num">16<br />Descuento Base Imponible</th>
                  <th className="th-num">17<br />IGV/IPM</th>
                  <th className="th-num">18<br />Descuento IGV y/o IPM</th>
                  <th className="th-num">19<br />Operación Exonerada</th>
                  <th className="th-num">20<br />Operación Inafecta</th>
                  <th className="th-num">21<br />ISC</th>
                  <th className="th-num">22<br />Base Imponible IVAP</th>
                  <th className="th-num">23<br />IVAP</th>
                  <th className="th-num">24<br />ICBPER</th>
                  <th className="th-num">25<br />Otros Tributos, Cargos y Descuentos</th>
                  <th className="th-num">26<br />Importe Total</th>
                  <th className="th-num">27<br />Código Moneda</th>
                  <th className="th-num">28<br />Tipo de Cambio</th>
                  <th className="th-num">29<br />Fec. Emisión</th>
                  <th className="th-num">30<br />Tipo</th>
                  <th className="th-num">31<br />Serie</th>
                  <th className="th-num">32<br />Número</th>
                  {[...Array(17)].map((_, i) => <th key={i} className="th-num th-libre-col">{41 + i}</th>)}
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_ruc || ''} onChange={(e) => updateCell(idx, 'col1_ruc', e.target.value)} className="table-input" maxLength="11" /></td>
                    <td><input type="text" value={row.col2_razonSocial || ''} onChange={(e) => updateCell(idx, 'col2_razonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col3_periodo || ''} onChange={(e) => updateCell(idx, 'col3_periodo', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col4_carSunat || ''} onChange={(e) => updateCell(idx, 'col4_carSunat', e.target.value)} className="table-input input-car" maxLength="27" /></td>
                    <td><input type="text" value={row.col5_fecEmision || ''} onChange={(e) => updateCell(idx, 'col5_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col6_fecVence || ''} onChange={(e) => updateCell(idx, 'col6_fecVence', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col7_tipo || ''} onChange={(e) => updateCell(idx, 'col7_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col8_serie || ''} onChange={(e) => updateCell(idx, 'col8_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col9_numInicial || ''} onChange={(e) => updateCell(idx, 'col9_numInicial', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col10_numFinal || ''} onChange={(e) => updateCell(idx, 'col10_numFinal', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col11_tipoDoc || ''} onChange={(e) => updateCell(idx, 'col11_tipoDoc', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col12_numDoc || ''} onChange={(e) => updateCell(idx, 'col12_numDoc', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col13_razonSocialCliente || ''} onChange={(e) => updateCell(idx, 'col13_razonSocialCliente', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col14_valorExportacion || ''} onChange={(e) => updateCell(idx, 'col14_valorExportacion', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col15_baseImponibleGravada || ''} onChange={(e) => updateCell(idx, 'col15_baseImponibleGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col16_descuentoBaseImponible || ''} onChange={(e) => updateCell(idx, 'col16_descuentoBaseImponible', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col17_igvIpm || ''} onChange={(e) => updateCell(idx, 'col17_igvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col18_descuentoIgvIpm || ''} onChange={(e) => updateCell(idx, 'col18_descuentoIgvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col19_operacionExonerada || ''} onChange={(e) => updateCell(idx, 'col19_operacionExonerada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col20_operacionInafecta || ''} onChange={(e) => updateCell(idx, 'col20_operacionInafecta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col21_isc || ''} onChange={(e) => updateCell(idx, 'col21_isc', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col22_baseImponibleIvap || ''} onChange={(e) => updateCell(idx, 'col22_baseImponibleIvap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col23_ivap || ''} onChange={(e) => updateCell(idx, 'col23_ivap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col24_icbper || ''} onChange={(e) => updateCell(idx, 'col24_icbper', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col25_otrosTributos || ''} onChange={(e) => updateCell(idx, 'col25_otrosTributos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_importeTotal || ''} onChange={(e) => updateCell(idx, 'col26_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col27_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col27_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col28_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col28_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col29_fecEmisionRef || ''} onChange={(e) => updateCell(idx, 'col29_fecEmisionRef', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col30_tipoRef || ''} onChange={(e) => updateCell(idx, 'col30_tipoRef', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col31_serieRef || ''} onChange={(e) => updateCell(idx, 'col31_serieRef', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col32_numeroRef || ''} onChange={(e) => updateCell(idx, 'col32_numeroRef', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col33_identificacionContrato || ''} onChange={(e) => updateCell(idx, 'col33_identificacionContrato', e.target.value)} className="table-input" maxLength="50" /></td>
                    {[...Array(17)].map((_, i) => (
                      <td key={i}><input type="text" value={row[`col${41 + i}_libre`] || ''} onChange={(e) => updateCell(idx, `col${41 + i}_libre`, e.target.value)} className="table-input input-small" /></td>
                    ))}
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="52" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para RVIE AJUSTES POST 2 - TABLA 70 COLUMNAS según imagen
const RvieAjustesPost2View = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [indicadorCont, setIndicadorCont] = useState('1');
  const [indicadorMoned, setIndicadorMoned] = useState('1');
  const [correlativo, setCorrelativo] = useState('01');

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RVIE AJUSTES POST 2:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RVIE AJUSTES POST 2',
        datosEmpresa
      );
      const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
      nuevaFila.col1_periodoAjuste = periodo;

      // Agregar valores por defecto para campos faltantes
      const camposDefault = {
        col2_cuo: '', col3_correlativoAsiento: '', col4_fecEmision: '', col5_fecVence: '',
        col6_tipo: '', col7_serie: '', col8_numInicial: '', col9_numFinal: '',
        col10_tipoDoc: '', col11_numDoc: '', col12_razonSocialCliente: '',
        col13_valorExportacion: '', col14_baseImponibleGravada: '', col15_descuentoBaseImponible: '',
        col16_igvIpm: '', col17_descuentoIgvIpm: '', col18_operacionExonerada: '',
        col19_operacionInafecta: '', col20_isc: '', col21_baseImponibleIvap: '',
        col22_ivap: '', col23_icbper: '', col24_otrosTributos: '', col25_importeTotal: '',
        col26_codigoMoneda: 'PEN', col27_tipoCambio: '', col28_fecEmisionRef: '',
        col29_tipoRef: '', col30_serieRef: '', col31_numeroRef: ''
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RVIE AJUSTES POST 2:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  const crearDatosEjemplo = () => {
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    return [{
      id: '01',
      col1_periodoAjuste: periodo,
      col2_cuo: '',
      col3_correlativoAsiento: '',
      col4_fecEmision: '',
      col5_fecVence: '',
      col6_tipo: '',
      col7_serie: '',
      col8_numInicial: '',
      col9_numFinal: '',
      col10_tipoDoc: '',
      col11_numDoc: '',
      col12_razonSocialCliente: '',
      col13_valorExportacion: '',
      col14_baseImponibleGravada: '',
      col15_descuentoBaseImponible: '',
      col16_igvIpm: '',
      col17_descuentoIgvIpm: '',
      col18_operacionExonerada: '',
      col19_operacionInafecta: '',
      col20_isc: '',
      col21_baseImponibleIvap: '',
      col22_ivap: '',
      col23_icbper: '',
      col24_otrosTributos: '',
      col25_importeTotal: '',
      col26_codigoMoneda: 'PEN',
      col27_tipoCambio: '',
      col28_fecEmisionRef: '',
      col29_tipoRef: '',
      col30_serieRef: '',
      col31_numeroRef: '',
      col32_identificacionContrato: '',
      col33_inconsistenciaTC: '',
      col34_indicadorMedioPago: '',
      col35_estado: '',
      ...Object.fromEntries([...Array(35)].map((_, i) => [`col${36 + i}_libre`, '']))
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) => idx === rowIndex ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_periodoAjuste: periodo,
      col2_cuo: '', col3_correlativoAsiento: '',
      col4_fecEmision: '', col5_fecVence: '', col6_tipo: '', col7_serie: '',
      col8_numInicial: '', col9_numFinal: '', col10_tipoDoc: '', col11_numDoc: '',
      col12_razonSocialCliente: '',
      col13_valorExportacion: '', col14_baseImponibleGravada: '', col15_descuentoBaseImponible: '',
      col16_igvIpm: '', col17_descuentoIgvIpm: '', col18_operacionExonerada: '',
      col19_operacionInafecta: '', col20_isc: '', col21_baseImponibleIvap: '',
      col22_ivap: '', col23_icbper: '', col24_otrosTributos: '', col25_importeTotal: '',
      col26_codigoMoneda: 'PEN', col27_tipoCambio: '',
      col28_fecEmisionRef: '', col29_tipoRef: '', col30_serieRef: '', col31_numeroRef: '',
      col32_identificacionContrato: '', col33_inconsistenciaTC: '', col34_indicadorMedioPago: '', col35_estado: '',
      ...Object.fromEntries([...Array(35)].map((_, i) => [`col${36 + i}_libre`, '']))
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RVIE AJUSTES POST 2',
        datosEditados: { datosUnificados: editableData }
      });
      alert(result.success ? `✅ ${result.message}` : `❌ Error: ${result.error}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { indicadorCont, indicadorMoned, correlativo });
    }
  };

  return (
    <div className="rvie-complementa-view">
      {/* Header estilo Excel con campos editables */}
      <div className="rvie-header-excel">
        <div className="header-row">
          <span className="header-label">EMPRESA:</span>
          <input
            type="text"
            value={datosEmpresa?.ruc || ''}
            readOnly
            className="header-input header-ruc"
          />
          <input
            type="text"
            value={datosEmpresa?.razonSocial || ''}
            readOnly
            className="header-input header-razon-social"
          />
        </div>
        <div className="header-row">
          <span className="header-label">PERIODO</span>
          <input
            type="text"
            value={`${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '05').padStart(2, '0')}`}
            readOnly
            className="header-input header-periodo"
          />
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR CONT</span>
          <input
            type="text"
            value={indicadorCont}
            onChange={(e) => setIndicadorCont(e.target.value.replace(/[^01]/g, '').slice(0, 1))}
            className="header-input header-indicador"
            maxLength="1"
          />
          <span className="header-hint">1 = SI; 0 = NO</span>
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR MONED</span>
          <input
            type="text"
            value={indicadorMoned}
            onChange={(e) => setIndicadorMoned(e.target.value.replace(/[^12]/g, '').slice(0, 1))}
            className="header-input header-indicador"
            maxLength="1"
          />
          <span className="header-hint">1 = PEN; 2 = USD</span>
        </div>
        <div className="header-row">
          <span className="header-label">N° CORRELATIVO</span>
          <input
            type="text"
            value={correlativo}
            onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              if (val.length === 1) setCorrelativo(val.padStart(2, '0'));
              else if (val.length === 0) setCorrelativo('01');
            }}
            className="header-input header-correlativo"
            maxLength="2"
          />
        </div>
      </div>

      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RVIE AJUSTES POST 2 - Estructura (70 Columnas: 1-35 + 36-70 Libre)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-70cols">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th colSpan="3" className="th-group th-generador">Datos Periodo/CUO</th>
                  <th colSpan="8" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th className="th-group th-cliente">Cliente</th>
                  <th colSpan="14" className="th-group th-valores">Valores Monetarios y Moneda</th>
                  <th colSpan="4" className="th-group th-referencia">Doc. Referencia</th>
                  <th colSpan="4" className="th-group th-estados">Identificación y Estados</th>
                  <th colSpan="35" className="th-group th-libre">Libre Utilización (36-70)</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">1<br />Periodo Ajuste</th>
                  <th className="th-num">2<br />CUO</th>
                  <th className="th-num">3<br />Correlativo Asiento</th>
                  <th className="th-num">4<br />Fec. Emisión</th>
                  <th className="th-num">5<br />Fec. Vence</th>
                  <th className="th-num">6<br />Tipo</th>
                  <th className="th-num">7<br />Serie</th>
                  <th className="th-num">8<br />Num Inicial</th>
                  <th className="th-num">9<br />Num Final</th>
                  <th className="th-num">10<br />Tipo Doc</th>
                  <th className="th-num">11<br />Número Doc</th>
                  <th className="th-num">12<br />Razón Social</th>
                  <th className="th-num">13<br />Valor Exportación</th>
                  <th className="th-num">14<br />Base Imponible</th>
                  <th className="th-num">15<br />Descuento BI</th>
                  <th className="th-num">16<br />IGV/IPM</th>
                  <th className="th-num">17<br />Desc. IGV</th>
                  <th className="th-num">18<br />Op. Exonerada</th>
                  <th className="th-num">19<br />Op. Inafecta</th>
                  <th className="th-num">20<br />ISC</th>
                  <th className="th-num">21<br />BI IVAP</th>
                  <th className="th-num">22<br />IVAP</th>
                  <th className="th-num">23<br />ICBPER</th>
                  <th className="th-num">24<br />Otros Tributos</th>
                  <th className="th-num">25<br />Importe Total</th>
                  <th className="th-num">26<br />Moneda</th>
                  <th className="th-num">27<br />Tipo Cambio</th>
                  <th className="th-num">28<br />Fec. Emisión</th>
                  <th className="th-num">29<br />Tipo</th>
                  <th className="th-num">30<br />Serie</th>
                  <th className="th-num">31<br />Número</th>
                  <th className="th-num">32<br />Identificación Contrato</th>
                  <th className="th-num">33<br />Inconsistencia TC</th>
                  <th className="th-num">34<br />Indicador Medio Pago</th>
                  <th className="th-num">35<br />Estado</th>
                  {[...Array(35)].map((_, i) => <th key={i} className="th-num th-libre-col">{36 + i}</th>)}
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx + 1).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_periodoAjuste || ''} onChange={(e) => updateCell(idx, 'col1_periodoAjuste', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col2_cuo || ''} onChange={(e) => updateCell(idx, 'col2_cuo', e.target.value)} className="table-input" /></td>
                    <td><input type="text" value={row.col3_correlativoAsiento || ''} onChange={(e) => updateCell(idx, 'col3_correlativoAsiento', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col4_fecEmision || ''} onChange={(e) => updateCell(idx, 'col4_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col5_fecVence || ''} onChange={(e) => updateCell(idx, 'col5_fecVence', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col6_tipo || ''} onChange={(e) => updateCell(idx, 'col6_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col7_serie || ''} onChange={(e) => updateCell(idx, 'col7_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col8_numInicial || ''} onChange={(e) => updateCell(idx, 'col8_numInicial', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col9_numFinal || ''} onChange={(e) => updateCell(idx, 'col9_numFinal', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col10_tipoDoc || ''} onChange={(e) => updateCell(idx, 'col10_tipoDoc', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col11_numDoc || ''} onChange={(e) => updateCell(idx, 'col11_numDoc', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col12_razonSocialCliente || ''} onChange={(e) => updateCell(idx, 'col12_razonSocialCliente', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col13_valorExportacion || ''} onChange={(e) => updateCell(idx, 'col13_valorExportacion', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col14_baseImponibleGravada || ''} onChange={(e) => updateCell(idx, 'col14_baseImponibleGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col15_descuentoBaseImponible || ''} onChange={(e) => updateCell(idx, 'col15_descuentoBaseImponible', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col16_igvIpm || ''} onChange={(e) => updateCell(idx, 'col16_igvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col17_descuentoIgvIpm || ''} onChange={(e) => updateCell(idx, 'col17_descuentoIgvIpm', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col18_operacionExonerada || ''} onChange={(e) => updateCell(idx, 'col18_operacionExonerada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col19_operacionInafecta || ''} onChange={(e) => updateCell(idx, 'col19_operacionInafecta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col20_isc || ''} onChange={(e) => updateCell(idx, 'col20_isc', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col21_baseImponibleIvap || ''} onChange={(e) => updateCell(idx, 'col21_baseImponibleIvap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col22_ivap || ''} onChange={(e) => updateCell(idx, 'col22_ivap', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col23_icbper || ''} onChange={(e) => updateCell(idx, 'col23_icbper', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col24_otrosTributos || ''} onChange={(e) => updateCell(idx, 'col24_otrosTributos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col25_importeTotal || ''} onChange={(e) => updateCell(idx, 'col25_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col26_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col27_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col27_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col28_fecEmisionRef || ''} onChange={(e) => updateCell(idx, 'col28_fecEmisionRef', e.target.value)} className="table-input input-date" /></td>
                    <td><input type="text" value={row.col29_tipoRef || ''} onChange={(e) => updateCell(idx, 'col29_tipoRef', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col30_serieRef || ''} onChange={(e) => updateCell(idx, 'col30_serieRef', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col31_numeroRef || ''} onChange={(e) => updateCell(idx, 'col31_numeroRef', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col32_identificacionContrato || ''} onChange={(e) => updateCell(idx, 'col32_identificacionContrato', e.target.value)} className="table-input" /></td>
                    <td><input type="text" value={row.col33_inconsistenciaTC || ''} onChange={(e) => updateCell(idx, 'col33_inconsistenciaTC', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col34_indicadorMedioPago || ''} onChange={(e) => updateCell(idx, 'col34_indicadorMedioPago', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col35_estado || ''} onChange={(e) => updateCell(idx, 'col35_estado', e.target.value)} className="table-input input-small" /></td>
                    {[...Array(35)].map((_, i) => (
                      <td key={i}><input type="text" value={row[`col${36 + i}_libre`] || ''} onChange={(e) => updateCell(idx, `col${36 + i}_libre`, e.target.value)} className="table-input input-small" /></td>
                    ))}
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="72" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para RCE COMPLETA - TABLA 80 COLUMNAS (41 obligatorias + 39 libre utilización)
const RceCompletaView = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [correlativo, setCorrelativo] = useState('1');
  const [comprobPago, setComprobPago] = useState('CP');

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RCE COMPLETA:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RCE COMPLETA',
        datosEmpresa
      );

      // Agregar valores por defecto para campos faltantes
      const camposDefault = {
        col4_carSunat: '', col5_fecEmision: '', col6_fecVence: '', col7_tipo: '',
        col8_serie: '', col9_damODsi: '', col10_numInicial: '', col11_numFinal: '',
        col12_tipoDoc: '', col13_numDoc: '', col14_razonSocialProveedor: '',
        col15_baseImponibleGravada: '', col16_igvGravada: '', col17_baseImponibleGravadaExport: '',
        col18_igvGravadaExport: '', col19_baseImponibleNoGravada: '', col20_igvNoGravada: '',
        col21_adquisicionesNoGravadas: '', col22_isc: '', col23_icbper: '',
        col24_otrosTributos: '', col25_importeTotal: '', col26_codigoMoneda: 'PEN',
        col27_tipoCambio: '', col28_fecEmisionRef: '', col29_tipoRef: '', col30_serieRef: '',
        col31_damODsiRef: '', col32_numeroRef: '', col33_clasificacionBsSs: '',
        col34_identificacionContrato: '', col35_porcentajeParticipacion: '',
        col36_impuestoMateriaBeneficio: '', col37_carCpModificar: '',
        col38_detraccion: '', col39_tipoNcNd: '', col40_estadoCp: '', col41_inconsistencia: ''
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RCE COMPLETA:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  const crearDatosEjemplo = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    return [{
      id: '01',
      // 1-2: Datos del Generador o Sujeto Obligado
      col1_ruc: rucEmpresa,
      col2_razonSocial: razonSocialEmpresa,
      // 3: Periodo
      col3_periodo: periodo,
      // 4: CAR-SUNAT
      col4_carSunat: '',
      // 5-13: Datos del Comprobante de pago
      col5_fecEmision: '',
      col6_fecVence: '',
      col7_tipo: '',
      col8_serie: '',
      col9_damODsi: '',
      col10_numInicial: '',
      col11_numFinal: '',
      col12_tipoDoc: '',
      col13_numDoc: '',
      // 14: Datos del Proveedor
      col14_razonSocialProveedor: '',
      // 15-23: Adquisiciones Gravadas
      col15_baseImponibleGravada: '',
      col16_igvGravada: '',
      col17_baseImponibleGravadaExport: '',
      col18_igvGravadaExport: '',
      col19_baseImponibleNoGravada: '',
      col20_igvNoGravada: '',
      col21_adquisicionesNoGravadas: '',
      col22_isc: '',
      col23_icbper: '',
      // 24-27: Otros valores y moneda
      col24_otrosTributos: '',
      col25_importeTotal: '',
      col26_codigoMoneda: 'PEN',
      col27_tipoCambio: '',
      // 28-32: Documento de Referencia
      col28_fecEmisionRef: '',
      col29_tipoRef: '',
      col30_serieRef: '',
      col31_damODsiRef: '',
      col32_numeroRef: '',
      // 33-37: Clasificación y otros
      col33_clasificacionBsSs: '',
      col34_identificacionContrato: '',
      col35_porcentajeParticipacion: '',
      col36_impuestoMateriaBeneficio: '',
      col37_carCpModificar: '',
      // 38-41: No obligatorios para TXT
      col38_detraccion: '',
      col39_tipoNcNd: '',
      col40_estadoCp: '',
      col41_inconsistencia: '',
      // 42-80: Libre utilización
      ...Object.fromEntries([...Array(39)].map((_, i) => [`col${42 + i}_libre`, '']))
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) => idx === rowIndex ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_ruc: rucEmpresa, col2_razonSocial: razonSocialEmpresa, col3_periodo: periodo, col4_carSunat: '',
      col5_fecEmision: '', col6_fecVence: '', col7_tipo: '', col8_serie: '', col9_damODsi: '',
      col10_numInicial: '', col11_numFinal: '', col12_tipoDoc: '', col13_numDoc: '',
      col14_razonSocialProveedor: '',
      col15_baseImponibleGravada: '', col16_igvGravada: '', col17_baseImponibleGravadaExport: '',
      col18_igvGravadaExport: '', col19_baseImponibleNoGravada: '', col20_igvNoGravada: '',
      col21_adquisicionesNoGravadas: '', col22_isc: '', col23_icbper: '',
      col24_otrosTributos: '', col25_importeTotal: '', col26_codigoMoneda: 'PEN', col27_tipoCambio: '',
      col28_fecEmisionRef: '', col29_tipoRef: '', col30_serieRef: '', col31_damODsiRef: '', col32_numeroRef: '',
      col33_clasificacionBsSs: '', col34_identificacionContrato: '', col35_porcentajeParticipacion: '',
      col36_impuestoMateriaBeneficio: '', col37_carCpModificar: '',
      col38_detraccion: '', col39_tipoNcNd: '', col40_estadoCp: '', col41_inconsistencia: '',
      ...Object.fromEntries([...Array(39)].map((_, i) => [`col${42 + i}_libre`, '']))
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RCE COMPLETA',
        datosEditados: { datosUnificados: editableData }
      });
      alert(result.success ? `✅ ${result.message}` : `❌ Error: ${result.error}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { correlativo, comprobPago });
    }
  };

  return (
    <div className="rvie-complementa-view">
      {/* Header estilo Excel - RCE COMPLETA */}
      <div className="rvie-header-excel rce-header">
        <div className="header-row">
          <span className="header-label">EMPRESA:</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.ruc || ''} readOnly className="header-input header-ruc" />
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.razonSocial || ''} readOnly className="header-input header-razon-social" />
        </div>
        <div className="header-row">
          <span className="header-label">PERIODO</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={`${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '05').padStart(2, '0')}`} readOnly className="header-input header-periodo" />
        </div>
        <div className="header-row">
          <span className="header-label">N° CORRELATIVO</span>
          <input
            type="text"
            value={correlativo}
            onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, ''))}
            className="header-input header-correlativo"
            maxLength="10"
          />
        </div>
        <div className="header-row">
          <span className="header-label">COMPROB PAGO</span>
          <input
            type="text"
            value={comprobPago}
            onChange={(e) => setComprobPago(e.target.value.toUpperCase())}
            className="header-input header-comprob-pago"
            maxLength="10"
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles - RCE COMPLETA</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      {/* Tabla 80 columnas */}
      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RCE COMPLETA - Estructura (80 Columnas: 1-41 + 42-80 Libre)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-80cols">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th colSpan="2" className="th-group th-generador">Datos del Generador o Sujeto Obligado</th>
                  <th rowSpan="2" className="th-periodo">3<br />Periodo<br />YYYYMM</th>
                  <th rowSpan="2" className="th-car">4<br />CAR-SUNAT<br />(Tabla 7)</th>
                  <th colSpan="9" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th className="th-group th-proveedor">Datos del Proveedor</th>
                  <th colSpan="3" className="th-group th-gravada1">Adqui. Gravadas Destinadas a Op. Gravadas y/o Exportación</th>
                  <th colSpan="3" className="th-group th-gravada2">Adqui. Gravadas Destinadas a Op. Gravadas y/o de Export. y No Gravadas</th>
                  <th colSpan="3" className="th-group th-nogravada">Adqui. gravadas destinadas a Op. no gravadas</th>
                  <th colSpan="2" className="th-group th-otros">Adquisiciones No Gravadas</th>
                  <th colSpan="4" className="th-group th-moneda">Otros Tributos y Moneda</th>
                  <th colSpan="5" className="th-group th-referencia">Documento de Referencia o que se modifica</th>
                  <th colSpan="5" className="th-group th-clasificacion">Clasificación y Otros</th>
                  <th colSpan="4" className="th-group th-noobligatorio">NO OBLIGATORIOS PARA EL ARCHIVO DE TXT</th>
                  <th colSpan="39" className="th-group th-libre">Libre Utilización (42-80)</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">1<br />RUC</th>
                  <th className="th-num">2<br />Nombres y Apellidos y/o Razón Social</th>
                  <th className="th-num">5<br />Fec. Emisión</th>
                  <th className="th-num">6<br />Fec. Vence</th>
                  <th className="th-num">7<br />Tipo</th>
                  <th className="th-num">8<br />Serie</th>
                  <th className="th-num">9<br />DAM O DSI</th>
                  <th className="th-num">10<br />Num Inicial</th>
                  <th className="th-num">11<br />Num Final</th>
                  <th className="th-num">12<br />Tipo Doc</th>
                  <th className="th-num">13<br />Número Doc</th>
                  <th className="th-num">14<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">15<br />Base Imponible</th>
                  <th className="th-num">16<br />IGV</th>
                  <th className="th-num">17<br />Base Imponible</th>
                  <th className="th-num">18<br />IGV</th>
                  <th className="th-num">19<br />Base Imponible</th>
                  <th className="th-num">20<br />IGV</th>
                  <th className="th-num">21<br />Adquisiciones No Gravadas</th>
                  <th className="th-num">22<br />ISC</th>
                  <th className="th-num">23<br />ICBPER</th>
                  <th className="th-num">24<br />Otros Tributos y Cargos</th>
                  <th className="th-num">25<br />Importe Total</th>
                  <th className="th-num">26<br />Código Moneda</th>
                  <th className="th-num">27<br />Tipo de Cambio</th>
                  <th className="th-num">28<br />Fec. Emisión</th>
                  <th className="th-num">29<br />Tipo</th>
                  <th className="th-num">30<br />Serie</th>
                  <th className="th-num">31<br />DAM o DSI</th>
                  <th className="th-num">32<br />Número CP</th>
                  <th className="th-num">33<br />Clasificacion Bs y Ss Adquiridos Ingresos &gt; 1500 UIT</th>
                  <th className="th-num">34<br />Identificación del contrato</th>
                  <th className="th-num">35<br />% Participación en el contrato</th>
                  <th className="th-num">36<br />Impuesto Materia de Beneficio ley</th>
                  <th className="th-num">37<br />CAR CP a Modificar</th>
                  <th className="th-num">38<br />Detracción</th>
                  <th className="th-num">39<br />Tipo NC o ND</th>
                  <th className="th-num">40<br />Estado del CP</th>
                  <th className="th-num">41<br />Inconsistencia</th>
                  {[...Array(39)].map((_, i) => <th key={i} className="th-num th-libre-col">{42 + i}</th>)}
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx + 1).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_ruc || ''} onChange={(e) => updateCell(idx, 'col1_ruc', e.target.value)} className="table-input" maxLength="11" /></td>
                    <td><input type="text" value={row.col2_razonSocial || ''} onChange={(e) => updateCell(idx, 'col2_razonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col3_periodo || ''} onChange={(e) => updateCell(idx, 'col3_periodo', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col4_carSunat || ''} onChange={(e) => updateCell(idx, 'col4_carSunat', e.target.value)} className="table-input input-car" maxLength="27" /></td>
                    <td><input type="text" value={row.col5_fecEmision || ''} onChange={(e) => updateCell(idx, 'col5_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col6_fecVence || ''} onChange={(e) => updateCell(idx, 'col6_fecVence', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col7_tipo || ''} onChange={(e) => updateCell(idx, 'col7_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col8_serie || ''} onChange={(e) => updateCell(idx, 'col8_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col9_damODsi || ''} onChange={(e) => updateCell(idx, 'col9_damODsi', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col10_numInicial || ''} onChange={(e) => updateCell(idx, 'col10_numInicial', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col11_numFinal || ''} onChange={(e) => updateCell(idx, 'col11_numFinal', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col12_tipoDoc || ''} onChange={(e) => updateCell(idx, 'col12_tipoDoc', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col13_numDoc || ''} onChange={(e) => updateCell(idx, 'col13_numDoc', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col14_razonSocialProveedor || ''} onChange={(e) => updateCell(idx, 'col14_razonSocialProveedor', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col15_baseImponibleGravada || ''} onChange={(e) => updateCell(idx, 'col15_baseImponibleGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col16_igvGravada || ''} onChange={(e) => updateCell(idx, 'col16_igvGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col17_baseImponibleGravadaExport || ''} onChange={(e) => updateCell(idx, 'col17_baseImponibleGravadaExport', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col18_igvGravadaExport || ''} onChange={(e) => updateCell(idx, 'col18_igvGravadaExport', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col19_baseImponibleNoGravada || ''} onChange={(e) => updateCell(idx, 'col19_baseImponibleNoGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col20_igvNoGravada || ''} onChange={(e) => updateCell(idx, 'col20_igvNoGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col21_adquisicionesNoGravadas || ''} onChange={(e) => updateCell(idx, 'col21_adquisicionesNoGravadas', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col22_isc || ''} onChange={(e) => updateCell(idx, 'col22_isc', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col23_icbper || ''} onChange={(e) => updateCell(idx, 'col23_icbper', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col24_otrosTributos || ''} onChange={(e) => updateCell(idx, 'col24_otrosTributos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col25_importeTotal || ''} onChange={(e) => updateCell(idx, 'col25_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col26_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col27_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col27_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col28_fecEmisionRef || ''} onChange={(e) => updateCell(idx, 'col28_fecEmisionRef', e.target.value)} className="table-input input-date" /></td>
                    <td><input type="text" value={row.col29_tipoRef || ''} onChange={(e) => updateCell(idx, 'col29_tipoRef', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col30_serieRef || ''} onChange={(e) => updateCell(idx, 'col30_serieRef', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col31_damODsiRef || ''} onChange={(e) => updateCell(idx, 'col31_damODsiRef', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col32_numeroRef || ''} onChange={(e) => updateCell(idx, 'col32_numeroRef', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col33_clasificacionBsSs || ''} onChange={(e) => updateCell(idx, 'col33_clasificacionBsSs', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col34_identificacionContrato || ''} onChange={(e) => updateCell(idx, 'col34_identificacionContrato', e.target.value)} className="table-input" /></td>
                    <td><input type="text" value={row.col35_porcentajeParticipacion || ''} onChange={(e) => updateCell(idx, 'col35_porcentajeParticipacion', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col36_impuestoMateriaBeneficio || ''} onChange={(e) => updateCell(idx, 'col36_impuestoMateriaBeneficio', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col37_carCpModificar || ''} onChange={(e) => updateCell(idx, 'col37_carCpModificar', e.target.value)} className="table-input input-car" /></td>
                    <td><input type="text" value={row.col38_detraccion || ''} onChange={(e) => updateCell(idx, 'col38_detraccion', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col39_tipoNcNd || ''} onChange={(e) => updateCell(idx, 'col39_tipoNcNd', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col40_estadoCp || ''} onChange={(e) => updateCell(idx, 'col40_estadoCp', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col41_inconsistencia || ''} onChange={(e) => updateCell(idx, 'col41_inconsistencia', e.target.value)} className="table-input input-small" /></td>
                    {[...Array(39)].map((_, i) => (
                      <td key={i}><input type="text" value={row[`col${42 + i}_libre`] || ''} onChange={(e) => updateCell(idx, `col${42 + i}_libre`, e.target.value)} className="table-input input-small" /></td>
                    ))}
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="82" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para la vista de RCE NO DOMICILIADOS - 36 COLUMNAS
const RceNoDomiciliadosView = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder }) => {
  const [editableData, setEditableData] = useState([]);

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  const crearDatosEjemplo = () => {
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '06').padStart(2, '0')}`;
    return [{
      id: '01',
      col1_periodo: periodo,
      col2_carSunat: '',
      col3_fecEmision: '',
      col4_tipo: '',
      col5_serie: '',
      col6_numeroCP: '',
      col7_valorAdquisiciones: '',
      col8_otrosConceptos: '',
      col9_importeTotal: '',
      col10_tipo: '',
      col11_serie: '',
      col12_damODsi: '',
      col13_numeroCP: '',
      col14_montoRetencionIGV: '',
      col15_codigoMoneda: '',
      col16_tipoCambio: '',
      col17_pais: '',
      col18_apellidosNombresRazonSocial: '',
      col19_domicilioExtranjero: '',
      col20_numIdentificacion: '',
      col21_numIdentifFiscal: '',
      col22_apellidosNombresRazonSocial: '',
      col23_pais: '',
      col24_vinculoCR: '',
      col25_rentaBruta: '',
      col26_deduccCosto: '',
      col27_rentaNeta: '',
      col28_tasaRetencion: '',
      col29_impuestoRetenido: '',
      col30_convenio: '',
      col31_exoneracionAplicada: '',
      col32_tipoRenta: '',
      col33_modalidadServicio: '',
      col34_aplicacionArt76: '',
      col35_carCpModificar: '',
      col36_libreUtilizacion: ''
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) =>
      idx === rowIndex ? { ...row, [field]: value } : row
    ));
  };

  const addRow = () => {
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '06').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_periodo: periodo, col2_carSunat: '',
      col3_fecEmision: '', col4_tipo: '', col5_serie: '', col6_numeroCP: '',
      col7_valorAdquisiciones: '', col8_otrosConceptos: '', col9_importeTotal: '',
      col10_tipo: '', col11_serie: '', col12_damODsi: '', col13_numeroCP: '',
      col14_montoRetencionIGV: '', col15_codigoMoneda: 'PEN', col16_tipoCambio: '',
      col17_pais: '', col18_apellidosNombresRazonSocial: '', col19_domicilioExtranjero: '',
      col20_numIdentificacion: '', col21_numIdentifFiscal: '',
      col22_apellidosNombresRazonSocial: '', col23_pais: '', col24_vinculoCR: '',
      col25_rentaBruta: '', col26_deduccCosto: '', col27_rentaNeta: '',
      col28_tasaRetencion: '', col29_impuestoRetenido: '',
      col30_convenio: '', col31_exoneracionAplicada: '', col32_tipoRenta: '',
      col33_modalidadServicio: '', col34_aplicacionArt76: '',
      col35_carCpModificar: '', col36_libreUtilizacion: ''
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, {});
    }
  };

  return (
    <div className="rvie-complementa-view">
      <div className="rvie-header-excel rce-header">
        <div className="header-row">
          <span className="header-label">EMPRESA:</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.ruc || ''} readOnly className="header-input header-ruc" />
        </div>
        <div className="header-row">
          <span className="header-label">PERIODO</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={`${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '06').padStart(2, '0')}`} readOnly className="header-input header-periodo" />
        </div>
      </div>

      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles - RCE NO DOMICILIADOS</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RCE NO DOMICILIADOS - Estructura (36 Columnas)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
          </div>
          <div className="table-container table-unified">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th rowSpan="2" className="th-periodo">1<br />Periodo<br />YYYYMM</th>
                  <th rowSpan="2" className="th-car">2<br />CAR-SUNAT<br />(Tabla 7)</th>
                  <th colSpan="4" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th colSpan="3" className="th-group th-valores">Valores</th>
                  <th colSpan="4" className="th-group th-docCredito">Documento que Sustenta Crédito Fiscal</th>
                  <th colSpan="3" className="th-group th-montos">Montos y Moneda</th>
                  <th rowSpan="2" className="th-pais">17<br />País</th>
                  <th colSpan="4" className="th-group th-noDomiciliado">Datos del sujeto no Domiciliado</th>
                  <th colSpan="3" className="th-group th-beneficiario">Beneficiario Efectivo de los pagos</th>
                  <th colSpan="5" className="th-group th-valoresAdicionales">Valores Adicionales</th>
                  <th colSpan="5" className="th-group th-convenio">Convenio y Aplicaciones</th>
                  <th colSpan="2" className="th-group th-car">CAR y Libre</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">3<br />Fec. Emisión</th>
                  <th className="th-num">4<br />Tipo</th>
                  <th className="th-num">5<br />Serie</th>
                  <th className="th-num">6<br />Numero CP</th>
                  <th className="th-num">7<br />Valor de las Adquisiciones</th>
                  <th className="th-num">8<br />Otros Conceptos Adicionales</th>
                  <th className="th-num">9<br />Importe Total</th>
                  <th className="th-num">10<br />Tipo</th>
                  <th className="th-num">11<br />Serie</th>
                  <th className="th-num">12<br />DAM O DSI</th>
                  <th className="th-num">13<br />Número CP</th>
                  <th className="th-num">14<br />Monto de la retención del IGV</th>
                  <th className="th-num">15<br />Código Moneda</th>
                  <th className="th-num">16<br />Tipo de Cambio</th>
                  <th className="th-num">18<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">19<br />Domicilio en el Extranjero</th>
                  <th className="th-num">20<br />Núm Identificación</th>
                  <th className="th-num">21<br />N° Identif. Fiscal</th>
                  <th className="th-num">22<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">23<br />País</th>
                  <th className="th-num">24<br />Vínculo C-R</th>
                  <th className="th-num">25<br />Renta Bruta</th>
                  <th className="th-num">26<br />Deducc / Costo</th>
                  <th className="th-num">27<br />Renta Neta</th>
                  <th className="th-num">28<br />Tasa Retención</th>
                  <th className="th-num">29<br />Impuesto Retenido</th>
                  <th className="th-num">30<br />Convenio</th>
                  <th className="th-num">31<br />Exoneración Aplicada</th>
                  <th className="th-num">32<br />Tipo Renta</th>
                  <th className="th-num">33<br />Modalidad del servicio</th>
                  <th className="th-num">34<br />Aplicación Art. 76</th>
                  <th className="th-num">35<br />CAR CP a Modificar</th>
                  <th className="th-num">36<br />Libre Utilización</th>
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_periodo || ''} onChange={(e) => updateCell(idx, 'col1_periodo', e.target.value)} className="table-input input-small" maxLength="8" /></td>
                    <td><input type="text" value={row.col2_carSunat || ''} onChange={(e) => updateCell(idx, 'col2_carSunat', e.target.value)} className="table-input input-car" maxLength="27" /></td>
                    <td><input type="text" value={row.col3_fecEmision || ''} onChange={(e) => updateCell(idx, 'col3_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col4_tipo || ''} onChange={(e) => updateCell(idx, 'col4_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col5_serie || ''} onChange={(e) => updateCell(idx, 'col5_serie', e.target.value)} className="table-input input-small" maxLength="20" /></td>
                    <td><input type="text" value={row.col6_numeroCP || ''} onChange={(e) => updateCell(idx, 'col6_numeroCP', e.target.value)} className="table-input" maxLength="20" /></td>
                    <td><input type="text" value={row.col7_valorAdquisiciones || ''} onChange={(e) => updateCell(idx, 'col7_valorAdquisiciones', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col8_otrosConceptos || ''} onChange={(e) => updateCell(idx, 'col8_otrosConceptos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col9_importeTotal || ''} onChange={(e) => updateCell(idx, 'col9_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col10_tipo || ''} onChange={(e) => updateCell(idx, 'col10_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col11_serie || ''} onChange={(e) => updateCell(idx, 'col11_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col12_damODsi || ''} onChange={(e) => updateCell(idx, 'col12_damODsi', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col13_numeroCP || ''} onChange={(e) => updateCell(idx, 'col13_numeroCP', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col14_montoRetencionIGV || ''} onChange={(e) => updateCell(idx, 'col14_montoRetencionIGV', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col15_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col15_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col16_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col16_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col17_pais || ''} onChange={(e) => updateCell(idx, 'col17_pais', e.target.value)} className="table-input input-tiny" maxLength="4" /></td>
                    <td><input type="text" value={row.col18_apellidosNombresRazonSocial || ''} onChange={(e) => updateCell(idx, 'col18_apellidosNombresRazonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col19_domicilioExtranjero || ''} onChange={(e) => updateCell(idx, 'col19_domicilioExtranjero', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col20_numIdentificacion || ''} onChange={(e) => updateCell(idx, 'col20_numIdentificacion', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col21_numIdentifFiscal || ''} onChange={(e) => updateCell(idx, 'col21_numIdentifFiscal', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col22_apellidosNombresRazonSocial || ''} onChange={(e) => updateCell(idx, 'col22_apellidosNombresRazonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col23_pais || ''} onChange={(e) => updateCell(idx, 'col23_pais', e.target.value)} className="table-input input-tiny" maxLength="4" /></td>
                    <td><input type="text" value={row.col24_vinculoCR || ''} onChange={(e) => updateCell(idx, 'col24_vinculoCR', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col25_rentaBruta || ''} onChange={(e) => updateCell(idx, 'col25_rentaBruta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_deduccCosto || ''} onChange={(e) => updateCell(idx, 'col26_deduccCosto', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col27_rentaNeta || ''} onChange={(e) => updateCell(idx, 'col27_rentaNeta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col28_tasaRetencion || ''} onChange={(e) => updateCell(idx, 'col28_tasaRetencion', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col29_impuestoRetenido || ''} onChange={(e) => updateCell(idx, 'col29_impuestoRetenido', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col30_convenio || ''} onChange={(e) => updateCell(idx, 'col30_convenio', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col31_exoneracionAplicada || ''} onChange={(e) => updateCell(idx, 'col31_exoneracionAplicada', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col32_tipoRenta || ''} onChange={(e) => updateCell(idx, 'col32_tipoRenta', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col33_modalidadServicio || ''} onChange={(e) => updateCell(idx, 'col33_modalidadServicio', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col34_aplicacionArt76 || ''} onChange={(e) => updateCell(idx, 'col34_aplicacionArt76', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col35_carCpModificar || ''} onChange={(e) => updateCell(idx, 'col35_carCpModificar', e.target.value)} className="table-input input-car" maxLength="27" /></td>
                    <td><input type="text" value={row.col36_libreUtilizacion || ''} onChange={(e) => updateCell(idx, 'col36_libreUtilizacion', e.target.value)} className="table-input" /></td>
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="38" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para RCE COMPLETA TC - TABLA 5 COLUMNAS (Tipo de Cambio)
const RceCompletaTcView = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder }) => {
  const [editableData, setEditableData] = useState([]);
  const [correlativo, setCorrelativo] = useState('1');

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Estructura RCE COMPLETA TC: 5 columnas según imagen SUNAT
  // ID | 1-Periodo YYYYMM (8) | 2-Fecha Emisión (1) | 3-Código Moneda (15) | 4-TC Soles (2) | 5-TC Dólares (20)
  const crearDatosEjemplo = () => {
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    return [{
      id: '00',
      col1_periodo: periodo,           // 1 - Periodo YYYYMM (8 caracteres)
      col2_fecEmision: '',             // 2 - Fecha Emisión (1 caracter)
      col3_codigoMoneda: '',           // 3 - Código Moneda (15 caracteres)
      col4_tcSoles: '',                // 4 - Tipo de Cambio Soles (2 caracteres)
      col5_tcDolares: ''               // 5 - Tipo de Cambio Dólares (20 caracteres)
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) =>
      idx === rowIndex ? { ...row, [field]: value } : row
    ));
  };

  const addRow = () => {
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length).padStart(2, '0'),
      col1_periodo: periodo,
      col2_fecEmision: '',
      col3_codigoMoneda: '',
      col4_tcSoles: '',
      col5_tcDolares: ''
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    if (!editableData || editableData.length === 0) {
      alert('No hay datos para guardar');
      return;
    }
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RCE COMPLETA TC',
        datosEditados: { datosUnificados: editableData }
      });
      alert(result.success ? `✅ ${result.message}` : `❌ Error: ${result.error}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { correlativo });
    }
  };

  return (
    <div className="rvie-complementa-view">
      {/* Header estilo Excel - RCE COMPLETA TC */}
      <div className="rvie-header-excel rce-header">
        <div className="header-row">
          <span className="header-label">EMPRESA:</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.ruc || ''} readOnly className="header-input header-ruc" />
        </div>
        <div className="header-row">
          <span className="header-label">PERIODO</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={`${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`} readOnly className="header-input header-periodo" />
        </div>
        <div className="header-row">
          <span className="header-label">N° CORRELATIVO</span>
          <input
            type="text"
            value={correlativo}
            onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, ''))}
            className="header-input header-correlativo"
            maxLength="10"
            style={{ backgroundColor: '#c5cfe0', fontWeight: 'bold' }}
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles - RCE COMPLETA TC</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      {/* Tabla 5 columnas - RCE COMPLETA TC */}
      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RCE COMPLETA TC - Estructura Tipo de Cambio (5 Columnas)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-5cols">
            <table className="rvie-table editable-table">
              <thead>
                {/* Fila de grupos principales */}
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th rowSpan="2" className="th-periodo">1<br />Periodo<br />YYYYMM</th>
                  <th rowSpan="2" className="th-fecha">2<br />Fecha<br />Emisión</th>
                  <th rowSpan="2" className="th-moneda">3<br />Código<br />Moneda</th>
                  <th colSpan="2" className="th-group th-tipocambio">4 - 5<br />Tipo de Cambio</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                {/* Fila de subcolumnas */}
                <tr className="header-cols">
                  <th className="th-num">Soles</th>
                  <th className="th-num">Dólares</th>
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_periodo || ''} onChange={(e) => updateCell(idx, 'col1_periodo', e.target.value)} className="table-input input-small" maxLength="8" /></td>
                    <td><input type="text" value={row.col2_fecEmision || ''} onChange={(e) => updateCell(idx, 'col2_fecEmision', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col3_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col3_codigoMoneda', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col4_tcSoles || ''} onChange={(e) => updateCell(idx, 'col4_tcSoles', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col5_tcDolares || ''} onChange={(e) => updateCell(idx, 'col5_tcDolares', e.target.value)} className="table-input" maxLength="20" /></td>
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para RCE REEMPLAZA - TABLA 50 COLUMNAS
const RceReemplazaView = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [indicadorCont, setIndicadorCont] = useState('1'); // 1 = SI (tiene contenido), 0 = NO
  const [indicadorMoned, setIndicadorMoned] = useState('1'); // 1 = PEN, 2 = USD

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RCE REEMPLAZA:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RCE REEMPLAZA',
        datosEmpresa
      );

      // Agregar valores por defecto para campos faltantes
      const camposDefault = {
        col4_carSunat: '', col5_fecEmision: '', col6_fecVence: '', col7_tipo: '',
        col8_serie: '', col9_damODsi: '', col10_numInicial: '', col11_numFinal: '',
        col12_tipoDoc: '', col13_numDoc: '', col14_razonSocialProveedor: '',
        col15_baseImponibleGravada: '', col16_igvGravada: '', col17_baseImponibleGravadaExport: '',
        col18_igvGravadaExport: '', col19_baseImponibleNoGravada: '', col20_igvNoGravada: '',
        col21_adquisicionesNoGravadas: '', col22_isc: '', col23_icbper: '',
        col24_otrosTributos: '', col25_importeTotal: '', col26_codigoMoneda: 'PEN',
        col27_tipoCambio: '', col28_fecEmisionRef: '', col29_tipoRef: '', col30_serieRef: '',
        col31_damODsiRef: '', col32_numeroRef: '', col33_clasificacionBsSs: '',
        col34_identificacionContrato: '', col35_porcentajeParticipacion: '',
        col36_impuestoMateriaBeneficio: '', col37_carCpModificar: '', col38_libre: '',
        col39_tipoNota: '', col40_estComp: '', col41_incal: '',
        col42_clu1: '', col43_clu2: '', col44_clu3: '', col45_clu4: '', col46_clu5: '',
        col47_clu6: '', col48_clu7: '', col49_clu8: '', col50_clu9: ''
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RCE REEMPLAZA:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  // Estructura RCE REEMPLAZA: 50 columnas según imagen SUNAT
  const crearDatosEjemplo = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    return [{
      id: '01',
      col1_ruc: rucEmpresa,
      col2_razonSocial: razonSocialEmpresa,
      col3_periodo: periodo,
      col4_carSunat: '',
      col5_fecEmision: '',
      col6_fecVence: '',
      col7_tipo: '',
      col8_serie: '',
      col9_damODsi: '',
      col10_numInicial: '',
      col11_numFinal: '',
      col12_tipoDoc: '',
      col13_numDoc: '',
      col14_razonSocialProveedor: '',
      col15_baseImponibleGravada: '',
      col16_igvGravada: '',
      col17_baseImponibleGravadaExport: '',
      col18_igvGravadaExport: '',
      col19_baseImponibleNoGravada: '',
      col20_igvNoGravada: '',
      col21_adquisicionesNoGravadas: '',
      col22_isc: '',
      col23_icbper: '',
      col24_otrosTributos: '',
      col25_importeTotal: '',
      col26_codigoMoneda: 'PEN',
      col27_tipoCambio: '',
      col28_fecEmisionRef: '',
      col29_tipoRef: '',
      col30_serieRef: '',
      col31_damODsiRef: '',
      col32_numeroRef: '',
      col33_clasificacionBsSs: '',
      col34_identificacionContrato: '',
      col35_porcentajeParticipacion: '',
      col36_impuestoMateriaBeneficio: '',
      col37_carCpModificar: '',
      col38_libre: '',
      col39_tipoNota: '',
      col40_estComp: '',
      col41_incal: '',
      col42_clu1: '', col43_clu2: '', col44_clu3: '', col45_clu4: '', col46_clu5: '',
      col47_clu6: '', col48_clu7: '', col49_clu8: '', col50_clu9: ''
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) => idx === rowIndex ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_ruc: rucEmpresa, col2_razonSocial: razonSocialEmpresa, col3_periodo: periodo, col4_carSunat: '',
      col5_fecEmision: '', col6_fecVence: '', col7_tipo: '', col8_serie: '', col9_damODsi: '',
      col10_numInicial: '', col11_numFinal: '', col12_tipoDoc: '', col13_numDoc: '',
      col14_razonSocialProveedor: '',
      col15_baseImponibleGravada: '', col16_igvGravada: '', col17_baseImponibleGravadaExport: '',
      col18_igvGravadaExport: '', col19_baseImponibleNoGravada: '', col20_igvNoGravada: '',
      col21_adquisicionesNoGravadas: '', col22_isc: '', col23_icbper: '',
      col24_otrosTributos: '', col25_importeTotal: '', col26_codigoMoneda: 'PEN', col27_tipoCambio: '',
      col28_fecEmisionRef: '', col29_tipoRef: '', col30_serieRef: '', col31_damODsiRef: '', col32_numeroRef: '',
      col33_clasificacionBsSs: '', col34_identificacionContrato: '', col35_porcentajeParticipacion: '',
      col36_impuestoMateriaBeneficio: '', col37_carCpModificar: '', col38_libre: '',
      col39_tipoNota: '', col40_estComp: '', col41_incal: '',
      col42_clu1: '', col43_clu2: '', col44_clu3: '', col45_clu4: '', col46_clu5: '',
      col47_clu6: '', col48_clu7: '', col49_clu8: '', col50_clu9: ''
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RCE REEMPLAZA',
        datosEditados: { datosUnificados: editableData }
      });
      alert(result.success ? `✅ ${result.message}` : `❌ Error: ${result.error}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { indicadorCont, indicadorMoned });
    }
  };

  return (
    <div className="rvie-complementa-view">
      <div className="rvie-header-excel rce-header">
        <div className="header-row">
          <span className="header-label">EMPRESA:</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.ruc || ''} readOnly className="header-input header-ruc" />
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.razonSocial || ''} readOnly className="header-input header-razon-social" />
        </div>
        <div className="header-row">
          <span className="header-label">PERIODO</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={`${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`} readOnly className="header-input header-periodo" />
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR CONT</span>
          <input
            type="text"
            value={indicadorCont}
            onChange={(e) => setIndicadorCont(e.target.value.replace(/[^01]/g, '').slice(0, 1))}
            className="header-input header-indicador"
            maxLength="1"
          />
          <span className="header-hint">1 = SI; 0 = NO</span>
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR MONED</span>
          <input
            type="text"
            value={indicadorMoned}
            onChange={(e) => setIndicadorMoned(e.target.value.replace(/[^12]/g, '').slice(0, 1))}
            className="header-input header-indicador"
            maxLength="1"
          />
          <span className="header-hint">1 = PEN; 2 = USD</span>
        </div>
      </div>

      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles - RCE REEMPLAZA</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RCE REEMPLAZA - Estructura (50 Columnas)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-50cols">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th colSpan="2" className="th-group th-generador">Datos del Generador o Sujeto Obligado</th>
                  <th rowSpan="2" className="th-periodo">3<br />Periodo<br />(AAAAMM)</th>
                  <th rowSpan="2" className="th-car">4<br />CAR-SUNAT<br />(Tabla 7)</th>
                  <th colSpan="9" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th className="th-group th-proveedor">Datos del Proveedor</th>
                  <th colSpan="2" className="th-group th-gravada1">Adqui. Gravadas Dest. a Op. Gravadas y/o Exportación</th>
                  <th colSpan="2" className="th-group th-gravada2">Adqui. Gravadas Dest. a Op. Gravadas y/o de Export. y No Gravadas</th>
                  <th colSpan="2" className="th-group th-nogravada">Adqui. gravadas dest. a Op. no gravadas</th>
                  <th rowSpan="2" className="th-otros">21<br />Adquisiciones<br />No Gravadas</th>
                  <th rowSpan="2" className="th-otros">22<br />ISC</th>
                  <th rowSpan="2" className="th-otros">23<br />ICBPER</th>
                  <th colSpan="2" className="th-group th-moneda">Otros Tributos y Cargos</th>
                  <th colSpan="2" className="th-group th-moneda">Moneda</th>
                  <th colSpan="5" className="th-group th-referencia">Documento de Referencia o que modifica</th>
                  <th colSpan="5" className="th-group th-clasificacion">Clasificación y Otros</th>
                  <th rowSpan="2" className="th-libre">38<br />Libre</th>
                  <th rowSpan="2" className="th-estados">39<br />Tipo de<br />Nota</th>
                  <th rowSpan="2" className="th-estados">40<br />Est.<br />Comp.</th>
                  <th rowSpan="2" className="th-estados">41<br />Incal</th>
                  <th colSpan="9" className="th-group th-libre">Libre Utilización (42-50)</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">1<br />RUC</th>
                  <th className="th-num">2<br />Nombres y Apellidos y/o Razón Social</th>
                  <th className="th-num">5<br />Fec. Emisión</th>
                  <th className="th-num">6<br />Fec. Vence</th>
                  <th className="th-num">7<br />Tipo</th>
                  <th className="th-num">8<br />Serie</th>
                  <th className="th-num">9<br />DAM O DSI</th>
                  <th className="th-num">10<br />Num Inicial</th>
                  <th className="th-num">11<br />Num Final</th>
                  <th className="th-num">12<br />Tipo Doc</th>
                  <th className="th-num">13<br />Número Doc</th>
                  <th className="th-num">14<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">15<br />Base Imponible</th>
                  <th className="th-num">16<br />IGV</th>
                  <th className="th-num">17<br />Base Imponible</th>
                  <th className="th-num">18<br />IGV</th>
                  <th className="th-num">19<br />Base Imponible</th>
                  <th className="th-num">20<br />IGV</th>
                  <th className="th-num">24<br />Otros Tributos y Cargos</th>
                  <th className="th-num">25<br />Importe Total</th>
                  <th className="th-num">26<br />Código Moneda</th>
                  <th className="th-num">27<br />Tipo de Cambio</th>
                  <th className="th-num">28<br />Fec. Emisión</th>
                  <th className="th-num">29<br />Tipo</th>
                  <th className="th-num">30<br />Serie</th>
                  <th className="th-num">31<br />DAM o DSI</th>
                  <th className="th-num">32<br />Número CP</th>
                  <th className="th-num">33<br />Clasif. Bs y Ss &gt;1500 UIT</th>
                  <th className="th-num">34<br />Identificación del contrato</th>
                  <th className="th-num">35<br />% Participación</th>
                  <th className="th-num">36<br />Impuesto Materia Beneficio</th>
                  <th className="th-num">37<br />CAR CP a Modificar</th>
                  <th className="th-num">CLU1</th>
                  <th className="th-num">CLU2</th>
                  <th className="th-num">CLU3</th>
                  <th className="th-num">CLU4</th>
                  <th className="th-num">CLU5</th>
                  <th className="th-num">CLU6</th>
                  <th className="th-num">CLU7</th>
                  <th className="th-num">CLU8</th>
                  <th className="th-num">CLU9</th>
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx + 1).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_ruc || ''} onChange={(e) => updateCell(idx, 'col1_ruc', e.target.value)} className="table-input" maxLength="11" /></td>
                    <td><input type="text" value={row.col2_razonSocial || ''} onChange={(e) => updateCell(idx, 'col2_razonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col3_periodo || ''} onChange={(e) => updateCell(idx, 'col3_periodo', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col4_carSunat || ''} onChange={(e) => updateCell(idx, 'col4_carSunat', e.target.value)} className="table-input input-car" maxLength="27" /></td>
                    <td><input type="text" value={row.col5_fecEmision || ''} onChange={(e) => updateCell(idx, 'col5_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col6_fecVence || ''} onChange={(e) => updateCell(idx, 'col6_fecVence', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col7_tipo || ''} onChange={(e) => updateCell(idx, 'col7_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col8_serie || ''} onChange={(e) => updateCell(idx, 'col8_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col9_damODsi || ''} onChange={(e) => updateCell(idx, 'col9_damODsi', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col10_numInicial || ''} onChange={(e) => updateCell(idx, 'col10_numInicial', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col11_numFinal || ''} onChange={(e) => updateCell(idx, 'col11_numFinal', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col12_tipoDoc || ''} onChange={(e) => updateCell(idx, 'col12_tipoDoc', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col13_numDoc || ''} onChange={(e) => updateCell(idx, 'col13_numDoc', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col14_razonSocialProveedor || ''} onChange={(e) => updateCell(idx, 'col14_razonSocialProveedor', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col15_baseImponibleGravada || ''} onChange={(e) => updateCell(idx, 'col15_baseImponibleGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col16_igvGravada || ''} onChange={(e) => updateCell(idx, 'col16_igvGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col17_baseImponibleGravadaExport || ''} onChange={(e) => updateCell(idx, 'col17_baseImponibleGravadaExport', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col18_igvGravadaExport || ''} onChange={(e) => updateCell(idx, 'col18_igvGravadaExport', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col19_baseImponibleNoGravada || ''} onChange={(e) => updateCell(idx, 'col19_baseImponibleNoGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col20_igvNoGravada || ''} onChange={(e) => updateCell(idx, 'col20_igvNoGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col21_adquisicionesNoGravadas || ''} onChange={(e) => updateCell(idx, 'col21_adquisicionesNoGravadas', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col22_isc || ''} onChange={(e) => updateCell(idx, 'col22_isc', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col23_icbper || ''} onChange={(e) => updateCell(idx, 'col23_icbper', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col24_otrosTributos || ''} onChange={(e) => updateCell(idx, 'col24_otrosTributos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col25_importeTotal || ''} onChange={(e) => updateCell(idx, 'col25_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col26_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col27_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col27_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col28_fecEmisionRef || ''} onChange={(e) => updateCell(idx, 'col28_fecEmisionRef', e.target.value)} className="table-input input-date" /></td>
                    <td><input type="text" value={row.col29_tipoRef || ''} onChange={(e) => updateCell(idx, 'col29_tipoRef', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col30_serieRef || ''} onChange={(e) => updateCell(idx, 'col30_serieRef', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col31_damODsiRef || ''} onChange={(e) => updateCell(idx, 'col31_damODsiRef', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col32_numeroRef || ''} onChange={(e) => updateCell(idx, 'col32_numeroRef', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col33_clasificacionBsSs || ''} onChange={(e) => updateCell(idx, 'col33_clasificacionBsSs', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col34_identificacionContrato || ''} onChange={(e) => updateCell(idx, 'col34_identificacionContrato', e.target.value)} className="table-input" /></td>
                    <td><input type="text" value={row.col35_porcentajeParticipacion || ''} onChange={(e) => updateCell(idx, 'col35_porcentajeParticipacion', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col36_impuestoMateriaBeneficio || ''} onChange={(e) => updateCell(idx, 'col36_impuestoMateriaBeneficio', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col37_carCpModificar || ''} onChange={(e) => updateCell(idx, 'col37_carCpModificar', e.target.value)} className="table-input input-car" /></td>
                    <td><input type="text" value={row.col38_libre || ''} onChange={(e) => updateCell(idx, 'col38_libre', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col39_tipoNota || ''} onChange={(e) => updateCell(idx, 'col39_tipoNota', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col40_estComp || ''} onChange={(e) => updateCell(idx, 'col40_estComp', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col41_incal || ''} onChange={(e) => updateCell(idx, 'col41_incal', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col42_clu1 || ''} onChange={(e) => updateCell(idx, 'col42_clu1', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col43_clu2 || ''} onChange={(e) => updateCell(idx, 'col43_clu2', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col44_clu3 || ''} onChange={(e) => updateCell(idx, 'col44_clu3', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col45_clu4 || ''} onChange={(e) => updateCell(idx, 'col45_clu4', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col46_clu5 || ''} onChange={(e) => updateCell(idx, 'col46_clu5', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col47_clu6 || ''} onChange={(e) => updateCell(idx, 'col47_clu6', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col48_clu7 || ''} onChange={(e) => updateCell(idx, 'col48_clu7', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col49_clu8 || ''} onChange={(e) => updateCell(idx, 'col49_clu8', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col50_clu9 || ''} onChange={(e) => updateCell(idx, 'col50_clu9', e.target.value)} className="table-input input-small" /></td>
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="52" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para RCE AJUSTES POST 1 - TABLA 37 COLUMNAS + Libre Utilización (42-80)
const RceAjustesPost1View = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [indicadorCont, setIndicadorCont] = useState('1');
  const [indicadorMoned, setIndicadorMoned] = useState('1');
  const [correlativo, setCorrelativo] = useState('01');

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RCE AJUSTES POST 1:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RCE AJUSTES POST 1',
        datosEmpresa
      );

      // Agregar valores por defecto para campos faltantes (columnas según SUNAT)
      const camposDefault = {
        col4_carSunat: '', col5_fecEmision: '', col6_fecVence: '', col7_tipo: '',
        col8_serie: '', col9_damODsi: '', col10_numInicial: '', col11_numFinal: '',
        col12_tipoDoc: '', col13_numDoc: '', col14_razonSocialProveedor: '',
        col15_baseImponibleGravada: '', col16_igvGravada: '', col17_baseImponibleGravadaExport: '',
        col18_igvGravadaExport: '', col19_baseImponibleNoGravada: '', col20_igvNoGravada: '',
        col21_adquisicionesNoGravadas: '', col22_isc: '', col23_icbper: '',
        col24_otrosTributos: '', col25_importeTotal: '', col26_codigoMoneda: 'PEN',
        col27_tipoCambio: '', col28_fecEmisionRef: '', col29_tipoRef: '', col30_serieRef: '',
        col31_damODsiRef: '', col32_numeroRef: '', col33_clasificacionBsSs: '',
        col34_identificacionContrato: '', col35_porcentajeParticipacion: '',
        col36_impuestoMateriaBeneficio: '', col37_carCpModificar: '',
        ...Object.fromEntries([...Array(39)].map((_, i) => [`col${42 + i}_libre`, '']))
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RCE AJUSTES POST 1:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  const crearDatosEjemplo = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    return [{
      id: '01',
      col1_ruc: rucEmpresa,
      col2_razonSocial: razonSocialEmpresa,
      col3_periodo: periodo,
      col4_carSunat: '',
      col5_fecEmision: '',
      col6_fecVence: '',
      col7_tipo: '',
      col8_serie: '',
      col9_damODsi: '',
      col10_numInicial: '',
      col11_numFinal: '',
      col12_tipoDoc: '',
      col13_numDoc: '',
      col14_razonSocialProveedor: '',
      col15_baseImponibleGravada: '',
      col16_igvGravada: '',
      col17_baseImponibleGravadaExport: '',
      col18_igvGravadaExport: '',
      col19_baseImponibleNoGravada: '',
      col20_igvNoGravada: '',
      col21_adquisicionesNoGravadas: '',
      col22_isc: '',
      col23_icbper: '',
      col24_otrosTributos: '',
      col25_importeTotal: '',
      col26_codigoMoneda: 'PEN',
      col27_tipoCambio: '',
      col28_fecEmisionRef: '',
      col29_tipoRef: '',
      col30_serieRef: '',
      col31_damODsiRef: '',
      col32_numeroRef: '',
      col33_clasificacionBsSs: '',
      col34_identificacionContrato: '',
      col35_porcentajeParticipacion: '',
      col36_impuestoMateriaBeneficio: '',
      col37_carCpModificar: '',
      ...Object.fromEntries([...Array(39)].map((_, i) => [`col${42 + i}_libre`, '']))
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) => {
      if (idx !== rowIndex) return row;

      const newRow = { ...row, [field]: value };

      // Si se cambió la moneda a PEN, limpiar automáticamente el tipo de cambio
      // SUNAT requiere que el campo 27 (tipo de cambio) esté vacío cuando la moneda es PEN
      if (field === 'col26_codigoMoneda' && value.toUpperCase() === 'PEN') {
        newRow.col27_tipoCambio = '';
      }

      return newRow;
    }));
  };

  const addRow = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_ruc: rucEmpresa,
      col2_razonSocial: razonSocialEmpresa,
      col3_periodo: periodo,
      col4_carSunat: '',
      col5_fecEmision: '',
      col6_fecVence: '',
      col7_tipo: '',
      col8_serie: '',
      col9_damODsi: '',
      col10_numInicial: '',
      col11_numFinal: '',
      col12_tipoDoc: '',
      col13_numDoc: '',
      col14_razonSocialProveedor: '',
      col15_baseImponibleGravada: '',
      col16_igvGravada: '',
      col17_baseImponibleGravadaExport: '',
      col18_igvGravadaExport: '',
      col19_baseImponibleNoGravada: '',
      col20_igvNoGravada: '',
      col21_adquisicionesNoGravadas: '',
      col22_isc: '',
      col23_icbper: '',
      col24_otrosTributos: '',
      col25_importeTotal: '',
      col26_codigoMoneda: 'PEN',
      col27_tipoCambio: '',
      col28_fecEmisionRef: '',
      col29_tipoRef: '',
      col30_serieRef: '',
      col31_damODsiRef: '',
      col32_numeroRef: '',
      col33_clasificacionBsSs: '',
      col34_identificacionContrato: '',
      col35_porcentajeParticipacion: '',
      col36_impuestoMateriaBeneficio: '',
      col37_carCpModificar: '',
      ...Object.fromEntries([...Array(39)].map((_, i) => [`col${42 + i}_libre`, '']))
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RCE AJUSTES POST 1',
        datosEditados: { datosUnificados: editableData }
      });
      alert(result.success ? `✅ ${result.message}` : `❌ Error: ${result.error}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino');
      return;
    }

    // Validación SUNAT: Campo 37 (CAR CP a Modificar) es obligatorio en RCE AJUSTES POST 1
    const filaSinCAR = editableData.findIndex(row => !row.col37_carCpModificar || row.col37_carCpModificar.trim() === '');
    if (filaSinCAR !== -1) {
      const continuar = window.confirm(
        `⚠️ ADVERTENCIA SUNAT:\n\n` +
        `La fila ${filaSinCAR + 1} tiene el campo 37 "CAR CP a Modificar" vacío.\n\n` +
        `Este campo es OBLIGATORIO en RCE AJUSTES POST 1.\n` +
        `SUNAT rechazará el archivo con el error: "Campo no debe estar vacío" y "Car no existe".\n\n` +
        `¿Desea continuar de todas formas?`
      );
      if (!continuar) return;
    }

    // Limpiar automáticamente tipo de cambio cuando la moneda es PEN
    // SUNAT requiere que el campo 27 esté vacío cuando la moneda es PEN
    const datosLimpios = editableData.map(row => {
      const newRow = { ...row };
      if (newRow.col26_codigoMoneda && newRow.col26_codigoMoneda.toUpperCase() === 'PEN') {
        if (newRow.col27_tipoCambio && newRow.col27_tipoCambio.trim() !== '') {
          console.log(`🔧 Auto-limpiando tipo de cambio para fila con moneda PEN`);
          newRow.col27_tipoCambio = '';
        }
      }
      return newRow;
    });

    if (onGenerarArchivo) {
      onGenerarArchivo(datosLimpios, { indicadorCont, indicadorMoned, correlativo });
    }
  };

  return (
    <div className="rvie-complementa-view">
      <div className="rvie-header-excel rce-header">
        <div className="header-row">
          <span className="header-label">EMPRESA:</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.ruc || ''} readOnly className="header-input header-ruc" />
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.razonSocial || ''} readOnly className="header-input header-razon-social" />
        </div>
        <div className="header-row">
          <span className="header-label">PERIODO</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={`${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`} readOnly className="header-input header-periodo" />
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR CONT</span>
          <input type="text" value={indicadorCont} onChange={(e) => setIndicadorCont(e.target.value.replace(/[^01]/g, '').slice(0, 1))} className="header-input header-indicador" maxLength="1" />
          <span className="header-hint">1 = SI; 0 = NO</span>
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR MONED</span>
          <input type="text" value={indicadorMoned} onChange={(e) => setIndicadorMoned(e.target.value.replace(/[^12]/g, '').slice(0, 1))} className="header-input header-indicador" maxLength="1" />
          <span className="header-hint">1 = PEN; 2 = USD</span>
        </div>
        <div className="header-row">
          <span className="header-label">N° CORRELATIVO</span>
          <input type="text" value={correlativo} onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length === 1) setCorrelativo(val.padStart(2, '0')); else if (val.length === 0) setCorrelativo('01'); }} className="header-input header-correlativo" maxLength="2" />
        </div>
      </div>

      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles - RCE AJUSTES POST 1</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RCE AJUSTES POST 1 - Estructura (Columnas 1-37 + Libre Utilización 42-80)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-rce-ajustes">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th colSpan="2" className="th-group th-generador">Datos del Generador o Sujeto Obligado</th>
                  <th rowSpan="2" className="th-periodo">3<br />Periodo<br />(AAAAMM)</th>
                  <th rowSpan="2" className="th-car">4<br />CAR-SUNAT<br />(Tabla 7)</th>
                  <th colSpan="8" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th colSpan="2" className="th-group th-proveedor">Datos del Proveedor</th>
                  <th colSpan="2" className="th-group th-gravada1">Adqui. Gravadas Dest. a Op. Grav. y/o Export.</th>
                  <th colSpan="2" className="th-group th-gravada2">Adqui. Gravadas Dest. a Op. Grav. y/o Export. Y No Grav.</th>
                  <th colSpan="2" className="th-group th-nogravada">Adqui. grav. dest. a Op. no gravadas</th>
                  <th rowSpan="2" className="th-otros">21<br />Adqui.<br />No Grav.</th>
                  <th rowSpan="2" className="th-otros">22<br />ISC</th>
                  <th rowSpan="2" className="th-otros">23<br />ICBPER</th>
                  <th rowSpan="2" className="th-otros">24<br />Otros<br />Trib. Cargos</th>
                  <th rowSpan="2" className="th-otros">25<br />Importe<br />Total</th>
                  <th rowSpan="2" className="th-moneda">26<br />Código<br />Moneda</th>
                  <th rowSpan="2" className="th-moneda">27<br />Tipo de<br />Cambio</th>
                  <th colSpan="5" className="th-group th-referencia">Documento de Referencia o que modifica</th>
                  <th rowSpan="2" className="th-clasificacion">33<br />Clasif.<br />Bs/Ss</th>
                  <th rowSpan="2" className="th-clasificacion">34<br />ID<br />Contrato</th>
                  <th rowSpan="2" className="th-clasificacion">35<br />%<br />Partic.</th>
                  <th rowSpan="2" className="th-clasificacion">36<br />Imp.<br />Benef.</th>
                  <th rowSpan="2" className="th-car">37<br />CAR<br />CP</th>
                  <th colSpan="39" className="th-group th-libre">42-80 Libre Utilización</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">1<br />RUC</th>
                  <th className="th-num">2<br />Razón Social</th>
                  <th className="th-num">5<br />Fec. Emisión</th>
                  <th className="th-num">6<br />Fec. Venc.</th>
                  <th className="th-num">7<br />Tipo</th>
                  <th className="th-num">8<br />Serie</th>
                  <th className="th-num">9<br />DAM O DSI</th>
                  <th className="th-num">10<br />Num Inicial</th>
                  <th className="th-num">11<br />Num Final</th>
                  <th className="th-num">12<br />Tipo Doc</th>
                  <th className="th-num">13<br />Número Doc</th>
                  <th className="th-num">14<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">15<br />Base Imp.</th>
                  <th className="th-num">16<br />IGV</th>
                  <th className="th-num">17<br />Base Imp.</th>
                  <th className="th-num">18<br />IGV</th>
                  <th className="th-num">19<br />Base Imp.</th>
                  <th className="th-num">20<br />IGV</th>
                  <th className="th-num">28<br />Fec. Emisión</th>
                  <th className="th-num">29<br />Tipo</th>
                  <th className="th-num">30<br />Serie</th>
                  <th className="th-num">31<br />DAM o DSI</th>
                  <th className="th-num">32<br />Número CP</th>
                  {[...Array(39)].map((_, i) => (
                    <th key={i} className="th-num th-libre">{42 + i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx + 1).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_ruc || ''} onChange={(e) => updateCell(idx, 'col1_ruc', e.target.value)} className="table-input input-ruc" maxLength="11" /></td>
                    <td><input type="text" value={row.col2_razonSocial || ''} onChange={(e) => updateCell(idx, 'col2_razonSocial', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col3_periodo || ''} onChange={(e) => updateCell(idx, 'col3_periodo', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col4_carSunat || ''} onChange={(e) => updateCell(idx, 'col4_carSunat', e.target.value)} className="table-input input-car" /></td>
                    <td><input type="text" value={row.col5_fecEmision || ''} onChange={(e) => updateCell(idx, 'col5_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col6_fecVence || ''} onChange={(e) => updateCell(idx, 'col6_fecVence', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col7_tipo || ''} onChange={(e) => updateCell(idx, 'col7_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col8_serie || ''} onChange={(e) => updateCell(idx, 'col8_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col9_damODsi || ''} onChange={(e) => updateCell(idx, 'col9_damODsi', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col10_numInicial || ''} onChange={(e) => updateCell(idx, 'col10_numInicial', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col11_numFinal || ''} onChange={(e) => updateCell(idx, 'col11_numFinal', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col12_tipoDoc || ''} onChange={(e) => updateCell(idx, 'col12_tipoDoc', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col13_numDoc || ''} onChange={(e) => updateCell(idx, 'col13_numDoc', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col14_razonSocialProveedor || ''} onChange={(e) => updateCell(idx, 'col14_razonSocialProveedor', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col15_baseImponibleGravada || ''} onChange={(e) => updateCell(idx, 'col15_baseImponibleGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col16_igvGravada || ''} onChange={(e) => updateCell(idx, 'col16_igvGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col17_baseImponibleGravadaExport || ''} onChange={(e) => updateCell(idx, 'col17_baseImponibleGravadaExport', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col18_igvGravadaExport || ''} onChange={(e) => updateCell(idx, 'col18_igvGravadaExport', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col19_baseImponibleNoGravada || ''} onChange={(e) => updateCell(idx, 'col19_baseImponibleNoGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col20_igvNoGravada || ''} onChange={(e) => updateCell(idx, 'col20_igvNoGravada', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col21_adquisicionesNoGravadas || ''} onChange={(e) => updateCell(idx, 'col21_adquisicionesNoGravadas', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col22_isc || ''} onChange={(e) => updateCell(idx, 'col22_isc', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col23_icbper || ''} onChange={(e) => updateCell(idx, 'col23_icbper', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col24_otrosTributos || ''} onChange={(e) => updateCell(idx, 'col24_otrosTributos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col25_importeTotal || ''} onChange={(e) => updateCell(idx, 'col25_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col26_codigoMoneda', e.target.value.toUpperCase())} className="table-input input-tiny" maxLength="3" title="Moneda: PEN o USD" /></td>
                    <td><input type="text" value={row.col27_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col27_tipoCambio', e.target.value)} className="table-input input-small" disabled={row.col26_codigoMoneda?.toUpperCase() === 'PEN'} title={row.col26_codigoMoneda?.toUpperCase() === 'PEN' ? 'Campo vacío requerido por SUNAT cuando moneda es PEN' : 'Tipo de cambio (solo para USD)'} style={row.col26_codigoMoneda?.toUpperCase() === 'PEN' ? { backgroundColor: '#e9ecef', cursor: 'not-allowed' } : {}} /></td>
                    <td><input type="text" value={row.col28_fecEmisionRef || ''} onChange={(e) => updateCell(idx, 'col28_fecEmisionRef', e.target.value)} className="table-input input-date" /></td>
                    <td><input type="text" value={row.col29_tipoRef || ''} onChange={(e) => updateCell(idx, 'col29_tipoRef', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col30_serieRef || ''} onChange={(e) => updateCell(idx, 'col30_serieRef', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col31_damODsiRef || ''} onChange={(e) => updateCell(idx, 'col31_damODsiRef', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col32_numeroRef || ''} onChange={(e) => updateCell(idx, 'col32_numeroRef', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col33_clasificacionBsSs || ''} onChange={(e) => updateCell(idx, 'col33_clasificacionBsSs', e.target.value)} className="table-input input-tiny" /></td>
                    <td><input type="text" value={row.col34_identificacionContrato || ''} onChange={(e) => updateCell(idx, 'col34_identificacionContrato', e.target.value)} className="table-input" /></td>
                    <td><input type="text" value={row.col35_porcentajeParticipacion || ''} onChange={(e) => updateCell(idx, 'col35_porcentajeParticipacion', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col36_impuestoMateriaBeneficio || ''} onChange={(e) => updateCell(idx, 'col36_impuestoMateriaBeneficio', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col37_carCpModificar || ''} onChange={(e) => updateCell(idx, 'col37_carCpModificar', e.target.value)} className={`table-input input-car ${!row.col37_carCpModificar?.trim() ? 'input-required-empty' : ''}`} placeholder="⚠️ OBLIGATORIO" title="Campo 37 - CAR del CP a Modificar (OBLIGATORIO para SUNAT)" style={!row.col37_carCpModificar?.trim() ? { borderColor: '#dc3545', borderWidth: '2px', backgroundColor: '#fff5f5' } : {}} /></td>
                    {[...Array(39)].map((_, i) => (
                      <td key={i}><input type="text" value={row[`col${42 + i}_libre`] || ''} onChange={(e) => updateCell(idx, `col${42 + i}_libre`, e.target.value)} className="table-input input-small" /></td>
                    ))}
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="80" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente para RCE AJUSTES POST 2 - TABLA 36 COLUMNAS + Libre Utilización
const RceAjustesPost2View = ({ hojaData, onGenerarArchivo, onSeleccionarCarpeta, onCerrarVista, datosEmpresa, selectedFolder, filaParaAutollenar }) => {
  const [editableData, setEditableData] = useState([]);
  const [indicadorCont, setIndicadorCont] = useState('1');
  const [indicadorMoned, setIndicadorMoned] = useState('1');
  const [correlativo, setCorrelativo] = useState('01');

  useEffect(() => {
    if (hojaData?.datosUnificados && hojaData.datosUnificados.length > 0) {
      setEditableData([...hojaData.datosUnificados]);
    } else {
      setEditableData(crearDatosEjemplo());
    }
  }, [hojaData, datosEmpresa]);

  // Efecto para procesar autollenado cuando se selecciona una fila del Excel
  useEffect(() => {
    if (filaParaAutollenar && filaParaAutollenar.timestamp) {
      console.log('🔄 Procesando autollenado RCE AJUSTES POST 2:', filaParaAutollenar);

      // Usar la función de extracción ROBUSTA con rowData (array de valores)
      const nuevaFila = extraerDatosDeFilaExcel(
        filaParaAutollenar.rowObject,
        filaParaAutollenar.headers,
        filaParaAutollenar.rowData,  // Array con los valores por posición
        'RCE AJUSTES POST 2',
        datosEmpresa
      );
      nuevaFila.col1_periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;

      // Agregar valores por defecto para campos faltantes
      const camposDefault = {
        col2_carSunat: '', col3_fecEmision: '', col4_tipo: '', col5_serie: '',
        col6_damODsi: '', col7_numeroCp: '', col8_otrosConceptos: '', col9_importeTotal: '',
        col10_tipoDocSustenta: '', col11_serieSustenta: '', col12_damODsiSustenta: '',
        col13_numeroCpSustenta: '', col14_montoRetencionIgv: '', col15_codigoMoneda: 'PEN',
        col16_tipoCambio: '', col17_paisNoDomiciliado: '', col18_apellidosNombresNoDom: '',
        col19_domicilioExtranjero: '', col20_numIdentificacion: '', col21_numIdentifFiscal: '',
        col22_apellidosNombresBenef: '', col23_paisBeneficiario: '', col24_vinculoCR: '',
        col25_rentaBruta: '', col26_deduccCosto: '', col27_rentaNeta: '', col28_tasaRetencion: '',
        col29_impuestoRetenido: '', col30_convenio: '', col31_exoneracionAplicada: '',
        col32_tipoRenta: '', col33_modalidadServicio: '', col34_aplicacionArt76: '',
        col35_carCpModificar: '', col36_libreUtilizacion: ''
      };

      Object.keys(camposDefault).forEach(campo => {
        if (nuevaFila[campo] === undefined) {
          nuevaFila[campo] = camposDefault[campo];
        }
      });

      setEditableData(prev => {
        nuevaFila.id = String(prev.length + 1).padStart(2, '0');
        console.log('✅ Nueva fila agregada RCE AJUSTES POST 2:', nuevaFila);
        return [...prev, nuevaFila];
      });
    }
  }, [filaParaAutollenar, datosEmpresa]);

  const crearDatosEjemplo = () => {
    const rucEmpresa = datosEmpresa?.ruc || '';
    const razonSocialEmpresa = datosEmpresa?.razonSocial || '';
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    return [{
      id: '01',
      col1_periodo: periodo,
      col2_carSunat: '',
      col3_fecEmision: '',
      col4_tipo: '',
      col5_serie: '',
      col6_damODsi: '',
      col7_numeroCp: '',
      col8_otrosConceptos: '',
      col9_importeTotal: '',
      col10_tipoDocSustenta: '',
      col11_serieSustenta: '',
      col12_damODsiSustenta: '',
      col13_numeroCpSustenta: '',
      col14_montoRetencionIgv: '',
      col15_codigoMoneda: 'PEN',
      col16_tipoCambio: '',
      col17_paisNoDomiciliado: '',
      col18_apellidosNombresNoDom: '',
      col19_domicilioExtranjero: '',
      col20_numIdentificacion: '',
      col21_numIdentifFiscal: '',
      col22_apellidosNombresBenef: '',
      col23_paisBeneficiario: '',
      col24_vinculoCR: '',
      col25_rentaBruta: '',
      col26_deduccCosto: '',
      col27_rentaNeta: '',
      col28_tasaRetencion: '',
      col29_impuestoRetenido: '',
      col30_convenio: '',
      col31_exoneracionAplicada: '',
      col32_tipoRenta: '',
      col33_modalidadServicio: '',
      col34_aplicacionArt76: '',
      col35_carCpModificar: '',
      col36_libreUtilizacion: ''
    }];
  };

  const updateCell = (rowIndex, field, value) => {
    setEditableData(prev => prev.map((row, idx) => idx === rowIndex ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    const periodo = `${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`;
    const newRow = {
      id: String(editableData.length + 1).padStart(2, '0'),
      col1_periodo: periodo,
      col2_carSunat: '',
      col3_fecEmision: '',
      col4_tipo: '',
      col5_serie: '',
      col6_damODsi: '',
      col7_numeroCp: '',
      col8_otrosConceptos: '',
      col9_importeTotal: '',
      col10_tipoDocSustenta: '',
      col11_serieSustenta: '',
      col12_damODsiSustenta: '',
      col13_numeroCpSustenta: '',
      col14_montoRetencionIgv: '',
      col15_codigoMoneda: 'PEN',
      col16_tipoCambio: '',
      col17_paisNoDomiciliado: '',
      col18_apellidosNombresNoDom: '',
      col19_domicilioExtranjero: '',
      col20_numIdentificacion: '',
      col21_numIdentifFiscal: '',
      col22_apellidosNombresBenef: '',
      col23_paisBeneficiario: '',
      col24_vinculoCR: '',
      col25_rentaBruta: '',
      col26_deduccCosto: '',
      col27_rentaNeta: '',
      col28_tasaRetencion: '',
      col29_impuestoRetenido: '',
      col30_convenio: '',
      col31_exoneracionAplicada: '',
      col32_tipoRenta: '',
      col33_modalidadServicio: '',
      col34_aplicacionArt76: '',
      col35_carCpModificar: '',
      col36_libreUtilizacion: ''
    };
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex) => {
    setEditableData(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  const guardarDatos = async () => {
    try {
      const result = await window.electronAPI.invoke('guardar-datos-editados', {
        nombreHoja: 'RCE AJUSTES POST 2',
        datosEditados: { datosUnificados: editableData }
      });
      alert(result.success ? `✅ ${result.message}` : `❌ Error: ${result.error}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const completarDatosTabla = () => {
    setEditableData(crearDatosEjemplo());
    alert('✅ Datos completados correctamente');
  };

  const generarArchivoDesdeTabla = async () => {
    if (!editableData || editableData.length === 0) {
      alert('❌ No hay datos en la tabla');
      return;
    }
    if (!selectedFolder) {
      alert('❌ Seleccione una carpeta de destino');
      return;
    }
    if (onGenerarArchivo) {
      onGenerarArchivo(editableData, { indicadorCont, indicadorMoned, correlativo });
    }
  };

  return (
    <div className="rvie-complementa-view">
      <div className="rvie-header-excel rce-header">
        <div className="header-row">
          <span className="header-label">EMPRESA:</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.ruc || ''} readOnly className="header-input header-ruc" />
          <span className="header-arrow">▶</span>
          <input type="text" value={datosEmpresa?.razonSocial || ''} readOnly className="header-input header-razon-social" />
        </div>
        <div className="header-row">
          <span className="header-label">PERIODO</span>
          <span className="header-arrow">▶</span>
          <input type="text" value={`${datosEmpresa?.anio || '2025'}${(datosEmpresa?.mes || '01').padStart(2, '0')}`} readOnly className="header-input header-periodo" />
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR CONT</span>
          <input type="text" value={indicadorCont} onChange={(e) => setIndicadorCont(e.target.value.replace(/[^01]/g, '').slice(0, 1))} className="header-input header-indicador" maxLength="1" />
          <span className="header-hint">1 = SI; 0 = NO</span>
        </div>
        <div className="header-row">
          <span className="header-label">INDICADOR MONED</span>
          <input type="text" value={indicadorMoned} onChange={(e) => setIndicadorMoned(e.target.value.replace(/[^12]/g, '').slice(0, 1))} className="header-input header-indicador" maxLength="1" />
          <span className="header-hint">1 = PEN; 2 = USD</span>
        </div>
        <div className="header-row">
          <span className="header-label">N° CORRELATIVO</span>
          <input type="text" value={correlativo} onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length === 1) setCorrelativo(val.padStart(2, '0')); else if (val.length === 0) setCorrelativo('01'); }} className="header-input header-correlativo" maxLength="2" />
        </div>
      </div>

      <div className="rvie-actions-header">
        <h3>⚡ Acciones Disponibles - RCE AJUSTES POST 2</h3>
        <div className="action-buttons-grid">
          <button className="btn btn-success action-btn-main" onClick={completarDatosTabla}>✅ COMPLETAR DATOS</button>
          <button className="btn btn-warning action-btn-main" onClick={generarArchivoDesdeTabla}>📁 GENERAR ARCHIVO</button>
          <button className="btn btn-primary action-btn-main" onClick={() => onSeleccionarCarpeta && onSeleccionarCarpeta()}>📂 SELECCIONAR CARPETA</button>
          <button className="btn btn-secondary action-btn-main" onClick={() => onCerrarVista && onCerrarVista()}>❌ CERRAR VISTA</button>
        </div>
        {selectedFolder && (
          <div className="folder-info-header">
            <strong>📂 Carpeta:</strong> <span className="folder-path">{selectedFolder}</span>
          </div>
        )}
      </div>

      <div className="rvie-content">
        <div className="datos-unificados">
          <h4>📊 RCE AJUSTES POST 2 - Estructura (36 Columnas)</h4>
          <div className="table-controls">
            <button className="btn btn-primary btn-small" onClick={addRow}>➕ Agregar Fila</button>
            <button className="btn btn-success btn-small" onClick={guardarDatos}>💾 Guardar Cambios</button>
          </div>
          <div className="table-container table-unified table-rce-ajustes">
            <table className="rvie-table editable-table">
              <thead>
                <tr className="header-groups">
                  <th rowSpan="2" className="th-id">ID</th>
                  <th rowSpan="2" className="th-periodo">1<br />Periodo<br />YYYYMM</th>
                  <th rowSpan="2" className="th-car">2<br />CAR - SUNAT<br />(Tabla 7)</th>
                  <th colSpan="5" className="th-group th-comprobante">Datos del Comprobante de pago</th>
                  <th rowSpan="2" className="th-otros">7<br />Valor de las<br />Adquisiciones</th>
                  <th rowSpan="2" className="th-otros">8<br />Otros Conceptos<br />Adicionales</th>
                  <th rowSpan="2" className="th-otros">9<br />Importe Total</th>
                  <th colSpan="4" className="th-group th-sustenta">Documento que Sustenta Crédito Fiscal</th>
                  <th rowSpan="2" className="th-otros">14<br />Monto de la<br />retención<br />del IGV</th>
                  <th rowSpan="2" className="th-otros">15<br />Código<br />Moneda</th>
                  <th rowSpan="2" className="th-otros">16<br />Tipo de<br />Cambio</th>
                  <th colSpan="5" className="th-group th-nodomiciliado">Datos del sujeto no Domiciliado</th>
                  <th colSpan="3" className="th-group th-beneficiario">Beneficiario Efectivo de los pagos</th>
                  <th rowSpan="2" className="th-renta">25<br />Renta Bruta</th>
                  <th rowSpan="2" className="th-renta">26<br />Deducc / Costo</th>
                  <th rowSpan="2" className="th-renta">27<br />Renta Neta</th>
                  <th rowSpan="2" className="th-renta">28<br />Tasa<br />Retención</th>
                  <th rowSpan="2" className="th-renta">29<br />Impuesto<br />Retenido</th>
                  <th rowSpan="2" className="th-convenio">30<br />Convenio</th>
                  <th rowSpan="2" className="th-convenio">31<br />Exoneración<br />Aplicada</th>
                  <th rowSpan="2" className="th-convenio">32<br />Tipo Renta</th>
                  <th rowSpan="2" className="th-convenio">33<br />Modalidad<br />del servicio</th>
                  <th rowSpan="2" className="th-convenio">34<br />Aplicación<br />Art. 76</th>
                  <th rowSpan="2" className="th-car">35<br />CAR CP a<br />Modificar</th>
                  <th rowSpan="2" className="th-libre">36<br />Libre<br />Utilización</th>
                  <th rowSpan="2" className="th-acciones">Acc.</th>
                </tr>
                <tr className="header-cols">
                  <th className="th-num">3<br />Fec. Emisión</th>
                  <th className="th-num">4<br />Tipo</th>
                  <th className="th-num">5<br />Serie</th>
                  <th className="th-num">6<br />DAM O DSI</th>
                  <th className="th-num">Número CP</th>
                  <th className="th-num">10<br />Tipo</th>
                  <th className="th-num">11<br />Serie</th>
                  <th className="th-num">12<br />DAM O DSI</th>
                  <th className="th-num">13<br />Número CP</th>
                  <th className="th-num">17<br />País</th>
                  <th className="th-num">18<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">19<br />Domicilio en el Extranjero</th>
                  <th className="th-num">20<br />Núm Identificación</th>
                  <th className="th-num">21<br />N° Identif. Fiscal</th>
                  <th className="th-num">22<br />Apellidos y Nombres y/o Razón Social</th>
                  <th className="th-num">23<br />País</th>
                  <th className="th-num">24<br />Vínculo C-R</th>
                </tr>
              </thead>
              <tbody>
                {editableData.length > 0 ? editableData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-id">{row.id || String(idx + 1).padStart(2, '0')}</td>
                    <td><input type="text" value={row.col1_periodo || ''} onChange={(e) => updateCell(idx, 'col1_periodo', e.target.value)} className="table-input input-small" maxLength="6" /></td>
                    <td><input type="text" value={row.col2_carSunat || ''} onChange={(e) => updateCell(idx, 'col2_carSunat', e.target.value)} className="table-input input-car" maxLength="27" /></td>
                    <td><input type="text" value={row.col3_fecEmision || ''} onChange={(e) => updateCell(idx, 'col3_fecEmision', e.target.value)} className="table-input input-date" placeholder="dd/mm/yyyy" /></td>
                    <td><input type="text" value={row.col4_tipo || ''} onChange={(e) => updateCell(idx, 'col4_tipo', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col5_serie || ''} onChange={(e) => updateCell(idx, 'col5_serie', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col6_damODsi || ''} onChange={(e) => updateCell(idx, 'col6_damODsi', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col7_numeroCp || ''} onChange={(e) => updateCell(idx, 'col7_numeroCp', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col8_otrosConceptos || ''} onChange={(e) => updateCell(idx, 'col8_otrosConceptos', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col9_importeTotal || ''} onChange={(e) => updateCell(idx, 'col9_importeTotal', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col10_tipoDocSustenta || ''} onChange={(e) => updateCell(idx, 'col10_tipoDocSustenta', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col11_serieSustenta || ''} onChange={(e) => updateCell(idx, 'col11_serieSustenta', e.target.value)} className="table-input input-small" maxLength="4" /></td>
                    <td><input type="text" value={row.col12_damODsiSustenta || ''} onChange={(e) => updateCell(idx, 'col12_damODsiSustenta', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col13_numeroCpSustenta || ''} onChange={(e) => updateCell(idx, 'col13_numeroCpSustenta', e.target.value)} className="table-input" maxLength="8" /></td>
                    <td><input type="text" value={row.col14_montoRetencionIgv || ''} onChange={(e) => updateCell(idx, 'col14_montoRetencionIgv', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col15_codigoMoneda || ''} onChange={(e) => updateCell(idx, 'col15_codigoMoneda', e.target.value)} className="table-input input-tiny" maxLength="3" /></td>
                    <td><input type="text" value={row.col16_tipoCambio || ''} onChange={(e) => updateCell(idx, 'col16_tipoCambio', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col17_paisNoDomiciliado || ''} onChange={(e) => updateCell(idx, 'col17_paisNoDomiciliado', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col18_apellidosNombresNoDom || ''} onChange={(e) => updateCell(idx, 'col18_apellidosNombresNoDom', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col19_domicilioExtranjero || ''} onChange={(e) => updateCell(idx, 'col19_domicilioExtranjero', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col20_numIdentificacion || ''} onChange={(e) => updateCell(idx, 'col20_numIdentificacion', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col21_numIdentifFiscal || ''} onChange={(e) => updateCell(idx, 'col21_numIdentifFiscal', e.target.value)} className="table-input" maxLength="15" /></td>
                    <td><input type="text" value={row.col22_apellidosNombresBenef || ''} onChange={(e) => updateCell(idx, 'col22_apellidosNombresBenef', e.target.value)} className="table-input input-wide" /></td>
                    <td><input type="text" value={row.col23_paisBeneficiario || ''} onChange={(e) => updateCell(idx, 'col23_paisBeneficiario', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col24_vinculoCR || ''} onChange={(e) => updateCell(idx, 'col24_vinculoCR', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col25_rentaBruta || ''} onChange={(e) => updateCell(idx, 'col25_rentaBruta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col26_deduccCosto || ''} onChange={(e) => updateCell(idx, 'col26_deduccCosto', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col27_rentaNeta || ''} onChange={(e) => updateCell(idx, 'col27_rentaNeta', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col28_tasaRetencion || ''} onChange={(e) => updateCell(idx, 'col28_tasaRetencion', e.target.value)} className="table-input input-small" /></td>
                    <td><input type="text" value={row.col29_impuestoRetenido || ''} onChange={(e) => updateCell(idx, 'col29_impuestoRetenido', e.target.value)} className="table-input input-number" /></td>
                    <td><input type="text" value={row.col30_convenio || ''} onChange={(e) => updateCell(idx, 'col30_convenio', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col31_exoneracionAplicada || ''} onChange={(e) => updateCell(idx, 'col31_exoneracionAplicada', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col32_tipoRenta || ''} onChange={(e) => updateCell(idx, 'col32_tipoRenta', e.target.value)} className="table-input input-tiny" maxLength="2" /></td>
                    <td><input type="text" value={row.col33_modalidadServicio || ''} onChange={(e) => updateCell(idx, 'col33_modalidadServicio', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col34_aplicacionArt76 || ''} onChange={(e) => updateCell(idx, 'col34_aplicacionArt76', e.target.value)} className="table-input input-tiny" maxLength="1" /></td>
                    <td><input type="text" value={row.col35_carCpModificar || ''} onChange={(e) => updateCell(idx, 'col35_carCpModificar', e.target.value)} className="table-input input-car" /></td>
                    <td><input type="text" value={row.col36_libreUtilizacion || ''} onChange={(e) => updateCell(idx, 'col36_libreUtilizacion', e.target.value)} className="table-input" /></td>
                    <td><button className="btn btn-danger btn-small" onClick={() => deleteRow(idx)}>🗑️</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="38" className="no-data">No hay datos. Use "➕ Agregar Fila" o "✅ COMPLETAR DATOS"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente visor de Excel integrado con soporte para autollenado
const ExcelViewer = ({ archivoData, onClose, onRowSelect, hojaActiva: hojaActivaProp, canAutoFill }) => {
  const [hojaActiva, setHojaActiva] = useState(0);
  const [selectedRow, setSelectedRow] = useState(null);

  if (!archivoData || !archivoData.hojas) {
    return null;
  }

  const nombresHojas = archivoData.nombresHojas || [];
  const hojaActual = nombresHojas[hojaActiva];
  const datosHoja = archivoData.hojas[hojaActual];

  // Manejar clic en fila para autollenado
  const handleRowClick = (rowIdx, rowData) => {
    if (!canAutoFill || !onRowSelect) {
      console.log('⚠️ Autollenado no disponible:', { canAutoFill, hasOnRowSelect: !!onRowSelect });
      return;
    }

    // Crear objeto con headers y valores
    const headers = datosHoja.headers || [];
    const rowObject = {};

    console.log('📊 ExcelViewer - Headers detectados:', headers);
    console.log('📊 ExcelViewer - Datos de la fila:', rowData);

    headers.forEach((header, idx) => {
      if (header && header.trim()) {
        const headerLimpio = header.trim();
        const valor = rowData[idx];
        rowObject[headerLimpio] = valor !== undefined && valor !== null ? String(valor) : '';
      }
    });

    console.log('📊 ExcelViewer - Objeto creado para autollenado:', rowObject);

    setSelectedRow(rowIdx);
    onRowSelect(rowObject, headers, rowData);
  };

  return (
    <div className="excel-viewer-overlay-modal" onClick={onClose}>
      <div className="excel-viewer-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="excel-viewer-modal-header">
          <div className="excel-viewer-title">
            <span className="excel-icon">📊</span>
            <span className="excel-filename">{archivoData.nombreArchivo}</span>
            <span className="excel-info">({datosHoja?.totalFilas || 0} filas × {datosHoja?.totalColumnas || 0} columnas)</span>
          </div>
          <div className="excel-header-actions">
            {canAutoFill && <span className="autofill-hint">💡 Clic en una fila para autorellenar</span>}
            <button className="btn btn-secondary btn-small excel-close-btn" onClick={onClose}>✕ Cerrar</button>
          </div>
        </div>

        {nombresHojas.length > 1 && (
          <div className="excel-tabs">
            {nombresHojas.map((nombre, idx) => (
              <button
                key={idx}
                className={`excel-tab ${idx === hojaActiva ? 'active' : ''}`}
                onClick={() => setHojaActiva(idx)}
              >
                {nombre}
              </button>
            ))}
          </div>
        )}

        <div className="excel-table-container">
          {datosHoja && datosHoja.headers && (
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="excel-row-num">#</th>
                  {datosHoja.headers.map((header, idx) => (
                    <th key={idx} className="excel-header-cell">{header || `Col ${idx + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datosHoja.rows && datosHoja.rows.length > 0 ? (
                  datosHoja.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={`${canAutoFill ? 'excel-row-clickable' : ''} ${selectedRow === rowIdx ? 'excel-row-selected' : ''}`}
                      onClick={() => handleRowClick(rowIdx, row)}
                      title={canAutoFill ? 'Clic para autorellenar esta fila en la tabla activa' : ''}
                    >
                      <td className="excel-row-num">{rowIdx + 1}</td>
                      {datosHoja.headers.map((_, colIdx) => (
                        <td key={colIdx} className="excel-cell">{row[colIdx] || ''}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={datosHoja.headers.length + 1} className="excel-no-data">
                      No hay datos en esta hoja
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const SireAjustesModule = () => {
  const [datosEmpresa, setDatosEmpresa] = useState({
    ruc: '',
    razonSocial: '',
    anio: new Date().getFullYear().toString(),
    mes: (new Date().getMonth() + 1).toString().padStart(2, '0')
  });

  const [currentMode, setCurrentMode] = useState('COMPRAS');
  const [currentSheet, setCurrentSheet] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [archivosOutput, setArchivosOutput] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [selectedHoja, setSelectedHoja] = useState('');
  const [showHojaView, setShowHojaView] = useState(false);
  const [hojaData, setHojaData] = useState(null);

  // Estados para el visor de Excel
  const [archivoExpandido, setArchivoExpandido] = useState(null);
  const [datosArchivoExpandido, setDatosArchivoExpandido] = useState(null);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);

  // Estado para autollenado desde Excel
  const [filaParaAutollenar, setFilaParaAutollenar] = useState(null);

  // Estados para el buscador de clientes
  const [clientes, setClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClientesList, setShowClientesList] = useState(false);
  const [filteredClientes, setFilteredClientes] = useState([]);

  // Estado para autollenado desde Excel
  const [autoFillData, setAutoFillData] = useState(null);

  // Ref para click outside y posicionamiento
  const searchWrapperRef = useRef(null);
  const searchInputRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });


  useEffect(() => {
    initialize();
  }, []);

  // Filtrar clientes cuando cambia el término de búsqueda
  useEffect(() => {
    console.log('🔍 useEffect filtrado ejecutado:', { searchTerm, clientesCount: clientes.length });

    if (searchTerm.trim() === '') {
      console.log('🔍 SearchTerm vacío - mostrar todos los clientes');
      setFilteredClientes(clientes);
      const shouldShow = clientes.length > 0;
      console.log('✅ setShowClientesList:', shouldShow);
      setShowClientesList(shouldShow);

      // Recalcular posición del dropdown
      if (shouldShow && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect();
        console.log('📍 Recalculando posición (vacío):', {
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
      return;
    }

    if (clientes.length > 0) {
      // Si hay término de búsqueda, filtrar
      const term = searchTerm.toLowerCase();
      const filtered = clientes.filter(cliente =>
        cliente.ruc.toLowerCase().includes(term) ||
        cliente.empresa.toLowerCase().includes(term)
      );
      console.log('🔎 Filtrando:', { term, filteredCount: filtered.length });
      setFilteredClientes(filtered);
      const shouldShow = filtered.length > 0;
      console.log('✅ setShowClientesList:', shouldShow);
      setShowClientesList(shouldShow); // Mostrar dropdown si hay resultados

      // Actualizar posición del dropdown
      if (filtered.length > 0 && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect();
        console.log('📍 Posición dropdown:', {
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    } else {
      console.log('❌ No hay clientes cargados');
      setFilteredClientes([]);
      setShowClientesList(false);
    }
  }, [searchTerm, clientes]);

  // Cerrar sugerencias al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowClientesList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initialize = async () => {
    try {
      setIsLoading(true);
      if (!window.electronAPI) {
        showAlert('Error: electronAPI no está disponible', 'error');
        return;
      }
      const result = await window.electronAPI.invoke('sire-ajustes-init');
      if (result.success) {
        loadInitialData(result.datos);
      } else {
        showAlert('Error al cargar datos iniciales: ' + result.error, 'error');
      }
      await updateFileList();
      // Cargar lista de clientes
      await cargarListaClientes();
    } catch (error) {
      showAlert('Error de inicialización: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const cargarListaClientes = async () => {
    try {
      console.log('🔍 Intentando cargar clientes...');
      const result = await window.electronAPI.invoke('cargar-clientes');
      console.log('📦 Resultado de cargar-clientes:', result);

      if (result.success) {
        setClientes(result.clientes || []);
        console.log(`✅ Clientes cargados: ${result.clientes?.length || 0}`);
      } else {
        console.warn('⚠️ No se pudieron cargar clientes:', result.error);
        setClientes([]); // Asegurar que sea array vacío
        showAlert(`No se pudieron cargar clientes: ${result.error}`, 'warning');
      }
    } catch (error) {
      console.error('❌ Error al cargar clientes:', error);
      setClientes([]);
      showAlert(`Error al cargar clientes: ${error.message}`, 'error');
    }
  };

  const handleClienteSelect = (cliente) => {
    // Actualizar tanto RUC como Razón Social
    setDatosEmpresa(prev => ({
      ...prev,
      ruc: cliente.ruc,
      razonSocial: cliente.empresa
    }));
    // Mantener el RUC en el campo de búsqueda (como lo hace SireModule)
    setSearchTerm(cliente.ruc);
    setShowClientesList(false);
  };

  const loadInitialData = (datos) => {
    setDatosEmpresa({
      ruc: datos.ruc || '',
      razonSocial: datos.razonSocial || '',
      anio: datos.anio || new Date().getFullYear().toString(),
      mes: datos.mes || (new Date().getMonth() + 1).toString().padStart(2, '0')
    });
    setCurrentMode(datos.modo || 'COMPRAS');
  };

  const handleInputChange = (field, value) => {
    setDatosEmpresa(prev => ({ ...prev, [field]: value }));
  };

  const changeMode = async (modo) => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.invoke('cambiar-vista', modo);
      if (result.success) {
        setCurrentMode(modo);
        showAlert(result.message, 'success');
        setSelectedHoja('');
        setShowHojaView(false);
        setHojaData(null);
      } else {
        showAlert('Error al cambiar modo: ' + result.error, 'error');
      }
    } catch (error) {
      showAlert('Error al cambiar modo: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const verificarRUC = async () => {
    const ruc = datosEmpresa.ruc.trim();
    if (!ruc || ruc.length !== 11) {
      showAlert('Ingrese un RUC válido de 11 dígitos', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const result = await window.electronAPI.invoke('verificar-ruc', ruc);
      if (result.success) {
        handleInputChange('razonSocial', result.razonSocial);
        showAlert(result.message, 'success');
      } else {
        showAlert(result.error, 'error');
      }
    } catch (error) {
      showAlert('Error al verificar RUC: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const seleccionarCarpeta = async () => {
    try {
      const result = await window.electronAPI.invoke('seleccionar-carpeta-destino');
      if (result.success) {
        setSelectedFolder(result.ruta);
        showAlert('Carpeta seleccionada: ' + result.ruta, 'info');
      } else {
        showAlert(result.error, 'error');
      }
    } catch (error) {
      showAlert('Error al seleccionar carpeta: ' + error.message, 'error');
    }
  };

  const updateFileList = async () => {
    try {
      const result = await window.electronAPI.invoke('listar-archivos-output', {
        ruc: datosEmpresa.ruc,
        rutaBase: selectedFolder
      });
      if (result.success) {
        setArchivosOutput(result.archivos || []);
      }
    } catch (error) {
      console.error('Error al actualizar lista:', error);
    }
  };

  // Función para expandir/colapsar visor de archivo xlsx
  const toggleArchivoExpandido = async (archivo) => {
    // Si es el mismo archivo, colapsar
    if (archivoExpandido === archivo.nombre) {
      setArchivoExpandido(null);
      setDatosArchivoExpandido(null);
      return;
    }

    // Verificar que sea un archivo xlsx
    const extension = archivo.tipo?.toLowerCase();
    if (extension !== '.xlsx' && extension !== '.xls' && extension !== '.xlsm') {
      showAlert('Solo se pueden visualizar archivos Excel (.xlsx, .xls, .xlsm)', 'error');
      return;
    }

    try {
      setCargandoArchivo(true);
      const result = await window.electronAPI.invoke('leer-archivo-xlsx-output', {
        nombreArchivo: archivo.nombre,
        ruc: datosEmpresa.ruc,
        rutaBase: selectedFolder
      });

      if (result.success) {
        setArchivoExpandido(archivo.nombre);
        setDatosArchivoExpandido(result);
      } else {
        showAlert(`Error al leer archivo: ${result.error}`, 'error');
      }
    } catch (error) {
      showAlert(`Error al cargar archivo: ${error.message}`, 'error');
    } finally {
      setCargandoArchivo(false);
    }
  };

  // Función para cerrar el visor de Excel
  const cerrarVisorExcel = () => {
    setArchivoExpandido(null);
    setDatosArchivoExpandido(null);
  };

  /**
   * Enviar archivo SIRE por Email
   */
  const handleEnviarSIREEmail = async (archivo) => {
    if (!datosEmpresa.ruc) {
      showAlert('Seleccione una empresa primero', 'warning');
      return;
    }

    const { value: emailDestino } = await window.Swal.fire({
      title: 'Enviar por Email',
      input: 'email',
      inputLabel: 'Correo de destino',
      inputPlaceholder: 'ejemplo@correo.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar'
    });

    if (!emailDestino) return;

    window.Swal.fire({
      title: 'Enviando...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => window.Swal.showLoading()
    });

    try {
      const result = await window.electronAPI.invoke('email:enviar-con-adjuntos', {
        destinatario: emailDestino,
        asunto: `Archivo SIRE - ${archivo.nombre}`,
        mensaje: `Adjunto: ${archivo.nombre}\n\nTipo: ${archivo.tipo || 'SIRE'}\nRUC: ${archivo.ruc || datosEmpresa.ruc}\nPeriodo: ${archivo.periodo || ''}\nFecha: ${new Date(archivo.fechaCreacion).toLocaleString()}`,
        archivos: [archivo.ruta]
      });

      if (result.success) {
        window.Swal.fire('✅ Enviado', `Email enviado a ${emailDestino}`, 'success');
      } else {
        window.Swal.fire('Error', result.error, 'error');
      }
    } catch (error) {
      window.Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * Enviar archivo SIRE por WhatsApp
   */
  const handleEnviarSIREWhatsApp = async (archivo) => {
    if (!datosEmpresa.ruc) {
      showAlert('Seleccione una empresa primero', 'warning');
      return;
    }

    // Verificar WhatsApp conectado
    const statusResult = await window.electronAPI.getWhatsAppStatus();
    if (!statusResult.success || !statusResult.status.isReady) {
      window.Swal.fire({
        title: 'WhatsApp no conectado',
        text: 'Por favor conecta WhatsApp desde el botón en el header',
        icon: 'warning'
      });
      return;
    }

    const { value: phoneNumber } = await window.Swal.fire({
      title: 'Enviar por WhatsApp',
      input: 'text',
      inputLabel: 'Número de WhatsApp',
      inputPlaceholder: '51987654321',
      showCancelButton: true,
      confirmButtonText: 'Enviar'
    });

    if (!phoneNumber) return;

    window.Swal.fire({
      title: 'Enviando...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => window.Swal.showLoading()
    });

    try {
      const result = await window.electronAPI.sendWhatsAppFile({
        phone: phoneNumber,
        filePath: archivo.ruta,
        caption: `📊 Archivo SIRE\n\nArchivo: ${archivo.nombre}\nTipo: ${archivo.tipo || 'SIRE'}\nRUC: ${archivo.ruc || datosEmpresa.ruc}\nPeriodo: ${archivo.periodo || ''}\nFecha: ${new Date(archivo.fechaCreacion).toLocaleString()}`
      });

      if (result.success) {
        window.Swal.fire('✅ Enviado', 'Archivo enviado por WhatsApp', 'success');
      } else {
        window.Swal.fire('Error', result.error, 'error');
      }
    } catch (error) {
      window.Swal.fire('Error', error.message, 'error');
    }
  };


  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filtrar archivos por RUC seleccionado
  const getArchivosFiltrados = () => {
    const ruc = datosEmpresa.ruc?.trim();
    if (!ruc || ruc.length !== 11) {
      return []; // Si no hay RUC válido, no mostrar archivos
    }
    // Filtrar archivos que contengan el RUC en el nombre
    return archivosOutput.filter(archivo =>
      archivo.nombre.includes(ruc)
    );
  };

  // Verificar si la hoja activa soporta autollenado
  const soportaAutollenado = () => {
    const hojasConAutollenado = [
      'RVIE COMPLEMENTA', 'RVIE REEMPLAZA', 'RVIE AJUSTES POST 1', 'RVIE AJUSTES POST 2',
      'RCE COMPLETA', 'RCE REEMPLAZA', 'RCE AJUSTES POST 1', 'RCE AJUSTES POST 2'
    ];
    return hojasConAutollenado.includes(selectedHoja);
  };

  // Manejar selección de fila del Excel para autollenado
  const handleExcelRowSelect = (rowObject, headers, rowData) => {
    console.log('🎯 handleExcelRowSelect llamado');
    console.log('🎯 Headers recibidos:', headers);
    console.log('🎯 rowObject recibido:', rowObject);
    console.log('🎯 rowData recibido:', rowData);
    console.log('🎯 Hoja seleccionada:', selectedHoja);
    console.log('🎯 Soporta autollenado:', soportaAutollenado());

    if (!soportaAutollenado()) {
      showAlert('Esta hoja no soporta autollenado. Seleccione una hoja COMPLEMENTA, COMPLETA, REEMPLAZA o AJUSTES.', 'info');
      return;
    }

    // Guardar la fila para que las vistas la procesen
    const datosParaAutollenar = { rowObject, headers, rowData, timestamp: Date.now() };
    console.log('🎯 Datos para autollenar:', datosParaAutollenar);

    setFilaParaAutollenar(datosParaAutollenar);
    showAlert(`✅ Fila seleccionada para autollenado en ${selectedHoja}`, 'success');
  };

  const showAlert = (message, type = 'info') => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setAlerts(prev => prev.filter(alert => alert.id !== id)), 5000);
  };

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const getAvailableHojas = () => {
    if (currentMode === 'VENTAS') {
      return [
        { value: 'RVIE COMPLEMENTA', label: 'RVIE COMPLEMENTA' },
        { value: 'RVIE REEMPLAZA', label: 'RVIE REEMPLAZA' },
        { value: 'RVIE AJUSTES POST 1', label: 'RVIE AJUSTES POST 1' },
        { value: 'RVIE AJUSTES POST 2', label: 'RVIE AJUSTES POST 2' }
      ];
    } else {
      return [
        { value: 'RCE COMPLETA', label: 'RCE COMPLETA' },
        { value: 'RCE NO DOMICILIADOS', label: 'RCE NO DOMICILIADOS' },
        { value: 'RCE COMPLETA TC', label: 'RCE COMPLETA TC' },
        { value: 'RCE REEMPLAZA', label: 'RCE REEMPLAZA' },
        { value: 'RCE AJUSTES POST 1', label: 'RCE AJUSTES POST 1' },
        { value: 'RCE AJUSTES POST 2', label: 'RCE AJUSTES POST 2' },
        { value: 'RCE AJUSTES POST DIST 1', label: 'RCE AJUSTES POST DIST 1' },
        { value: 'RCE AJUSTES POST DIST 2', label: 'RCE AJUSTES POST DIST 2' }
      ];
    }
  };

  const handleHojaSelection = async (hojaName) => {
    setSelectedHoja(hojaName);
    if (hojaName) {
      try {
        setIsLoading(true);
        const result = await window.electronAPI.invoke('cargar-datos-hoja', { nombreHoja: hojaName });
        if (result.success) {
          setHojaData(result.datos);
          setShowHojaView(true);
          setCurrentSheet(hojaName);
          showAlert(`Hoja "${hojaName}" cargada correctamente`, 'success');
        } else {
          setHojaData(null);
          setShowHojaView(true);
          setCurrentSheet(hojaName);
          showAlert(`Hoja "${hojaName}" cargada (sin datos previos)`, 'info');
        }
      } catch (error) {
        showAlert('Error al cargar hoja: ' + error.message, 'error');
      } finally {
        setIsLoading(false);
      }
    } else {
      setShowHojaView(false);
      setHojaData(null);
      setCurrentSheet(null);
    }
  };

  const closeHojaView = () => {
    setShowHojaView(false);
    setSelectedHoja('');
    setHojaData(null);
    setCurrentSheet(null);
  };

  const completarDatosHoja = async (nombreHoja) => {
    if (!datosEmpresa.ruc || datosEmpresa.ruc.length !== 11) {
      showAlert('Configure un RUC válido antes de completar datos', 'error');
      return;
    }
    if (!datosEmpresa.razonSocial) {
      showAlert('Configure la Razón Social antes de completar datos', 'error');
      return;
    }
    try {
      setIsLoading(true);
      showAlert(`Completando datos en: ${nombreHoja}...`, 'info');
      const result = await window.electronAPI.invoke('completar-datos', {
        nombreHoja,
        datosEmpresa: { ...datosEmpresa, modo: currentMode }
      });
      if (result.success) {
        setCurrentSheet(result.hojaUsada || nombreHoja);
        showAlert(`✅ Datos completados: ${result.filasAfectadas || 0} filas`, 'success');
        await handleHojaSelection(nombreHoja);
      } else {
        showAlert(`❌ Error: ${result.error}`, 'error');
      }
    } catch (error) {
      showAlert(`❌ Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Genera archivo TXT y ZIP desde los datos editables de la tabla
   * @param {string} nombreHoja - Nombre de la hoja (RVIE COMPLEMENTA, etc.)
   * @param {Array} datosTabla - Datos editables de la tabla (opcional, si no se pasa usa Excel)
   * @param {Object} opciones - Opciones adicionales (correlativo, indicadorCont, indicadorMoned, comprobPago)
   */
  const generarArchivoHoja = async (nombreHoja, datosTabla = null, opciones = {}) => {
    if (!selectedFolder) {
      showAlert('Seleccione una carpeta de destino primero', 'error');
      return;
    }

    // Validar que hay datos si se pasan desde la tabla
    if (datosTabla && datosTabla.length === 0) {
      showAlert('No hay datos en la tabla para generar el archivo', 'error');
      return;
    }

    try {
      setIsLoading(true);
      showAlert(`Generando archivo para: ${nombreHoja}...`, 'info');

      // Extraer opciones (usar !== undefined para manejar valores '0' correctamente)
      const correlativoFinal = opciones?.correlativo !== undefined ? opciones.correlativo : '01';
      const indicadorContFinal = opciones?.indicadorCont !== undefined ? opciones.indicadorCont : '1';
      const indicadorMonedFinal = opciones?.indicadorMoned !== undefined ? opciones.indicadorMoned : '1';
      const comprobPagoFinal = opciones?.comprobPago !== undefined ? opciones.comprobPago : 'CP';

      console.log('Opciones de generación:', { correlativoFinal, indicadorContFinal, indicadorMonedFinal, comprobPagoFinal });

      const result = await window.electronAPI.invoke('generar-archivo-desde-tabla', {
        nombreHoja: nombreHoja,
        rutaDestino: selectedFolder,
        datosTabla: datosTabla,
        datosEmpresa: datosEmpresa,
        correlativo: correlativoFinal,
        indicadorCont: indicadorContFinal,
        indicadorMoned: indicadorMonedFinal,
        comprobPago: comprobPagoFinal
      });

      if (result.success) {
        showAlert(`✅ Archivo generado: ${result.nombreArchivo || nombreHoja}`, 'success');
        await updateFileList();
      } else {
        showAlert(`❌ Error: ${result.error}`, 'error');
      }
    } catch (error) {
      showAlert(`❌ Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="sire-ajustes-module">
      <div className="sire-ajustes-header">
        <div className="sire-header-content">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.2-5.2l-4.2 4.2m0 6l4.2 4.2" />
            </svg>
            SIRE AJUSTES - Control de Registros
          </h2>
          <p className="sire-ajustes-subtitle">Sistema Integrado de Registros Electrónicos - Ajustes</p>
        </div>
      </div>

      {/* Alertas */}
      <div className="alerts-container">
        {alerts.map(alert => (
          <div key={alert.id} className={`alert alert-${alert.type}`}>
            <span>{alert.message}</span>
            <button onClick={() => removeAlert(alert.id)} className="alert-close">×</button>
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Procesando...</p>
          </div>
        </div>
      )}

      <div className="sire-ajustes-content">
        {/* Datos de Empresa - Layout compacto */}
        <div className="form-section datos-empresa-section">
          <h3>📊 Datos de la Empresa</h3>
          <div className="form-row">
            <div className="form-group cliente-search-container">
              <label>RUC / Buscar Empresa:</label>
              <div className="ruc-search-wrapper" ref={searchWrapperRef}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    // Si es un RUC válido (solo números), también actualizar datosEmpresa
                    if (/^\d{0,11}$/.test(value)) {
                      handleInputChange('ruc', value);
                    } else if (value === '') {
                      handleInputChange('ruc', '');
                    }
                  }}
                  onFocus={() => {
                    // Always show dropdown if there are clients (even if search is empty)
                    if (filteredClientes.length > 0) {
                      setShowClientesList(true);
                      // Recalcular posición
                      if (searchInputRef.current) {
                        const rect = searchInputRef.current.getBoundingClientRect();
                        setDropdownPosition({
                          top: rect.bottom + 4,
                          left: rect.left,
                          width: rect.width
                        });
                      }
                    }
                  }}
                  maxLength="50"
                  placeholder="Buscar por RUC o nombre..."
                  className="sire-select ruc-search-input"
                />
                {showClientesList && filteredClientes.length > 0 && (
                  <div className="ruc-suggestions">
                    {filteredClientes.map((cliente, idx) => (
                      <div
                        key={idx}
                        className="ruc-suggestion-item"
                        onMouseDown={() => handleClienteSelect(cliente)}
                      >
                        <div className="suggestion-ruc">{cliente.ruc}</div>
                        <div className="suggestion-nombre">{cliente.empresa}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Razón Social:</label>
              <input
                type="text"
                value={datosEmpresa.razonSocial}
                onChange={(e) => handleInputChange('razonSocial', e.target.value)}
                placeholder="Razón social"
              />
            </div>
            <div className="form-group small-field">
              <label>Año:</label>
              <input
                type="text"
                value={datosEmpresa.anio}
                onChange={(e) => handleInputChange('anio', e.target.value.replace(/\D/g, '').substring(0, 4))}
                maxLength="4"
                placeholder="2025"
              />
            </div>
            <div className="form-group small-field">
              <label>Mes:</label>
              <input
                type="text"
                value={datosEmpresa.mes}
                onChange={(e) => handleInputChange('mes', e.target.value.replace(/\D/g, '').substring(0, 2))}
                maxLength="2"
                placeholder="01"
              />
            </div>
            <div>
              <label>&nbsp;</label>
              <button className="btn btn-success" onClick={verificarRUC}>🔍 Verificar RUC</button>
            </div>
          </div>
        </div>

        {/* Control de Vista + Hoja Actual en una fila */}
        <div className="form-section control-vista-section">
          <h3>🔄 Control de Vista</h3>
          <div className="form-row" style={{ marginBottom: '12px' }}>
            <div className="mode-buttons" style={{ flex: 1 }}>
              <button
                className={`btn ${currentMode === 'VENTAS' ? 'btn-primary active' : 'btn-secondary'}`}
                onClick={() => changeMode('VENTAS')}
              >
                📈 VENTAS (RVIE)
              </button>
              <button
                className={`btn ${currentMode === 'COMPRAS' ? 'btn-primary active' : 'btn-secondary'}`}
                onClick={() => changeMode('COMPRAS')}
              >
                📉 COMPRAS (RCE)
              </button>
            </div>
          </div>
          <div className="current-sheet">
            <h4>📋 Hoja Actual:</h4>
            <p>{currentSheet ? currentSheet : 'Ninguna seleccionada'}</p>
          </div>
        </div>

        {/* Selector de Hojas */}
        <div className="form-section">
          <h3>📋 Seleccionar Hoja de Trabajo</h3>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <select value={selectedHoja} onChange={(e) => handleHojaSelection(e.target.value)} className="hoja-selector">
                <option value="">-- Seleccione una hoja --</option>
                {getAvailableHojas().map(hoja => (
                  <option key={hoja.value} value={hoja.value}>{hoja.label}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedHoja && (
            <div className="no-hoja-selected">
              <div className="placeholder-content">
                <h4>📋 Seleccione una hoja para comenzar</h4>
                <p>Elija una hoja del desplegable superior para ver las acciones disponibles.</p>
                <div className="available-actions-preview">
                  <span className="preview-action">✅ Completar Datos</span>
                  <span className="preview-action">📁 Generar Archivo</span>
                  <span className="preview-action">📂 Seleccionar Carpeta</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vista de Hoja */}
        {showHojaView && selectedHoja && (
          <div className="hoja-view-section">
            <div className="hoja-header">
              <h3>📊 {selectedHoja}</h3>
              <button className="btn btn-secondary btn-small" onClick={closeHojaView}>❌ Cerrar</button>
            </div>

            {selectedHoja === 'RVIE COMPLEMENTA' && (
              <RvieComplementaView
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                archivosOutput={archivosOutput}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja === 'RVIE REEMPLAZA' && (
              <RvieReemplazaView
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja === 'RVIE AJUSTES POST 1' && (
              <RvieAjustesPost1View
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja === 'RVIE AJUSTES POST 2' && (
              <RvieAjustesPost2View
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja === 'RCE COMPLETA' && (
              <RceCompletaView
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja === 'RCE NO DOMICILIADOS' && (
              <RceNoDomiciliadosView
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
              />
            )}

            {selectedHoja === 'RCE COMPLETA TC' && (
              <RceCompletaTcView
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
              />
            )}

            {selectedHoja === 'RCE REEMPLAZA' && (
              <RceReemplazaView
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja === 'RCE AJUSTES POST 1' && (
              <RceAjustesPost1View
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja === 'RCE AJUSTES POST 2' && (
              <RceAjustesPost2View
                hojaData={hojaData}
                onCompletarDatos={() => completarDatosHoja(selectedHoja)}
                onGenerarArchivo={(datosTabla, opciones) => generarArchivoHoja(selectedHoja, datosTabla, opciones)}
                onSeleccionarCarpeta={seleccionarCarpeta}
                onCerrarVista={closeHojaView}
                datosEmpresa={datosEmpresa}
                selectedFolder={selectedFolder}
                filaParaAutollenar={filaParaAutollenar}
              />
            )}

            {selectedHoja !== 'RVIE COMPLEMENTA' && selectedHoja !== 'RVIE REEMPLAZA' && selectedHoja !== 'RVIE AJUSTES POST 1' && selectedHoja !== 'RVIE AJUSTES POST 2' && selectedHoja !== 'RCE COMPLETA' && selectedHoja !== 'RCE NO DOMICILIADOS' && selectedHoja !== 'RCE COMPLETA TC' && selectedHoja !== 'RCE REEMPLAZA' && selectedHoja !== 'RCE AJUSTES POST 1' && selectedHoja !== 'RCE AJUSTES POST 2' && (
              <div className="hoja-placeholder">
                <h4>🚧 Vista en Desarrollo</h4>
                <p>La vista para "{selectedHoja}" estará disponible próximamente.</p>
              </div>
            )}
          </div>
        )}

        {/* Archivos Output - Filtrados por RUC */}
        <div className="status-section">
          <h4>📁 Archivos en Carpeta Output {datosEmpresa.ruc?.length === 11 ? `(RUC: ${datosEmpresa.ruc})` : ''}</h4>
          {(() => {
            const archivosFiltrados = getArchivosFiltrados();
            const rucValido = datosEmpresa.ruc?.trim()?.length === 11;

            return (
              <>
                <div className="file-list">
                  {!rucValido ? (
                    <div className="file-item">
                      <div className="file-info">
                        <div className="file-name">⚠️ Ingrese un RUC válido</div>
                        <div className="file-details">Debe ingresar un RUC de 11 dígitos para ver los archivos correspondientes</div>
                      </div>
                    </div>
                  ) : archivosFiltrados.length === 0 ? (
                    <div className="file-item">
                      <div className="file-info">
                        <div className="file-name">No hay archivos para este RUC</div>
                        <div className="file-details">No se encontraron archivos en output para el RUC: {datosEmpresa.ruc}</div>
                      </div>
                    </div>
                  ) : (
                    archivosFiltrados.map((archivo, index) => {
                      const esExcel = ['.xlsx', '.xls', '.xlsm'].includes(archivo.tipo?.toLowerCase());
                      const estaExpandido = archivoExpandido === archivo.nombre;

                      return (
                        <div key={index} className={`file-item-wrapper ${estaExpandido ? 'expanded' : ''}`}>
                          <div
                            className={`file-item ${esExcel ? 'file-item-clickable' : ''} ${estaExpandido ? 'file-item-active' : ''}`}
                            onClick={() => esExcel && toggleArchivoExpandido(archivo)}
                            title={esExcel ? 'Clic para ver contenido' : ''}
                          >
                            <div className="file-info">
                              <div className="file-name">
                                {esExcel && <span className="file-excel-icon">{estaExpandido ? '📂' : '📊'}</span>}
                                {archivo.nombre}
                                {esExcel && <span className="file-expand-hint">{estaExpandido ? ' ▲' : ' ▼'}</span>}
                              </div>
                              <div className="file-details">
                                Tamaño: {formatFileSize(archivo.tamaño)} | Modificado: {new Date(archivo.fechaModificacion).toLocaleString()}
                              </div>
                            </div>
                            <div className="file-actions-buttons" style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnviarSIREEmail(archivo);
                                }}
                                className="btn btn-secondary btn-small"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                title="Enviar por Gmail"
                              >
                                ✉️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnviarSIREWhatsApp(archivo);
                                }}
                                className="btn btn-success btn-small"
                                style={{ padding: '6px 12px', fontSize: '12px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}
                                title="Enviar por WhatsApp"
                              >
                                📱
                              </button>
                            </div>
                            {cargandoArchivo && archivoExpandido === null && (
                              <div className="file-loading">Cargando...</div>
                            )}
                          </div>

                          {/* Visor de Excel expandido */}
                          {estaExpandido && datosArchivoExpandido && (
                            <ExcelViewer
                              archivoData={datosArchivoExpandido}
                              onClose={cerrarVisorExcel}
                              onRowSelect={handleExcelRowSelect}
                              hojaActiva={selectedHoja}
                              canAutoFill={soportaAutollenado()}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="file-actions">
                  <button className="btn btn-secondary btn-small" onClick={updateFileList}>🔄 Actualizar Lista</button>
                  {rucValido && <span className="file-count">{archivosFiltrados.length} archivo(s) encontrado(s)</span>}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default SireAjustesModule;
