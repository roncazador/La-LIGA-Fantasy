(() => {
  'use strict';

  const state = { view: 'team', snapshot: null, live: { dashboard: null, standings: [], market: [], players: [], injuries: [] }, liveMode: false };
  const money = value => value == null || !Number.isFinite(Number(value)) ? 'N/D' : new Intl.NumberFormat('es-ES').format(Number(value)) + ' €';
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const arrayData = value => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.players)) return value.players;
    if (Array.isArray(value?.squad)) return value.squad;
    if (Array.isArray(value?.members)) return value.members;
    return [];
  };
  const objectData = value => value && typeof value === 'object' && !Array.isArray(value) ? (value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : value) : {};
  const first = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function ensureStyle() {
    if (document.getElementById('fantasyDataStyle')) return;
    const style = document.createElement('style');
    style.id = 'fantasyDataStyle';
    style.textContent = `
      #realDataPanel{margin-top:12px}
      #realDataHeader{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
      #realDataTabs{display:flex;gap:6px;overflow:auto;margin:10px 0;padding-bottom:3px}
      #realDataTabs button.active{background:#ff454c}
      #realDataTabs button{cursor:pointer}
      .fd-live{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;background:#1a4e39;color:#2bd888;border:1px solid #276e52}
      .fd-ref{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;background:#302b18;color:#ffd166;border:1px solid #66572a}
      .fd-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0}
      .fd-metric{background:#0e131d;border:1px solid #2a3141;border-radius:10px;padding:9px}
      .fd-metric .v{font-size:17px;font-weight:900;margin-top:3px}
      .fd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .fd-card{background:#0e131d;border:1px solid #2a3141;border-radius:11px;padding:10px}
      .fd-card.mine{border-color:#ff454c;box-shadow:0 0 0 1px rgba(255,69,76,.15) inset}
      .fd-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px}
      .fd-name{font-weight:900}
      .fd-small{font-size:10px;color:#9aa3b7}
      .fd-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #232a38}
      .fd-row:last-child{border-bottom:0}
      .fd-market{display:grid;grid-template-columns:1.25fr .6fr .8fr .85fr;gap:7px;padding:8px 0;border-bottom:1px solid #232a38;font-size:10px;align-items:center}
      .fd-market:last-child{border-bottom:0}
      .fd-market .good{color:#2bd888}
      .fd-market .warn{color:#ffd166}
      .fd-market .bad{color:#ff727b}
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
        if (status) status.textContent = '🟡 Referencia observada cargada · Conecta LALIGA para ver equipo, clasificación y mercado LIVE.';
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
      if (status) {
        const errors = Array.isArray(dashboard.errors) ? dashboard.errors : [];
        status.textContent = errors.length
          ? `🟠 LALIGA LIVE · datos parciales · ${errors.join(', ')}`
          : '🟢 LALIGA LIVE · equipo, clasificación y mercado sincronizados · solo lectura.';
      }
      render();
    } catch (error) {
      state.liveMode = false;
      if (status) status.textContent = `🟡 Sin datos LIVE (${error.message}) · se mantiene la referencia observada sin inventar valores.`;
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
        <div><h2 style="margin-bottom:4px">📊 Equipo · Rivales · Mercado</h2><div class="tiny">Vista unificada inspirada en la app LALIGA · modo solo lectura</div></div>
        <div id="realDataMode" class="fd-ref">🟡 REFERENCIA</div>
      </div>
      <div id="realDataTabs">
        <button class="active" type="button" data-view="team">👤 Mi equipo</button>
        <button type="button" data-view="rivals">👥 Rivales</button>
        <button type="button" data-view="market">💰 Mercado</button>
        <button type="button" data-view="activity">📰 Actividad</button>
        <button type="button" data-view="standings">🏆 Clasificación</button>
      </div>
      <div id="realDataStatus" class="note">Cargando referencia y comprobando sesión LIVE…</div>
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
    return node;
  }

  function playerRows(players) {
    return players.map(p => {
      const status = String(p.availability || '').toLowerCase().includes('suspend') ? 'bad' : 'good';
      const right = p.pfsy == null ? 'N/D' : p.pfsy;
      const lock = p.lockDays != null ? ` · bloqueo ${esc(p.lockDays)}d` : '';
      return `<div class="fd-row"><div><div class="fd-name">${esc(p.name)}${p.star ? ' ⭐' : ''}</div><div class="fd-small">${esc(p.position || 'N/D')} · <span class="${status}">${esc(p.availability || 'N/D')}</span>${lock} · ${money(p.price)}</div></div><b>${esc(right)}</b></div>`;
    }).join('');
  }

  function managerCard(entry, manager, mine = false) {
    const players = Array.isArray(state.snapshot?.rostersVisible?.[manager]) ? state.snapshot.rostersVisible[manager] : [];
    const liveStanding = state.live.standings.find(x => first(x?.username, x?.managerName, x?.manager?.username, x?.name) === manager);
    const rank = first(liveStanding?.rank, entry?.rank);
    const points = first(liveStanding?.points, liveStanding?.totalPoints, liveStanding?.fantasyPoints, liveStanding?.score, entry?.pfsy);
    return `<div class="fd-card${mine ? ' mine' : ''}"><div class="fd-head"><div><div class="fd-name">${esc(manager)}${mine ? ' · TÚ' : ''}</div><div class="fd-small">Valor: ${money(first(liveStanding?.teamValue, liveStanding?.value, entry?.teamValue))}</div></div><b>#${esc(rank ?? 'N/D')} · ${esc(points ?? 'N/D')} PFSY</b></div>${players.length ? playerRows(players) : '<div class="fd-small">Sin jugadores legibles en la referencia.</div>'}</div>`;
  }

  function render() {
    const body = document.getElementById('realDataBody');
    const mode = document.getElementById('realDataMode');
    if (!body || !state.snapshot) return;
    if (mode) {
      mode.className = state.liveMode ? 'fd-live' : 'fd-ref';
      mode.textContent = state.liveMode ? '🟢 LIVE' : '🟡 REFERENCIA';
    }

    const snapshot = state.snapshot;
    const standingsRef = Array.isArray(snapshot.standingsVisible) ? snapshot.standingsVisible : [];
    const standings = state.liveMode && state.live.standings.length ? state.live.standings : standingsRef;

    if (state.view === 'rivals') {
      const rows = standings.filter(x => {
        const manager = first(x?.manager, x?.username, x?.managerName, x?.name, '');
        return String(manager).toLowerCase() !== 'roncazador';
      });
      body.innerHTML = `<div class="fd-grid">${rows.map(x => {
        const manager = first(x?.manager, x?.username, x?.managerName, x?.name, 'N/D');
        const reference = standingsRef.find(y => y.manager === manager) || x;
        return managerCard(reference, manager);
      }).join('')}</div>`;
      return;
    }

    if (state.view === 'market') {
      const snapshotRows = Array.isArray(snapshot.marketListings) ? snapshot.marketListings : [];
      const rows = state.liveMode && state.live.market.length ? state.live.market : snapshotRows;
      const cheapest = rows.filter(x => finite(x.price) !== null).sort((a,b) => Number(a.price)-Number(b.price))[0];
      const valueGap = cheapest && finite(cheapest.value) !== null && finite(cheapest.price) !== null ? Number(cheapest.value) - Number(cheapest.price) : null;
      body.innerHTML = `<div class="fd-metrics"><div class="fd-metric"><div class="label">Saldo mostrado</div><div class="v">${money(first(state.live.dashboard?.marketBalance, snapshot.snapshot?.marketBalance))}</div></div><div class="fd-metric"><div class="label">Recompensa</div><div class="v">${money(first(state.live.dashboard?.dailyReward, snapshot.snapshot?.dailyReward))}</div></div><div class="fd-metric"><div class="label">Anuncios visibles</div><div class="v">${rows.length}</div></div><div class="fd-metric"><div class="label">Mejor margen visible</div><div class="v ${valueGap !== null && valueGap > 0 ? 'good' : 'warn'}">${valueGap === null ? 'N/D' : money(valueGap)}</div></div></div><div class="fd-card"><div class="fd-market" style="font-weight:800"><span>Jugador / dueño</span><span>PFSY</span><span>Valor</span><span>Precio</span></div>${rows.map(x => `<div class="fd-market"><span><b>${esc(first(x.player, x.playerName, x.name, 'N/D'))}</b><br><span class="fd-small">${esc(first(x.owner, x.manager, x.seller, 'N/D'))} · ${esc(first(x.status, x.availability, 'N/D'))} · ${esc(first(x.remainingDays, x.expires, x.days, 'N/D'))}</span></span><span>${esc(first(x.pfsy, x.pfsY, x.points, 'N/D'))}</span><span>${money(first(x.value, x.marketValue))}</span><span><b>${money(first(x.price, x.marketPrice, x.currentPrice))}</b></span></div>`).join('')}</div><div class="source">${state.liveMode ? 'Los valores superiores proceden del panel LALIGA LIVE cuando el backend los devuelve.' : 'No hay sesión LALIGA activa: se muestran únicamente los anuncios claramente observados en la grabación.'}</div>`;
      return;
    }

    if (state.view === 'activity') {
      body.innerHTML = `<div class="fd-card">${(snapshot.recentActivity || []).map(x => `<div class="fd-activity"><b>${esc(x.type)}</b> <span class="fd-small">${esc(x.date)}</span><br>${esc(x.manager)} ${esc(x.action || '')}${x.player ? ` · <b>${esc(x.player)}</b>` : ''}${x.amount != null ? ` · <b>${money(x.amount)}</b>` : ''}</div>`).join('')}</div>`;
      return;
    }

    if (state.view === 'standings') {
      body.innerHTML = `<div class="fd-card"><div class="fd-market" style="font-weight:800"><span># Manager</span><span>PFSY</span><span>Valor</span><span>Fuente</span></div>${standings.map(x => `<div class="fd-market"><span><b>#${esc(first(x.rank, x.position, 'N/D'))} ${esc(first(x.manager, x.username, x.managerName, x.name, 'N/D'))}</b></span><span>${esc(first(x.pfsy, x.pfsY, x.points, x.totalPoints, x.score, 'N/D'))}</span><span>${money(first(x.teamValue, x.value, x.marketValue))}</span><span>${state.liveMode ? 'LIVE' : 'REFERENCIA'}</span></div>`).join('')}</div>`;
      return;
    }

    const me = standingsRef.find(x => x.manager === 'roncazador') || {};
    const liveMe = state.live.standings.find(x => first(x?.username, x?.managerName, x?.manager?.username, x?.name) === 'roncazador') || {};
    const players = state.liveMode && state.live.players.length ? state.live.players : (snapshot.rostersVisible?.roncazador || []);
    const playerPfsy = players.reduce((a,p) => a + Number(first(p.pfsy, p.pfsY, p.points, 0) || 0), 0);
    const teamValue = first(liveMe.teamValue, liveMe.value, snapshot.snapshot?.teamValue);
    const squadSize = state.liveMode && state.live.players.length ? `${state.live.players.length}/24` : snapshot.snapshot?.teamCount;
    const gap = Number(first(liveMe.points, liveMe.totalPoints, liveMe.fantasyPoints, liveMe.score, me.pfsy, 0)) - Number(standingsRef[1]?.pfsy || 0);
    body.innerHTML = `<div class="fd-metrics"><div class="fd-metric"><div class="label">Posición</div><div class="v">#${esc(first(liveMe.rank, liveMe.position, me.rank, 'N/D'))}</div></div><div class="fd-metric"><div class="label">PFSY</div><div class="v">${esc(first(liveMe.points, liveMe.totalPoints, liveMe.fantasyPoints, liveMe.score, me.pfsy, 'N/D'))}</div></div><div class="fd-metric"><div class="label">Valor</div><div class="v">${money(teamValue)}</div></div><div class="fd-metric"><div class="label">Plantilla</div><div class="v">${esc(squadSize || 'N/D')}</div></div></div><div class="source" style="margin-bottom:8px">Inicio Jornada 3 · 28/08/2026 19:00 · recompensa observada: ${money(snapshot.snapshot?.dailyReward)} · diferencia actual frente a #2: ${gap >= 0 ? '+' : ''}${gap} PFSY.</div><div class="fd-card mine">${playerRows(players)}</div>`;
  }

  async function refreshAll() {
    await loadSnapshot();
    await loadLiveDashboard();
  }

  function boot() {
    ensureStyle();
    panel();
    void refreshAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
