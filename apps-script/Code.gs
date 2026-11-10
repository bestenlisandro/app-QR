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
var SH_REC = 'Recursos';

var REG_HEADERS = [
  'ID', 'Fecha', 'Operario', 'Proyecto', 'Cliente', 'Cod_Operacion', 'Operacion',
  'Tipo', 'Inicio', 'Fin', 'Minutos', 'Horas', 'Estado', 'Observacion', 'Origen', 'Editado_por', 'Recurso'
];
// Índices (0-based) de REG_HEADERS
var C = {
  ID: 0, FECHA: 1, OPERARIO: 2, PROYECTO: 3, CLIENTE: 4, COD: 5, OPERACION: 6,
  TIPO: 7, INICIO: 8, FIN: 9, MIN: 10, HORAS: 11, ESTADO: 12, OBS: 13, ORIGEN: 14, EDITADO: 15, RECURSO: 16
};

// Tipos de operación
//   PROYECTO : siempre se carga a un proyecto (si no se escaneó, queda "Sin proyecto – revisar")
//   OPCIONAL : se carga al proyecto escaneado o, si no hubo, a "GENERAL" (tarea general del taller)
//   PAUSA    : descanso / almuerzo / pausa, sin proyecto
//   FIN      : fin de jornada (cierra lo abierto, no genera registro)
// Recurso: máquina o puesto que ocupa la operación (para medir la capacidad utilizada).
// Armado y Procesado sin múltiple tienen un código por banco: así se sabe en qué banco se trabajó.
var OPERACIONES_DEFAULT = [
  ['DESCARGA', 'Descarga de materiales', 'OPCIONAL', ''],
  ['ACOMODO', 'Acomodamiento', 'OPCIONAL', ''],
  ['CORTE', 'Corte', 'PROYECTO', 'ESCUADRADORA'],
  ['RANURADO', 'Ranurado', 'PROYECTO', 'ESCUADRADORA'],
  ['PEGADO', 'Pegado de cantos', 'PROYECTO', 'PEGADORA'],
  ['PROCMULT', 'Procesado con múltiple', 'PROYECTO', 'MULTIPLE'],
  ['PROCSINB1', 'Procesado sin múltiple', 'PROYECTO', 'BANCO1'],
  ['PROCSINB2', 'Procesado sin múltiple', 'PROYECTO', 'BANCO2'],
  ['ARMADOB1', 'Armado', 'PROYECTO', 'BANCO1'],
  ['ARMADOB2', 'Armado', 'PROYECTO', 'BANCO2'],
  ['LIMPIEZA', 'Limpieza', 'OPCIONAL', ''],
  ['EMBALAJE', 'Embalaje', 'PROYECTO', ''],
  ['CARGA', 'Carga', 'PROYECTO', ''],
  ['DESCANSO', 'Descanso', 'PAUSA', ''],
  ['ALMUERZO', 'Almuerzo', 'PAUSA', ''],
  ['PAUSA', 'Pausa', 'PAUSA', ''],
  ['FIN', 'Fin de jornada', 'FIN', '']
];
var OPS_HEADERS = ['Codigo', 'Nombre', 'Tipo', 'Orden', 'Activa', 'Recurso'];
function opsDefaultRows() {
  return OPERACIONES_DEFAULT.map(function (o, i) { return [o[0], o[1], o[2], i + 1, 'SI', o[3]]; });
}

// Foto: ruta de la imagen dentro de la web app (carpeta webapp/img/recursos) o una URL completa.
var RECURSOS_DEFAULT = [
  ['ESCUADRADORA', 'Escuadradora', 'img/recursos/escuadradora.jpg'],
  ['PEGADORA', 'Pegadora de cantos', 'img/recursos/pegadora.jpg'],
  ['MULTIPLE', 'Múltiple', 'img/recursos/multiple.jpg'],
  ['BANCO1', 'Banco de trabajo 1', 'img/recursos/banco1.jpg'],
  ['BANCO2', 'Banco de trabajo 2', 'img/recursos/banco2.jpg']
];
var REC_HEADERS = ['Codigo', 'Nombre', 'Foto', 'Orden', 'Activo'];

