(() => {
  'use strict';

  const state = { view: 'team', snapshot: null, live: { teams: [], standings: [], players: [], injuries: [] } };
  const money = value => value == null ? 'N/D' : new Intl.NumberFormat('es-ES').format(Number(value)) + ' €';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function ensureStyle() {
    if (document.getElementById('fantasyDataStyle')) return;
    const style = document.createElement('style');
    style.id = 'fantasyDataStyle';
    style.textContent = `
      #realDataPanel{margin-top:12px}
      #realDataTabs{display:flex;gap:6px;overflow:auto;margin:8px 0;padding-bottom:3px}
      #realDataTabs button.active{background:#ff454c}
      .fd-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0}
      .fd-metric{background:#0e131d;border:1px solid #2a3141;border-radius:10px;padding:9px}
      .fd-metric .v{font-size:17px;font-weight:900;margin-top:3px}
      .fd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .fd-card{background:#0e131d;border:1px solid #2a3141;border-radius:11px;padding:10px}
      .fd-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px}
      .fd-name{font-weight:900}
      .fd-small{font-size:10px;color:#9aa3b7}
      .fd-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #232a38}
      .fd-row:last-child{border-bottom:0}
      .fd-market{display:grid;grid-template-columns:1.2fr .55fr .8fr .8fr;gap:7px;padding:8px 0;border-bottom:1px solid #232a38;font-size:10px;align-items:center}
      .fd-market:last-child{border-bottom:0}
      .fd-activity{padding:8px 0;border-bottom:1px solid #232a38;font-size:10px;line-height:1.35}
      .fd-activity:last-child{border-bottom:0}
      @media(max-width:700px){.fd-metrics{grid-template-columns:repeat(2,1fr)}.fd-grid{grid-template-columns:1fr}.fd-market{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  async function loadSnapshot() {
    try {
      const response = await fetch('/video-reference-snapshot-2026-08-27.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`SNAPSHOT_HTTP_${response.status}`);
      state.snapshot = await response.json();
      render();
    } catch (error) {
      const status = document.getElementById('realDataStatus');
      if (status) status.textContent = `⚠️ La referencia de la grabación no está disponible (${error.message}).`;
    }
  }

  async function loadLiveSection(section) {
    const status = document.getElementById('realDataStatus');
    if (status) status.textContent = `⏳ Consultando ${section} LIVE…`;
    try {
      const response = await fetch(`/api/data/${encodeURIComponent(section)}`, { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
      state.live[section] = data[section] || [];
      if (status) status.textContent = `✅ ${state.live[section].length} registros LIVE · ${data.provider || 'Proveedor'}`;
      render(section === 'standings' ? 'standings' : 'live');
    } catch (error) {
      if (status) status.textContent = `🟡 Sin datos LIVE de ${section}: ${error.message}. Se mantiene la referencia observada sin inventar valores.`;
    }
  }

  function panel() {
    let node = document.getElementById('realDataPanel');
    if (node) return node;
    node = document.createElement('section');
    node.id = 'realDataPanel';
    node.className = 'card';
    node.innerHTML = `
      <div class="flex" style="justify-content:space-between;align-items:flex-start">
        <div><h2 style="margin-bottom:4px">📊 Datos Fantasy observados</h2><div class="tiny">Grabación LALIGA · referencia histórica · solo lectura</div></div>
        <button id="realDataRefresh" class="primary" type="button">↻ Actualizar</button>
      </div>
      <div id="realDataTabs">
        <button class="active" type="button" data-view="team">👤 Mi equipo</button>
        <button type="button" data-view="rivals">👥 Rivales</button>
        <button type="button" data-view="market">💰 Mercado</button>
        <button type="button" data-view="activity">📰 Actividad</button>
        <button type="button" data-view="standings">🏆 Clasificación</button>
      </div>
      <div id="realDataStatus" class="note">Cargando referencia de la grabación…</div>
      <div id="realDataBody"></div>
    `;
    const hero = document.querySelector('.hero');
    const anchor = hero || document.querySelector('.top');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
    else document.body.prepend(node);
    node.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      node.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === button));
      state.view = button.dataset.view;
      render(state.view);
    }));
    node.querySelector('#realDataRefresh').addEventListener('click', () => void loadSnapshot());
    return node;
  }

  function playerRows(players) {
    return players.map(p => `<div class="fd-row"><div><div class="fd-name">${esc(p.name)}${p.star ? ' ⭐' : ''}</div><div class="fd-small">${esc(p.position)} · ${esc(p.availability)}${p.lockDays ? ` · bloqueo ${esc(p.lockDays)}d` : ''} · ${money(p.price)}</div></div><b>${esc(p.pfsy)}</b></div>`).join('');
  }

  function managerCard(entry, manager) {
    const players = Array.isArray(state.snapshot?.rostersVisible?.[manager]) ? state.snapshot.rostersVisible[manager] : [];
    return `<div class="fd-card"><div class="fd-head"><div><div class="fd-name">${esc(manager)}</div><div class="fd-small">Valor: ${money(entry.teamValue)}</div></div><b>#${esc(entry.rank)} · ${esc(entry.pfsy)} PFSY</b></div>${players.length ? playerRows(players) : '<div class="fd-small">Sin jugadores legibles en la grabación.</div>'}</div>`;
  }

  function render() {
    const body = document.getElementById('realDataBody');
    if (!body) return;
    const s = state.snapshot;
    if (!s) return;
    if (state.view === 'rivals') {
      body.innerHTML = `<div class="fd-grid">${(s.standingsVisible || []).filter(x => x.manager !== 'roncazador').map(x => managerCard(x, x.manager)).join('')}</div>`;
      return;
    }
    if (state.view === 'market') {
      const rows = s.marketListings || [];
      body.innerHTML = `<div class="fd-metrics"><div class="fd-metric"><div class="label">Saldo mostrado</div><div class="v">${money(s.snapshot?.marketBalance)}</div></div><div class="fd-metric"><div class="label">Recompensa</div><div class="v">${money(s.snapshot?.dailyReward)}</div></div><div class="fd-metric"><div class="label">Anuncios visibles</div><div class="v">${rows.length}</div></div><div class="fd-metric"><div class="label">Jornada</div><div class="v">J${esc(s.snapshot?.matchdayAtStart)}</div></div></div><div class="fd-card"><div class="fd-market" style="font-weight:800"><span>Jugador / dueño</span><span>PFSY</span><span>Valor</span><span>Precio</span></div>${rows.map(x => `<div class="fd-market"><span><b>${esc(x.player)}</b><br><span class="fd-small">${esc(x.owner)} · ${esc(x.status)} · ${esc(x.remainingDays)}d</span></span><span>${esc(x.pfsy)}</span><span>${money(x.value)}</span><span><b>${money(x.price)}</b></span></div>`).join('')}</div>`;
      return;
    }
    if (state.view === 'activity') {
      body.innerHTML = `<div class="fd-card">${(s.recentActivity || []).map(x => `<div class="fd-activity"><b>${esc(x.type)}</b> <span class="fd-small">${esc(x.date)}</span><br>${esc(x.manager)} ${esc(x.action || '')}${x.player ? ` · <b>${esc(x.player)}</b>` : ''}${x.amount != null ? ` · <b>${money(x.amount)}</b>` : ''}</div>`).join('')}</div>`;
      return;
    }
    if (state.view === 'standings') {
      body.innerHTML = `<div class="fd-card"><div class="fd-market" style="font-weight:800"><span># Manager</span><span>PFSY</span><span>Valor</span><span></span></div>${(s.standingsVisible || []).map(x => `<div class="fd-market"><span><b>#${esc(x.rank)} ${esc(x.manager)}</b></span><span>${esc(x.pfsy)}</span><span>${money(x.teamValue)}</span><span></span></div>`).join('')}</div>`;
      return;
    }
    const me = (s.standingsVisible || []).find(x => x.manager === 'roncazador') || {};
    const players = s.rostersVisible?.roncazador || [];
    const playerPfsy = players.reduce((a,p) => a + Number(p.pfsy || 0), 0);
    body.innerHTML = `<div class="fd-metrics"><div class="fd-metric"><div class="label">Posición</div><div class="v">#${esc(me.rank ?? 'N/D')}</div></div><div class="fd-metric"><div class="label">PFSY</div><div class="v">${esc(me.pfsy ?? 'N/D')}</div></div><div class="fd-metric"><div class="label">Valor</div><div class="v">${money(s.snapshot?.teamValue)}</div></div><div class="fd-metric"><div class="label">Plantilla</div><div class="v">${esc(s.snapshot?.teamCount ?? 'N/D')}</div></div></div><div class="source" style="margin-bottom:8px">Jornada 3 · inicio visible: 28/08/2026 19:00 · recompensa: ${money(s.snapshot?.dailyReward)} · PFSY sumado solo de jugadores visibles: ${playerPfsy}. Estos datos proceden de la grabación, no del servicio LIVE.</div><div class="fd-card">${playerRows(players)}</div>`;
  }

  function boot() {
    ensureStyle();
    panel();
    void loadSnapshot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
