/**
 * Control de Tiempos de Producción por QR
 * Backend Google Apps Script — Web App vinculada a la planilla de Google Sheets.
 *
 * Instalación: Extensiones > Apps Script en la planilla, pegar este archivo
 * como Code.gs, ejecutar setupHojas() una vez, e implementar como Web App.
 * Ver docs/02-GUIA-DESPLIEGUE.md para el paso a paso completo.
 */

// ---------------------------------------------------------------------------
// CONFIGURACIÓN
// ---------------------------------------------------------------------------

var SHEET_PROYECTOS = 'Proyectos';
var SHEET_REGISTROS = 'Registro_Tiempos';
var SHEET_DASHBOARD = 'Dashboard_Resumen';

var OPERARIOS = ['Mariano', 'Emiliano', 'Gonzalo'];

var OPERACIONES = [
  { id: 'OP-01', nombre: 'Descarga de materiales' },
  { id: 'OP-02', nombre: 'Orden / Clasificación' },
  { id: 'OP-03', nombre: 'Corte (Escuadradora)' },
  { id: 'OP-04', nombre: 'Pegado de cantos (Pegadora PVC)' },
  { id: 'OP-05', nombre: 'Procesado / Perforado (Perforadora múltiple)' },
  { id: 'OP-06', nombre: 'Armado (Bancos de armado)' },
  { id: 'OP-07', nombre: 'Carga (Logística / Despacho)' }
];

var REGISTROS_HEADERS = [
  'ID_Registro', 'ID_Proyecto', 'Operario', 'Operacion_ID', 'Operacion',
  'Fecha', 'Hora_Inicio', 'Hora_Fin', 'Duracion_Minutos', 'Horas_Hombre',
  'Tiempo_Pausado_Minutos', 'Pausa_Inicio', 'Estado', 'Ultima_Actualizacion'
];

var PROYECTOS_HEADERS = [
  'ID_Proyecto', 'Cliente', 'Tipo_Servicio', 'Estado',
  'Fecha_Inicio', 'Fecha_Entrega_Estimada', 'Observaciones'
];

var ESTADOS_ACTIVOS = ['En Curso', 'Pausado'];

// ---------------------------------------------------------------------------
// MENÚ (al abrir la planilla)
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Control de Producción')
    .addItem('Inicializar / Reparar hojas', 'setupHojas')
    .addItem('Recalcular Dashboard_Resumen', 'recalcularDashboardMenu')
    .addToUi();
}

function recalcularDashboardMenu() {
  buildDashboardFormulas(getSS().getSheetByName(SHEET_DASHBOARD));
  SpreadsheetApp.getActiveSpreadsheet().toast('Dashboard_Resumen recalculado.');
}

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function setupHojas() {
  var ss = getSS();

  var shProy = ss.getSheetByName(SHEET_PROYECTOS) || ss.insertSheet(SHEET_PROYECTOS);
  if (shProy.getLastRow() === 0) {
    shProy.appendRow(PROYECTOS_HEADERS);
    shProy.appendRow(['PRJ-001', 'Cliente de ejemplo', 'Interno', 'Activo', new Date(), '', 'Fila de ejemplo, puede borrarla']);
    shProy.setFrozenRows(1);
    shProy.autoResizeColumns(1, PROYECTOS_HEADERS.length);
  }

  var shReg = ss.getSheetByName(SHEET_REGISTROS) || ss.insertSheet(SHEET_REGISTROS);
  if (shReg.getLastRow() === 0) {
    shReg.appendRow(REGISTROS_HEADERS);
    shReg.setFrozenRows(1);
    shReg.autoResizeColumns(1, REGISTROS_HEADERS.length);
  }

  var shDash = ss.getSheetByName(SHEET_DASHBOARD) || ss.insertSheet(SHEET_DASHBOARD);
  buildDashboardFormulas(shDash);

  SpreadsheetApp.getActiveSpreadsheet().toast('Hojas listas: Proyectos, Registro_Tiempos, Dashboard_Resumen.');
}

