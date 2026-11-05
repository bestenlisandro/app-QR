/**
 * Control de Tiempos de Producción por QR — Besten
 * Backend Google Apps Script vinculado a la planilla "Control de Produccion Taller".
 *
 * Instalación (ver docs/02-GUIA-DESPLIEGUE.md):
 *   1. En la planilla: Extensiones > Apps Script, pegar este archivo como Code.gs.
 *   2. Ejecutar setupHojas() una vez (crea pestañas y el cierre automático diario).
 *   3. Implementar > Nueva implementación > Aplicación web
 *      (Ejecutar como: Yo · Acceso: Cualquier usuario).
 *
 * Lo que se puede cambiar SIN tocar código está en la planilla:
 *   - Operarios y el prefijo de la pistola de cada uno  -> pestaña Operarios
 *   - Lista de operaciones                              -> pestaña Operaciones
 *   - Proyectos                                         -> pestaña Proyectos
 *   - PIN de correcciones, hora de cierre automático    -> pestaña Config
 */

// ---------------------------------------------------------------------------
// NOMBRES DE HOJAS Y COLUMNAS
// ---------------------------------------------------------------------------

var SH_REG = 'Registro_Tiempos';
var SH_PROY = 'Proyectos';
var SH_OPER = 'Operarios';
var SH_OPS = 'Operaciones';
var SH_CFG = 'Config';
var SH_REP = 'Reporte';

var REG_HEADERS = [
  'ID', 'Fecha', 'Operario', 'Proyecto', 'Cliente', 'Cod_Operacion', 'Operacion',
  'Tipo', 'Inicio', 'Fin', 'Minutos', 'Horas', 'Estado', 'Observacion', 'Origen', 'Editado_por'
];
// Índices (0-based) de REG_HEADERS
var C = {
  ID: 0, FECHA: 1, OPERARIO: 2, PROYECTO: 3, CLIENTE: 4, COD: 5, OPERACION: 6,
  TIPO: 7, INICIO: 8, FIN: 9, MIN: 10, HORAS: 11, ESTADO: 12, OBS: 13, ORIGEN: 14, EDITADO: 15
};

// Tipos de operación
//   PROYECTO : siempre se carga a un proyecto (si no se escaneó, queda "Sin proyecto – revisar")
//   OPCIONAL : se carga al proyecto escaneado o, si no hubo, a "GENERAL" (tarea general del taller)
//   PAUSA    : descanso / almuerzo / pausa, sin proyecto
//   FIN      : fin de jornada (cierra lo abierto, no genera registro)
var OPERACIONES_DEFAULT = [
  ['DESCARGA', 'Descarga de materiales', 'OPCIONAL'],
  ['ACOMODO', 'Acomodamiento', 'OPCIONAL'],
  ['CORTE', 'Corte', 'PROYECTO'],
  ['PEGADO', 'Pegado de cantos', 'PROYECTO'],
  ['PROCMULT', 'Procesado con múltiple', 'PROYECTO'],
  ['PROCSIN', 'Procesado sin múltiple', 'PROYECTO'],
  ['RANURADO', 'Ranurado', 'PROYECTO'],
  ['ARMADO', 'Armado', 'PROYECTO'],
  ['LIMPIEZA', 'Limpieza', 'OPCIONAL'],
  ['EMBALAJE', 'Embalaje', 'PROYECTO'],
  ['CARGA', 'Carga', 'PROYECTO'],
  ['DESCANSO', 'Descanso', 'PAUSA'],
  ['ALMUERZO', 'Almuerzo', 'PAUSA'],
  ['PAUSA', 'Pausa', 'PAUSA'],
  ['FIN', 'Fin de jornada', 'FIN']
];

var OPERARIOS_DEFAULT = [
  ['Mariano', 'M1'],
  ['Emiliano', 'E2'],
  ['Gonzalo', 'G3']
];