var OPERARIOS_DEFAULT = [
  ['Mariano', 'M1'],
  ['Emiliano', 'E2'],
  ['Gonzalo', 'G3']
];

var CONFIG_DEFAULT = [
  ['ADMIN_PIN', '1234', 'PIN para correcciones en el dashboard (Maxi, Daniel, Lisandro). CAMBIARLO.'],
  ['HORA_CIERRE', 19, 'Hora (0-23) en que se cierran solas las operaciones que quedaron abiertas.'],
  ['VENTANA_PROYECTO_MIN', 15, 'Minutos que "vale" el QR de proyecto escaneado antes de la operación.'],
  ['HORAS_DISPONIBLES_DIA', 7.75, 'Horas de trabajo por día para calcular la capacidad (8:30 a 17 menos 45 min de almuerzo = 7,75).'],
  ['FERIADOS', '', 'Días no laborables de lunes a viernes, separados por coma (ej. 24/12/2026, 25/12/2026). Si alguien ficha ese día, cuenta igual.']
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

  ensureSheet(SH_OPS, OPS_HEADERS, opsDefaultRows());
  ensureSheet(SH_OPER, ['Nombre', 'Prefijo_Pistola', 'Activo'], OPERARIOS_DEFAULT.map(function (o) { return [o[0], o[1], 'SI']; }));
  ensureSheet(SH_PROY, ['ID_Proyecto', 'Cliente', 'Descripcion', 'Estado', 'Fecha_Inicio', 'Fecha_Entrega'],
    [['104', 'Cliente de ejemplo', 'Fila de ejemplo, se puede borrar', 'Activo', new Date(), '']]);
  ensureSheet(SH_CFG, ['Clave', 'Valor', 'Descripcion'], CONFIG_DEFAULT);

  var reg = ensureSheet(SH_REG, REG_HEADERS, null);
  reg.getRange('B:B').setNumberFormat('dd/mm/yyyy');
  reg.getRange('I:J').setNumberFormat('dd/mm/yyyy hh:mm');
  reg.getRange('K:L').setNumberFormat('0.00');

  actualizarRecursos();
  buildReporte();

  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);

  instalarTriggerCierre();
  try { ss.toast('Listo: hojas creadas y cierre automático programado.'); } catch (e) {}
}

/**
 * Agrega recursos (máquinas y bancos) a una planilla ya instalada. Se puede ejecutar
 * varias veces sin duplicar nada. setupHojas() la llama sola.
 */
function actualizarRecursos() {
  var ss = getSS();

  // 1) Hoja Recursos
  ensureSheet(SH_REC, REC_HEADERS, RECURSOS_DEFAULT.map(function (r, i) { return [r[0], r[1], r[2], i + 1, 'SI']; }));

  // 2) Operaciones: columna Recurso, operaciones por banco y desactivar Armado / Procesado sin múltiple genéricos
  var ops = ss.getSheetByName(SH_OPS);
  var defs = {};
  OPERACIONES_DEFAULT.forEach(function (o, i) { defs[o[0]] = { fila: [o[0], o[1], o[2], i + 1, 'SI', o[3]], orden: i + 1 }; });
  if (String(ops.getRange(1, 6).getValue()).trim() !== 'Recurso') {
    ops.getRange(1, 6).setValue('Recurso').setFontWeight('bold').setBackground('#1e2226').setFontColor('#ffffff');
  }
  var n = ops.getLastRow() - 1;
  var datos = n > 0 ? ops.getRange(2, 1, n, 6).getValues() : [];
  var vistos = {};
  datos.forEach(function (r) {
    var cod = norm(r[0]);
    vistos[cod] = true;
    if (defs[cod]) {
      if (!r[5]) r[5] = defs[cod].fila[5];
      r[3] = defs[cod].orden;
    }
    if (cod === 'ARMADO' || cod === 'PROCSIN') { r[4] = 'NO'; r[3] = 90; }
  });
  OPERACIONES_DEFAULT.forEach(function (o) { if (!vistos[o[0]]) datos.push(defs[o[0]].fila); });
  datos.sort(function (a, b) { return (Number(a[3]) || 99) - (Number(b[3]) || 99); });
  if (datos.length) ops.getRange(2, 1, datos.length, 6).setValues(datos);

  // 3) Config: claves nuevas
  var cfg = ss.getSheetByName(SH_CFG);
  var claves = {};
  readTable(SH_CFG).forEach(function (r) { claves[String(r[0]).trim()] = true; });
  CONFIG_DEFAULT.forEach(function (r) { if (!claves[r[0]]) cfg.appendRow(r); });

  // 4) Registro_Tiempos: columna Recurso (y completar registros viejos)
  var reg = ss.getSheetByName(SH_REG);
  if (reg) {
    if (String(reg.getRange(1, REG_HEADERS.length).getValue()).trim() !== 'Recurso') {
      reg.getRange(1, REG_HEADERS.length).setValue('Recurso').setFontWeight('bold').setBackground('#1e2226').setFontColor('#ffffff');
    }
    var nr = reg.getLastRow() - 1;
    if (nr > 0) {
      var mapa = {};
      getOperaciones().forEach(function (o) { mapa[o.codigo] = o.recurso; });
      var cods = reg.getRange(2, C.COD + 1, nr, 1).getValues();
      var recs = reg.getRange(2, C.RECURSO + 1, nr, 1).getValues();
      var cambio = false;
      for (var i = 0; i < nr; i++) {
        if (!recs[i][0] && mapa[norm(cods[i][0])]) { recs[i][0] = mapa[norm(cods[i][0])]; cambio = true; }
      }
      if (cambio) reg.getRange(2, C.RECURSO + 1, nr, 1).setValues(recs);
    }
  }
}

