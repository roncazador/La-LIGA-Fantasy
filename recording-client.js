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
      installBrain25();
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
    installBrain25();
  }

  /* =========================
     BRAIN v2.5 — confidence-aware overlay
  ========================= */
  const BRAIN_KEY = 'fantasy_brain_v25_mode';
  const clamp = (v,a=0,b=100) => Math.max(a, Math.min(b, Number(v) || 0));
  const n = (v,d=0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const normPos = p => {
    const x = String(p || '').toUpperCase();
    if (['GK','POR','PORTERO'].includes(x)) return 'POR';
    if (['DF','DEF','DEFENSA'].includes(x)) return 'DEF';
    if (['MF','MED','MEDIO','MEDIOCENTRO','CEN'].includes(x)) return 'MED';
    if (['FW','DEL','DELANTERO'].includes(x)) return 'DEL';
    return x;
  };
  const normalizePlayer = p => ({...p,name:String(p?.name||p?.player||p?.playerName||'').trim(),position:normPos(p?.position||p?.pos),points:n(p?.points??p?.pfsy??p?.fantasyPoints??p?.score),starts:n(p?.starts),minutes:n(p?.minutes),trend1d:n(p?.trend1d??p?.change1d),trend3d:n(p?.trend3d??p?.change3d),trend7d:n(p?.trend7d??p?.change7d),price:n(p?.price??p?.marketPrice??p?.currentPrice),value:n(p?.value??p?.marketValue??p?.estimatedValue),rotationRisk:clamp(n(p?.rotationRisk,0),0,1),injuryRisk:clamp(n(p?.injuryRisk,0),0,1),fixture:Array.isArray(p?.fixture)?p.fixture.slice(0,4).map(x=>clamp(n(x,50))):[50,50,50,50]});
  const getMode = () => localStorage.getItem(BRAIN_KEY) || 'balanced';
  const getWeights = () => getMode()==='aggressive'?{performance:.34,availability:.21,context:.20,market:.15,risk:.10}:getMode()==='conservative'?{performance:.27,availability:.26,context:.18,market:.11,risk:.18}:{performance:.30,availability:.25,context:.20,market:.15,risk:.10};
  function freshness(){
    const raw=localStorage.getItem('fm25_lastSync')||localStorage.getItem('fm24_lastSync');
    if(!raw)return 25;
    const age=(Date.now()-new Date(raw).getTime())/3600000;
    if(!Number.isFinite(age)||age<0)return 25;
    if(age<=6)return 100;if(age<=24)return 85;if(age<=48)return 65;if(age<=168)return 40;return 15;
  }
  function brainScore(p){
    const performance=clamp(p.points*4)*.60+clamp((p.minutes/90)*20)*.25+clamp(p.starts*5)*.15;
    const availability=clamp(.58*clamp(p.minutes/9)+.42*clamp(p.starts*10));
    const context=clamp(p.fixture?.[0]??50);
    const market=p.value>0&&p.price>0?clamp(50+((p.value-p.price)/p.value)*100):clamp(50+p.trend1d+p.trend3d*.5);
    const risk=clamp((1-p.rotationRisk)*65+(1-p.injuryRisk)*35);
    const w=getWeights();
    const raw=performance*w.performance+availability*w.availability+context*w.context+market*w.market+risk*w.risk;
    const fields=[p.points,p.starts,p.minutes,p.trend1d,p.trend3d,p.trend7d,p.price,p.value,p.fixture?.[0]];
    const completeness=fields.filter(v=>Number.isFinite(Number(v))).length/fields.length*100;
    const confidence=clamp(completeness*.62+freshness()*.38);
    const score=clamp(raw*(.82+confidence/100*.18));
    return {score,confidence,performance,availability,context,market,risk};
  }
  const brainProjection=(p,i=0)=>{const d=brainScore(p);const f=clamp(p.fixture?.[i]??50);const trend=clamp(50+p.trend3d*2+p.trend7d);const risk=(1-(p.rotationRisk*.7+p.injuryRisk*.3))*100;return Math.round(clamp(d.score*.42+f*.26+trend*.16+risk*.11+d.confidence*.05-i*2.5));};
  function installBrain25(){
    if(document.getElementById('brain25Panel')){renderBrain25(getBrainPlayers());return;}
    const styleId='brain25InlineStyle';
    if(!document.getElementById(styleId)){
      const s=document.createElement('style');s.id=styleId;s.textContent=`#brain25Panel{margin:12px 0}.b25grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.b25m{background:#0e131d;border:1px solid #2a3141;border-radius:10px;padding:9px}.b25m .v{font-size:18px;font-weight:900;margin-top:3px}.b25tbl{width:100%;border-collapse:collapse}.b25tbl th,.b25tbl td{padding:7px 5px;border-bottom:1px solid #232a38;font-size:10px;text-align:left}.b25tbl th{font-size:8px;color:#9aa3b7;text-transform:uppercase}@media(max-width:750px){.b25grid{grid-template-columns:repeat(2,1fr)}.b25tbl th:nth-child(n+6),.b25tbl td:nth-child(n+6){display:none}}`;document.head.appendChild(s);
    }
    const panel=document.createElement('section');panel.id='brain25Panel';panel.className='card';
    panel.innerHTML=`<div class="flex" style="justify-content:space-between"><div><h2 style="margin:0 0 4px">🧠 Cerebro v2.5</h2><div class="tiny">Calidad de datos + frescura + decisión adaptativa</div></div><select id="brain25Mode" style="max-width:160px"><option value="balanced">Equilibrado</option><option value="conservative">Conservador</option><option value="aggressive">Agresivo</option></select></div><div id="brain25Metrics" class="b25grid" style="margin:10px 0"></div><div id="brain25Body"></div>`;
    const brainTab=document.getElementById('brain');
    const anchor=brainTab||document.querySelector('.hero');
    if(anchor?.parentNode)anchor.parentNode.insertBefore(panel,anchor.nextSibling);else document.querySelector('.app')?.appendChild(panel);
    const select=panel.querySelector('#brain25Mode');select.value=getMode();select.addEventListener('change',()=>{localStorage.setItem(BRAIN_KEY,select.value);renderBrain25(getBrainPlayers());});
    renderBrain25(getBrainPlayers());
    if(!getBrainPlayers().length) loadBrain25Live();
  }
  function getBrainPlayers(){
    const local=(()=>{try{const a=JSON.parse(localStorage.getItem('fm25_state_v1')||localStorage.getItem('fm24_state_v1')||'{}');return Array.isArray(a.players)?a.players:[]}catch{return []}})();
    if(local.length)return local;
    const live=window.__fantasyLivePlayers;
    return Array.isArray(live)?live:[];
  }
  async function loadBrain25Live(){
    try{
      const r=await fetch('/api/data/players?page=1',{credentials:'include',cache:'no-store'});if(!r.ok)throw new Error(`HTTP_${r.status}`);
      const d=await r.json();const players=Array.isArray(d.players)?d.players:Array.isArray(d.data)?d.data:[];
      if(players.length){window.__fantasyLivePlayers=players;renderBrain25(players);}
    }catch{}
  }
  function renderBrain25(raw){
    const panel=document.getElementById('brain25Panel');if(!panel)return;
    const rows=(raw||[]).map(normalizePlayer).filter(p=>p.name).map(p=>({...p,...brainScore(p)})).sort((a,b)=>b.score-a.score);
    const avg=rows.length?Math.round(rows.reduce((s,p)=>s+p.confidence,0)/rows.length):null;const fresh=freshness();
    panel.querySelector('#brain25Metrics').innerHTML=`<div class="b25m"><div class="label">Confianza datos</div><div class="v">${avg==null?'N/D':avg+'/100'}</div></div><div class="b25m"><div class="label">Actualidad</div><div class="v">${fresh>=85?'ALTA':fresh>=65?'MEDIA':fresh>=40?'BAJA':'MUY BAJA'}</div></div><div class="b25m"><div class="label">Modo</div><div class="v">${getMode()==='balanced'?'EQUILIBRADO':getMode()==='conservative'?'CONSERVADOR':'AGRESIVO'}</div></div><div class="b25m"><div class="label">Líder</div><div class="v">${rows[0]?esc(rows[0].name):'N/D'}</div></div>`;
    if(!rows.length){panel.querySelector('#brain25Body').innerHTML='<div class="empty">Sin jugadores evaluables. Conecta LALIGA o importa datos locales.</div>';return;}
    panel.querySelector('#brain25Body').innerHTML=`<div style="overflow:auto"><table class="b25tbl"><thead><tr><th>Jugador</th><th>Pos</th><th>Score</th><th>Conf.</th><th>J+1</th><th>J+2</th><th>Decisión</th></tr></thead><tbody>${rows.slice(0,40).map(p=>{const decision=p.score>=78&&p.confidence>=65?'TITULAR / PRIORIDAD':p.score>=70?'TITULAR':p.score>=62?'SEGUIR':p.score<=44?'SALIDA':'NEUTRA';return `<tr><td><b>${esc(p.name)}</b><br><span class="tiny">${esc(p.team||'')}</span></td><td>${esc(p.position||'N/D')}</td><td><b>${Math.round(p.score)}</b></td><td>${Math.round(p.confidence)}</td><td>${brainProjection(p,0)}</td><td>${brainProjection(p,1)}</td><td>${decision}</td></tr>`}).join('')}</tbody></table></div>`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
