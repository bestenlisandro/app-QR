// Configuración compartida por todas las pantallas.
//
// Operarios, prefijos de pistola, operaciones y proyectos NO se cargan acá:
// se editan en la planilla de Google Sheets (pestañas Operarios, Operaciones,
// Proyectos y Config) y las pantallas los leen solas.
//
// Lo único que va acá es la URL del backend (Apps Script publicado como
// Aplicación web, termina en /exec). Ver docs/02-GUIA-DESPLIEGUE.md.
const APP_CONFIG = {
  // Implementación de la cuenta bestenlisandroglineur@gmail.com
  // (planilla "Control de Produccion Taller"). Si se cambia Code.gs, usar
  // Implementar > Administrar implementaciones > editar > Nueva versión: así la URL no cambia.
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyXh861OpjYcKIv5X4CHxGvLpRxzyOzlvBVypKZBRLNHhV93O3KUFUrWI09GDPrEsRZ/exec',

  // Cada cuántos segundos se refresca el estado en pantalla
  REFRESCO_SEG: 8
};
