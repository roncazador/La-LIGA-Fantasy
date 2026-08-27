(() => {
  'use strict';

  const SNAPSHOT_URL = '/recording-data-2026-08-27.json';
  const LIVE_ENDPOINT = '/api/fantasy/dashboard';
  const BRAIN_KEY = 'fantasy_brain_v29_mode';
  let data = null;
  let live = null;

  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const money = v => v == null ? 'N/D' : new Intl.NumberFormat('es-ES').format(Number(v)) + ' €';
  const normPos = p => ({GK:'POR',POR:'POR',PORTERO:'POR',DF:'DEF',DEF:'DEF',DEFENSA:'DEF',MF:'MED',MED:'MED',MEDIO:'MED',MEDIOCENTRO:'MED',CEN:'MED',FW:'DEL',DEL:'DEL',DELANTERO:'DEL'}[String(p||'').toUpperCase()] || String(p||'N/D'));

  function normalizeSnapshot(raw) {
    const s = raw?.snapshot || {};
    return {
      ...raw,
      teamValue: raw.teamValue ?? s.teamValue ?? null,
      reward: raw.reward ?? raw.dailyReward ?? s.dailyReward ?? null,
      marketBalance: raw.marketBalance ?? s.marketBalance ?? null,
      matchday: raw.matchday ?? s.matchdayAtStart ?? null,
      standings: Array.isArray(raw.standings) ? raw.standings : (Array.isArray(raw.standingsVisible) ? raw.standingsVisible : []),
      rostersVisible: raw.rostersVisible || raw.rosters || {},
      marketListings: Array.isArray(raw.marketListings) ? raw.marketListings : (Array.isArray(raw.market?.visible) ? raw.market.visible : []),
      recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : (Array.isArray(raw.activity) ? raw.activity : [])
    };
  }

  function topStats() {
    const me = data?.standings?.find(x => x.manager === 'roncazador');
    const set = (id, value) => { const n = document.getElementById(id); if (n) n.textContent = value; };
    set('kRank', me?.rank != null ? `#${me.rank}` : 'N/D');
    set('kPoints', me?.pfsy != null ? me.pfsy : 'N/D');
    set('kValue', money(data?.teamValue));
    set('kSquad', data?.teamCount || data?.snapshot?.teamCount || 'N/D');
    set('kCash', money(data?.marketBalance));
    const acc = document.getElementById('kAccuracy');
    if (acc && acc.textContent === 'N/D') acc.textContent = 'Ref.';
  }

  function ensureStyles() {
    if (document.getElementById('recordingV29Styles')) return;
    const s = document.createElement('style');
    s.id = 'recordingV29Styles';
    s.textContent = `
      #recordingPanelV29{margin:12px 0;border:1px solid #30394d;border-radius:16px;background:linear-gradient(135deg,#151b29,#0e121a);padding:12px}
      #recordingPanelV29 .r29-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      #recordingPanelV29 .r29-title{font-size:17px;font-weight:950}
      #recordingPanelV29 .r29-sub{color:#9aa3b7;font-size:10px;margin-top:3px}
      #recordingPanelV29 .r29-tabs{display:flex;gap:6px;overflow:auto;padding:9px 0 3px;position:sticky;top:54px;z-index:4;background:rgba(14,18,26,.96);backdrop-filter:blur(10px)}
      #recordingPanelV29 .r29-tabs button{cursor:pointer}
      #recordingPanelV29 .r29-tabs button.active{background:#ff454c}
      #recordingPanelV29 .r29-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}
      #recordingPanelV29 .r29-metric{background:#0d121b;border:1px solid #293244;border-radius:11px;padding:9px}
      #recordingPanelV29 .r29-value{font-size:17px;font-weight:950;margin-top:3px}
      #recordingPanelV29 .r29-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      #recordingPanelV29 .r29-card{background:#0c1119;border:1px solid #283142;border-radius:12px;padding:10px}
      #recordingPanelV29 .r29-card.me{border-color:#59647d;box-shadow:0 0 0 1px rgba(255,69,76,.12) inset}
      #recordingPanelV29 .r29-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #222a38}
      #recordingPanelV29 .r29-row:last-child{border-bottom:0}
      #recordingPanelV29 .r29-name{font-weight:900}
      #recordingPanelV29 .r29-meta{font-size:10px;color:#9aa3b7;margin-top:2px;line-height:1.35}
      #recordingPanelV29 .r29-score{font-weight:950;font-size:14px}
      #recordingPanelV29 .good{color:#2bd888}.bad{color:#ff727b}.warn{color:#ffd166}.blue2{color:#78aaff}
      #recordingPanelV29 .r29-market{display:grid;grid-template-columns:1.25fr .55fr .8fr .8fr;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #222a38;font-size:10px}
      #recordingPanelV29 .r29-market:last-child{border-bottom:0}
      #recordingPanelV29 .r29-activity{padding:8px 0;border-bottom:1px solid #222a38;font-size:10px;line-height:1.4}
      #recordingPanelV29 .r29-activity:last-child{border-bottom:0}
      #recordingPanelV29 .r29-callout{padding:9px 10px;border:1px solid #39445b;background:#111723;border-radius:10px;font-size:10px;line-height:1.45;margin:8px 0}
      #recordingPanelV29 .r29-live{font-size:9px;padding:4px 7px;border-radius:999px;background:#1b2432;color:#9aa3b7;white-space:nowrap}
      #recordingPanelV29 .r29-live.ok{color:#2bd888;background:#13291f}
      #recordingPanelV29 .r29-live.wait{color:#ffd166;background:#2b2414}
      @media(max-width:900px){#recordingPanelV29 .r29-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:650px){#recordingPanelV29 .r29-metrics{grid-template-columns:repeat(2,1fr)}#recordingPanelV29 .r29-grid{grid-template-columns:1fr}#recordingPanelV29 .r29-market{grid-template-columns:1fr 1fr}#recordingPanelV29 .r29-tabs{top:48px}}
    `;
    document.head.appendChild(s);
  }

  function managers() { return Array.isArray(data?.standings) ? data.standings : []; }
  function roster(manager) { return Array.isArray(data?.rostersVisible?.[manager]) ? data.rostersVisible[manager] : []; }
  function managerCard(m) {
    const row = managers().find(x => x.manager === m) || {};
    const players = roster(m);
    return `<div class="r29-card ${m === 'roncazador' ? 'me' : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px"><div><div class="r29-name">${esc(m)}</div><div class="r29-meta">Valor ${money(row.teamValue)}</div></div><b>#${esc(row.rank ?? 'N/D')} · ${esc(row.pfsy ?? 'N/D')} PFSY</b></div>
      ${players.length ? players.map(playerRow).join('') : '<div class="r29-meta">Sin jugadores legibles.</div>'}
    </div>`;
  }
  function playerRow(p) {
    const status = String(p.availability || '').toLowerCase().includes('suspend') ? '<span class="bad">Suspendido</span>' : '<span class="good">Alineable</span>';
    const lock = p.lockDays ? ` · ${esc(p.lockDays)}d` : '';
    return `<div class="r29-row"><div><div class="r29-name">${esc(p.name || p.player || 'N/D')}${p.star ? ' ⭐' : ''}</div><div class="r29-meta">${esc(normPos(p.position || p.pos))} · ${status}${lock} · ${money(p.price ?? p.value)}</div></div><div class="r29-score">${p.pfsy ?? p.points ?? '—'}</div></div>`;
  }

  function teamView() {
    const me = managers().find(x => x.manager === 'roncazador') || {};
    const players = roster('roncazador');
    const visiblePoints = players.reduce((s,p) => s + (num(p.pfsy) || 0), 0);
    return `<div class="r29-metrics">
      <div class="r29-metric"><div class="label">Posición</div><div class="r29-value">#${esc(me.rank ?? 'N/D')}</div></div>
      <div class="r29-metric"><div class="label">PFSY</div><div class="r29-value">${esc(me.pfsy ?? 'N/D')}</div></div>
      <div class="r29-metric"><div class="label">Valor equipo</div><div class="r29-value">${money(data.teamValue)}</div></div>
      <div class="r29-metric"><div class="label">Plantilla</div><div class="r29-value">${esc(data.teamCount || data.snapshot?.teamCount || 'N/D')}</div></div>
    </div>
    <div class="r29-callout">📅 <b>Inicio Jornada ${esc(data.matchday ?? '3')}</b> · recompensa visible <b>${money(data.reward)}</b> · ${players.length} jugadores legibles · PFSY visible sumado ${visiblePoints}.</div>
    <div class="r29-card me">${players.length ? players.map(playerRow).join('') : '<div class="r29-meta">No hay jugadores visibles en el snapshot.</div>'}</div>`;
  }

  function rivalsView() {
    const rows = managers().filter(x => x.manager !== 'roncazador');
    return `<div class="r29-grid">${rows.map(x => managerCard(x.manager)).join('')}</div>`;
  }

  function marketView() {
    const rows = Array.isArray(data.marketListings) ? data.marketListings : [];
    const discounted = rows.filter(x => num(x.price) != null && num(x.value) != null && x.price < x.value).length;
    const doubtful = rows.filter(x => String(x.status||'').toLowerCase().includes('dudos')).length;
    return `<div class="r29-metrics">
      <div class="r29-metric"><div class="label">Saldo mercado</div><div class="r29-value">${money(data.marketBalance)}</div></div>
      <div class="r29-metric"><div class="label">Anuncios observados</div><div class="r29-value">${rows.length}</div></div>
      <div class="r29-metric"><div class="label">Por debajo de valor</div><div class="r29-value blue2">${discounted}</div></div>
      <div class="r29-metric"><div class="label">Dudosos</div><div class="r29-value warn">${doubtful}</div></div>
    </div>
    <div class="r29-callout">💰 <b>Estado observado en la grabación del 27/08/2026</b>. No se presenta como mercado LIVE. La sincronización real se habilita al conectar la cuenta y el backend.</div>
    <div class="r29-card"><div class="r29-market" style="font-weight:900"><span>Jugador / dueño</span><span>PFSY</span><span>Valor</span><span>Precio</span></div>
      ${rows.map(x => { const advantage = num(x.value)!=null && num(x.price)!=null ? Math.round((1 - x.price/x.value)*100) : null; const state = String(x.status||'').toLowerCase().includes('dudos') ? '<span class="warn">Dudoso</span>' : '<span class="good">Alineable</span>'; return `<div class="r29-market"><span><b>${esc(x.player ?? x.name ?? 'N/D')}</b><br><span class="r29-meta">${esc(x.owner || 'N/D')} · ${state} · ${esc(x.remainingDays ?? x.expires ?? 'N/D')}d</span></span><span>${esc(x.pfsy ?? 'N/D')}</span><span>${money(x.value)}</span><span><b>${money(x.price)}</b>${advantage != null ? `<br><span class="blue2">−${advantage}%</span>` : ''}</span></div>`; }).join('') || '<div class="r29-meta">Sin anuncios legibles.</div>'}
    </div>`;
  }

  function activityView() {
    const rows = Array.isArray(data.recentActivity) ? data.recentActivity : [];
    return `<div class="r29-card">${rows.map(x => `<div class="r29-activity"><b>${esc(x.type)}</b> <span class="r29-meta">${esc(x.date)}</span><br>${esc(x.manager || x.actor || 'N/D')} ${esc(x.action || '')}${x.player ? ` · <b>${esc(x.player)}</b>` : ''}${x.amount != null ? ` · <b>${money(x.amount)}</b>` : ''}</div>`).join('') || '<div class="r29-meta">Sin actividad legible.</div>'}</div>`;
  }

  function render(view='team') {
    const body = document.getElementById('recordingBodyV29');
    if (!body) return;
    body.innerHTML = view === 'rivals' ? rivalsView() : view === 'market' ? marketView() : view === 'activity' ? activityView() : teamView();
  }

  function buildPanel() {
    if (document.getElementById('recordingPanelV29')) return document.getElementById('recordingPanelV29');
    const panel = document.createElement('section');
    panel.id = 'recordingPanelV29';
    panel.innerHTML = `<div class="r29-head"><div><div class="r29-title">📊 Tu liga · lectura inteligente</div><div class="r29-sub">Mi equipo · rivales · mercado · actividad · referencia visual 27/08/2026</div></div><span id="recordingLiveBadge" class="r29-live wait">REFERENCIA</span></div>
      <div class="r29-tabs"><button type="button" data-r29="team" class="active">👤 Mi equipo</button><button type="button" data-r29="rivals">👥 Rivales</button><button type="button" data-r29="market">💰 Mercado</button><button type="button" data-r29="activity">📰 Actividad</button></div>
      <div id="recordingBodyV29"></div>`;
    const app = document.querySelector('.app');
    const hero = app?.querySelector('.hero');
    const anchor = document.getElementById('realDataPanel') || hero;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling); else app?.prepend(panel);
    panel.querySelectorAll('[data-r29]').forEach(b => b.addEventListener('click', () => { panel.querySelectorAll('[data-r29]').forEach(x => x.classList.toggle('active', x === b)); render(b.dataset.r29); }));
    return panel;
  }

  function injectReferenceLabel() {
    const real = document.getElementById('realDataPanel');
    if (!real || real.dataset.r29Guard) return;
    real.dataset.r29Guard = '1';
    const status = real.querySelector('.source, .alert');
    const note = document.createElement('div');
    note.className = 'r29-callout';
    note.innerHTML = '📌 <b>Referencia de grabación cargada.</b> Los datos de aquí son observados y no LIVE; no sustituyen la conexión oficial.';
    status?.parentNode?.insertBefore(note, status.nextSibling);
  }

  async function loadLive() {
    try {
      const r = await fetch(LIVE_ENDPOINT, { credentials:'include', cache:'no-store' });
      if (!r.ok) return;
      const json = await r.json().catch(() => null);
      if (json && typeof json === 'object') {
        live = json;
        const b = document.getElementById('recordingLiveBadge');
        if (b) { b.textContent = 'LIVE CONECTADO'; b.classList.remove('wait'); b.classList.add('ok'); }
        document.getElementById('recordingPanelV29')?.querySelector('.r29-sub')?.insertAdjacentText('beforeend',' · LIVE disponible');
      }
    } catch {}
  }

  function brainScore(p) {
    const points = num(p.pfsy ?? p.points) || 0;
    const value = num(p.value) || 0;
    const price = num(p.price) || 0;
    const availability = String(p.availability||'').toLowerCase().includes('suspend') ? 0 : 100;
    const market = value > 0 && price > 0 ? Math.max(0, Math.min(100, 50 + (value-price)/value*100)) : 50;
    const mode = localStorage.getItem(BRAIN_KEY) || 'balanced';
    const weights = mode === 'aggressive' ? [0.48,0.22,0.20,0.10] : mode === 'conservative' ? [0.32,0.34,0.14,0.20] : [0.40,0.28,0.17,0.15];
    const score = Math.round(points*4*weights[0] + availability*weights[1] + market*weights[2] + 50*weights[3]);
    return Math.max(0, Math.min(100, score));
  }

  function brainPanel() {
    if (document.getElementById('brainV29Mini')) return;
    const p = document.createElement('section');
    p.id='brainV29Mini'; p.className='card';
    p.innerHTML=`<h3>🧠 Cerebro v2.9 · Señales rápidas</h3><div class="note">Usa los datos observados disponibles sin inventar campos no visibles.</div><div id="brainV29Rows"></div>`;
    const brainTab=document.getElementById('brain');
    if(brainTab?.parentNode) brainTab.parentNode.insertBefore(p,brainTab.nextSibling); else document.querySelector('.app')?.appendChild(p);
    const rows=roster('roncazador').map(x=>({...x,score:brainScore(x)})).sort((a,b)=>b.score-a.score).slice(0,7);
    document.getElementById('brainV29Rows').innerHTML=rows.length?rows.map(x=>`<div class="r29-row"><div><b>${esc(x.name)}</b><div class="r29-meta">${esc(normPos(x.position||x.pos))} · ${x.availability==='Suspendido'?'<span class="bad">Suspendido</span>':'<span class="good">Alineable</span>'}</div></div><b>${x.score}</b></div>`).join(''):'<div class="empty">Sin jugadores observados.</div>';
  }

  async function load() {
    try {
      const r = await fetch(SNAPSHOT_URL, { cache:'no-store' });
      if (!r.ok) throw new Error(`HTTP_${r.status}`);
      data = normalizeSnapshot(await r.json());
      ensureStyles();
      topStats();
      buildPanel();
      render('team');
      brainPanel();
      injectReferenceLabel();
      loadLive();
    } catch (e) {
      console.warn('Recording snapshot unavailable', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true }); else load();
})();