var CONFIG_DEFAULT = [
  ['ADMIN_PIN', '1234', 'PIN para correcciones en el dashboard (Maxi, Daniel, Lisandro). CAMBIARLO.'],
  ['HORA_CIERRE', 19, 'Hora (0-23) en que se cierran solas las operaciones que quedaron abiertas.'],
  ['VENTANA_PROYECTO_MIN', 15, 'Minutos que "vale" el QR de proyecto escaneado antes de la operación.']
];

var PROYECTO_GENERAL = 'GENERAL';
var TZ_DEFAULT = 'America/Argentina/Buenos_Aires';

// ---------------------------------------------------------------------------
// MENÚ
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Control de Producción')
    .addItem('Inicializar / reparar hojas', 'setupHojas')
    .addItem('Cerrar ahora las operaciones abiertas', 'cierreAutomatico')
    .addToUi();
}

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function tz() {
  return getSS().getSpreadsheetTimeZone() || TZ_DEFAULT;
}

function ensureSheet(name, headers, rows) {
  var ss = getSS();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1e2226').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (rows && rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return sh;
}

function setupHojas() {
  var ss = getSS();
  ss.setSpreadsheetTimeZone(TZ_DEFAULT);

  var opsRows = OPERACIONES_DEFAULT.map(function (o, i) { return [o[0], o[1], o[2], i + 1, 'SI']; });
  ensureSheet(SH_OPS, ['Codigo', 'Nombre', 'Tipo', 'Orden', 'Activa'], opsRows);
  ensureSheet(SH_OPER, ['Nombre', 'Prefijo_Pistola', 'Activo'], OPERARIOS_DEFAULT.map(function (o) { return [o[0], o[1], 'SI']; }));
  ensureSheet(SH_PROY, ['ID_Proyecto', 'Cliente', 'Descripcion', 'Estado', 'Fecha_Inicio', 'Fecha_Entrega'],
    [['104', 'Cliente de ejemplo', 'Fila de ejemplo, se puede borrar', 'Activo', new Date(), '']]);
  ensureSheet(SH_CFG, ['Clave', 'Valor', 'Descripcion'], CONFIG_DEFAULT);

  var reg = ensureSheet(SH_REG, REG_HEADERS, null);
  reg.getRange('B:B').setNumberFormat('dd/mm/yyyy');
  reg.getRange('I:J').setNumberFormat('dd/mm/yyyy hh:mm');
  reg.getRange('K:L').setNumberFormat('0.00');

  buildReporte();

  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);

  instalarTriggerCierre();
  try { ss.toast('Listo: hojas creadas y cierre automático programado.'); } catch (e) {}
}

function buildReporte() {
  var ss = getSS();
  var sh = ss.getSheetByName(SH_REP) || ss.insertSheet(SH_REP);
  sh.clear();
  var hoy = new Date();
  var primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  sh.getRange('A1').setValue('Desde').setFontWeight('bold');
  sh.getRange('B1').setValue(primero).setNumberFormat('dd/mm/yyyy').setBackground('#fff4cc');
  sh.getRange('A2').setValue('Hasta').setFontWeight('bold');
  sh.getRange('B2').setValue(hoy).setNumberFormat('dd/mm/yyyy').setBackground('#fff4cc');
  sh.getRange('D1').setValue('Cambiá las fechas amarillas y todo se recalcula. Valores en horas (no incluye operaciones abiertas).')
    .setFontStyle('italic').setFontColor('#666666');

  var rango = 'Registro_Tiempos!A2:P';
  function q(select, extra, tail) {
    return '=IFERROR(QUERY(' + rango + ',"select ' + select +
      ' where B >= date \'"&TEXT($B$1,"yyyy-mm-dd")&"\' and B <= date \'"&TEXT($B$2,"yyyy-mm-dd")&"\' and M <> \'Abierta\'' +
      extra + ' ' + tail + '",0),"Sin datos en el período")';
  }

  sh.getRange('A4').setValue('Horas por operario y operación').setFontWeight('bold');
  sh.getRange('A5').setFormula(q('C, sum(L)', '', 'group by C pivot G'));

  sh.getRange('A22').setValue('Horas por proyecto y operación').setFontWeight('bold');
  sh.getRange('A23').setFormula(q('D, sum(L)', " and D <> ''", 'group by D pivot G'));

  sh.getRange('A60').setValue('Horas por día y operario').setFontWeight('bold');
  sh.getRange('A61').setFormula(q('B, sum(L)', '', "group by B pivot C format B 'dd/mm/yyyy'"));
}