function buildDashboardFormulas(sh) {
  sh.clear();

  sh.getRange('A1').setValue('Horas-Hombre por Proyecto').setFontWeight('bold');
  sh.getRange('A2').setFormula(
    '=IFERROR(QUERY(Registro_Tiempos!A2:N,"select B, sum(J) where B <> \'\' group by B label sum(J) \'Horas Hombre\'",0),"Sin datos")'
  );

  sh.getRange('D1').setValue('Horas-Hombre por Operación').setFontWeight('bold');
  sh.getRange('D2').setFormula(
    '=IFERROR(QUERY(Registro_Tiempos!A2:N,"select E, sum(J) where E <> \'\' group by E label sum(J) \'Horas Hombre\'",0),"Sin datos")'
  );

  sh.getRange('G1').setValue('Horas-Hombre por Operario').setFontWeight('bold');
  sh.getRange('G2').setFormula(
    '=IFERROR(QUERY(Registro_Tiempos!A2:N,"select C, sum(J) where C <> \'\' group by C label sum(J) \'Horas Hombre\'",0),"Sin datos")'
  );

  sh.getRange('J1').setValue('Desglose Operario x Operación (Horas-Hombre)').setFontWeight('bold');
  sh.getRange('J2').setFormula(
    '=IFERROR(QUERY(Registro_Tiempos!A2:N,"select C, sum(J) where C <> \'\' group by C pivot E",0),"Sin datos")'
  );

  sh.getRange('A1:P1').setFontSize(11);
  sh.setColumnWidths(1, 16, 140);

  var nota = 'Estas fórmulas solo suman tareas Finalizadas. Para ver tareas en curso en vivo usar el dashboard web (webapp/dashboard.html).';
  sh.getRange('A20').setValue(nota).setFontStyle('italic').setFontColor('#666666');
}

// ---------------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------------

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  var sh = getSS().getSheetByName(name);
  if (!sh) {
    throw new Error('Falta la hoja "' + name + '". Ejecute setupHojas() desde el editor de Apps Script o el menú Control de Producción.');
  }
  return sh;
}

function headerMap(sh) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) { if (h) map[h] = i + 1; });
  return map;
}

function requireStr(val, name) {
  if (val === undefined || val === null || String(val).trim() === '') {
    throw new Error('Falta el campo obligatorio: ' + name);
  }
  return String(val).trim();
}

function formatFecha(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function appendRowFromMap(sh, obj) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    return obj.hasOwnProperty(h) ? obj[h] : '';
  });
  sh.appendRow(row);
}

function rowToObject(row, map) {
  return {
    id_registro: row[map['ID_Registro'] - 1],
    id_proyecto: row[map['ID_Proyecto'] - 1],
    operario: row[map['Operario'] - 1],
    operacion_id: row[map['Operacion_ID'] - 1],
    operacion: row[map['Operacion'] - 1],
    fecha: row[map['Fecha'] - 1],
    hora_inicio: row[map['Hora_Inicio'] - 1],
    hora_fin: row[map['Hora_Fin'] - 1],
    duracion_minutos: row[map['Duracion_Minutos'] - 1],
    horas_hombre: row[map['Horas_Hombre'] - 1],
    tiempo_pausado_minutos: row[map['Tiempo_Pausado_Minutos'] - 1],
    pausa_inicio: row[map['Pausa_Inicio'] - 1],
    estado: row[map['Estado'] - 1],
    ultima_actualizacion: row[map['Ultima_Actualizacion'] - 1]
  };
}

function findActiveByOperario(operario) {
  var sh = getSheet(SHEET_REGISTROS);
  var map = headerMap(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var op = row[map['Operario'] - 1];
    var estado = row[map['Estado'] - 1];
    if (op === operario && ESTADOS_ACTIVOS.indexOf(estado) !== -1) {
      return { rowIndex: i + 2, map: map, sheet: sh, row: row };
    }
  }
  return null;
}

function findByIdRegistro(idRegistro) {
  var sh = getSheet(SHEET_REGISTROS);
  var map = headerMap(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][map['ID_Registro'] - 1] === idRegistro) {
      return { rowIndex: i + 2, map: map, sheet: sh, row: values[i] };
    }
  }
  return null;
}

