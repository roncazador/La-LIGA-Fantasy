(() => {
  'use strict';

  const state = { teams: [], standings: [], players: [], injuries: [] };
  let playerPage = 1;
  let playerTotalPages = 1;
  let loading = false;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const cell = value => value === null || value === undefined || value === '' ? '—' : esc(value);

  function ensurePanel() {
    let panel = document.getElementById('realDataPanel');
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = 'realDataPanel';
    panel.className = 'card';
    panel.innerHTML = `
      <div class="flex" style="justify-content:space-between">
        <div>
          <h2 style="margin-bottom:4px">📊 Datos reales de LaLiga</h2>
          <div id="realDataMeta" class="tiny">API-Football · temporada 2026</div>
        </div>
        <button id="realDataRefresh" class="primary" type="button">↻ Actualizar</button>
      </div>
      <div class="nav" id="realDataTabs" style="position:static;margin:8px 0 0">
        <button type="button" data-view="teams" class="active">Equipos</button>
        <button type="button" data-view="players">Jugadores</button>
        <button type="button" data-view="standings">Clasificación</button>
        <button type="button" data-view="injuries">Lesiones</button>
      </div>
      <div id="realDataStatus" class="note" style="margin:8px 0">Preparando datos…</div>
      <div id="realDataBody"></div>
    `;

    const anchor = document.querySelector('.app')?.firstElementChild || document.body.firstElementChild;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    else document.body.prepend(panel);

    panel.querySelectorAll('[data-view]').forEach(button => {
      button.addEventListener('click', () => {
        panel.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === button));
        renderView(button.dataset.view);
      });
    });
    panel.querySelector('#realDataRefresh').addEventListener('click', () => loadCurrentView(true));
    return panel;
  }

  function status(message, ok = true) {
    const node = document.getElementById('realDataStatus');
    if (node) node.innerHTML = `${ok ? '✅' : '⚠️'} ${message}`;
  }

  function renderTeams() {
    const rows = state.teams;
    if (!rows.length) return '<div class="empty">No hay equipos reales disponibles.</div>';
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">${rows.map(team => `
      <div class="player" style="padding:10px;background:#0f131c;border:1px solid #2a3141;border-radius:10px">
        <div class="flex">
          ${team.logo ? `<img src="${esc(team.logo)}" alt="" width="28" height="28" style="object-fit:contain" loading="lazy">` : ''}
          <div><div class="name">${esc(team.name)}</div><div class="tiny">${cell(team.city)} · ${cell(team.venue)}</div></div>
        </div>
      </div>`).join('')}</div>`;
  }

  function renderPlayers() {
    const rows = state.players;
    if (!rows.length) return '<div class="empty">No hay jugadores cargados.</div>';
    const html = `<div style="overflow:auto"><table><thead><tr><th>Jugador</th><th>Equipo</th><th>Pos.</th><th>Min.</th><th>G/A</th><th>Rating</th></tr></thead><tbody>${rows.map(p => `
      <tr><td><b>${esc(p.name)}</b></td><td>${cell(p.team)}</td><td>${cell(p.position)}</td><td>${cell(p.minutes)}</td><td>${cell(p.goals)}/${cell(p.assists)}</td><td>${p.rating === null ? '—' : p.rating.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>
      <div class="flex" style="margin-top:8px"><button id="prevPlayers" type="button" ${playerPage <= 1 ? 'disabled' : ''}>← Anterior</button><span class="tiny">Página ${playerPage}/${playerTotalPages}</span><button id="nextPlayers" type="button" ${playerPage >= playerTotalPages ? 'disabled' : ''}>Siguiente →</button></div>`;
    return html;
  }

  function renderStandings() {
    const rows = state.standings.slice().sort((a,b) => (num(a.rank) ?? 999) - (num(b.rank) ?? 999));
    if (!rows.length) return '<div class="empty">La clasificación todavía no está disponible.</div>';
    return `<div style="overflow:auto"><table><thead><tr><th>#</th><th>Equipo</th><th>PTS</th><th>PJ</th><th>DG</th><th>Forma</th></tr></thead><tbody>${rows.map(r => `
      <tr><td>${cell(r.rank)}</td><td><b>${esc(r.team)}</b></td><td>${cell(r.points)}</td><td>${cell(r.played)}</td><td>${cell(r.goalDiff)}</td><td>${cell(r.form)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderInjuries() {
    const rows = state.injuries;
    if (!rows.length) return '<div class="empty">No hay lesiones comunicadas por el proveedor para esta consulta.</div>';
    return `<div>${rows.slice(0, 100).map(r => `
      <div class="player"><div><div class="name">${esc(r.player)}</div><div class="tiny">${cell(r.team)} · ${cell(r.type)} · ${cell(r.reason)}</div></div><span class="pill red">RIESGO</span></div>`).join('')}</div>`;
  }

  function renderView(view) {
    const body = document.getElementById('realDataBody');
    if (!body) return;
    body.innerHTML = view === 'players' ? renderPlayers() : view === 'standings' ? renderStandings() : view === 'injuries' ? renderInjuries() : renderTeams();
    body.querySelector('#prevPlayers')?.addEventListener('click', () => { playerPage -= 1; loadCurrentView(true); });
    body.querySelector('#nextPlayers')?.addEventListener('click', () => { playerPage += 1; loadCurrentView(true); });
  }

  async function request(section) {
    const include = encodeURIComponent(section);
    const response = await fetch(`/api/data/${include}`, { credentials: 'include', cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
    return data;
  }

  async function loadCurrentView(force = false) {
    if (loading && !force) return;
    loading = true;
    const active = document.querySelector('#realDataTabs [data-view].active')?.dataset.view || 'teams';
    const suffix = active === 'players' ? `?page=${playerPage}` : '';
    status(`Consultando ${active === 'teams' ? 'equipos' : active === 'players' ? 'jugadores' : active === 'standings' ? 'clasificación' : 'lesiones'}…`);
    try {
      const response = await fetch(`/api/data/${active}${suffix}`, { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
      if (active === 'teams') state.teams = data.teams || [];
      if (active === 'players') { state.players = data.players || []; playerPage = data.page || playerPage; playerTotalPages = data.totalPages || playerTotalPages; }
      if (active === 'standings') state.standings = data.standings || [];
      if (active === 'injuries') state.injuries = data.injuries || [];
      const count = active === 'teams' ? state.teams.length : active === 'players' ? state.players.length : active === 'standings' ? state.standings.length : state.injuries.length;
      const source = data.provider || 'API-Football';
      status(`${count} registros recibidos · fuente: ${source}`);
      renderView(active);
    } catch (error) {
      status(`Datos no disponibles: ${error.message}`, false);
      renderView(active);
    } finally {
      loading = false;
    }
  }

  function boot() {
    ensurePanel();
    loadCurrentView();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
