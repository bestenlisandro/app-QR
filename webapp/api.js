// Cliente del backend (Google Apps Script) + utilidades comunes.
// El POST va como text/plain para evitar el preflight CORS que Apps Script no responde.
const Api = {
  isConfigured() {
    return !!APP_CONFIG.APPS_SCRIPT_URL && !APP_CONFIG.APPS_SCRIPT_URL.includes('PEGAR_AQUI');
  },
  async get(action, params = {}) {
    if (!this.isConfigured()) throw new Error('Falta configurar la URL del backend en config.js');
    const url = new URL(APP_CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('Error de red: ' + res.status);
    return res.json();
  },
  async post(action, data = {}) {
    if (!this.isConfigured()) throw new Error('Falta configurar la URL del backend en config.js');
    const res = await fetch(APP_CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data }),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('Error de red: ' + res.status);
    return res.json();
  }
};

// ---- Cola de escaneos: si se corta internet, se guardan y se mandan después ----
// Cada item: { codigo, ts, operario? }. Se envían en orden, de a uno.
function crearCola(clave, onResultado, onCambio) {
  let cola = [];
  try { cola = JSON.parse(localStorage.getItem(clave) || '[]'); } catch (e) { cola = []; }
  let enviando = false;
  const guardar = () => { try { localStorage.setItem(clave, JSON.stringify(cola)); } catch (e) {} onCambio && onCambio(cola.length); };
  async function procesar() {
    if (enviando || !cola.length) return;
    enviando = true;
    try {
      while (cola.length) {
        const item = cola[0];
        let res;
        try {
          res = await Api.post('scan', item);
        } catch (err) {
          onCambio && onCambio(cola.length, true);
          break; // sin conexión: se reintenta más tarde
        }
        cola.shift();
        guardar();
        onResultado && onResultado(item, res);
      }
    } finally {
      enviando = false;
    }
  }
  setInterval(procesar, 5000);
  window.addEventListener('online', procesar);
  return {
    agregar(item) { cola.push(item); guardar(); procesar(); },
    get largo() { return cola.length; },
    procesar
  };
}

// ---- Sonidos (sin archivos) ----
const Sonido = (() => {
  let ctx = null;
  function tono(freq, dur, delay = 0) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; o.type = 'square';
      g.gain.value = 0.15;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + delay;
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  return {
    ok() { tono(1200, 0.08); },
    inicio() { tono(900, 0.08); tono(1400, 0.1, 0.1); },
    cierre() { tono(1400, 0.08); tono(900, 0.12, 0.1); },
    alerta() { tono(600, 0.15); tono(600, 0.15, 0.25); tono(600, 0.15, 0.5); },
    error() { tono(220, 0.6); }
  };
})();

// ---- Formatos ----
function fmtDur(min) {
  min = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
function fmtHoras(min) { return (Math.round((Number(min) || 0) / 60 * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtHora(ms) { return ms ? new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'; }
function fmtFecha(ms) { return ms ? new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'; }
function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtPct(v) { return (Number(v) || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'; }
// "Armado" + recurso BANCO1 -> "Armado · Banco 1"
function opConBanco(r) {
  const m = /^BANCO(\d+)$/.exec(r && r.recurso || '');
  return (r && r.operacion || '') + (m ? ' · Banco ' + m[1] : '');
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function minutosDe(r, ahora = Date.now()) {
  if (r.minutos !== null && r.minutos !== undefined && r.estado !== 'Abierta') return Number(r.minutos);
  return r.inicio ? Math.max(0, (ahora - r.inicio) / 60000) : 0;
}