function instalarTriggerCierre() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cierreAutomatico') ScriptApp.deleteTrigger(t);
  });
  var hora = Number(getConfig().HORA_CIERRE);
  if (isNaN(hora) || hora < 0 || hora > 23) hora = 19;
  ScriptApp.newTrigger('cierreAutomatico').timeBased().atHour(hora).everyDays(1).inTimezone(TZ_DEFAULT).create();
}

// ---------------------------------------------------------------------------
// LECTURA DE CONFIGURACIÓN DESDE LA PLANILLA
// ---------------------------------------------------------------------------

function readTable(name) {
  var sh = getSS().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function esSi(v) {
  var s = String(v).trim().toUpperCase();
  return s === '' || s === 'SI' || s === 'SÍ' || s === 'TRUE' || s === 'X' || s === '1';
}

/** Normaliza un código leído: mayúsculas, solo letras y números (inmune a la distribución de teclado). */
function norm(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
}

function getConfig() {
  var cfg = {};
  CONFIG_DEFAULT.forEach(function (r) { cfg[r[0]] = r[1]; });
  readTable(SH_CFG).forEach(function (r) { if (r[0]) cfg[String(r[0]).trim()] = r[1]; });
  return cfg;
}

function getOperaciones() {
  var rows = readTable(SH_OPS);
  if (!rows.length) rows = OPERACIONES_DEFAULT.map(function (o, i) { return [o[0], o[1], o[2], i + 1, 'SI']; });
  return rows.filter(function (r) { return r[0] && esSi(r[4]); }).map(function (r) {
    return { codigo: norm(r[0]), nombre: String(r[1]), tipo: String(r[2] || 'PROYECTO').trim().toUpperCase(), orden: Number(r[3]) || 99 };
  }).sort(function (a, b) { return a.orden - b.orden; });
}

function getOperarios() {
  var rows = readTable(SH_OPER);
  if (!rows.length) rows = OPERARIOS_DEFAULT.map(function (o) { return [o[0], o[1], 'SI']; });
  return rows.filter(function (r) { return r[0] && esSi(r[2]); }).map(function (r) {
    return { nombre: String(r[0]).trim(), prefijo: norm(r[1]) };
  });
}

function getProyectos(soloActivos) {
  return readTable(SH_PROY).filter(function (r) {
    return r[0] !== '' && (!soloActivos || String(r[3]).trim().toLowerCase() !== 'terminado');
  }).map(function (r) {
    return { id: String(r[0]).trim(), cliente: String(r[1] || ''), descripcion: String(r[2] || ''), estado: String(r[3] || '') };
  });
}

// ---------------------------------------------------------------------------
// WEB APP
// ---------------------------------------------------------------------------

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case 'config': return jsonOutput(apiConfig());
      case 'estado': return jsonOutput(apiEstado());
      case 'registros': return jsonOutput(apiRegistros(p.desde, p.hasta));
      case 'ping': return jsonOutput({ ok: true, ts: Date.now() });
      default: return jsonOutput({ ok: false, error: 'Acción desconocida: ' + p.action });
    }
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  try {
    switch (body.action) {
      case 'scan': return jsonOutput(conLock(function () { return apiScan(body); }));
      case 'admin': return jsonOutput(conLock(function () { return apiAdmin(body); }));
      default: return jsonOutput({ ok: false, error: 'Acción desconocida: ' + body.action });
    }
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err && err.message || err) });
  }
}

function conLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function apiConfig() {
  return {
    ok: true,
    operarios: getOperarios(),
    operaciones: getOperaciones(),
    proyectos: getProyectos(true),
    ventanaProyectoMin: Number(getConfig().VENTANA_PROYECTO_MIN) || 15,
    serverTs: Date.now()
  };
}

// ---------------------------------------------------------------------------
// REGISTROS: acceso a la hoja
// ---------------------------------------------------------------------------

function regSheet() {
  var sh = getSS().getSheetByName(SH_REG);
  if (!sh) { setupHojas(); sh = getSS().getSheetByName(SH_REG); }
  return sh;
}

function allRegRows() {
  var sh = regSheet();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, REG_HEADERS.length).getValues();
}

function findRowById(id) {
  var rows = allRegRows();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][C.ID]) === String(id)) return { rowNum: i + 2, row: rows[i] };
  }
  return null;
}

function findOpen(operario) {
  var rows = allRegRows();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i][C.OPERARIO] === operario && rows[i][C.ESTADO] === 'Abierta') return { rowNum: i + 2, row: rows[i] };
  }
  return null;
}

function toDate(v) {
  if (v instanceof Date) return v;
  if (v === '' || v === null || v === undefined) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fechaDe(d) {
  var s = Utilities.formatDate(d, tz(), 'yyyy-MM-dd');
  return Utilities.parseDate(s, tz(), 'yyyy-MM-dd');
}

function minutosEntre(a, b) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 600) / 100); // 2 decimales
}

function nuevoId() {
  return 'R' + Utilities.formatDate(new Date(), tz(), 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100);
}

function abrirRegistro(o) {
  var row = new Array(REG_HEADERS.length);
  for (var i = 0; i < row.length; i++) row[i] = '';
  row[C.ID] = nuevoId();
  row[C.FECHA] = fechaDe(o.inicio);
  row[C.OPERARIO] = o.operario;
  row[C.PROYECTO] = o.proyecto || '';
  row[C.CLIENTE] = o.cliente || '';
  row[C.COD] = o.op.codigo;
  row[C.OPERACION] = o.op.nombre;
  row[C.TIPO] = o.op.tipo === 'PAUSA' ? 'Pausa' : (o.proyecto === PROYECTO_GENERAL ? 'General' : 'Productiva');
  row[C.INICIO] = o.inicio;
  row[C.ESTADO] = 'Abierta';
  row[C.OBS] = o.obs || '';
  row[C.ORIGEN] = o.origen || '';
  regSheet().appendRow(row);
  return row;
}

function cerrarRegistro(found, fin, estado, obsExtra, editadoPor) {
  var row = found.row;
  var inicio = toDate(row[C.INICIO]);
  if (!inicio) inicio = fin;
  if (fin.getTime() < inicio.getTime()) fin = inicio;
  var min = minutosEntre(inicio, fin);
  row[C.FIN] = fin;
  row[C.MIN] = min;
  row[C.HORAS] = Math.round(min / 60 * 10000) / 10000;
  row[C.ESTADO] = estado || 'Cerrada';
  if (obsExtra) row[C.OBS] = row[C.OBS] ? row[C.OBS] + ' · ' + obsExtra : obsExtra;
  if (editadoPor) row[C.EDITADO] = editadoPor;
  regSheet().getRange(found.rowNum, 1, 1, REG_HEADERS.length).setValues([row]);
  return row;
}

// ---------------------------------------------------------------------------
// ESCANEO — la lógica central
// ---------------------------------------------------------------------------

/**
 * body: { codigo, operario?, ts?, origen? }
 *  - Desde la PC compartida: codigo trae el prefijo de la pistola (ej. "M1OP-CORTE") y no viene operario.
 *  - Desde el celular: viene operario y codigo sin prefijo.
 */
