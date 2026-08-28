(() => {
  'use strict';

  const BRAIN_VERSION = '2.6';
  const MODE_KEY = 'fantasy_brain_v26_mode';
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, Number(v) || 0));
  const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const has = v => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));
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
      team: String(p?.team || p?.teamName || p?.club || '').trim(),
      points: num(p?.points ?? p?.pfsy ?? p?.fantasyPoints ?? p?.score),
      starts: num(p?.starts),
      minutes: num(p?.minutes),
      appearances: num(p?.appearances ?? p?.apps ?? p?.matches),
      trend1d: num(p?.trend1d ?? p?.change1d),
      trend3d: num(p?.trend3d ?? p?.change3d),
      trend7d: num(p?.trend7d ?? p?.change7d),
      price: num(p?.price ?? p?.marketPrice ?? p?.currentPrice ?? p?.value),
      value: num(p?.value ?? p?.marketValue ?? p?.estimatedValue),
      rotationRisk: clamp(num(p?.rotationRisk, 0), 0, 1),
      injuryRisk: clamp(num(p?.injuryRisk, 0), 0, 1),
      fixture: Array.isArray(p?.fixture) ? p.fixture.slice(0,4).map(x => clamp(num(x,50))) : [],
      availability: String(p?.availability || p?.status || p?.healthStatus || '').trim()
    };
  }

  const mode = () => localStorage.getItem(MODE_KEY) || 'balanced';
  const weights = () => mode() === 'aggressive'
    ? {performance:.33, availability:.18, context:.18, market:.20, risk:.11}
    : mode() === 'conservative'
      ? {performance:.25, availability:.27, context:.17, market:.11, risk:.20}
      : {performance:.30, availability:.24, context:.19, market:.16, risk:.11};

  function freshness() {
    const raw = localStorage.getItem('laliga_last_live_sync') || localStorage.getItem('fm25_lastSync') || localStorage.getItem('fm24_lastSync');
    if (!raw) return 15;
    const age = (Date.now() - new Date(raw).getTime()) / 3600000;
    if (!Number.isFinite(age) || age < 0) return 15;
    if (age <= 1) return 100;
    if (age <= 6) return 95;
    if (age <= 24) return 85;
    if (age <= 48) return 65;
    if (age <= 168) return 40;
    return 15;
  }

  function dataQuality(p) {
    const fields = ['points','starts','minutes','trend1d','trend3d','trend7d','price','value'];
    const present = fields.filter(k => has(p[k])).length;
    const fixtureQuality = Array.isArray(p.fixture) && p.fixture.length > 0 ? 1 : 0;
    const identityQuality = p.name ? 1 : 0;
    const quality = (present / fields.length) * 75 + fixtureQuality * 15 + identityQuality * 10;
    return clamp(quality);
  }

  function roleProfile(p) {
    switch (p.position) {
      case 'POR': return {availability:.42, context:.22, market:.12};
      case 'DEF': return {availability:.30, context:.24, market:.17};
      case 'MED': return {availability:.24, context:.26, market:.18};
      case 'DEL': return {availability:.19, context:.27, market:.21};
      default: return {availability:.26, context:.24, market:.17};
    }
  }

  function score(p) {
    const points = clamp(p.points * 4);
    const minutes = clamp((p.minutes / 90) * 20);
    const starts = clamp(p.starts * 5);
    const appearances = clamp(p.appearances * 2.5);
    const performance = clamp(points*.52 + minutes*.22 + starts*.16 + appearances*.10);

    const availabilityObserved = [has(p.minutes), has(p.starts), has(p.appearances)].filter(Boolean).length;
    const observedAvailability = clamp(0.55*clamp(p.minutes/9) + 0.35*clamp(p.starts*10) + 0.10*clamp(p.appearances*4));
    const availability = availabilityObserved ? observedAvailability : 50;

    const context = p.fixture.length ? clamp(p.fixture[0]) : 50;
    const shortTrend = has(p.trend1d) || has(p.trend3d) || has(p.trend7d)
      ? clamp(50 + p.trend1d*1.7 + p.trend3d*1.15 + p.trend7d*.6)
      : 50;
    const priceSignal = p.value > 0 && p.price > 0
      ? clamp(50 + ((p.value - p.price) / p.value) * 100)
      : shortTrend;
    const market = clamp(priceSignal*.62 + shortTrend*.38);

    const explicitAvailabilityPenalty = /(inj|lesi|duda|doubt|out|baja|sanc)/i.test(p.availability) ? 24 : 0;
    const risk = clamp((1-(p.rotationRisk*.7+p.injuryRisk*.3))*100 - explicitAvailabilityPenalty);

    const role = roleProfile(p);
    const w = weights();
    const roleAdjusted = {
      performance: w.performance,
      availability: w.availability * (0.85 + role.availability),
      context: w.context * (0.85 + role.context),
      market: w.market * (0.85 + role.market),
      risk: w.risk
    };
    const total = roleAdjusted.performance + roleAdjusted.availability + roleAdjusted.context + roleAdjusted.market + roleAdjusted.risk;
    Object.keys(roleAdjusted).forEach(k => roleAdjusted[k] /= total);

    const raw = performance*roleAdjusted.performance + availability*roleAdjusted.availability + context*roleAdjusted.context + market*roleAdjusted.market + risk*roleAdjusted.risk;
    const quality = dataQuality(p);
    const confidence = clamp(quality*.65 + freshness()*.35);
    const score = clamp(raw * (0.78 + confidence/100*.22));
    return {score, performance, availability, context, market, risk, confidence, quality, shortTrend};
  }

  function transferScore(p, d) {
    const fixture = p.fixture.length ? clamp(p.fixture[0]) : 50;
    const upside = p.value > 0 && p.price > 0 ? clamp(50 + ((p.value-p.price)/p.value)*140) : d.market;
    const momentum = clamp(50 + d.shortTrend*.55 + d.market*.45 - 50);
    const confidence = d.confidence;
    return Math.round(clamp(
      d.performance*.28 + fixture*.20 + upside*.25 + d.risk*.12 + confidence*.10 + momentum*.05
    ));
  }

  function projection(p, i=0) {
    const d = score(p);
    const f = clamp(p.fixture?.[i] ?? 50);
    return Math.round(clamp(d.score*.45 + f*.28 + d.shortTrend*.15 + d.risk*.08 + d.confidence*.04 - i*2.5));
  }

  function decision(p, d, t) {
    if (d.confidence < 45) return 'FALTA INFORMACIÓN';
    if (d.risk < 42) return 'NO FORZAR';
    if (t >= 78 && d.confidence >= 65) return 'COMPRAR / PRIORIDAD';
    if (d.score >= 79 && d.confidence >= 65) return 'TITULAR / PRIORIDAD';
    if (d.score >= 71) return 'TITULAR';
    if (t >= 68) return 'VIGILAR MERCADO';
    if (d.score <= 43) return 'SALIDA';
    return 'MANTENER';
  }

  function ensureStyle(){
    if(document.getElementById('brain26Style')) return;
    const s=document.createElement('style'); s.id='brain26Style';
    s.textContent=`#brain26Panel{margin:12px 0}.b26-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.b26-metric{background:#0e131d;border:1px solid #2a3141;border-radius:10px;padding:9px}.b26-metric .v{font-size:18px;font-weight:900;margin-top:3px}.b26-table{width:100%;border-collapse:collapse}.b26-table th,.b26-table td{padding:7px 5px;border-bottom:1px solid #232a38;font-size:10px;text-align:left}.b26-table th{font-size:8px;color:#9aa3b7;text-transform:uppercase}.b26-good{color:#2bd888}.b26-warn{color:#ffd166}.b26-bad{color:#ff727b}.b26-blue{color:#78aaff}.b26-source{font-size:10px;color:#9aa3b7;margin-top:8px;line-height:1.45}@media(max-width:850px){.b26-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){.b26-grid{grid-template-columns:repeat(2,1fr)}.b26-table th:nth-child(n+7),.b26-table td:nth-child(n+7){display:none}}`;
    document.head.appendChild(s);
  }

  function panel(){
    let p=document.getElementById('brain26Panel');
    if(p) return p;
    p=document.createElement('section'); p.id='brain26Panel'; p.className='card';
    const anchor=document.getElementById('brain25Panel') || document.getElementById('brain') || document.querySelector('.hero');
    (anchor?.parentNode || document.querySelector('.app') || document.body)?.appendChild(p);
    p.innerHTML=`<div class="flex" style="justify-content:space-between"><div><h2 style="margin:0 0 4px">🧠 Cerebro v${BRAIN_VERSION}</h2><div class="tiny">Decisión adaptativa · calidad por campo · señal de mercado</div></div><select id="brain26Mode" style="max-width:160px"><option value="balanced">Equilibrado</option><option value="conservative">Conservador</option><option value="aggressive">Agresivo</option></select></div><div id="brain26Metrics" class="b26-grid" style="margin:10px 0"></div><div id="brain26Body"></div>`;
    const select=p.querySelector('#brain26Mode'); select.value=mode(); select.addEventListener('change',()=>{localStorage.setItem(MODE_KEY,select.value);render(window.__brain26Players||[],window.__brain26Source||'LOCAL')});
    return p;
  }

  function render(players, source='LOCAL'){
    window.__brain26Players=players; window.__brain26Source=source;
    const p=panel();
    const scored=players.map(normalize).filter(x=>x.name).map(x=>{const d=score(x);return {...x,...d,transfer:transferScore(x,d)}}).sort((a,b)=>b.score-a.score);
    const avg=scored.length?Math.round(scored.reduce((s,x)=>s+x.confidence,0)/scored.length):null;
    const avgTransfer=scored.length?Math.round(scored.reduce((s,x)=>s+x.transfer,0)/scored.length):null;
    const fresh=freshness();
    const live=String(source).toUpperCase().includes('LIVE');
    p.querySelector('#brain26Metrics').innerHTML=`<div class="b26-metric"><div class="label">Confianza</div><div class="v">${avg==null?'N/D':avg+'/100'}</div></div><div class="b26-metric"><div class="label">Actualidad</div><div class="v">${fresh>=85?'ALTA':fresh>=65?'MEDIA':'BAJA'}</div></div><div class="b26-metric"><div class="label">Mercado</div><div class="v">${avgTransfer==null?'N/D':avgTransfer+'/100'}</div></div><div class="b26-metric"><div class="label">Modo</div><div class="v">${mode()==='balanced'?'EQUILIBRADO':mode()==='conservative'?'CONSERVADOR':'AGRESIVO'}</div></div><div class="b26-metric"><div class="label">Fuente</div><div class="v">${esc(source)}</div></div>`;
    const sourceNote = live
      ? 'LIVE: la señal de mercado y decisiones se calculan sobre los datos oficiales recibidos en esta sesión.'
      : 'REFERENCIA: estos datos no se presentan como LIVE. La confianza se reduce cuando faltan campos o frescura.';
    p.querySelector('#brain26Body').innerHTML=(scored.length?`<div style="overflow:auto"><table class="b26-table"><thead><tr><th>Jugador</th><th>Pos</th><th>Score</th><th>Conf.</th><th>Mercado</th><th>J+1</th><th>Decisión</th></tr></thead><tbody>${scored.slice(0,40).map(x=>{const d=decision(x,x,x.transfer);return `<tr><td><b>${esc(x.name)}</b><br><span class="tiny">${esc(x.team)}</span></td><td>${esc(x.position||'N/D')}</td><td class="${x.score>=75?'b26-good':x.score>=60?'b26-warn':'b26-bad'}"><b>${Math.round(x.score)}</b></td><td>${Math.round(x.confidence)}</td><td class="${x.transfer>=72?'b26-blue':x.transfer>=55?'b26-warn':'b26-bad'}">${x.transfer}</td><td>${projection(x,0)}</td><td>${d}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No hay jugadores legibles. Conecta LALIGA o importa datos locales.</div>')+`<div class="b26-source">${sourceNote}</div>`;
  }

  function extractFantasyPlayers(dashboard){
    const team = dashboard?.team?.data || dashboard?.team || {};
    const raw = team?.players || team?.squad || team?.members || team?.roster || [];
    if (!Array.isArray(raw)) return [];
    return raw.map(p => ({
      ...p,
      name: p?.name || p?.playerName || p?.fullName || p?.player?.name,
      team: p?.team || p?.teamName || p?.club || p?.player?.team?.name,
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
      const body=document.getElementById('brain26Body');
      if(body && !local.length) body.insertAdjacentHTML('afterbegin',`<div class="source">Motor v${BRAIN_VERSION} sin datos LIVE (${esc(error.message)}). No se inventan datos.</div>`);
    }
  }

  function boot(){ensureStyle();panel();load();setInterval(load,10*60*1000);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
