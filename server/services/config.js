module.exports = {
  PORTALES: {
    1: "https://e-menu.sunat.gob.pe/cl-ti-itmenu2/MenuInternetPlataforma.htm?exe=55.1.1.1.1", // Mis declaraciones y pagos
    2: "https://e-menu.sunat.gob.pe/cl-ti-itmenucabina/MenuInternet.htm", // Ventana Principal
    3: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon", // Portal Buzón (corregido)
    4: "https://e-menu.sunat.gob.pe/cl-ti-itmenucabina/MenuInternet.htm" // Emitir Factura
  },
  PLAYWRIGHT: {
    headless: process.env.PLAYWRIGHT_HEADLESS === 'true' || process.env.NODE_ENV === 'production',
    timeout: 6000,         // ms para esperar selector txtRuc
    concurrency: 3,        // número de browsers simultáneos por defecto
    slowMo: 0
  },
  LOG_PATH: "logs/automatizador.log"
};