function apiScan(body) {
  var operarios = getOperarios();
  var operaciones = getOperaciones();
  var raw = norm(body.codigo);
  if (!raw) return { ok: false, error: 'Código vacío' };

  var operario = body.operario ? String(body.operario) : null;
  var resto = raw;
  if (!operario) {
    var cands = operarios.filter(function (o) { return o.prefijo && raw.indexOf(o.prefijo) === 0; })
      .sort(function (a, b) { return b.prefijo.length - a.prefijo.length; });
    if (!cands.length) return { ok: false, error: 'No reconozco la pistola (prefijo). Código leído: ' + raw };
    operario = cands[0].nombre;
    resto = raw.slice(cands[0].prefijo.length);
  } else if (!operarios.some(function (o) { return o.nombre === operario; })) {
    return { ok: false, error: 'Operario desconocido: ' + operario };
  } else {
    // Si desde el celular escanean algo con prefijo, se lo sacamos igual.
    operarios.forEach(function (o) {
      if (!o.prefijo) return;
      if (resto.indexOf(o.prefijo + 'OP') === 0 || resto.indexOf(o.prefijo + 'PRY') === 0) resto = resto.slice(o.prefijo.length);
    });
  }

  var ahora = new Date();
  var ts = body.ts ? new Date(Number(body.ts)) : ahora;
  if (isNaN(ts.getTime()) || Math.abs(ts.getTime() - ahora.getTime()) > 36 * 3600 * 1000) ts = ahora;
  var origen = body.origen || (body.operario ? 'Celular' : 'PC');

  var props = PropertiesService.getScriptProperties();
  var pendKey = 'PEND_' + operario;

  // --- QR de PROYECTO -----------------------------------------------------
  if (resto.indexOf('PRY') === 0) {
    var idNorm = resto.slice(3);
    var proy = null;
    getProyectos(false).forEach(function (p) { if (norm(p.id) === idNorm) proy = p; });
    var pend = { id: proy ? proy.id : idNorm, cliente: proy ? proy.cliente : '', ts: ts.getTime(), noCargado: !proy };
    props.setProperty(pendKey, JSON.stringify(pend));
    return {
      ok: true, tipo: 'proyecto', operario: operario, proyecto: pend.id,
      mensaje: operario + ': proyecto ' + pend.id + (proy ? ' (' + proy.cliente + ')' : ' — no está en la lista de Proyectos') + '. Ahora escaneá la operación.',
      alerta: !proy
    };
  }

  // --- QR de OPERACIÓN ----------------------------------------------------
  if (resto.indexOf('OP') !== 0) return { ok: false, operario: operario, error: 'Código no reconocido: ' + raw };
  var cod = resto.slice(2);
  var op = null;
  operaciones.forEach(function (o) { if (o.codigo === cod) op = o; });
  if (!op) return { ok: false, operario: operario, error: 'Operación desconocida: ' + cod };

  var ventana = (Number(getConfig().VENTANA_PROYECTO_MIN) || 15) * 60000;
  var pendiente = null;
  try { pendiente = JSON.parse(props.getProperty(pendKey) || 'null'); } catch (x) {}
  if (pendiente && (ts.getTime() - pendiente.ts > ventana || ts.getTime() < pendiente.ts - 60000)) pendiente = null;

  var abierta = findOpen(operario);

  // Fin de jornada
  if (op.tipo === 'FIN') {
    props.deleteProperty(pendKey);
    if (abierta) {
      cerrarRegistro(abierta, ts, 'Cerrada');
      return { ok: true, tipo: 'fin', operario: operario, mensaje: operario + ': fin de jornada. Se cerró ' + abierta.row[C.OPERACION] + '.' };
    }
    return { ok: true, tipo: 'fin', operario: operario, mensaje: operario + ': fin de jornada (no tenía nada abierto).' };
  }

  // Mismo QR que la operación abierta -> TERMINA (si no se escaneó otro proyecto distinto)
  if (abierta && abierta.row[C.COD] === op.codigo &&
      (!pendiente || op.tipo === 'PAUSA' || norm(pendiente.id) === norm(abierta.row[C.PROYECTO]))) {
    var cerrada = cerrarRegistro(abierta, ts, 'Cerrada');
    props.deleteProperty(pendKey);
    return {
      ok: true, tipo: 'cierre', operario: operario,
      mensaje: operario + ': terminó ' + op.nombre + (cerrada[C.PROYECTO] ? ' · ' + cerrada[C.PROYECTO] : '') + ' (' + formatMin(cerrada[C.MIN]) + ').'
    };
  }

  // Si había otra cosa abierta, se cierra al empezar la nueva
  var cerroAnterior = '';
  if (abierta) {
    cerrarRegistro(abierta, ts, 'Cerrada');
    cerroAnterior = ' (se cerró ' + abierta.row[C.OPERACION] + ')';
  }

  var proyecto = '', cliente = '', obs = '', alerta = false;
  if (op.tipo === 'PROYECTO') {
    if (pendiente) { proyecto = pendiente.id; cliente = pendiente.cliente; if (pendiente.noCargado) obs = 'Proyecto no cargado en la lista – revisar'; }
    else { obs = 'Sin proyecto – revisar'; alerta = true; }
  } else if (op.tipo === 'OPCIONAL') {
    if (pendiente) { proyecto = pendiente.id; cliente = pendiente.cliente; }
    else { proyecto = PROYECTO_GENERAL; cliente = 'Taller'; }
  }
  props.deleteProperty(pendKey);

  abrirRegistro({ operario: operario, proyecto: proyecto, cliente: cliente, op: op, inicio: ts, obs: obs, origen: origen });

  return {
    ok: true, tipo: 'inicio', operario: operario, alerta: alerta,
    mensaje: operario + ': empezó ' + op.nombre + (proyecto ? ' · ' + proyecto : '') +
      (alerta ? ' — SIN PROYECTO (escaneá primero el QR del proyecto)' : '') + cerroAnterior
  };
}

