(() => {
  'use strict';

  const money = value => value == null ? '—' : new Intl.NumberFormat('es-ES').format(Number(value)) + ' €';
  const text = value => String(value ?? '').trim();
  const esc = value => text(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  let data = null;

  async function load() {
    try {
      const response = await fetch('/recording-data-2026-08-27.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      data = await response.json();
      installUi();
    } catch (error) {
      console.warn('Recording data unavailable', error);
    }
  }

  function ensureStyles() {
    if (document.getElementById('recordingStyles')) return;
    const style = document.createElement('style');
    style.id = 'recordingStyles';
    style.textContent = `
      #recordingPanel .recordTabs{display:flex;gap:6px;overflow:auto;margin:4px 0 12px;padding-bottom:3px}
      #recordingPanel .recordTabs button{cursor:pointer}
      #recordingPanel .recordTabs button.active{background:#ff454c}
      #recordingPanel .recordGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #recordingPanel .managerCard,#recordingPanel .marketCard,#recordingPanel .activityCard{background:#0f131c;border:1px solid #2a3141;border-radius:12px;padding:11px}
      #recordingPanel .managerHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
      #recordingPanel .managerName{font-weight:900}
      #recordingPanel .rankBadge{font-weight:900;font-size:11px}
      #recordingPanel .rosterRow{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #232a38}
      #recordingPanel .rosterRow:last-child{border-bottom:0}
      #recordingPanel .playerMeta{font-size:10px;color:#9aa3b7;margin-top:2px}
      #recordingPanel .pfsy{font-weight:900;font-size:13px}
      #recordingPanel .statusGood{color:#2bd888;font-weight:800}
      #recordingPanel .statusBad{color:#ff727b;font-weight:800}
      #recordingPanel .marketHero{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
      #recordingPanel .metric{background:#151a24;border:1px solid #2a3141;border-radius:10px;padding:9px}
      #recordingPanel .metric .v{font-size:18px;font-weight:900;margin-top:3px}
      #recordingPanel .marketRow{display:grid;grid-template-columns:1.1fr .8fr .8fr .9fr;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #232a38;font-size:10px}
      #recordingPanel .marketRow:last-child{border-bottom:0}
      #recordingPanel .activityRow{padding:8px 0;border-bottom:1px solid #232a38;font-size:10px;line-height:1.35}
      #recordingPanel .activityRow:last-child{border-bottom:0}
      @media(max-width:900px){#recordingPanel .recordGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){#recordingPanel .recordGrid{grid-template-columns:1fr}#recordingPanel .marketHero{grid-template-columns:1fr 1fr}#recordingPanel .marketRow{grid-template-columns:1fr 1fr}.recordSource{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function buildPanel() {
    let panel = document.getElementById('recordingPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'recordingPanel';
    panel.className = 'card';
    panel.innerHTML = `
      <div class="flex" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h2 style="margin-bottom:4px">📱 LALIGA observada en la grabación</h2>
          <div class="tiny">Referencia histórica · no sustituye datos LIVE</div>
        </div>
        <span class="pill">27/08/2026 · J3</span>
      </div>
      <div class="recordSource source" style="margin-top:8px">Datos extraídos únicamente de los fotogramas legibles de la grabación aportada. Los campos no legibles permanecen como N/D.</div>
      <div class="recordTabs">
        <button type="button" data-record-view="team" class="active">👤 Mi equipo</button>
        <button type="button" data-record-view="rivals">👥 Rivales</button>
        <button type="button" data-record-view="market">💰 Mercado</button>
        <button type="button" data-record-view="activity">📰 Actividad</button>
      </div>
      <div id="recordingBody"></div>
    `;
    const app = document.querySelector('.app');
    const hero = app?.querySelector('.hero');
    const real = document.getElementById('realDataPanel');
    const anchor = real || hero;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    else app?.prepend(panel);
    return panel;
  }

  function installNavButton(panel) {
    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('[data-tab="recording"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = 'recording';
    button.textContent = '📱 Datos grabación';
    nav.appendChild(button);
    button.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
      panel.classList.add('active');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function findManager(name) {
    return Array.isArray(data?.standings) ? data.standings.find(x => x.manager === name) : null;
  }

  function roster(manager) {
    return Array.isArray(data?.rostersVisible?.[manager]) ? data.rostersVisible[manager] : [];
  }

  function rosterRow(p) {
    const statusClass = p.availability === 'Suspendido' ? 'statusBad' : 'statusGood';
    const right = p.pfsy == null ? '—' : p.pfsy;
    const detail = [p.position, p.availability, p.lockDays ? `${p.lockDays} días` : null].filter(Boolean).join(' · ');
    return `<div class="rosterRow"><div><div class="managerName">${esc(p.name)}${p.star ? ' ⭐' : ''}</div><div class="playerMeta">${esc(detail)} · ${money(p.price)}</div></div><div class="pfsy ${statusClass}">${esc(right)}</div></div>`;
  }

  function renderTeam() {
    const me = findManager('roncazador');
    const rows = roster('roncazador');
    const total = rows.reduce((s,p) => s + Number(p.pfsy || 0), 0);
    return `<div class="marketHero">
      <div class="metric"><div class="label">Posición</div><div class="v">#${esc(me?.rank ?? 'N/D')}</div></div>
      <div class="metric"><div class="label">PFSY</div><div class="v">${esc(me?.pfsy ?? 'N/D')}</div></div>
      <div class="metric"><div class="label">Valor equipo</div><div class="v">${money(data.teamValue)}</div></div>
    </div>
    <div class="source" style="margin-bottom:10px"><b>20/24 fichas</b> · Inicio Jornada 3: <b>vie 28 · 19:00h</b> · recompensa visible: <b>${money(data.reward)}</b> · PFSY de los 7 jugadores visibles: <b>${total}</b>.</div>
    <div class="managerCard">${rows.map(rosterRow).join('')}</div>`;
  }

  function managerCard(manager) {
    const standing = findManager(manager);
    const players = roster(manager);
    return `<div class="managerCard"><div class="managerHead"><div><div class="managerName">${esc(manager)}</div><div class="tiny">Valor ${money(standing?.teamValue)}</div></div><div class="rankBadge">#${esc(standing?.rank ?? 'N/D')} · ${esc(standing?.pfsy ?? 'N/D')} PFSY</div></div>${players.length ? players.map(rosterRow).join('') : '<div class="empty">Sin jugadores legibles en la grabación.</div>'}</div>`;
  }

  function renderRivals() {
    const managers = (data.standings || []).filter(x => x.manager !== 'roncazador').map(x => x.manager);
    return `<div class="recordGrid">${managers.map(managerCard).join('')}</div>`;
  }

  function renderMarket() {
    const rows = data.marketListings || [];
    return `<div class="marketHero">
      <div class="metric"><div class="label">Saldo mercado mostrado</div><div class="v">${money(data.marketBalance)}</div></div>
      <div class="metric"><div class="label">Recompensa diaria</div><div class="v">${money(data.reward)}</div></div>
      <div class="metric"><div class="label">Jugadores visibles</div><div class="v">${rows.length}</div></div>
    </div>
    <div class="managerCard"><div class="marketRow" style="font-weight:800"><span>Jugador</span><span>PFSY</span><span>Valor</span><span>Precio</span></div>${rows.map(p => `<div class="marketRow"><span><b>${esc(p.player)}</b><br><span class="tiny">${esc(p.owner)} · ${esc(p.status)} · ${esc(p.remainingDays)} días</span></span><span>${esc(p.pfsy)}</span><span>${money(p.value)}</span><span><b>${money(p.price)}</b></span></div>`).join('')}</div>`;
  }

  function renderActivity() {
    const rows = data.recentActivity || [];
    return `<div class="activityCard">${rows.map(item => `<div class="activityRow"><b>${esc(item.type)}</b> <span class="tiny">${esc(item.date)}</span><br>${esc(item.manager)} ${esc(item.action || '')}${item.player ? ` · <b>${esc(item.player)}</b>` : ''}${item.amount != null ? ` · <b>${money(item.amount)}</b>` : ''}</div>`).join('')}</div>`;
  }

  function render(view='team') {
    const body = document.getElementById('recordingBody');
    if (!body) return;
    body.innerHTML = view === 'rivals' ? renderRivals() : view === 'market' ? renderMarket() : view === 'activity' ? renderActivity() : renderTeam();
  }

  function installUi() {
    ensureStyles();
    const panel = buildPanel();
    installNavButton(panel);
    panel.querySelectorAll('[data-record-view]').forEach(button => button.addEventListener('click', () => {
      panel.querySelectorAll('[data-record-view]').forEach(x => x.classList.toggle('active', x === button));
      render(button.dataset.recordView);
    }));
    render('team');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();

/* Brain v2.5 overlay: keeps the v2.8 application intact and adds the upgraded scoring layer. */
(() => {
  const src = '/brain-engine-v25.js';
  const load = () => {
    if (document.querySelector(`script[data-brain-v25="1"]`)) return;
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.dataset.brainV25 = '1';
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true });
  else load();
})();
