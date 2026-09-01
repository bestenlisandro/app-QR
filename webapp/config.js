// Configuración compartida por index.html, dashboard.html y generador-qr.html
//
// 1. Desplegar apps-script/Code.gs como Web App (ver docs/02-GUIA-DESPLIEGUE.md).
// 2. Pegar acá la URL que termina en /exec.
const APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxBkIEn9GGh8yRL4OUiMfOTZHeZo4IaHU4yC_ub1jqBCSdOtFkQbYM3bNRiUi_sfhtfFQ/exec',

  OPERARIOS: ['Mariano', 'Emiliano', 'Gonzalo'],

  OPERACIONES: [
    { id: 'OP-01', nombre: 'Descarga de materiales' },
    { id: 'OP-02', nombre: 'Orden / Clasificación' },
    { id: 'OP-03', nombre: 'Corte (Escuadradora)' },
    { id: 'OP-04', nombre: 'Pegado de cantos (Pegadora PVC)' },
    { id: 'OP-05', nombre: 'Procesado / Perforado (Perforadora múltiple)' },
    { id: 'OP-06', nombre: 'Armado (Bancos de armado)' },
    { id: 'OP-07', nombre: 'Carga (Logística / Despacho)' }
  ],

  // Frecuencia de refresco del dashboard en tiempo real (ms)
  DASHBOARD_POLL_MS: 6000
};
