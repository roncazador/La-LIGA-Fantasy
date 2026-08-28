(() => {
  'use strict';

  const SYNC_MS = 5 * 60 * 1000;
  const LAST_SYNC_KEY = 'laliga_connection_last_sync_v212';
  const LIVE_KEY = 'fm212_live_dashboard';
  let running = false;

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const n = byId(id); if (n) n.textContent = value; };
  const fmt = ts => {
    if (!ts) return 'Nunca';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return 'Nunca';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' }).format(d);
  };
  const money = value => {
    const n = Number(value);
    return Number.isFinite(n) ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n) + ' €' : '—';
  };

  function ensurePanel() {
    let panel = byId('connectionPanelV212');
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = 'connectionPanelV212';
    panel.className = 'card';
    panel.style.cssText = 'margin:12px 0;border:1px solid #30394d;border-radius:15px;background:#111722;padding:12px;';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h3 style="margin:0 0 4px">🔐 Conectar cuenta LALIGA</h3>
          <div style="font-size:10px;color:#9aa3b7">Acceso oficial · sesión HttpOnly · datos reales · solo lectura</div>
        </div>
        <div id="connectionBadgeV212" class="pill">Comprobando…</div>
      </div>

      <div id="connectionDetailsV212" class="note" style="margin-top:9px">Comprobando configuración y sesión…</div>

      <div id="connectionMethodsV212" style="margin-top:10px">
        <div id="ssoBoxV212" style="display:none">
          <button type="button" id="connectSSOV212" class="primary">🔑 Entrar con LALIGA / Google</button>
        </div>

        <form id="directLoginV212" style="margin-top:8px">
          <div style="font-size:11px;font-weight:800;margin-bottom:6px">Acceso con correo y contraseña</div>
          <label style="display:block;font-size:11px;margin-bottom:5px">Correo de LALIGA</label>
          <input id="laligaEmailV212" type="email" autocomplete="username" required maxlength="320" placeholder="tu-correo@ejemplo.com">
          <label style="display:block;font-size:11px;margin:8px 0 5px">Contraseña</label>
          <input id="laligaPasswordV212" type="password" autocomplete="current-password" required maxlength="1024" placeholder="Contraseña de LALIGA">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px">
            <button type="submit" class="good">🔐 Conectar cuenta</button>
            <button type="button" id="syncV212">🔄 Sincronizar</button>
            <button type="button" id="logoutV212">Cerrar sesión</button>
          </div>
        </form>
      </div>

      <div id="connectionWarningV212" class="source" style="margin-top:9px;display:none"></div>
    `;

    const hero = document.querySelector('.hero');
    if (hero?.parentNode) hero.parentNode.insertBefore(panel, hero.nextSibling);
    else document.querySelector('.app')?.prepend(panel);

    byId('connectSSOV212')?.addEventListener('click', () => window.location.assign('/auth/start?platform=web'));
    byId('directLoginV212')?.addEventListener('submit', loginDirect);
    byId('syncV212')?.addEventListener('click', () => void syncOnce('manual'));
    byId('logoutV212')?.addEventListener('click', logout);
    return panel;
  }

  function setBadge(text, cls = '') {
    const n = byId('connectionBadgeV212');
    if (n) {
      n.className = `pill ${cls}`.trim();
      n.textContent = text;
    }
  }

  function setWarning(message) {
    const n = byId('connectionWarningV212');
    if (!n) return;
    n.style.display = message ? 'block' : 'none';
    n.textContent = message || '';
  }

  function setLegacyConnectionState(connected) {
    const n = byId('conn');
    if (!n) return;
    n.textContent = connected ? '✅ Cuenta LALIGA conectada · datos reales disponibles.' : '⚠️ Cuenta LALIGA no conectada.';
  }

  async function getJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP_${response.status}`), { status: response.status, data });
    return data;
  }

  function pickNumber(...values) {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function findFirst(value, keys, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 3) return null;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== null && value[key] !== undefined) return value[key];
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') {
        const hit = findFirst(child, keys, depth + 1);
        if (hit !== null && hit !== undefined) return hit;
      }
    }
    return null;
  }

  function updateDashboard(summary) {
    if (!summary) return;

    const profile = summary.profile || {};
    const standing = Array.isArray(summary.standing) ? summary.standing : Array.isArray(summary.standing?.data) ? summary.standing.data : [];
    const mine = standing.find(row => {
      const id = findFirst(row, ['userId', 'managerId', 'id']);
      return String(id ?? '') === String(profile.id ?? profile.userId ?? profile.managerId ?? '');
    }) || standing.find(row => String(findFirst(row, ['username', 'managerName', 'name']) ?? '').trim().toLowerCase() === String(profile.username ?? profile.managerName ?? profile.name ?? '').trim().toLowerCase());

    const rank = pickNumber(findFirst(mine, ['rank', 'position', 'place']));
    const points = pickNumber(findFirst(mine, ['pfsy', 'pfsY', 'points', 'score', 'totalPoints']));
    const budget = summary.budget || {};
    const team = summary.team || {};
    const cash = pickNumber(findFirst(budget, ['cash', 'money', 'balance', 'available', 'budget']));
    const value = pickNumber(findFirst(team, ['value', 'marketValue', 'teamValue']));
    const players = findFirst(team, ['players', 'roster', 'squad']);
    const squad = Array.isArray(players) ? players.length : null;

    if (rank !== null) setText('kRank', String(rank));
    if (points !== null) setText('kPoints', String(points));
    if (cash !== null) setText('kCash', money(cash));
    if (value !== null) setText('kValue', money(value));
    if (squad !== null) setText('kSquad', String(squad));

    window.__laligaLiveDashboard = summary;
    window.dispatchEvent(new CustomEvent('laliga:live-data', { detail: summary }));
  }

  async function getSession() {
    return getJson('/api/session');
  }

  async function getAuthStatus() {
    return getJson('/api/auth/status');
  }

  async function loginDirect(event) {
    event.preventDefault();
    const emailNode = byId('laligaEmailV212');
    const passwordNode = byId('laligaPasswordV212');
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const email = String(emailNode?.value || '').trim();
    const password = String(passwordNode?.value || '');

    if (!email || !password) return;
    button.disabled = true;
    setBadge('Autenticando…', 'yellow');
    setWarning('');
    setText('connectionDetailsV212', 'Autenticando directamente contra LALIGA…');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `HTTP_${response.status}`), { status: response.status, data });

      if (passwordNode) passwordNode.value = '';
      setBadge('Conectada', 'good');
      setLegacyConnectionState(true);
      setText('connectionDetailsV212', 'Cuenta autenticada. Descargando datos Fantasy en directo…');
      await syncOnce('login');
    } catch (error) {
      if (passwordNode) passwordNode.value = '';
      setBadge('No conectada', 'red');
      setLegacyConnectionState(false);
      if (error.message === 'LOGIN_RATE_LIMITED') setWarning('Demasiados intentos. Espera unos minutos antes de volver a intentarlo.');
      else if (error.message === 'AUTHENTICATION_PROVIDER_UNAVAILABLE') setWarning('El servicio de autenticación de LALIGA no está disponible en este momento.');
      else if (error.message === 'INVALID_PROVIDER_TOKEN') setWarning('LALIGA respondió, pero el token recibido no pudo validarse.');
      else setWarning('No se pudo autenticar la cuenta. Comprueba el correo y la contraseña de LALIGA.');
      setText('connectionDetailsV212', 'No se ha podido iniciar la sesión.');
    } finally {
      button.disabled = false;
    }
  }

  async function syncOnce(reason = 'manual') {
    if (running) return;
    running = true;
    try {
      setBadge('Sincronizando…', 'yellow');
      const session = await getSession();
      if (!session.authenticated) {
        setBadge('No conectada', 'yellow');
        setLegacyConnectionState(false);
        setText('connectionDetailsV212', `Acceso preparado · última sincronización: ${fmt(localStorage.getItem(LAST_SYNC_KEY))}`);
        return;
      }

      const dashboard = await getJson('/api/fantasy/dashboard');
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      localStorage.setItem(LIVE_KEY, JSON.stringify({ savedAt: now, dashboard }));
      window.__laligaLiveDashboard = dashboard;
      updateDashboard(dashboard);

      const errors = Array.isArray(dashboard.errors) ? dashboard.errors : [];
      setBadge(errors.length ? 'LIVE · parcial' : 'LIVE · conectado', errors.length ? 'yellow' : 'good');
      setLegacyConnectionState(true);
      setText('connectionDetailsV212', `Última sincronización: ${fmt(now)} · datos reales recibidos · ${errors.length ? `faltan: ${errors.join(', ')}` : 'sin errores reportados'}.`);
      setWarning(errors.length ? `El servidor pudo recuperar la sesión, pero algunas fuentes de datos fallaron: ${errors.join(', ')}.` : '');
    } catch (error) {
      setBadge(error.status === 401 ? 'Sesión caducada' : 'Error de datos', 'red');
      setLegacyConnectionState(error.status !== 401);
      setText('connectionDetailsV212', `No se pudo completar la sincronización (${reason}).`);
      setWarning(error.status === 401 ? 'La sesión ha caducado. Vuelve a conectar la cuenta.' : 'Se mantiene el último estado local disponible; no se inventan datos nuevos.');
    } finally {
      running = false;
    }
  }

  async function boot() {
    ensurePanel();
    try {
      const auth = await getAuthStatus();
      const ssoBox = byId('ssoBoxV212');
      if (ssoBox) ssoBox.style.display = auth.configured ? 'block' : 'none';
      setText('connectionDetailsV212', auth.configured ? 'OAuth oficial disponible o acceso directo con correo y contraseña.' : 'OAuth del navegador no está configurado; usa el acceso directo de LALIGA.');
      if (!auth.configured) setWarning('El botón OAuth no está activo porque faltan parámetros OIDC. El acceso directo con correo/contraseña sí está preparado.');
    } catch {
      setWarning('No se pudo consultar el estado de autenticación del servidor.');
    }
    await syncOnce('inicio');
  }

  window.LALIGA_CONNECTION = Object.freeze({ sync: syncOnce });
  window.addEventListener('focus', () => void syncOnce('focus'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncOnce('visible'); });
  window.setInterval(() => void syncOnce('programada'), SYNC_MS);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else void boot();
})();
