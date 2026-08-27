(() => {
  'use strict';

  const state = { view: 'team', snapshot: null, live: { dashboard: null, standings: [], market: [], players: [], injuries: [] }, liveMode: false };
  const money = value => value == null || !Number.isFinite(Number(value)) ? 'N/D' : new Intl.NumberFormat('es-ES').format(Number(value)) + ' €';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const first = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const arrayData = value => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.players)) return value.players;
    return [];
  };
  const objectData = value => value && typeof value === 'object' && !Array.isArray(value) ? (value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : value) : {};

  function ensureStyle() {
    if (document.getElementById('fantasyDataStyle')) return;
    const style = document.createElement('style');
    style.id = 'fantasyDataStyle';
    style.textContent = `
      #realDataPanel{margin-top:12px}
      #realDataHeader{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
      #realDataTabs{display:flex;gap:6px;overflow:auto;margin:10px 0;padding-bottom:3px;scrollbar-width:none}
      #realDataTabs button{cursor:pointer;touch-action:manipulation}
      #realDataTabs button.active{background:#ff454c}
      .fd-live,.fd-ref{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900}
      .fd-live{background:#1a4e39;color:#2bd888;border:1px solid #276e52}
      .fd-ref{background:#302b18;color:#ffd166;border:1px solid #66572a}
      .fd-source{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:8px 0;padding:8px 10px;border:1px solid #2a3141;border-radius:10px;background:#0d121b;font-size:10px}
      .fd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .fd-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0}
      .fd-metric{background:#0e131d;border:1px solid #2a3141;border-radius:10px;padding:9px}
      .fd-metric .v{font-size:17px;font-weight:900;margin-top:3px}
      .fd-card{background:#0e131d;border:1px solid #2a3141;border-radius:11px;padding:10px}
      .fd-card.mine{border-color:#ff454c;box-shadow:0 0 0 1px rgba(255,69,76,.15) inset}
      .fd-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px}
      .fd-name{font-weight:900}
      .fd-small{font-size:10px;color:#9aa3b7}
      .fd-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 0;border-bottom:1px solid #232a38}
      .fd-row:last-child{border-bottom:0}
      .fd-row .meta{font-size:10px;color:#9aa3b7;margin-top:2px}
      .fd-market{display:grid;grid-template-columns:1.25fr .6fr .8fr .85fr;gap:7px;padding:8px 0;border-bottom:1px solid #232a38;font-size:10px;align-items:center}
      .fd-market:last-child{border-bottom:0}
      .fd-market .good{color:#2bd888}.fd-market .warn{color:#ffd166}.fd-market .bad{color:#ff727b}
      .fd-activity{padding:8px 0;border-bottom:1px solid #232a38;font-size:10px;line-height:1.35}
      .fd-activity:last-child{border-bottom:0}
      .fd-empty{padding:16px;text-align:center;color:#9aa3b7;font-size:11px}
      .fd-count{display:inline-flex;min-width:20px;height:20px;padding:0 6px;align-items:center;justify-content:center;border-radius:999px;background:#202636;font-size:9px;font-weight:900}
      @media(max-width:700px){.fd-metrics{grid-template-columns:repeat(2,1fr)}.fd-grid{grid-template-columns:1fr}.fd-market{grid-template-columns:1.2fr .55fr .8fr .85fr}}
      @media(max-width:480px){.fd-metrics{grid-template-columns:repeat(2,1fr)}.fd-market{grid-template-columns:1fr 1fr}.fd-market span:nth-child(n+3){font-size:9px}}
    `;
    document.head.appendChild(style);
  }

  function normalizeSnapshot(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const nested = raw.snapshot && typeof raw.snapshot === 'object' ? raw.snapshot : {};
    return {
      ...raw,
      competition: first(raw.competition, raw.league, 'La Liga'),
      matchday: first(raw.matchday, nested.matchdayAtStart),
      reward: first(raw.reward, nested.dailyReward),
      marketBalance: first(raw.marketBalance, nested.marketBalance),
      teamCount: first(raw.teamCount, nested.teamCount),
      teamValue: first(raw.teamValue, nested.teamValue),
      standingsVisible: Array.isArray(raw.standingsVisible) ? raw.standingsVisible : (Array.isArray(raw.standings) ? raw.standings : []),
      rostersVisible: raw.rostersVisible && typeof raw.rostersVisible === 'object' ? raw.rostersVisible : {},
      marketListings: Array.isArray(raw.marketListings) ? raw.marketListings : [],
      recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : [],
      eventsVisible: Array.isArray(raw.eventsVisible) ? raw.eventsVisible : (Array.isArray(raw.events) ? raw.events : [])
    };
  }

  async function loadSnapshot() {
    const urls = ['/recording-data-2026-08-27.json', '/video-reference-snapshot-2026-08-27.json'];
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`SNAPSHOT_HTTP_${response.status}`);
        const raw = await response.json();
        state.snapshot = normalizeSnapshot(raw);
        render();
        return;
      } catch (error) { lastError = error; }
    }
    const status = document.getElementById('realDataStatus');
    if (status) status.textContent = `⚠️ No se pudo cargar la referencia observada (${lastError?.message || 'error desconocido'}).`;
  }

  function normalizeLivePlayer(player) {
    const name = first(player?.name, player?.playerName, player?.fullName, player?.displayName, player?.player);
    if (!name) return null;
    return {
      name,
      position: first(player?.position, player?.pos, player?.positionName, player?.role, 'N/D'),
      pfsy: finite(first(player?.pfsy, player?.pfsY, player?.points, player?.fantasyPoints, player?.score)),
      price: finite(first(player?.price, player?.marketPrice, player?.currentPrice, player?.value, player?.marketValue)),
      availability: first(player?.availability, player?.status, player?.healthStatus, 'Alineable'),
      lockDays: finite(first(player?.lockDays, player?.daysLocked, player?.remainingDays)),
      star: Boolean(player?.star || player?.captain || player?.isCaptain)
    };
  }

  function normalizeLiveMarket(payload) {
    return arrayData(payload).map(item => ({
      player: first(item?.player, item?.playerName, item?.name, item?.fullName),
      owner: first(item?.owner, item?.manager, item?.seller, item?.teamName, 'N/D'),
      pfsy: finite(first(item?.pfsy, item?.pfsY, item?.points, item?.fantasyPoints, item?.score)),
      value: finite(first(item?.value, item?.marketValue, item?.estimatedValue, item?.fairValue)),
      price: finite(first(item?.price, item?.marketPrice, item?.currentPrice, item?.cost, item?.amount)),
      status: first(item?.status, item?.availability, 'N/D'),
      remainingDays: first(item?.remainingDays, item?.expires, item?.days, 'N/D')
    })).filter(item => item.player || item.price !== null || item.value !== null);
  }

  async function loadLiveDashboard() {
    const status = document.getElementById('realDataStatus');
    try {
      const sessionResponse = await fetch('/api/session', { credentials: 'include', cache: 'no-store' });
      const session = await sessionResponse.json().catch(() => ({}));
      if (!session.authenticated) {
        state.liveMode = false;
        if (status) status.textContent = '🟡 REFERENCIA · datos observados en la grabación. Conecta LALIGA para sustituirlos por datos LIVE.';
        render();
        return;
      }
      const response = await fetch('/api/fantasy/dashboard', { credentials: 'include', cache: 'no-store' });
      const dashboard = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(dashboard.error || `HTTP_${response.status}`);
      state.live.dashboard = dashboard;
      state.liveMode = true;
      state.live.standings = arrayData(dashboard.standing);
      state.live.market = normalizeLiveMarket(dashboard.market);
      const liveTeam = objectData(dashboard.team);
      const livePlayers = arrayData(liveTeam.players || liveTeam.squad || liveTeam.members || liveTeam.roster);
      state.live.players = livePlayers.map(normalizeLivePlayer).filter(Boolean);
      if (status) status.textContent = Array.isArray(dashboard.errors) && dashboard.errors.length ? `🟠 LALIGA LIVE · datos parciales · ${dashboard.errors.join(', ')}` : '🟢 LALIGA LIVE · equipo, rivales y mercado sincronizados · solo lectura.';
      render();
    } catch (error) {
      state.liveMode = false;
      if (status) status.textContent = `🟡 Sin datos LIVE (${error.message}) · se mantiene la referencia observada.`;
      render();
    }
  }

  function panel() {
    let node = document.getElementById('realDataPanel');
    if (node) return node;
    node = document.createElement('section');
    node.id = 'realDataPanel';
    node.className = 'card';
    node.innerHTML = `
      <div id="realDataHeader">
        <div><h2 style="margin-bottom:4px">📊 Equipo · Rivales · Mercado</h2><div class="tiny">Panel visual unificado · inspirado en la app LALIGA · solo lectura</div></div>
        <div id="realDataMode" class="fd-ref">🟡 REFERENCIA</div>
      </div>
      <div id="realDataTabs">
        <button class="active" type="button" data-view="team">👤 Mi equipo <span class="fd-count">7</span></button>
        <button type="button" data-view="rivals">👥 Rivales <span class="fd-count">8</span></button>
        <button type="button" data-view="market">💰 Mercado <span class="fd-count">3</span></button>
        <button type="button" data-view="activity">📰 Actividad</button>
        <button type="button" data-view="standings">🏆 Clasificación</button>
      </div>
      <div id="realDataStatus" class="note">Cargando referencia observada y comprobando sesión LIVE…</div>
      <div id="realDataBody"></div>
    `;
    const hero = document.querySelector('.hero');
    const anchor = hero || document.querySelector('.top');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
    else document.body.prepend(node);
    node.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      node.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === button));
      state.view = button.dataset.view;
      render();
    }));
    return node;
  }

  function playerRows(players) {
    if (!players.length) return '<div class="fd-empty">Sin jugadores legibles.</div>';
    return players.map(p => {
      const suspended = String(p.availability || '').toLowerCase().includes('suspend');
      const statusClass = suspended ? 'bad' : 'good';
      const lock = p.lockDays != null ? ` · bloqueo ${esc(p.lockDays)}d` : '';
      return `<div class="fd-row"><div><div class="fd-name">${esc(p.name)}${p.star ? ' ⭐' : ''}</div><div class="meta">${esc(p.position || 'N/D')} · <span class="${statusClass}">${esc(p.availability || 'N/D')}</span>${lock} · ${money(p.price)}</div></div><b>${esc(p.pfsy ?? 'N/D')}</b></div>`;
    }).join('');
  }

  function managerCard(entry, manager, mine = false) {
    const players = Array.isArray(state.snapshot?.rostersVisible?.[manager]) ? state.snapshot.rostersVisible[manager] : [];
    const liveStanding = state.live.standings.find(x => first(x?.username, x?.managerName, x?.manager?.username, x?.name) === manager);
    const rank = first(liveStanding?.rank, entry?.rank);
    const points = first(liveStanding?.points, liveStanding?.totalPoints, liveStanding?.fantasyPoints, liveStanding?.score, entry?.pfsy);
    return `<div class="fd-card${mine ? ' mine' : ''}"><div class="fd-head"><div><div class="fd-name">${esc(manager)}${mine ? ' · TÚ' : ''}</div><div class="fd-small">Valor: ${money(first(liveStanding?.teamValue, liveStanding?.value, entry?.teamValue))}</div></div><b>#${esc(rank ?? 'N/D')} · ${esc(points ?? 'N/D')} PFSY</b></div>${playerRows(players)}</div>`;
  }

  function render() {
    const body = document.getElementById('realDataBody');
    const mode = document.getElementById('realDataMode');
    if (!body || !state.snapshot) return;
    const snapshot = state.snapshot;
    const standingsRef = Array.isArray(snapshot.standingsVisible) ? snapshot.standingsVisible : [];
    const standings = state.liveMode && state.live.standings.length ? state.live.standings : standingsRef;
    if (mode) { mode.className = state.liveMode ? 'fd-live' : 'fd-ref'; mode.textContent = state.liveMode ? '🟢 LIVE' : '🟡 REFERENCIA'; }

    if (state.view === 'rivals') {
      const rows = standings.filter(x => String(first(x?.manager, x?.username, x?.managerName, x?.name, '')).toLowerCase() !== 'roncazador');
      body.innerHTML = `<div class="fd-source"><span>👥 Managers visibles: <b>${rows.length}</b> · jugadores legibles: <b>${rows.reduce((n,x)=>n+(state.snapshot.rostersVisible?.[first(x?.manager,x?.username,x?.managerName,x?.name)]||[]).length,0)}</b></span><span class="fd-small">No se inventan jugadores no visibles</span></div><div class="fd-grid">${rows.map(x => { const manager = first(x?.manager,x?.username,x?.managerName,x?.name,'N/D'); const reference = standingsRef.find(y=>y.manager===manager)||x; return managerCard(reference,manager); }).join('')}</div>`;
      return;
    }

    if (state.view === 'market') {
      const snapshotRows = Array.isArray(snapshot.marketListings) ? snapshot.marketListings : [];
      const rows = state.liveMode && state.live.market.length ? state.live.market : snapshotRows;
      const priced = rows.filter(x => finite(x.price) !== null);
      const cheapest = priced.slice().sort((a,b)=>Number(a.price)-Number(b.price))[0];
      const valueGap = cheapest && finite(cheapest.value)!==null ? Number(cheapest.value)-Number(cheapest.price) : null;
      const refLabel = state.liveMode ? 'LIVE' : `REFERENCIA · ${rows.length} anuncios observados`;
      body.innerHTML = `<div class="fd-source"><span>💰 Estado: <b>${refLabel}</b></span><span>Saldo: <b>${money(first(state.live.dashboard?.marketBalance,snapshot.marketBalance))}</b></span></div><div class="fd-metrics"><div class="fd-metric"><div class="label">Saldo mercado</div><div class="v">${money(first(state.live.dashboard?.marketBalance,snapshot.marketBalance))}</div></div><div class="fd-metric"><div class="label">Recompensa</div><div class="v">${money(first(state.live.dashboard?.dailyReward,snapshot.reward))}</div></div><div class="fd-metric"><div class="label">Anuncios</div><div class="v">${rows.length}</div></div><div class="fd-metric"><div class="label">Margen visible</div><div class="v ${valueGap!==null&&valueGap>0?'good':'warn'}">${valueGap===null?'N/D':money(valueGap)}</div></div></div><div class="fd-card"><div class="fd-market" style="font-weight:800"><span>Jugador / dueño</span><span>PFSY</span><span>Valor</span><span>Precio</span></div>${rows.map(x=>`<div class="fd-market"><span><b>${esc(first(x.player,x.playerName,x.name,'Nombre no legible'))}</b><br><span class="fd-small">${esc(first(x.owner,x.manager,x.seller,'N/D'))} · ${esc(first(x.status,x.availability,'N/D'))} · ${esc(first(x.remainingDays,x.expires,x.days,'N/D'))}</span></span><span>${esc(first(x.pfsy,x.pfsY,x.points,'N/D'))}</span><span>${money(first(x.value,x.marketValue))}</span><span><b>${money(first(x.price,x.marketPrice,x.currentPrice))}</b></span></div>`).join('')}</div><div class="source">${state.liveMode?'Los valores LIVE sustituyen la referencia cuando el backend los devuelve.':'Los datos mostrados proceden únicamente de lo visible en la grabación del 27/08/2026; no representan un mercado LIVE.'}</div>`;
      return;
    }

    if (state.view === 'activity') {
      const rows = Array.isArray(snapshot.recentActivity) ? snapshot.recentActivity : [];
      body.innerHTML = `<div class="fd-card">${rows.length ? rows.map(x=>`<div class="fd-activity"><b>${esc(x.type)}</b> <span class="fd-small">${esc(x.date)}</span><br>${esc(x.manager)} ${esc(x.action||'')}${x.player?` · <b>${esc(x.player)}</b>`:''}${x.amount!=null?` · <b>${money(x.amount)}</b>`:''}</div>`).join('') : '<div class="fd-empty">Sin actividad observada.</div>'}</div>`;
      return;
    }

    if (state.view === 'standings') {
      body.innerHTML = `<div class="fd-card"><div class="fd-market" style="font-weight:800"><span># Manager</span><span>PFSY</span><span>Valor</span><span>Fuente</span></div>${standings.map(x=>`<div class="fd-market"><span><b>#${esc(first(x.rank,x.position,'N/D'))} ${esc(first(x.manager,x.username,x.managerName,x.name,'N/D'))}</b></span><span>${esc(first(x.pfsy,x.pfsY,x.points,x.totalPoints,x.score,'N/D'))}</span><span>${money(first(x.teamValue,x.value,x.marketValue))}</span><span>${state.liveMode?'LIVE':'REFERENCIA'}</span></div>`).join('')}</div>`;
      return;
    }

    const me = standingsRef.find(x=>x.manager==='roncazador') || {};
    const liveMe = state.live.standings.find(x=>first(x?.username,x?.managerName,x?.manager?.username,x?.name)==='roncazador') || {};
    const players = state.liveMode && state.live.players.length ? state.live.players : (snapshot.rostersVisible?.roncazador || []);
    const playerPfsy = players.reduce((a,p)=>a+Number(first(p.pfsy,p.pfsY,p.points,0)||0),0);
    const teamValue = first(liveMe.teamValue,liveMe.value,snapshot.teamValue);
    const squadSize = state.liveMode && state.live.players.length ? `${state.live.players.length}/24` : snapshot.teamCount;
    const marketBalance = first(state.live.dashboard?.marketBalance,snapshot.marketBalance);
    const gap = Number(first(liveMe.points,liveMe.totalPoints,liveMe.fantasyPoints,liveMe.score,me.pfsy,0)) - Number(standingsRef[1]?.pfsy || 0);
    body.innerHTML = `<div class="fd-source"><span>📅 Jornada ${esc(snapshot.matchday ?? 'N/D')} · 28/08/2026 19:00</span><span>Mercado: <b>${money(marketBalance)}</b></span></div><div class="fd-metrics"><div class="fd-metric"><div class="label">Posición</div><div class="v">#${esc(first(liveMe.rank,liveMe.position,me.rank,'N/D'))}</div></div><div class="fd-metric"><div class="label">PFSY</div><div class="v">${esc(first(liveMe.points,liveMe.totalPoints,liveMe.fantasyPoints,liveMe.score,me.pfsy,'N/D'))}</div></div><div class="fd-metric"><div class="label">Valor</div><div class="v">${money(teamValue)}</div></div><div class="fd-metric"><div class="label">Plantilla</div><div class="v">${esc(squadSize || 'N/D')}</div></div></div><div class="fd-card mine"><div class="fd-head"><div><div class="fd-name">👤 roncazador · TU EQUIPO</div><div class="fd-small">PFSY visible sumado: ${playerPfsy} · recompensa observada: ${money(snapshot.reward)}</div></div><b>${players.length}/24</b></div>${playerRows(players)}</div><div class="source">${state.liveMode?'Datos oficiales LIVE cuando están disponibles.':'Referencia observada: 7 jugadores legibles de tu equipo. El resto de la plantilla no se muestra porque no quedó legible en la grabación.'}</div>`;
  }

  async function refreshAll() { await loadSnapshot(); await loadLiveDashboard(); }

  function boot() { ensureStyle(); panel(); void refreshAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();