function getProyectoInfo(idProyecto) {
  var sh = getSheet(SHEET_PROYECTOS);
  var map = headerMap(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][map['ID_Proyecto'] - 1] === idProyecto) {
      return {
        id_proyecto: values[i][map['ID_Proyecto'] - 1],
        cliente: values[i][map['Cliente'] - 1],
        tipo_servicio: values[i][map['Tipo_Servicio'] - 1],
        estado: values[i][map['Estado'] - 1]
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// ENDPOINTS HTTP
// ---------------------------------------------------------------------------

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;
  try {
    switch (action) {
      case 'config':
        return jsonOutput({ ok: true, operarios: OPERARIOS, operaciones: OPERACIONES });
      case 'proyectosActivos':
        return jsonOutput(getProyectosActivos());
      case 'estadoOperario':
        return jsonOutput(getEstadoOperario(e.parameter.operario));
      case 'dashboard':
        return jsonOutput(getDashboardData());
      default:
        return jsonOutput({ ok: true, mensaje: 'API Control de Tiempos de Producción activa.' });
    }
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var result;
    switch (action) {
      case 'iniciar':
        result = iniciarOperacion(body);
        break;
      case 'pausar':
        result = pausarOperacion(body);
        break;
      case 'reanudar':
        result = reanudarOperacion(body);
        break;
      case 'finalizar':
        result = finalizarOperacion(body);
        break;
      default:
        throw new Error('Acción no reconocida: ' + action);
    }
    return jsonOutput(result);
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// LÓGICA DE NEGOCIO — FICHADAS
// ---------------------------------------------------------------------------

function iniciarOperacion(body) {
  var operario = requireStr(body.operario, 'operario');
  var idProyecto = requireStr(body.proyecto_id, 'proyecto_id');
  var idOperacion = requireStr(body.operacion_id, 'operacion_id');
  var nombreOperacion = requireStr(body.operacion_nombre, 'operacion_nombre');

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var activa = findActiveByOperario(operario);
    if (activa) {
      return {
        ok: false,
        error: 'El operario ya tiene una tarea activa. Debe pausarla o finalizarla antes de iniciar otra.',
        tarea_activa: rowToObject(activa.row, activa.map)
      };
    }

    var sh = getSheet(SHEET_REGISTROS);
    var now = new Date();
    var idRegistro = 'REG-' + Utilities.getUuid();

    appendRowFromMap(sh, {
      'ID_Registro': idRegistro,
      'ID_Proyecto': idProyecto,
      'Operario': operario,
      'Operacion_ID': idOperacion,
      'Operacion': nombreOperacion,
      'Fecha': formatFecha(now),
      'Hora_Inicio': now,
      'Hora_Fin': '',
      'Duracion_Minutos': '',
      'Horas_Hombre': '',
      'Tiempo_Pausado_Minutos': 0,
      'Pausa_Inicio': '',
      'Estado': 'En Curso',
      'Ultima_Actualizacion': now
    });

    var found = findByIdRegistro(idRegistro);
    var proyectoInfo = getProyectoInfo(idProyecto);

    return {
      ok: true,
      registro: rowToObject(found.row, found.map),
      aviso: proyectoInfo ? null : 'Atención: el proyecto ' + idProyecto + ' no está cargado en la hoja Proyectos.'
    };
  } finally {
    lock.releaseLock();
  }
}

function pausarOperacion(body) {
  var idRegistro = requireStr(body.id_registro, 'id_registro');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var found = findByIdRegistro(idRegistro);
    if (!found) return { ok: false, error: 'Registro no encontrado.' };

    var estado = found.row[found.map['Estado'] - 1];
    if (estado !== 'En Curso') {
      return { ok: false, error: 'Solo se puede pausar una tarea En Curso (estado actual: ' + estado + ').' };
    }

    var now = new Date();
    found.sheet.getRange(found.rowIndex, found.map['Pausa_Inicio']).setValue(now);
    found.sheet.getRange(found.rowIndex, found.map['Estado']).setValue('Pausado');
    found.sheet.getRange(found.rowIndex, found.map['Ultima_Actualizacion']).setValue(now);

    var refreshed = findByIdRegistro(idRegistro);
    return { ok: true, registro: rowToObject(refreshed.row, refreshed.map) };
  } finally {
    lock.releaseLock();
  }
}

function reanudarOperacion(body) {
  var idRegistro = requireStr(body.id_registro, 'id_registro');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var found = findByIdRegistro(idRegistro);
    if (!found) return { ok: false, error: 'Registro no encontrado.' };

    var estado = found.row[found.map['Estado'] - 1];
    if (estado !== 'Pausado') {
      return { ok: false, error: 'Solo se puede reanudar una tarea Pausada (estado actual: ' + estado + ').' };
    }

    var pausaInicioVal = found.row[found.map['Pausa_Inicio'] - 1];
    var now = new Date();
    var minutosPausa = pausaInicioVal ? (now.getTime() - new Date(pausaInicioVal).getTime()) / 60000 : 0;
    var pausadoPrevio = Number(found.row[found.map['Tiempo_Pausado_Minutos'] - 1]) || 0;

    found.sheet.getRange(found.rowIndex, found.map['Tiempo_Pausado_Minutos']).setValue(Math.round((pausadoPrevio + minutosPausa) * 100) / 100);
    found.sheet.getRange(found.rowIndex, found.map['Pausa_Inicio']).setValue('');
    found.sheet.getRange(found.rowIndex, found.map['Estado']).setValue('En Curso');
    found.sheet.getRange(found.rowIndex, found.map['Ultima_Actualizacion']).setValue(now);

    var refreshed = findByIdRegistro(idRegistro);
    return { ok: true, registro: rowToObject(refreshed.row, refreshed.map) };
  } finally {
    lock.releaseLock();
  }
}