function getRecursos() {
  var rows = readTable(SH_REC);
  if (!rows.length) rows = RECURSOS_DEFAULT.map(function (r, i) { return [r[0], r[1], r[2], i + 1, 'SI']; });
  return rows.filter(function (r) { return r[0] && esSi(r[4]); }).map(function (r) {
    return { codigo: norm(r[0]), nombre: String(r[1]), foto: String(r[2] || ''), orden: Number(r[3]) || 99 };
  }).sort(function (a, b) { return a.orden - b.orden; });
}

function getFeriados() {
  var v = getConfig().FERIADOS;
  if (v instanceof Date) return [Utilities.formatDate(v, tz(), 'yyyy-MM-dd')];
  return String(v || '').split(/[,;\n]+/).map(function (t) {
    var m = t.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : null;
  }).filter(Boolean);
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

  // Separador de argumentos según la configuración regional de la planilla
  // (español/portugués/etc. usan ";", inglés usa ","). Se filtra con FILTER en vez de
  // TEXT(fecha) para no depender del formato de fecha del idioma.
  var loc = String(ss.getSpreadsheetLocale() || 'es_AR');
  var S = /^(en|ja|zh|ko|th|he|iw|hi)/i.test(loc) ? ',' : ';';
  var R = 'Registro_Tiempos!';
  function q(select, extraFiltro) {
    return '=IFERROR(QUERY(FILTER(' + R + 'A2:P' + S + R + 'B2:B>=$B$1' + S + R + 'B2:B<=$B$2' + S + R + 'M2:M<>"Abierta"' +
      (extraFiltro ? S + extraFiltro : '') + ')' + S + '"' + select + '"' + S + '0)' + S + '"Sin datos en el período")';
  }

  sh.getRange('A4').setValue('Horas por operario y operación').setFontWeight('bold');
  sh.getRange('A5').setFormula(q('select Col3, sum(Col12) group by Col3 pivot Col7'));

  sh.getRange('A22').setValue('Horas por proyecto y operación').setFontWeight('bold');
  sh.getRange('A23').setFormula(q('select Col4, sum(Col12) group by Col4 pivot Col7', R + 'D2:D<>""'));

  sh.getRange('A60').setValue('Horas por día y operario').setFontWeight('bold');
  sh.getRange('A61').setFormula(q("select Col2, sum(Col12) group by Col2 pivot Col3 format Col2 'dd/mm/yyyy'"));
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
  if (!rows.length) rows = opsDefaultRows();
  return rows.filter(function (r) { return r[0] && esSi(r[4]); }).map(function (r) {
    return { codigo: norm(r[0]), nombre: String(r[1]), tipo: String(r[2] || 'PROYECTO').trim().toUpperCase(), orden: Number(r[3]) || 99, recurso: norm(r[5] || '') };
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
    recursos: getRecursos(),
    ventanaProyectoMin: Number(getConfig().VENTANA_PROYECTO_MIN) || 15,
    horasDisponiblesDia: Number(String(getConfig().HORAS_DISPONIBLES_DIA).replace(',', '.')) || 7.75,
    feriados: getFeriados(),
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
  row[C.RECURSO] = o.op.recurso || '';
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
    mensaje: operario + ': empezó ' + op.nombre + (/^BANCO\d/.test(op.recurso || '') ? ' (Banco ' + op.recurso.slice(5) + ')' : '') + (proyecto ? ' · ' + proyecto : '') +
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
    estado: r[C.ESTADO], obs: r[C.OBS], origen: r[C.ORIGEN], editado: r[C.EDITADO], recurso: r[C.RECURSO] || ''
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
  if (/^(listarConfig|guardarRecurso|fotoRecurso|guardarOperacion)$/.test(body.op)) return apiConfigAdmin(body);

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
      r[C.COD] = nop.codigo; r[C.OPERACION] = nop.nombre; r[C.RECURSO] = nop.recurso || '';
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

// ---------------------------------------------------------------------------
// CONFIGURACIÓN DE MÁQUINAS Y OPERACIONES DESDE EL DASHBOARD (con PIN)
// ---------------------------------------------------------------------------

var CARPETA_FOTOS = 'Fotos máquinas - Control QR';
var TIPOS_VALIDOS = ['PROYECTO', 'OPCIONAL', 'PAUSA'];

/** Ejecutar una vez desde el editor para autorizar el acceso a Drive (fotos). */
function autorizarDrive() {
  var f = carpetaFotos();
  Logger.log('Carpeta de fotos: ' + f.getUrl());
}

function carpetaFotos() {
  var it = DriveApp.getFoldersByName(CARPETA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_FOTOS);
}

function tablaCompleta(nombre, ncols) {
  var sh = getSS().getSheetByName(nombre);
  var n = sh.getLastRow() - 1;
  return { sh: sh, filas: n > 0 ? sh.getRange(2, 1, n, ncols).getValues() : [] };
}

/** Código nuevo a partir del nombre, sin repetir: "Sierra circular" -> SIERRACIRCU */
function codigoNuevo(nombre, existentes) {
  var base = norm(nombre).slice(0, 10) || 'X';
  if (/^(OP|PRY)/.test(base)) base = 'X' + base;
  var cod = base, i = 2;
  while (existentes[cod]) cod = base + (i++);
  return cod;
}

function apiConfigAdmin(body) {
  var c = body.cambios || {};

  if (body.op === 'listarConfig') {
    var rec = tablaCompleta(SH_REC, 5).filas.filter(function (r) { return r[0]; }).map(function (r) {
      return { codigo: norm(r[0]), nombre: String(r[1]), foto: String(r[2] || ''), orden: Number(r[3]) || 99, activo: esSi(r[4]) };
    });
    var ops = tablaCompleta(SH_OPS, 6).filas.filter(function (r) { return r[0]; }).map(function (r) {
      return { codigo: norm(r[0]), nombre: String(r[1]), tipo: String(r[2]).trim().toUpperCase(), orden: Number(r[3]) || 99, activa: esSi(r[4]), recurso: norm(r[5] || '') };
    });
    return { ok: true, recursos: rec, operaciones: ops };
  }

  if (body.op === 'guardarRecurso') {
    var nombre = String(c.nombre || '').trim();
    if (!nombre) return { ok: false, error: 'Falta el nombre de la máquina' };
    var t = tablaCompleta(SH_REC, 5);
    var idx = -1, existentes = {};
    t.filas.forEach(function (r, i) { existentes[norm(r[0])] = true; if (c.codigo && norm(r[0]) === norm(c.codigo)) idx = i; });
    if (idx >= 0) {
      t.filas[idx][1] = nombre;
      if (c.activo !== undefined) t.filas[idx][4] = c.activo ? 'SI' : 'NO';
      t.sh.getRange(idx + 2, 1, 1, 5).setValues([t.filas[idx]]);
      return { ok: true, codigo: norm(t.filas[idx][0]) };
    }
    var cod = codigoNuevo(nombre, existentes);
    var orden = t.filas.reduce(function (m, r) { return Math.max(m, Number(r[3]) || 0); }, 0) + 1;
    t.sh.appendRow([cod, nombre, '', orden, 'SI']);
    return { ok: true, codigo: cod };
  }

  if (body.op === 'fotoRecurso') {
    var t2 = tablaCompleta(SH_REC, 5);
    var fila = -1;
    t2.filas.forEach(function (r, i) { if (norm(r[0]) === norm(c.codigo)) fila = i; });
    if (fila < 0) return { ok: false, error: 'No encontré la máquina ' + c.codigo };
    var m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(c.imagen || ''));
    if (!m) return { ok: false, error: 'La foto no llegó bien. Probá de nuevo.' };
    var blob = Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], norm(c.codigo).toLowerCase() + '_' + Utilities.formatDate(new Date(), tz(), 'yyyyMMdd_HHmm') + '.jpg');
    var carpeta = carpetaFotos();
    var archivo = carpeta.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // Foto anterior en Drive: se manda a la papelera
    var prev = /[?&]id=([\w-]+)/.exec(String(t2.filas[fila][2] || ''));
    if (prev) { try { DriveApp.getFileById(prev[1]).setTrashed(true); } catch (e) {} }
    var url = 'https://drive.google.com/thumbnail?id=' + archivo.getId() + '&sz=w1600';
    t2.sh.getRange(fila + 2, 3).setValue(url);
    return { ok: true, foto: url };
  }

  if (body.op === 'guardarOperacion') {
    var nom = String(c.nombre || '').trim();
    var tipo = String(c.tipo || 'PROYECTO').toUpperCase();
    if (!nom) return { ok: false, error: 'Falta el nombre de la operación' };
    if (TIPOS_VALIDOS.indexOf(tipo) < 0) return { ok: false, error: 'Tipo inválido' };
    var recurso = norm(c.recurso || '');
    if (tipo === 'PAUSA') recurso = '';
    var t3 = tablaCompleta(SH_OPS, 6);
    var j = -1, ex = {};
    t3.filas.forEach(function (r, i) { ex[norm(r[0])] = true; if (c.codigo && norm(r[0]) === norm(c.codigo)) j = i; });
    if (j >= 0) {
      if (norm(t3.filas[j][0]) === 'FIN') return { ok: false, error: 'Fin de jornada no se puede modificar' };
      t3.filas[j][1] = nom; t3.filas[j][2] = tipo; t3.filas[j][5] = recurso;
      if (c.activa !== undefined) t3.filas[j][4] = c.activa ? 'SI' : 'NO';
      t3.sh.getRange(j + 2, 1, 1, 6).setValues([t3.filas[j]]);
      return { ok: true, codigo: norm(t3.filas[j][0]) };
    }
    // Nueva: va después de la última operación de trabajo (antes de las pausas)
    var codN = codigoNuevo(nom, ex);
    var ultimaTrabajo = 0;
    t3.filas.forEach(function (r) { var tp = String(r[2]).toUpperCase(); if (tp !== 'PAUSA' && tp !== 'FIN' && esSi(r[4])) ultimaTrabajo = Math.max(ultimaTrabajo, Number(r[3]) || 0); });
    var filas = t3.filas.map(function (r) {
      var tp = String(r[2]).toUpperCase();
      if ((tp === 'PAUSA' || tp === 'FIN') && Number(r[3]) > ultimaTrabajo && Number(r[3]) < 90) r[3] = Number(r[3]) + 1;
      return r;
    });
    filas.push([codN, nom, tipo, ultimaTrabajo + 1, 'SI', recurso]);
    filas.sort(function (a, b) { return (Number(a[3]) || 99) - (Number(b[3]) || 99); });
    t3.sh.getRange(2, 1, filas.length, 6).setValues(filas);
    return { ok: true, codigo: codN };
  }
  return { ok: false, error: 'Operación desconocida' };
}