function formatMin(m) {
  m = Number(m) || 0;
  var h = Math.floor(m / 60), mm = Math.round(m % 60);
  return h ? h + ' h ' + mm + ' min' : mm + ' min';
}

// ---------------------------------------------------------------------------
// CIERRE AUTOMÁTICO (trigger diario)
// ---------------------------------------------------------------------------

function cierreAutomatico() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var hora = Number(getConfig().HORA_CIERRE);
    if (isNaN(hora)) hora = 19;
    var ahora = new Date();
    var hoyStr = Utilities.formatDate(ahora, tz(), 'yyyy-MM-dd');
    var corteHoy = Utilities.parseDate(hoyStr + ' ' + ('0' + hora).slice(-2) + ':00', tz(), 'yyyy-MM-dd HH:mm');
    var rows = allRegRows();
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][C.ESTADO] !== 'Abierta') continue;
      var inicio = toDate(rows[i][C.INICIO]) || ahora;
      // Si arrancó otro día, se cierra a la hora de corte de ese día
      var diaIni = Utilities.formatDate(inicio, tz(), 'yyyy-MM-dd');
      var corte = Utilities.parseDate(diaIni + ' ' + ('0' + hora).slice(-2) + ':00', tz(), 'yyyy-MM-dd HH:mm');
      if (diaIni === hoyStr) corte = corteHoy;
      var fin = inicio.getTime() > corte.getTime() ? ahora : corte;
      if (fin.getTime() > ahora.getTime()) fin = ahora;
      cerrarRegistro({ rowNum: i + 2, row: rows[i] }, fin, 'Cierre automático', 'Quedó abierta – revisar hora de fin');
      n++;
    }
    var props = PropertiesService.getScriptProperties();
    getOperarios().forEach(function (o) { props.deleteProperty('PEND_' + o.nombre); });
    return n;
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

