(() => {
  'use strict';

  const MODE_KEY = 'fantasy_brain_v25_mode';
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, Number(v) || 0));
  const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const pos = p => {
    const x = String(p || '').toUpperCase();
    if (['GK','POR','PORTERO'].includes(x)) return 'POR';
    if (['DF','DEF','DEFENSA'].includes(x)) return 'DEF';
    if (['MF','MED','MEDIO','MEDIOCENTRO','CEN'].includes(x)) return 'MED';
    if (['FW','DEL','DELANTERO'].includes(x)) return 'DEL';
    return x;
  };

  function normalize(p) {
    return {
      ...p,
      name: String(p?.name || p?.player || p?.playerName || p?.fullName || '').trim(),
      position: pos(p?.position || p?.pos || p?.positionName),
      points: num(p?.points ?? p?.pfsy ?? p?.fantasyPoints ?? p?.score),
      starts: num(p?.starts),
      minutes: num(p?.minutes),
      trend1d: num(p?.trend1d ?? p?.change1d),
      trend3d: num(p?.trend3d ?? p?.change3d),
      trend7d: num(p?.trend7d ?? p?.change7d),
      price: num(p?.price ?? p?.marketPrice ?? p?.currentPrice ?? p?.value),
      value: num(p?.value ?? p?.marketValue ?? p?.estimatedValue),
      rotationRisk: clamp(num(p?.rotationRisk, 0), 0, 1),
      injuryRisk: clamp(num(p?.injuryRisk, 0), 0, 1),
      fixture: Array.isArray(p?.fixture) ? p.fixture.slice(0,4).map(x => clamp(num(x,50))) : [50,50,50,50]
    };
  }

  const mode = () => localStorage.getItem(MODE_KEY) || 'balanced';
  const weights = () => mode() === 'aggressive'
    ? {performance:.34, availability:.21, context:.20, market:.15, risk:.10}
    : mode() === 'conservative'
      ? {performance:.27, availability:.26, context:.18, market:.11, risk:.18}
      : {performance:.30, availability:.25, context:.20, market:.15, risk:.10};

  function freshness() {
    const raw = localStorage.getItem('fm25_lastSync') || localStorage.getItem('fm24_lastSync') || localStorage.getItem('laliga_last_live_sync');
    if (!raw) return 25;
    const age = (Date.now() - new Date(raw).getTime()) / 3600000;
    if (!Number.isFinite(age) || age < 0) return 25;
    if (age <= 1) return 100;
    if (age <= 6) return 95;
    if (age <= 24) return 85;
    if (age <= 48) return 65;
    if (age <= 168) return 40;
    return 15;
  }

  function score(p) {
    const points = clamp(p.points * 4);
    const mins = clamp((p.minutes / 90) * 20);
    const starts = clamp(p.starts * 5);
    const performance = clamp(points*.60 + mins*.25 + starts*.15);
    const availability = clamp(.58*clamp(p.minutes/9) + .42*clamp(p.starts*10));
    const context = clamp(p.fixture?.[0] ?? 50);
    const market = p.value > 0 && p.price > 0 ? clamp(50 + ((p.value-p.price)/p.value)*100) : clamp(50 + p.trend1d + p.trend3d*.5);
    const risk = clamp((1-p.rotationRisk)*65 + (1-p.injuryRisk)*35);
    const w = weights();
    const raw = performance*w.performance + availability*w.availability + context*w.context + market*w.market + risk*w.risk;
    const completeness = [p.points,p.starts,p.minutes,p.trend1d,p.trend3d,p.trend7d,p.price,p.value,p.fixture?.[0]].filter(v => Number.isFinite(Number(v))).length / 9 * 100;
    const confidence = clamp(completeness*.62 + freshness()*.38);
    const confidenceFactor = .82 + confidence/100*.18;
    const score = clamp(raw * confidenceFactor);
    return { score, performance, availability, context, market, risk, confidence };
  }

  const projection = (p, i=0) => {
    const d = score(p);
    const f = clamp(p.fixture?.[i] ?? 50);
    const trend = clamp(50 + p.trend3d*2 + p.trend7d);
    const risk = (1-(p.rotationRisk*.7+p.injuryRisk*.3))*100;
    return Math.round(clamp(d.score*.42 + f*.26 + trend*.16 + risk*.11 + d.confidence*.05 - i*2.5));
  };

  function ensureStyle(){
    if(document.getElementById('brain25Style')) return;
    const s=document.createElement('style'); s.id='brain25Style';
    s.textContent=`#brain25Panel{margin:12px 0}.b25-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.b25-metric{background:#0e131d;border:1px solid #2a3141;border-radius:10px;padding:9px}.b25-metric .v{font-size:18px;font-weight:900;margin-top:3px}.b25-table{width:100%;border-collapse:collapse}.b25-table th,.b25-table td{padding:7px 5px;border-bottom:1px solid #232a38;font-size:10px;text-align:left}.b25-table th{font-size:8px;color:#9aa3b7;text-transform:uppercase}.b25-good{color:#2bd888}.b25-warn{color:#ffd166}.b25-bad{color:#ff727b}@media(max-width:750px){.b25-grid{grid-template-columns:repeat(2,1fr)}.b25-table th:nth-child(n+6),.b25-table td:nth-child(n+6){display:none}}`;
    document.head.appendChild(s);
  }

  function panel(){
    let p=document.getElementById('brain25Panel');
    if(p) return p;
    p=document.createElement('section'); p.id='brain25Panel'; p.className='card';
    const anchor=document.getElementById('brain') || document.querySelector('.hero');
    (anchor?.parentNode || document.querySelector('.app'))?.appendChild(p);
    p.innerHTML=`<div class="flex" style="justify-content:space-between"><div><h2 style="margin:0 0 4px">🧠 Cerebro v2.5</h2><div class="tiny">Calidad de datos + frescura + decisión adaptativa</div></div><select id="brain25Mode" style="max-width:160px"><option value="balanced">Equilibrado</option><option value="conservative">Conservador</option><option value="aggressive">Agresivo</option></select></div><div id="brain25Metrics" class="b25-grid" style="margin:10px 0"></div><div id="brain25Body"></div>`;
    const select=p.querySelector('#brain25Mode'); select.value=mode(); select.addEventListener('change',()=>{localStorage.setItem(MODE_KEY,select.value);render(window.__brain25Players||[])});
    return p;
  }

  function render(players, source='LOCAL'){
    window.__brain25Players=players;
    const p=panel();
    const scored=players.map(normalize).filter(x=>x.name).map(x=>({...x,...score(x)})).sort((a,b)=>b.score-a.score);
    const avg=scored.length?Math.round(scored.reduce((s,x)=>s+x.confidence,0)/scored.length):null;
    const fresh=freshness();
    p.querySelector('#brain25Metrics').innerHTML=`<div class="b25-metric"><div class="label">Confianza datos</div><div class="v">${avg==null?'N/D':avg+'/100'}</div></div><div class="b25-metric"><div class="label">Actualidad</div><div class="v">${fresh>=85?'ALTA':fresh>=65?'MEDIA':'BAJA'}</div></div><div class="b25-metric"><div class="label">Modo</div><div class="v">${mode()==='balanced'?'EQUILIBRADO':mode()==='conservative'?'CONSERVADOR':'AGRESIVO'}</div></div><div class="b25-metric"><div class="label">Fuente</div><div class="v">${esc(source)}</div></div>`;
    p.querySelector('#brain25Body').innerHTML=scored.length?`<div style="overflow:auto"><table class="b25-table"><thead><tr><th>Jugador</th><th>Pos</th><th>Score</th><th>Conf.</th><th>J+1</th><th>J+2</th><th>Decisión</th></tr></thead><tbody>${scored.slice(0,40).map(x=>{const d=x.score>=78&&x.confidence>=65?'TITULAR / PRIORIDAD':x.score>=70?'TITULAR':x.score>=62?'SEGUIR':x.score<=44?'SALIDA':'NEUTRA'; return `<tr><td><b>${esc(x.name)}</b><br><span class="tiny">${esc(x.team||'')}</span></td><td>${esc(x.position||'N/D')}</td><td class="${x.score>=75?'b25-good':x.score>=60?'b25-warn':'b25-bad'}"><b>${Math.round(x.score)}</b></td><td>${Math.round(x.confidence)}</td><td>${projection(x,0)}</td><td>${projection(x,1)}</td><td>${d}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No hay jugadores legibles. Conecta LALIGA o importa datos locales.</div>';
  }

  function extractFantasyPlayers(dashboard){
    const team = dashboard?.team?.data || dashboard?.team || {};
    const raw = team?.players || team?.squad || team?.members || team?.roster || [];
    if (!Array.isArray(raw)) return [];
    return raw.map(p => ({
      ...p,
      name: p?.name || p?.playerName || p?.fullName || p?.player?.name,
      position: p?.position || p?.positionName || p?.role,
      points: p?.points ?? p?.pfsy ?? p?.fantasyPoints ?? p?.score,
      price: p?.price ?? p?.marketPrice ?? p?.currentPrice ?? p?.value,
      value: p?.value ?? p?.marketValue ?? p?.estimatedValue,
      availability: p?.availability || p?.status || p?.healthStatus
    })).filter(p => p.name);
  }

  async function load(){
    try{
      const live=await fetch('/api/fantasy/dashboard',{credentials:'include',cache:'no-store'});
      if(live.ok){
        const dashboard=await live.json();
        const players=extractFantasyPlayers(dashboard);
        if(players.length){
          localStorage.setItem('laliga_last_live_sync',new Date().toISOString());
          render(players,'LALIGA LIVE');
          return;
        }
      }
    }catch{}
    try{
      const r=await fetch('/api/data/players?page=1',{credentials:'include',cache:'no-store'});
      if(!r.ok) throw new Error(`HTTP_${r.status}`);
      const data=await r.json();
      const players=Array.isArray(data.players)?data.players:Array.isArray(data.data)?data.data:[];
      if(players.length) render(players,'API-FOOTBALL');
    }catch(error){
      const local = (()=>{try{return JSON.parse(localStorage.getItem('fm25_state_v1')||localStorage.getItem('fm24_state_v1')||'{}').players||[]}catch{return []}})();
      render(Array.isArray(local)?local:[],'LOCAL');
      const body=document.getElementById('brain25Body');
      if(body && !local.length) body.insertAdjacentHTML('afterbegin',`<div class="source">Motor v2.5 sin datos LIVE (${esc(error.message)}). No se inventan datos.</div>`);
    }
  }

  function boot(){ensureStyle();panel();load();setInterval(load,10*60*1000);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
