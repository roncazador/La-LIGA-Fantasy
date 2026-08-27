(() => {
  'use strict';

  const money = value => {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(number) + ' €';
  };

  const text = value => String(value ?? '').trim();
  const first = (...values) => values.find(value => value !== undefined && value !== null && text(value) !== '');

  function arrayData(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.content)) return value.content;
    return [];
  }

  function objectData(value) {
    if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return {};
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setConnection(message, ok = true) {
    const node = document.getElementById('conn');
    if (!node) return;
    node.textContent = `${ok ? '✅' : 'ℹ️'} ${message}`;
  }

  function ensureProviderMatrix(status) {
    let node = document.getElementById('providerMatrix');
    if (!node) {
      node = document.createElement('div');
      node.id = 'providerMatrix';
      node.style.cssText = 'margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;';
      const anchor = document.getElementById('conn');
      if (anchor?.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
      else document.body.prepend(node);
    }

    const entries = [
      ['LALIGA', status?.laliga?.configured ? 'LISTO' : 'PENDIENTE', status?.laliga?.configured],
      ['API-Football', status?.apiFootball?.configured ? 'PRINCIPAL · LISTO' : 'SIN CLAVE', status?.apiFootball?.configured],
      ['football-data.org', status?.footballData?.configured ? 'RESPALDO · LISTO' : 'SIN TOKEN', status?.footballData?.configured],
      ['Sportmonks', status?.sportmonks?.configured ? 'RESPALDO · LISTO' : 'SIN COBERTURA/CLAVE', status?.sportmonks?.configured],
      ['Opta / Stats Perform', status?.opta?.configured ? 'RESPALDO · LISTO' : (status?.opta?.contractReady ? 'FALTA CREDENCIAL' : 'SIN CONTRATO/ENDPOINT'), status?.opta?.configured]
    ];

    node.replaceChildren(...entries.map(([name, state, ok]) => {
      const card = document.createElement('div');
      card.style.cssText = 'padding:9px;border-radius:10px;background:rgba(255,255,255,.035);';
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:700;';
      title.textContent = name;
      const value = document.createElement('div');
      value.style.cssText = 'margin-top:4px;font-size:.86em;opacity:.8;';
      value.textContent = state;
      card.append(title, value);
      if (ok) card.dataset.status = 'ok';
      return card;
    }));
  }

  function ensureConnectControl(configured) {
    let node = document.getElementById('laligaConnectControl');
    if (!node) {
      node = document.createElement('div');
      node.id = 'laligaConnectControl';
      node.style.cssText = 'margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
      const anchor = document.getElementById('conn') || document.body.firstElementChild;
      if (anchor?.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
      else document.body.prepend(node);
    }

    node.replaceChildren();
    const label = document.createElement('span');
    label.textContent = configured
      ? 'Conecta tu cuenta LALIGA para cargar plantilla, liga, presupuesto y clasificación.'
      : 'La conexión oficial de LALIGA todavía necesita configuración OAuth en Render.';
    node.appendChild(label);

    if (configured) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Conectar LALIGA';
      button.style.cssText = 'cursor:pointer;padding:9px 14px;border-radius:10px;border:0;font-weight:700;';
      button.addEventListener('click', () => {
        button.disabled = true;
        button.textContent = 'Abriendo LALIGA…';
        window.location.assign('/auth/start?platform=ios');
      });
      node.appendChild(button);
    }
  }

  function ensureFixtureProviderInfo() {
    let node = document.getElementById('fixtureProviderInfo');
    if (node) return node;
    const status = document.getElementById('fixturesStatus');
    if (!status?.parentNode) return null;

    node = document.createElement('div');
    node.id = 'fixtureProviderInfo';
    node.style.cssText = 'margin-top:8px;padding:9px 10px;border-radius:10px;background:#0f141e;border:1px solid #2a3141;font-size:10px;line-height:1.45;';
    status.parentNode.insertBefore(node, status.nextSibling);
    return node;
  }

  function setFixtureProviderInfo(data) {
    const node = ensureFixtureProviderInfo();
    if (!node) return;

    const primary = data?.primaryProvider || 'ninguno';
    const labels = {
      'api-football': 'API-Football',
      'football-data.org': 'football-data.org',
      sportmonks: 'Sportmonks',
      opta: 'Opta / Stats Perform'
    };
    const primaryLabel = labels[primary] || primary;
    const providers = data?.providers || {};
    const active = Object.entries(providers)
      .filter(([, result]) => result?.ok)
      .map(([name, result]) => `${labels[name] || name}: ${Number(result.count || 0)}`)
      .join(' · ');

    node.innerHTML = `<b>Motor de partidos:</b> ${primaryLabel}`
      + (active ? ` · Fuentes activas: ${active}` : '')
      + `<br><span style="opacity:.72">Los partidos se combinan y deduplican antes de mostrarse.</span>`;
  }

  async function refreshFixtureProviderInfo() {
    try {
      const response = await fetch('/api/fixtures/next', { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      setFixtureProviderInfo(data);
      return data;
    } catch {
      setFixtureProviderInfo({ primaryProvider: null, providers: {} });
      return {};
    }
  }

  function bootFixtures() {
    if (window.__laligaFixturesBooted) return;
    const button = document.getElementById('loadFixtures');
    if (!button) return;
    window.__laligaFixturesBooted = true;

    const status = document.getElementById('fixturesStatus');
    if (status) status.textContent = '⏳ Cargando partidos con el sistema multi-proveedor…';
    ensureFixtureProviderInfo();

    // The legacy UI already knows how to render state.fixtures. Trigger it once
    // so the new unified backend feeds the existing renderer without duplicating state.
    window.setTimeout(() => button.click(), 250);

    // The legacy renderer does not know about the new `primaryProvider` field.
    // This small observer keeps its status human-readable while the backend response loads.
    if (status && !window.__laligaFixtureObserver) {
      window.__laligaFixtureObserver = new MutationObserver(() => {
        const value = text(status.textContent);
        if (value.includes('football-data.org')) {
          status.textContent = value.replaceAll('football-data.org', 'sistema multi-proveedor');
        }
      });
      window.__laligaFixtureObserver.observe(status, { childList: true, characterData: true, subtree: true });
    }

    refreshFixtureProviderInfo();
  }

  async function loadProviderState() {
    try {
      const response = await fetch('/api/providers/status', { credentials: 'include', cache: 'no-store' });
      const status = await response.json().catch(() => ({}));
      ensureProviderMatrix(status);
      return status;
    } catch {
      ensureProviderMatrix({});
      return {};
    }
  }

  async function loadAuthState() {
    try {
      const response = await fetch('/api/auth/status', { credentials: 'include', cache: 'no-store' });
      const status = await response.json().catch(() => ({}));
      ensureConnectControl(Boolean(status.configured));
      const oauthState = document.getElementById('oauthState');
      if (oauthState) oauthState.textContent = status.configured ? 'LISTO' : 'PENDIENTE';
      return status;
    } catch {
      ensureConnectControl(false);
      return { configured: false };
    }
  }

  function profileName(profile) {
    return first(profile.username, profile.name, profile.displayName, profile.nickname, profile.email);
  }

  function leagueName(league) {
    return first(league.name, league.leagueName, league.title, league.competitionName);
  }

  function findNumber(source, keys) {
    for (const key of keys) {
      const number = Number(source?.[key]);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function applyDashboard(payload) {
    const profile = objectData(payload.profile);
    const leagues = arrayData(payload.leagues);
    const standing = arrayData(payload.standing);
    const team = objectData(payload.team);
    const budget = objectData(payload.budget);
    const league = leagues[0] || {};
    const user = profileName(profile);
    const teamName = first(team.name, team.teamName, team.clubName, team.displayName);

    const mine = standing.find(row => {
      if (!user) return false;
      const rowUser = first(row?.username, row?.managerName, row?.manager?.username);
      return rowUser === user || row?.userId === profile?.id;
    });

    const rank = first(mine?.rank, mine?.position, mine?.standingPosition, mine?.ranking);
    const points = first(mine?.points, mine?.totalPoints, mine?.fantasyPoints, mine?.score, team?.points, profile?.points);
    const squad = first(team?.players?.length, team?.squad?.length, team?.members?.length, payload?.squad?.length);
    const value = findNumber(team, ['value', 'marketValue', 'teamValue', 'estimatedValue']);
    const cash = findNumber(budget, ['money', 'cash', 'budget', 'available', 'balance']);

    setText('kRank', rank ?? '—');
    setText('kPoints', points ?? '—');
    setText('kValue', value === null ? '—' : money(value));
    setText('kSquad', squad ?? '—');
    setText('kCash', cash === null ? '—' : money(cash));

    const leagueLabel = leagueName(league);
    const version = payload.version || '2.8.0';
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    const summary = [
      user ? `Manager: ${user}` : null,
      leagueLabel ? `Liga: ${leagueLabel}` : null,
      teamName ? `Equipo: ${teamName}` : null,
      errors.length ? `Datos incompletos: ${errors.join(', ')}` : null
    ].filter(Boolean).join(' · ');

    setConnection(`LALIGA conectada · v${version} · solo lectura.`, true);
    const brainStatus = document.getElementById('brainStatus');
    if (brainStatus) brainStatus.textContent = errors.length ? 'Activo · datos parciales' : 'Activo · datos LALIGA';
    const brainSummary = document.getElementById('brainSummary');
    if (brainSummary) brainSummary.textContent = summary || 'Sesión activa. El motor ya puede trabajar con datos oficiales disponibles.';
    const providerLaliga = document.getElementById('providerLaliga');
    if (providerLaliga) providerLaliga.textContent = 'CONECTADO';
    const dot = document.getElementById('dotLaliga');
    if (dot) dot.classList.add('ok');
    const oauthState = document.getElementById('oauthState');
    if (oauthState) oauthState.textContent = 'CONECTADO';
  }

  async function loadDashboard() {
    await Promise.all([loadProviderState(), loadAuthState()]);
    bootFixtures();
    try {
      const sessionResponse = await fetch('/api/session', { credentials: 'include', cache: 'no-store' });
      const session = await sessionResponse.json().catch(() => ({}));
      if (!session.authenticated) {
        setConnection('LALIGA no conectada. Pulsa «Conectar LALIGA» para iniciar sesión oficial.', false);
        return;
      }

      const response = await fetch('/api/fantasy/dashboard', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setConnection(`Sesión activa, pero LALIGA no ha devuelto los datos (${payload.error || response.status}).`, false);
        return;
      }
      applyDashboard(payload);
    } catch {
      setConnection('No se pudieron cargar los datos de LALIGA.', false);
    }
  }

  window.addEventListener('pageshow', loadDashboard);
  window.addEventListener('focus', loadDashboard);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadDashboard();
  });

  loadDashboard();
})();
