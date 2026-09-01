// Cliente HTTP hacia el Web App de Google Apps Script.
// El POST se envía con Content-Type: text/plain para evitar el preflight
// CORS que Apps Script no responde correctamente en despliegues "Anyone".
const Api = {
  isConfigured() {
    return !!APP_CONFIG.APPS_SCRIPT_URL && !APP_CONFIG.APPS_SCRIPT_URL.includes('PEGAR_AQUI');
  },

  async get(action, params = {}) {
    if (!this.isConfigured()) throw new Error('Falta configurar APPS_SCRIPT_URL en config.js');
    const url = new URL(APP_CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('Error de red: ' + res.status);
    return res.json();
  },

  async post(action, data = {}) {
    if (!this.isConfigured()) throw new Error('Falta configurar APPS_SCRIPT_URL en config.js');
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
