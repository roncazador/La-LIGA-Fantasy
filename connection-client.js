(() => {
  'use strict';

  const SYNC_MS = 10 * 60 * 1000;
  const LAST_SYNC_KEY = 'laliga_connection_last_sync_v210';
  let running = false;

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  const fmt = ts => {
    if (!ts) return 'Nunca';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return 'Nunca';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' }).format(d);
  };

  function ensurePanel() {
    let panel = document.getElementById('connectionPanelV210');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'connectionPanelV210';
    panel.className = 'card';
    panel.style.cssText = 'margin:12px 0;border:1px solid #30394d;border-radius:15px;background:#111722;padding:12px;';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h3 style="margin:0 0 4px">🔐 Conexión LALIGA · automática</h3>
          <div style="font-size:10px;color:#9aa3b7">SSO oficial · sesión HttpOnly · solo lectura</div>
        </div>
        <div id="connectionBadgeV210" class="pill">Comprobando…</div>
      </div>
      <div id="connectionDetailsV210" class="note" style="margin-top:9px">Comprobando configuración, sesión y última sincronización…</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px">
        <button type="button" id="connectV210" class="primary">🔑 Conectar con LALIGA</button>
        <button type="button" id="syncV210" class="good">🔄 Sincronizar ahora</button>
        <button type="button" id="logoutV210">Cerrar sesión</button>
      </div>
      <div id="connectionWarningV210" class="source" style="margin-top:9px;display:none"></div>
    `;
    const hero = document.querySelector('.hero');
    if (hero?.parentNode) hero.parentNode.insertBefore(panel, hero.nextSibling);
    else document.querySelector('.app')?.prepend(panel);
    return panel;
  }

  function setBadge(text, cls = '') {
    const badge = document.getElementById('connectionBadgeV210');
    if (!badge) return;
    badge.className = `pill ${cls}`.trim();
    badge.textContent = text;
  }

  function setWarning(message) {
    const node = document.getElementById('connectionWarningV210');
    if (!node) return;
    node.style.display = message ? 'block' : 'none';
    node.textContent = message || '';
  }

  async function getJson(url) {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP_${response.status}`), { status: response.status, data });
    return data;
  }

  async function syncOnce(reason = 'manual') {
    if (running) return;
    running = true;
    try {
      setBadge('Sincronizando…', 'yellow');
      setText('connectionDetailsV210', `Consultando sesión y datos de LALIGA (${reason})…`);
      const session = await getJson('/api/session');
      const auth = await getJson('/api/auth/status');
      if (!auth.configured) {
        setBadge('OAuth pendiente', 'yellow');
        setText('connectionDetailsV210', 'El servidor está preparado, pero faltan los parámetros oficiales de OAuth de LALIGA en Render.');
        setWarning('No introduzcas correo, contraseña, cookies ni tokens en la aplicación. La conexión debe completarse mediante el inicio de sesión oficial de LALIGA.');
        return;
      }
      setWarning('');
      if (!session.authenticated) {
        setBadge('No conectada', 'yellow');
        setText('connectionDetailsV210', `OAuth listo · última sincronización local: ${fmt(localStorage.getItem(LAST_SYNC_KEY))}`);
        return;
      }

      const dashboard = await getJson('/api/fantasy/dashboard');
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      localStorage.setItem('fm210_live_dashboard', JSON.stringify({ savedAt: now, dashboard }));
      window.dispatchEvent(new CustomEvent('laliga:sync', { detail: { savedAt: now, dashboard } }));

      const errors = Array.isArray(dashboard.errors) ? dashboard.errors : [];
      setBadge(errors.length ? 'LIVE · parcial' : 'LIVE · conectado', errors.length ? 'yellow' : 'good');
      setText('connectionDetailsV210', `Última sincronización: ${fmt(now)} · datos LALIGA recibidos · ${errors.length ? `faltan: ${errors.join(', ')}` : 'sin errores reportados'}.`);
    } catch (error) {
      setBadge('Error de conexión', 'red');
      setText('connectionDetailsV210', `No se pudo completar la sincronización: ${error.message}.`);
      if (error.status === 401) setWarning('La sesión de LALIGA ha caducado o no existe. Usa «Conectar con LALIGA» para iniciar de nuevo el SSO oficial.');
      else setWarning('Se mantiene el último estado local disponible; no se han inventado datos nuevos.');
    } finally {
      running = false;
    }
  }

  function boot() {
    const panel = ensurePanel();
    panel.querySelector('#connectV210')?.addEventListener('click', () => {
      window.location.assign('/auth/start?platform=ios');
    });
    panel.querySelector('#syncV210')?.addEventListener('click', () => { void syncOnce('manual'); });
    panel.querySelector('#logoutV210')?.addEventListener('click', () => {
      window.location.assign('/auth/logout');
    });

    window.addEventListener('focus', () => { void syncOnce('focus'); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncOnce('visible');
    });

    void syncOnce('inicio');
    window.setInterval(() => { void syncOnce('programada'); }, SYNC_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