function rowToObj(r, rowNum) {
  var ini = toDate(r[C.INICIO]), fin = toDate(r[C.FIN]);
  return {
    id: String(r[C.ID]),
    fecha: r[C.FECHA] instanceof Date ? Utilities.formatDate(r[C.FECHA], tz(), 'yyyy-MM-dd') : String(r[C.FECHA]),
    operario: r[C.OPERARIO], proyecto: String(r[C.PROYECTO]), cliente: r[C.CLIENTE],
    cod: r[C.COD], operacion: r[C.OPERACION], tipo: r[C.TIPO],
    inicio: ini ? ini.getTime() : null, fin: fin ? fin.getTime() : null,
    minutos: r[C.MIN] === '' ? null : Number(r[C.MIN]),
    estado: r[C.ESTADO], obs: r[C.OBS], origen: r[C.ORIGEN], editado: r[C.EDITADO]
  };
}

function apiEstado() {
  var rows = allRegRows();
  var hoyStr = Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  var ventana = (Number(getConfig().VENTANA_PROYECTO_MIN) || 15) * 60000;
  var operarios = getOperarios().map(function (o) {
    var abierta = null, ultimo = null;
    for (var i = rows.length - 1; i >= 0; i--) {
      if (rows[i][C.OPERARIO] !== o.nombre) continue;
      if (!ultimo) ultimo = rowToObj(rows[i]);
      if (rows[i][C.ESTADO] === 'Abierta') { abierta = rowToObj(rows[i]); break; }
    }
    var pend = null;
    try { pend = JSON.parse(props.getProperty('PEND_' + o.nombre) || 'null'); } catch (x) {}
    if (pend && Date.now() - pend.ts > ventana) pend = null;
    return { nombre: o.nombre, abierta: abierta, ultimo: ultimo, proyectoPendiente: pend ? pend.id : null };
  });
  var hoy = [];
  for (var j = 0; j < rows.length; j++) {
    var obj = rowToObj(rows[j]);
    if (obj.fecha === hoyStr) hoy.push(obj);
  }
  return { ok: true, serverTs: Date.now(), operarios: operarios, hoy: hoy };
}

function apiRegistros(desde, hasta) {
  var out = [];
  allRegRows().forEach(function (r, i) {
    var o = rowToObj(r);
    if (desde && o.fecha < desde) return;
    if (hasta && o.fecha > hasta) return;
    out.push(o);
  });
  return { ok: true, serverTs: Date.now(), registros: out };
}

// ---------------------------------------------------------------------------
// CORRECCIONES (con PIN)
// ---------------------------------------------------------------------------

/**
 * body: { pin, quien, op: 'verificar'|'editar'|'cerrar'|'borrar'|'crear', id?, cambios? }
 * cambios: { operario, proyecto, cod, inicio (ms), fin (ms o null), obs }
 */