function finalizarOperacion(body) {
  var idRegistro = requireStr(body.id_registro, 'id_registro');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var found = findByIdRegistro(idRegistro);
    if (!found) return { ok: false, error: 'Registro no encontrado.' };

    var estado = found.row[found.map['Estado'] - 1];
    if (estado === 'Finalizado') return { ok: false, error: 'La tarea ya estaba finalizada.' };

    var now = new Date();
    var pausadoPrevio = Number(found.row[found.map['Tiempo_Pausado_Minutos'] - 1]) || 0;

    if (estado === 'Pausado') {
      var pausaInicioVal = found.row[found.map['Pausa_Inicio'] - 1];
      if (pausaInicioVal) {
        pausadoPrevio += (now.getTime() - new Date(pausaInicioVal).getTime()) / 60000;
      }
    }

    var horaInicio = new Date(found.row[found.map['Hora_Inicio'] - 1]);
    var totalMinutos = (now.getTime() - horaInicio.getTime()) / 60000;
    var duracionNeta = Math.max(0, totalMinutos - pausadoPrevio);
    var horasHombre = duracionNeta / 60;

    found.sheet.getRange(found.rowIndex, found.map['Hora_Fin']).setValue(now);
    found.sheet.getRange(found.rowIndex, found.map['Duracion_Minutos']).setValue(Math.round(duracionNeta * 100) / 100);
    found.sheet.getRange(found.rowIndex, found.map['Horas_Hombre']).setValue(Math.round(horasHombre * 10000) / 10000);
    found.sheet.getRange(found.rowIndex, found.map['Tiempo_Pausado_Minutos']).setValue(Math.round(pausadoPrevio * 100) / 100);
    found.sheet.getRange(found.rowIndex, found.map['Pausa_Inicio']).setValue('');
    found.sheet.getRange(found.rowIndex, found.map['Estado']).setValue('Finalizado');
    found.sheet.getRange(found.rowIndex, found.map['Ultima_Actualizacion']).setValue(now);

    var refreshed = findByIdRegistro(idRegistro);
    return { ok: true, registro: rowToObject(refreshed.row, refreshed.map) };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------------------------

function getEstadoOperario(operario) {
  if (!operario) throw new Error('Falta el parámetro operario.');
  var activa = findActiveByOperario(operario);
  if (!activa) return { ok: true, tiene_tarea_activa: false };
  return { ok: true, tiene_tarea_activa: true, tarea: rowToObject(activa.row, activa.map) };
}

function getProyectosActivos() {
  var sh = getSheet(SHEET_PROYECTOS);
  var map = headerMap(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, proyectos: [] };

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var proyectos = values
    .filter(function (r) {
      var id = r[map['ID_Proyecto'] - 1];
      var estado = r[map['Estado'] - 1];
      return id !== '' && estado !== 'Finalizado' && estado !== 'Cerrado';
    })
    .map(function (r) {
      return {
        id_proyecto: r[map['ID_Proyecto'] - 1],
        cliente: r[map['Cliente'] - 1],
        tipo_servicio: r[map['Tipo_Servicio'] - 1],
        estado: r[map['Estado'] - 1]
      };
    });

  return { ok: true, proyectos: proyectos };
}

function getDashboardData() {
  var sh = getSheet(SHEET_REGISTROS);
  var map = headerMap(sh);
  var lastRow = sh.getLastRow();
  var now = new Date();

  var result = {
    ok: true,
    generado: now,
    tareas_activas: [],
    por_operario: {},
    por_operacion: {},
    por_proyecto: {},
    totales: { horas_hombre_hoy: 0, horas_hombre_total: 0, tareas_finalizadas_hoy: 0 }
  };

  OPERARIOS.forEach(function (o) {
    result.por_operario[o] = { horas_hombre: 0, estado: 'Libre', tarea_actual: null };
  });
  OPERACIONES.forEach(function (op) {
    result.por_operacion[op.nombre] = 0;
  });

  if (lastRow < 2) return result;

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var hoyStr = formatFecha(now);

  values.forEach(function (row) {
    var operario = row[map['Operario'] - 1];
    var operacion = row[map['Operacion'] - 1];
    var proyecto = row[map['ID_Proyecto'] - 1];
    var estado = row[map['Estado'] - 1];
    var fecha = row[map['Fecha'] - 1];
    var horasHombre = Number(row[map['Horas_Hombre'] - 1]) || 0;

    if (!proyecto) return;
    if (!result.por_proyecto[proyecto]) {
      result.por_proyecto[proyecto] = { horas_hombre: 0, por_operacion: {} };
    }

    if (estado === 'Finalizado') {
      if (result.por_operario[operario]) result.por_operario[operario].horas_hombre += horasHombre;
      result.por_operacion[operacion] = (result.por_operacion[operacion] || 0) + horasHombre;
      result.por_proyecto[proyecto].horas_hombre += horasHombre;
      result.por_proyecto[proyecto].por_operacion[operacion] = (result.por_proyecto[proyecto].por_operacion[operacion] || 0) + horasHombre;
      result.totales.horas_hombre_total += horasHombre;
      if (fecha === hoyStr) {
        result.totales.horas_hombre_hoy += horasHombre;
        result.totales.tareas_finalizadas_hoy += 1;
      }
    } else if (ESTADOS_ACTIVOS.indexOf(estado) !== -1) {
      var horaInicio = new Date(row[map['Hora_Inicio'] - 1]);
      var pausadoAcum = Number(row[map['Tiempo_Pausado_Minutos'] - 1]) || 0;
      var elapsedMin;

      if (estado === 'Pausado') {
        var pausaInicioVal = row[map['Pausa_Inicio'] - 1];
        var pausaInicio = pausaInicioVal ? new Date(pausaInicioVal) : now;
        elapsedMin = (pausaInicio.getTime() - horaInicio.getTime()) / 60000 - pausadoAcum;
      } else {
        elapsedMin = (now.getTime() - horaInicio.getTime()) / 60000 - pausadoAcum;
      }
      elapsedMin = Math.max(0, elapsedMin);

      var tarea = {
        id_registro: row[map['ID_Registro'] - 1],
        operario: operario,
        proyecto: proyecto,
        operacion: operacion,
        estado: estado,
        minutos_transcurridos: Math.round(elapsedMin * 10) / 10,
        hora_inicio: horaInicio
      };

      result.tareas_activas.push(tarea);
      if (result.por_operario[operario]) {
        result.por_operario[operario].estado = estado;
        result.por_operario[operario].tarea_actual = tarea;
      }
    }
  });

  return result;
}
