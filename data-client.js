(() => {
  'use strict';

  const state = { teams: [], standings: [], players: [], injuries: [] };
  let playerPage = 1;
  let playerTotalPages = 1;
  let loading = false;

  // Snapshot de lectura obtenido de la grabación de pantalla aportada el 27/08/2026.
  // Solo se incluyen datos claramente visibles; cuando un importe/nombre no es legible,
  // se conserva como null y se marca la observación para no inventar información.
  const RECORDING_SNAPSHOT = {
    source: {
      file: 'ScreenRecording_08-27-2026 11-32-03_1.mp4',
      captured_at: '2026-08-27',
      duration_seconds: 199.666667,
      note: 'Snapshot manual asistido por visión sobre los fotogramas visibles de la grabación.'
    },
    league: {
      competition: 'LaLiga Fantasy',
      displayFilter: 'Total',
      currentWeekLabel: 'Inicio Jornada 3',
      currentWeekStart: '2026-08-28 19:00',
      reward: 100000,
      rewardAvailable: true
    },
    manager: {
      username: 'roncazador',
      pfsY: 109,
      teamValue: 269039595,
      squadSize: '20/24'
    },
    ranking: [
      { rank: 1, manager: 'roncazador', pfsY: 109, teamValue: 269039595 },
      { rank: 2, manager: 'FarlaAcademy', pfsY: 105, teamValue: 131991112 },
      { rank: 3, manager: 'Jonymessi', pfsY: 78, teamValue: 258996039 },
      { rank: 4, manager: 'SURIKTO97', pfsY: 75, teamValue: 224106603 },
      { rank: 5, manager: '⚽saugarrr 😈', pfsY: 69, teamValue: 205802339 },
      { rank: 6, manager: 'AlvaroNP96', pfsY: 52, teamValue: 139315086 },
      { rank: 7, manager: 'kubakar', pfsY: 27, teamValue: 183508912 },
      { rank: 8, manager: 'Akm90', pfsY: 27, teamValue: 90915403 },
      { rank: 9, manager: 'Piotrekatletico', pfsY: 0, teamValue: 230143626 }
    ],
    squads: {
      roncazador: [
        { name: 'Noubi', pos: 'DEF', pfsY: 5, average: 2.5, value: 12937595, lock: 13930586, status: 'Alineable', recent: [3,2] },
        { name: 'Zubeldia', pos: 'DEF', pfsY: 0, average: 0, value: 9748341, lock: 17616671, status: 'Alineable', recent: [-1,1] },
        { name: 'Aramburu', pos: 'DEF', pfsY: 2, average: 1, value: 17653067, lock: 20249095, status: 'Alineable', recent: [2,null] },
        { name: 'Fermín', pos: 'CEN', pfsY: 19, average: 19, value: 79606127, lock: null, lockText: '13 días', status: 'Alineable', recent: [null,19], club: 'Barcelona' },
        { name: 'Óscar Valentín', pos: 'CEN', pfsY: 7, average: 3.5, value: 4301017, lock: null, lockText: '9 días', status: 'Alineable', recent: [5,2] },
        { name: 'Cala', pos: 'DEL', pfsY: 11, average: 5.5, value: 4899778, lock: null, lockText: '8 días', status: 'Alineable', recent: [4,7] }
      ],
      Jonymessi: [
        { name: 'Aubameyang', pos: 'DEL', pfsY: 20, average: 10, value: 50181171, lock: null, lockText: '8 días', status: 'Alineable', recent: [10,10] },
        { name: 'Ferran Jutglà', pos: 'DEL', pfsY: 4, average: 4, value: 9061209, lock: 16325936, status: 'Alineable', recent: [null,4] },
        { name: 'Lucas Boyé', pos: 'DEL', pfsY: 5, average: 5, value: 11293904, lock: 25726200, status: 'Alineable', recent: [null,5] },
        { name: 'Mikautadze', pos: 'DEL', pfsY: 23, average: 11.5, value: 71083800, lock: null, lockText: '14 días', status: 'Alineable', recent: [9,14] }
      ],
      SURIKTO97: [
        { name: 'Urko', pos: 'CEN', pfsY: 8, average: 4, value: 5406257, lock: 8785150, status: 'Alineable', recent: [6,2] },
        { name: 'Brahim', pos: 'CEN', pfsY: 2, average: 1, value: 10355693, lock: 24837550, status: 'Alineable', recent: [2,0] },
        { name: 'Valverde', pos: 'CEN', pfsY: 15, average: 7.5, value: 72072954, lock: 78291362, status: 'Alineable', recent: [9,6] },
        { name: 'Álvaro García', pos: 'CEN', pfsY: 10, average: 5, value: 20929654, lock: 24997633, status: 'Alineable', recent: [8,2] }
      ],
      '⚽saugarrr 😈': [
        { name: 'Adama', pos: 'DEF', pfsY: 0, average: 0, value: 452679, lock: 1000000, status: 'Alineable', recent: [null,0], club: 'Athletic' },
        { name: 'C. Puga', pos: 'DEF', pfsY: 8, average: 4, value: 4934935, lock: 10982248, status: 'Alineable', recent: [4,4] },
        { name: 'Dela', pos: 'DEF', pfsY: 9, average: 4.5, value: 11282179, lock: null, lockText: '13 días', status: 'Alineable', recent: [1,8] },
        { name: 'Carmona', pos: 'DEF', pfsY: 1, average: 0.5, value: 3428773, lock: null, lockText: '09:12:15', status: 'Alineable', recent: [0,1] }
      ],
      AlvaroNP96: [
        { name: 'Ximo Navarro', pos: 'DEF', pfsY: 5, average: 2.5, value: 5140820, lock: 9647656, status: 'Alineable', recent: [2,3] },
        { name: 'Q. Hartman', pos: 'DEF', pfsY: 0, average: 0, value: 6351701, lock: 17522880, status: 'Alineable', recent: [null,null] },
        { name: 'M. Dituro', pos: 'POR', pfsY: 4, average: 2, value: 9005409, lock: null, lockText: '9 días', status: 'Alineable', recent: [5,-1] },
        { name: 'Le Normand', pos: 'DEF', pfsY: 8, average: 4, value: 12652812, lock: 33065081, status: 'Suspendido', recent: [9,-1] },
        { name: 'R.P. Bigas', pos: 'DEF', pfsY: 2, average: 1, value: 3736592, lock: 12838681, status: 'Alineable', recent: [null,null] }
      ]
    },
    market: {
      marketBalance: 40542121,
      visible: [
        { name: null, owner: 'Jonymessi', pfsY: null, status: 'Alineable', value: 3496065, price: 5000000, expires: '2 días', note: 'Nombre no legible en el fotograma.' },
        { name: 'Isaac', pos: 'DEL', owner: '⚽saugarrr 😈', pfsY: 13, value: 6665244, price: 6460286, expires: '2 días', status: 'Alineable' },
        { name: 'Juan Iglesias', pos: 'DEF', owner: 'Jonymessi', pfsY: 7, value: 12942787, price: 18000000, expires: '3 días', status: 'Dudoso' }
      ]
    },
    activity: [
      { date: '2026-08-24', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'Sergio', destination: 'LALIGA', amount: 1222999 },
      { date: '2026-08-24', type: 'market', actor: '⚽saugarrr 😈', action: 'vendido', player: 'Eguiluz', destination: 'LALIGA', amount: 417286 },
      { date: '2026-08-24', type: 'market', actor: '⚽saugarrr 😈', action: 'vendido', player: 'Isi', destination: 'LALIGA', amount: 18063492 },
      { date: '2026-08-23', type: 'market', actor: 'SURIKTO97', action: 'vendido', player: 'Pere Milla', destination: 'LALIGA', amount: 7639350 },
      { date: '2026-08-23', type: 'market', actor: 'SURIKTO97', action: 'vendido', player: 'Johnny', destination: 'LALIGA', amount: 4785427 },
      { date: '2026-08-23', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'Bartra', destination: 'LALIGA', amount: 28111111 },
      { date: '2026-08-23', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'Guridi', destination: 'LALIGA', amount: 7222222 },
      { date: '2026-08-20', type: 'market', actor: 'roncazador', action: 'comprado', player: 'Álex Balde', destination: 'LALIGA', amount: 25001999 },
      { date: '2026-08-20', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'Juan Iglesias', destination: 'LALIGA', amount: 12195508 },
      { date: '2026-08-20', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'Ryan', destination: 'LALIGA', amount: 14000001 },
      { date: '2026-08-20', type: 'market', actor: 'FarlaAcademy', action: 'comprado', player: 'Bil Nsongo', destination: 'LALIGA', amount: 8000517 },
      { date: '2026-08-20', type: 'market', actor: 'SURIKTO97', action: 'comprado', player: 'Vlachodimos', destination: 'LALIGA', amount: 25947108 },
      { date: '2026-08-20', type: 'market', actor: 'SURIKTO97', action: 'comprado', player: 'Fran González', destination: 'roncazador', amount: 1100000 },
      { date: '2026-08-20', type: 'no-score', actor: 'Piotrekatletico', action: 'no puntuación', note: 'En la jornada 1, Piotrekatletico no ha puntuado.' },
      { date: '2026-08-17', type: 'market', actor: 'FarlaAcademy', action: 'comprado', player: 'Lunin', destination: '⚽saugarrr 😈', amount: 4548366 },
      { date: '2026-08-17', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Luismi Cruz', destination: 'LALIGA', amount: 5441863 },
      { date: '2026-08-17', type: 'market', actor: 'roncazador', action: 'vendido', player: 'Balliu', destination: 'LALIGA', amount: 999309 },
      { date: '2026-08-17', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Facu', destination: 'LALIGA', amount: 2741169 },
      { date: '2026-08-17', type: 'market', actor: 'FarlaAcademy', action: 'comprado', player: 'Koke', destination: 'LALIGA', amount: 18083013 },
      { date: '2026-08-17', type: 'market', actor: 'kubakar', action: 'comprado', player: 'Youssef', destination: 'LALIGA', amount: 595701 },
      { date: '2026-08-17', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'C. Soler', destination: 'LALIGA', amount: 32202800 },
      { date: '2026-08-10', type: 'market', actor: 'Jonymessi', action: 'vendido', player: 'J. Musso', destination: 'LALIGA', amount: 5372450 },
      { date: '2026-08-10', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Cardona', destination: 'LALIGA', amount: 5210690 },
      { date: '2026-08-10', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Óscar Valentín', destination: 'LALIGA', amount: 3179963 },
      { date: '2026-08-10', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Niño', destination: 'LALIGA', amount: 2823497 },
      { date: '2026-08-10', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Foulquier', destination: 'LALIGA', amount: 2607682 },
      { date: '2026-08-10', type: 'market', actor: '⚽saugarrr 😈', action: 'comprado', player: 'Adama', destination: 'LALIGA', amount: 536412 },
      { date: '2026-08-03', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Manu Sánchez', destination: 'LALIGA', amount: 5284994 },
      { date: '2026-08-03', type: 'market', actor: 'roncazador', action: 'comprado', player: 'Balliu', destination: 'LALIGA', amount: 825642 },
      { date: '2026-08-03', type: 'market', actor: 'FarlaAcademy', action: 'comprado', player: 'Leo Román', destination: 'LALIGA', amount: 30000556 },
      { date: '2026-08-02', type: 'market', actor: 'roncazador', action: 'comprado', player: 'Germán V.', destination: 'FarlaAcademy', amount: 24902715 },
      { date: '2026-08-02', type: 'market', actor: 'roncazador', action: 'vendido', player: 'Hugo Duro', destination: 'LALIGA', amount: 9444898 },
      { date: '2026-08-02', type: 'market', actor: 'roncazador', action: 'vendido', player: 'Guruzeta', destination: 'LALIGA', amount: 12327616 },
      { date: '2026-08-16', type: 'market', actor: 'kubakar', action: 'comprado', player: 'Roberto', destination: 'FarlaAcademy', amount: 15658009 },
      { date: '2026-08-16', type: 'market', actor: 'kubakar', action: 'comprado', player: 'M. Casadó', destination: 'LALIGA', amount: 2199177 },
      { date: '2026-08-16', type: 'market', actor: 'SURIKTO97', action: 'comprado', player: 'Torrientes', destination: 'LALIGA', amount: 7963780 },
      { date: '2026-08-16', type: 'market', actor: 'FarlaAcademy', action: 'vendido', player: 'Fidalgo', destination: 'LALIGA', amount: 2884878 },
      { date: '2026-08-13', type: 'market', actor: 'roncazador', action: 'comprado', player: 'Martim Neto', destination: 'LALIGA', amount: 2222299 },
      { date: '2026-08-13', type: 'market', actor: '⚽saugarrr 😈', action: 'comprado', player: 'Carmona', destination: 'LALIGA', amount: 4378551 },
      { date: '2026-08-13', type: 'market', actor: 'roncazador', action: 'vendido', player: 'Ionut Radu', destination: 'LALIGA', amount: 4547081 },
      { date: '2026-08-12', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'Paredes', destination: 'LALIGA', amount: 4709638 },
      { date: '2026-08-12', type: 'market', actor: 'Jonymessi', action: 'comprado', player: 'Óscar Valentín', destination: 'LALIGA', amount: 2530046 },
      { date: '2026-08-12', type: 'market', actor: 'roncazador', action: 'comprado', player: 'Konaté', destination: 'LALIGA', amount: 4790432 },
      { date: '2026-08-30', type: 'market', actor: 'roncazador', action: 'vendido', player: 'Ionut Radu', destination: 'LALIGA', amount: 31898939, note: 'Fecha que aparece en una pantalla intermedia; conservar como observación de grabación.' },
      { date: '2026-07-29', type: 'member', actor: 'Akm90', action: 'se ha unido a la liga' },
      { date: '2026-07-29', type: 'member', actor: '⚽saugarrr 😈', action: 'se ha unido a la liga' },
      { date: '2026-07-29', type: 'member', actor: 'Jonymessi', action: 'se ha unido a la liga' },
      { date: '2026-07-29', type: 'member', actor: 'kubakar', action: 'se ha unido a la liga' },
      { date: '2026-07-29', type: 'member', actor: 'SURIKTO97', action: 'se ha unido a la liga' },
      { date: '2026-07-29', type: 'member', actor: 'roncazador', action: 'se ha unido a la liga' }
    ],
    observations: [
      'La grabación muestra el filtro Total y una recompensa diaria de 100.000 € disponible.',
      'El equipo de roncazador aparece con 20/24 fichas y valor de equipo 269.039.595 €.',
      'La clasificación visible sitúa a roncazador 1.º con 109 PFSY.',
      'La pantalla de mercado muestra un saldo/importe de 40.542.121 €.',
      'La actividad visible incluye operaciones de mercado desde el 29/07/2026 y altas de miembros en la liga.',
      'Algunos registros están parcialmente cubiertos por overlays/anuncios o contienen texto no completamente legible; esos campos no se inventan.'
    ]
  };

  window.__laligaRecordingSnapshot = RECORDING_SNAPSHOT;
  try { localStorage.setItem('laliga_recording_snapshot', JSON.stringify(RECORDING_SNAPSHOT)); } catch {}

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const cell = value => value === null || value === undefined || value === '' ? '—' : esc(value);
  const eur = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('es-ES').format(value) + ' €';

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
          <div id="realDataMeta" class="tiny">API-Football · temporada 2026 · + snapshot de grabación</div>
        </div>
        <button id="realDataRefresh" class="primary" type="button">↻ Actualizar</button>
      </div>
      <div class="nav" id="realDataTabs" style="position:static;margin:8px 0 0">
        <button type="button" data-view="teams" class="active">Equipos</button>
        <button type="button" data-view="players">Jugadores</button>
        <button type="button" data-view="standings">Clasificación</button>
        <button type="button" data-view="injuries">Lesiones</button>
        <button type="button" data-view="recording">📹 Grabación</button>
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
        if (button.dataset.view === 'recording') {
          status(`${RECORDING_SNAPSHOT.ranking.length} managers · ${RECORDING_SNAPSHOT.activity.length} registros de actividad · snapshot de la grabación`, true);
          renderView('recording');
        } else {
          renderView(button.dataset.view);
          loadCurrentView(true);
        }
      });
    });
    panel.querySelector('#realDataRefresh').addEventListener('click', () => {
      const active = document.querySelector('#realDataTabs [data-view].active')?.dataset.view || 'teams';
      if (active === 'recording') {
        status('Snapshot de grabación ya incorporado; no requiere consulta externa.', true);
        renderView('recording');
        return;
      }
      loadCurrentView(true);
    });
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

  function renderRecording() {
    const snap = RECORDING_SNAPSHOT;
    const manager = snap.manager;
    const rankingRows = snap.ranking.map(r => `<tr><td>${r.rank}</td><td><b>${esc(r.manager)}</b></td><td>${r.pfsY}</td><td>${eur(r.teamValue)}</td></tr>`).join('');
    const squadBlocks = Object.entries(snap.squads).map(([owner, players]) => `
      <div class="card" style="margin:0">
        <div class="flex" style="justify-content:space-between"><h3 style="margin:0">${esc(owner)}</h3><span class="pill">${players.length} visibles</span></div>
        <div style="overflow:auto;margin-top:8px"><table><thead><tr><th>Jugador</th><th>Pos.</th><th>PFSY</th><th>Media</th><th>Valor</th><th>Estado</th></tr></thead><tbody>
          ${players.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${cell(p.pos)}</td><td>${cell(p.pfsY)}</td><td>${cell(p.average)}</td><td>${eur(p.value)}</td><td>${cell(p.status)}${p.lock != null ? ` · ${eur(p.lock)}` : p.lockText ? ` · ${esc(p.lockText)}` : ''}</td></tr>`).join('')}
        </tbody></table></div>
      </div>`).join('');
    const marketRows = snap.market.visible.map(m => `<tr><td><b>${cell(m.name)}</b></td><td>${cell(m.pos)}</td><td>${cell(m.owner)}</td><td>${cell(m.pfsY)}</td><td>${eur(m.value)}</td><td>${eur(m.price)}</td><td>${cell(m.status)}</td><td>${cell(m.expires)}</td></tr>`).join('');
    const activityRows = snap.activity.map(a => `<tr><td>${esc(a.date)}</td><td>${esc(a.type)}</td><td><b>${esc(a.actor)}</b></td><td>${esc(a.action)}</td><td>${cell(a.player)}</td><td>${cell(a.destination)}</td><td>${a.amount == null ? '—' : eur(a.amount)}</td></tr>`).join('');
    return `
      <div class="grid3">
        <div class="card"><div class="label">Manager</div><div class="value">${esc(manager.username)}</div><div class="tiny">#1 · ${manager.pfsY} PFSY</div></div>
        <div class="card"><div class="label">Valor equipo</div><div class="value blue">${eur(manager.teamValue)}</div><div class="tiny">${esc(manager.squadSize)}</div></div>
        <div class="card"><div class="label">Recompensa</div><div class="value yellow">${eur(snap.league.reward)}</div><div class="tiny">Disponible · inicio jornada 3: ${esc(snap.league.currentWeekStart)}</div></div>
      </div>
      <div class="card"><h3>🏆 Clasificación observada</h3><div style="overflow:auto"><table><thead><tr><th>#</th><th>Manager</th><th>PFSY</th><th>Valor</th></tr></thead><tbody>${rankingRows}</tbody></table></div></div>
      <div class="card"><h3>👥 Plantillas observadas</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:10px">${squadBlocks}</div></div>
      <div class="card"><h3>💰 Mercado observado</h3><div class="source">Importe visible en pantalla: <b>${eur(snap.market.marketBalance)}</b></div><div style="overflow:auto;margin-top:8px"><table><thead><tr><th>Jugador</th><th>Pos.</th><th>Propietario</th><th>PFSY</th><th>Valor</th><th>Precio</th><th>Estado</th><th>Caduca</th></tr></thead><tbody>${marketRows}</tbody></table></div></div>
      <div class="card"><h3>🧾 Actividad observada</h3><div style="overflow:auto"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Manager</th><th>Acción</th><th>Jugador</th><th>Destino</th><th>Importe</th></tr></thead><tbody>${activityRows}</tbody></table></div></div>
      <div class="alert"><b>Fuente:</b> ${esc(snap.source.file)} · ${snap.source.duration_seconds}s. ${esc(snap.league.displayFilter)} · datos derivados solo de lo visible en la grabación. Los campos no legibles se mantienen como “—”.</div>
    `;
  }

  function renderView(view) {
    const body = document.getElementById('realDataBody');
    if (!body) return;
    body.innerHTML = view === 'players' ? renderPlayers()
      : view === 'standings' ? renderStandings()
      : view === 'injuries' ? renderInjuries()
      : view === 'recording' ? renderRecording()
      : renderTeams();
    body.querySelector('#prevPlayers')?.addEventListener('click', () => { playerPage -= 1; loadCurrentView(true); });
    body.querySelector('#nextPlayers')?.addEventListener('click', () => { playerPage += 1; loadCurrentView(true); });
  }

  async function loadCurrentView(force = false) {
    if (loading && !force) return;
    const active = document.querySelector('#realDataTabs [data-view].active')?.dataset.view || 'teams';
    if (active === 'recording') {
      status(`${RECORDING_SNAPSHOT.ranking.length} managers · snapshot local de la grabación`, true);
      renderView('recording');
      return;
    }
    loading = true;
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