function apiAdmin(body) {
  if (String(body.pin || '') !== String(getConfig().ADMIN_PIN)) return { ok: false, error: 'PIN incorrecto' };
  var quien = String(body.quien || 'Admin').slice(0, 40);
  if (body.op === 'verificar') return { ok: true };

  var ops = getOperaciones();
  function opPorCod(cod) { var r = null; ops.forEach(function (o) { if (o.codigo === norm(cod)) r = o; }); return r; }
  var proyectos = getProyectos(false);
  function clienteDe(id) { var c = ''; proyectos.forEach(function (p) { if (norm(p.id) === norm(id)) c = p.cliente; }); return id === PROYECTO_GENERAL ? 'Taller' : c; }
  var sello = quien + ' ' + Utilities.formatDate(new Date(), tz(), 'dd/MM HH:mm');

  if (body.op === 'crear') {
    var c = body.cambios || {};
    var op = opPorCod(c.cod);
    if (!op || op.tipo === 'FIN') return { ok: false, error: 'Operación inválida' };
    if (!c.operario || !c.inicio) return { ok: false, error: 'Faltan operario o inicio' };
    var row = abrirRegistro({
      operario: c.operario, proyecto: c.proyecto || (op.tipo === 'OPCIONAL' ? PROYECTO_GENERAL : ''),
      cliente: clienteDe(c.proyecto || ''), op: op, inicio: new Date(Number(c.inicio)), obs: c.obs || 'Cargado a mano', origen: 'Corrección'
    });
    if (c.fin) {
      var f = findRowById(row[C.ID]);
      cerrarRegistro(f, new Date(Number(c.fin)), 'Corregida', '', sello);
    } else {
      var f2 = findRowById(row[C.ID]);
      f2.row[C.EDITADO] = sello;
      regSheet().getRange(f2.rowNum, 1, 1, REG_HEADERS.length).setValues([f2.row]);
    }
    return { ok: true, id: row[C.ID] };
  }

  var found = findRowById(body.id);
  if (!found) return { ok: false, error: 'No encontré el registro ' + body.id };

  if (body.op === 'borrar') {
    regSheet().deleteRow(found.rowNum);
    return { ok: true };
  }

  if (body.op === 'cerrar') {
    var fin = body.cambios && body.cambios.fin ? new Date(Number(body.cambios.fin)) : new Date();
    cerrarRegistro(found, fin, 'Corregida', '', sello);
    return { ok: true };
  }

  if (body.op === 'editar') {
    var ch = body.cambios || {};
    var r = found.row;
    if (ch.operario) r[C.OPERARIO] = ch.operario;
    if (ch.cod) {
      var nop = opPorCod(ch.cod);
      if (!nop || nop.tipo === 'FIN') return { ok: false, error: 'Operación inválida' };
      r[C.COD] = nop.codigo; r[C.OPERACION] = nop.nombre;
      if (nop.tipo === 'PAUSA') { r[C.PROYECTO] = ''; r[C.CLIENTE] = ''; }
    }
    if (ch.proyecto !== undefined) { r[C.PROYECTO] = ch.proyecto; r[C.CLIENTE] = clienteDe(ch.proyecto); }
    var opActual = opPorCod(r[C.COD]);
    r[C.TIPO] = opActual && opActual.tipo === 'PAUSA' ? 'Pausa' : (r[C.PROYECTO] === PROYECTO_GENERAL ? 'General' : 'Productiva');
    if (ch.inicio) { r[C.INICIO] = new Date(Number(ch.inicio)); r[C.FECHA] = fechaDe(r[C.INICIO]); }
    if (ch.obs !== undefined) r[C.OBS] = ch.obs;
    // Si se corrigió y ya no falta el proyecto, se limpia la marca de revisión
    if (r[C.PROYECTO] && String(r[C.OBS]).indexOf('Sin proyecto') >= 0) {
      r[C.OBS] = String(r[C.OBS]).replace(/Sin proyecto – revisar( · )?/, '').trim();
    }
    // Una corrección de horario saca la marca de "revisar hora de fin"
    if (ch.fin && String(r[C.OBS]).indexOf('revisar hora de fin') >= 0) {
      r[C.OBS] = String(r[C.OBS]).replace(/( · )?Quedó abierta – revisar hora de fin/, '').trim();
    }
    if (ch.fin) {
      return { ok: true, row: rowToObj(cerrarRegistro(found, new Date(Number(ch.fin)), 'Corregida', '', sello)) };
    }
    if (r[C.FIN] !== '' && r[C.FIN] !== null) {
      return { ok: true, row: rowToObj(cerrarRegistro(found, toDate(r[C.FIN]), 'Corregida', '', sello)) };
    }
    r[C.EDITADO] = sello;
    regSheet().getRange(found.rowNum, 1, 1, REG_HEADERS.length).setValues([r]);
    return { ok: true, row: rowToObj(r) };
  }

  return { ok: false, error: 'Operación de corrección desconocida' };
}
