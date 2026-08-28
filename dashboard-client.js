(() => {
  'use strict';

  const VERSION = '2.12.0';
  const state = { dashboard: null, fixtures: [], loadedAt: null, fixtureSource: '—' };
  const w = window;
  const d = document;

  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const arr = v => Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : Array.isArray(v?.items) ? v.items : Array.isArray(v?.content) ? v.content : [];
  const text = v => String(v ?? '').trim();
  const norm = v => text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|sd|ud|real|club|rcd|ca|deportivo)\b/g, '').replace(/[^a-z0-9]/g, '');
  const money = v => num(v) === null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(v)) + ' €';
  const esc = v => text(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function dateParts(iso) {
    const dt = new Date(iso);
    if (!Number.isFinite(dt.getTime())) return { date: 'N/D', time: 'N/D' };
    return {
      date: new Intl.DateTimeFormat('es-ES', { weekday:'short', day:'2-digit', month:'2-digit', timeZone:'Europe/Madrid' }).format(dt),
      time: new Intl.DateTimeFormat('es-ES', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Europe/Madrid' }).format(dt)
    };
  }

  function normalizeFixtures(payload) {
    const raw = arr(payload?.merged?.length ? payload.merged : payload?.matches?.length ? payload.matches : payload);
    return raw
      .filter(m => text(m?.home || m?.homeTeam?.name) && text(m?.away || m?.awayTeam?.name) && text(m?.utcDate || m?.date))
      .map(m => ({
        id: text(m.id ?? `${m.home}-${m.away}-${m.utcDate ?? m.date}`),
        utcDate: text(m.utcDate || m.date),
        home: text(m.home || m.homeTeam?.name),
        away: text(m.away || m.awayTeam?.name),
        homeTeam: m.homeTeam || { id:m.homeTeamId ?? null, name:m.home || m.homeTeam?.name },
        awayTeam: m.awayTeam || { id:m.awayTeamId ?? null, name:m.away || m.awayTeam?.name },
        status: m.status || null,
        matchday: m.officialMatchday ?? m.matchday ?? null,
        round: m.round || null,
        source: m.source || payload?.primaryProvider || payload?.source || 'Proveedor',
        sources: Array.isArray(m.sources) ? m.sources : [m.source || payload?.primaryProvider || payload?.source || 'Proveedor']
      }))
      .sort((a,b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  }

  function fixtureContext(team, fixtures) {
    const key = norm(team);
    const next = state.fixtures.filter(f => norm(f.home) === key || norm(f.away) === key)[0];
    if (!next) return { value:50, label:'Sin rival próximo', fixture:null };
    const home = norm(next.home) === key;
    const explicit = num(next.difficulty ?? next.fixtureDifficulty ?? next.opponentDifficulty);
    const base = explicit === null ? (home ? 58 : 42) : Math.max(0, Math.min(100, 100 - explicit));
    const hours = (new Date(next.utcDate).getTime() - Date.now()) / 3600000;
    const restPenalty = hours >= 0 && hours < 72 ? 7 : 0;
    return { value:Math.max(0, Math.min(100, base - restPenalty)), label:`${home ? 'Casa' : 'Fuera'} · ${next.away === team ? next.home : next.away}`, fixture:next };
  }

  const BRAIN = {
    version: VERSION,
    extractPlayers(dashboard) {
      const team = dashboard?.team?.data ?? dashboard?.team ?? {};
      const raw = arr(team?.players).length ? arr(team.players) : arr(team?.squad).length ? arr(team.squad) : arr(team?.members);
      return raw.map(p => {
        const positionRaw = text(p?.position ?? p?.positionName ?? p?.role).toUpperCase();
        const position = ['GK','POR','PORTERO'].includes(positionRaw) ? 'POR' : ['DF','DEF','DEFENSA'].includes(positionRaw) ? 'DEF' : ['MF','MED','MEDIO','MEDIOCENTRO','CEN'].includes(positionRaw) ? 'MED' : ['FW','DEL','DELANTERO'].includes(positionRaw) ? 'DEL' : positionRaw;
        return { ...p, name:text(p?.name ?? p?.playerName ?? p?.fullName ?? p?.player?.name), team:p?.team ?? p?.clubName ?? p?.club ?? '', position,
          points:num(p?.points ?? p?.pfsy ?? p?.fantasyPoints ?? p?.score) ?? 0,
          minutes:num(p?.minutes) ?? 0, starts:num(p?.starts) ?? 0,
          price:num(p?.price ?? p?.marketPrice ?? p?.currentPrice), value:num(p?.value ?? p?.marketValue ?? p?.estimatedValue),
          injuryRisk:Math.max(0,Math.min(100,(num(p?.injuryRisk) ?? 0) * (num(p?.injuryRisk) !== null && num(p?.injuryRisk) <= 1 ? 100 : 1))),
          rotationRisk:Math.max(0,Math.min(100,(num(p?.rotationRisk) ?? 0) * (num(p?.rotationRisk) !== null && num(p?.rotationRisk) <= 1 ? 100 : 1))),
          availability:text(p?.availability ?? p?.status ?? '')
        };
      }).filter(p => p.name);
    },
    extractMarket(dashboard) { return arr(dashboard?.market?.data?.length ? dashboard.market.data : dashboard?.market); },
    scorePlayer(p, context=50) {
      const performance = Math.max(0,Math.min(100,(p.points * 3.8) * .66 + Math.min(20,(p.minutes/90)*20) * .19 + Math.min(20,p.starts*5) * .15));
      const suspended = /suspend|baja disciplin|sancion/i.test(p.availability);
      const availability = suspended ? 5 : Math.max(0,Math.min(100,55 + Math.min(25,p.minutes/3.6) + Math.min(20,p.starts*4)));
      const market = p.value > 0 && p.price > 0 ? Math.max(0,Math.min(100,50 + ((p.value - p.price) / p.value) * 100)) : 50;
      const risk = Math.max(0,Math.min(100,100 - (p.rotationRisk*.65 + p.injuryRisk*.35)));
      const contextScore = Math.max(0,Math.min(100,context));
      const score = Math.round(Math.max(0,Math.min(100,performance*.34 + availability*.21 + contextScore*.20 + market*.15 + risk*.10)));
      const completeness = ['points','minutes','starts','price','value'].filter(k => num(p[k]) !== null).length / 5;
      const confidence = Math.round(Math.max(20,Math.min(100,35 + completeness*55 + (state.loadedAt ? 10 : 0))));
      let recommendation = score >= 80 ? 'PRIORIDAD' : score >= 70 ? 'TITULAR' : score >= 60 ? 'VIGILAR' : score <= 44 ? 'SALIDA' : 'MANTENER';
      return { score, confidence, performance, availability, market, risk, context:contextScore, recommendation };
    },
    analyze({ dashboard = {}, fixtures = [] } = {}) {
      state.fixtures = fixtures;
      const players = BRAIN.extractPlayers(dashboard).map(p => ({ ...p, ...BRAIN.scorePlayer(p, fixtureContext(p.team, fixtures).value), fixture:fixtureContext(p.team, fixtures) })).sort((a,b) => b.score-a.score);
      const market = BRAIN.extractMarket(dashboard).map(l => {
        const price = num(l?.price ?? l?.marketPrice ?? l?.currentPrice);
        const value = num(l?.value ?? l?.marketValue ?? l?.estimatedValue);
        const pseudo = { ...l, name:text(l?.player?.name ?? l?.playerName ?? l?.name ?? l?.player), points:num(l?.points ?? l?.pfsy) ?? 0, minutes:num(l?.minutes) ?? 0, starts:num(l?.starts) ?? 0, price, value, injuryRisk:num(l?.injuryRisk) ?? 0, rotationRisk:num(l?.rotationRisk) ?? 0, availability:text(l?.availability ?? l?.status ?? '') };
        const s = BRAIN.scorePlayer(pseudo,50); const margin = value > 0 && price > 0 ? (value-price)/value : null;
        const recommendation = margin !== null && margin >= .10 && s.score >= 72 ? 'PRIORIDAD' : s.score >= 68 ? 'VIGILAR' : 'NO FORZAR';
        return { ...l, ...s, margin, price, value, name:pseudo.name, recommendation };
      }).sort((a,b) => (b.score + (b.margin ?? -1)*40) - (a.score + (a.margin ?? -1)*40));
      const risk = players.slice().sort((a,b) => (b.rotationRisk+b.injuryRisk) - (a.rotationRisk+a.injuryRisk))[0] || null;
      return { players, market, best:players[0] || null, bestMarket:market[0] || null, risk, counts:{players:players.length, market:market.length, fixtures:fixtures.length} };
    }
  };
  w.FANTASY_BRAIN_V28 = Object.freeze(BRAIN);

  function hideLegacy() {
    const selectors = ['.nav','.panel','#brain25Panel','#videoReference','#connectionPanelV212','#providerMatrix','#laligaConnectControl','#fixtureProviderInfo'];
    document.querySelectorAll(selectors.join(',')).forEach(n => n.style.setProperty('display','none','important'));
  }

  function installStyle() {
    if (d.getElementById('fantasyV28Style')) return;
    const s=d.createElement('style'); s.id='fantasyV28Style';
    s.textContent=`#fantasyV28{margin:12px 0}.v28tabs{display:flex;gap:8px;overflow:auto;margin:0 0 12px}.v28tabs button{flex:0 0 auto;min-width:118px;min-height:50px;font-size:13px}.v28tabs button.active{background:#ff454c}.v28view{display:none}.v28view.active{display:block}.v28hero{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.v28metric{min-height:96px}.v28metric .v{font-size:22px;font-weight:900;margin-top:7px}.v28two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v28list{display:grid;gap:7px}.v28row{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #2a3141;padding:11px 0}.v28row:last-child{border-bottom:0}.v28match{padding:13px;border:1px solid #2a3141;border-radius:12px;background:#0f131c}.v28match .teams{font-size:14px;font-weight:900}.v28reason{font-size:11px;color:#9aa3b7;line-height:1.5}.v28tag{font-size:9px;font-weight:900;padding:5px 8px;border-radius:999px;background:#202636}.v28empty{text-align:center;padding:28px 10px;color:#9aa3b7}.v28sectionHead{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.v28primary{width:100%;min-height:44px}.v28subnav{display:flex;gap:7px;overflow:auto;margin:8px 0}.v28subnav button{min-width:112px}@media(max-width:760px){.v28hero{grid-template-columns:repeat(2,1fr)}.v28two{grid-template-columns:1fr}.v28tabs button{min-width:108px}}`;
    d.head.appendChild(s);
  }

  function mount() {
    hideLegacy(); installStyle();
    let root=d.getElementById('fantasyV28');
    if(root) return root;
    root=d.createElement('section'); root.id='fantasyV28'; root.className='card';
    root.innerHTML=`<div class="v28tabs"><button class="active" data-tab="resumen">🏠 Resumen</button><button data-tab="cerebro">🧠 Cerebro</button><button data-tab="equipo">👥 Equipo</button><button data-tab="partidos">📅 Partidos</button><button data-tab="mercado">💰 Mercado</button><button data-tab="liga">🏆 Liga</button></div><section class="v28view active" data-view="resumen"><div class="v28hero"><div class="card v28metric"><div class="label">Posición</div><div class="v" id="v28Rank">—</div></div><div class="card v28metric"><div class="label">PFSY</div><div class="v" id="v28Points">—</div></div><div class="card v28metric"><div class="label">Efectivo</div><div class="v" id="v28Cash">—</div></div><div class="card v28metric"><div class="label">Plantilla</div><div class="v" id="v28Squad">—</div></div></div><div class="v28two" style="margin-top:12px"><div class="card"><div class="label">CONEXIÓN</div><h3 id="v28Conn" style="margin:5px 0">Comprobando…</h3><div id="v28ConnText" class="v28reason">Datos LIVE de LALIGA.</div><button class="primary v28primary" id="v28Connect" style="margin-top:9px">Conectar / actualizar</button></div><div class="card"><div class="label">DECISIÓN</div><h3 id="v28Decision" style="margin:5px 0">Esperando datos</h3><div id="v28DecisionText" class="v28reason">El cerebro seleccionará la acción con mayor confianza.</div></div></div></section><section class="v28view" data-view="cerebro"><div class="v28two"><div class="card"><div class="label">MEJOR JUGADOR</div><h3 id="v28Best">N/D</h3><div id="v28BestText" class="v28reason">Sin datos.</div></div><div class="card"><div class="label">MEJOR OPORTUNIDAD DE MERCADO</div><h3 id="v28BestMarket">N/D</h3><div id="v28BestMarketText" class="v28reason">Sin mercado.</div></div></div><div class="card"><div class="label">MAYOR RIESGO</div><h3 id="v28Risk">N/D</h3><div id="v28RiskText" class="v28reason">Sin datos.</div></div><div class="card"><div class="label">CÓMO DECIDE</div><div class="v28reason">Rendimiento · disponibilidad · próximo rival · mercado · riesgo. La confianza disminuye cuando faltan datos.</div></div></section><section class="v28view" data-view="equipo"><div class="v28sectionHead"><h3>👥 Mi equipo</h3><span id="v28TeamState" class="v28tag">N/D</span></div><div id="v28SquadList" class="v28list"><div class="v28empty">Conecta tu cuenta para ver la plantilla.</div></div></section><section class="v28view" data-view="partidos"><div class="v28sectionHead"><h3>📅 Calendario de partidos</h3><button id="v28RefreshFixtures" class="primary">Actualizar</button></div><div id="v28FixtureStatus" class="v28reason" style="margin:7px 0 10px">Cargando calendario…</div><div id="v28Fixtures" class="v28list"></div></section><section class="v28view" data-view="mercado"><div class="v28sectionHead"><h3>💰 Mercado LIVE</h3><span id="v28MarketState" class="v28tag">N/D</span></div><div id="v28Market" class="v28list"><div class="v28empty">Conecta tu cuenta para cargar el mercado.</div></div></section><section class="v28view" data-view="liga"><div class="card"><h3>🏆 Clasificación</h3><div id="v28League" class="v28list"><div class="v28empty">Conecta tu cuenta para cargar la liga.</div></div></div></section>`;
    d.querySelector('.app')?.appendChild(root);
    root.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => { root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));root.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v.dataset.view===btn.dataset.tab)); }));
    root.querySelector('#v28RefreshFixtures')?.addEventListener('click',loadFixtures);
    root.querySelector('#v28Connect')?.addEventListener('click',()=>{ if(w.LALIGA_CONNECTION?.sync) void w.LALIGA_CONNECTION.sync('manual-v28'); else w.location.assign('/auth/start?platform=ios'); });
    return root;
  }

  const set = (id,v) => { const n=d.getElementById(id); if(n)n.textContent=text(v); };

  function renderFixtures() {
    const node=d.getElementById('v28Fixtures'); if(!node)return;
    if(!state.fixtures.length){node.innerHTML='<div class="v28empty">No hay próximos partidos disponibles.</div>';return;}
    node.innerHTML=state.fixtures.slice(0,40).map(m=>{const dt=dateParts(m.utcDate);return `<div class="v28match"><div class="teams">${esc(m.home)} — ${esc(m.away)}</div><div class="tiny">${esc(dt.date)} · ${esc(dt.time)}${m.matchday?` · Jornada ${esc(m.matchday)}`:''}</div><div class="tiny">${esc((m.sources||[m.source]).join(' · '))}</div></div>`}).join('');
  }

  async function loadFixtures() {
    const status=d.getElementById('v28FixtureStatus'); if(status)status.textContent='Consultando calendario unificado…';
    try {
      const r=await fetch('/api/fixtures',{credentials:'include',cache:'no-store'}); const p=await r.json().catch(()=>({}));
      const matches=normalizeFixtures(p);
      if(!matches.length)throw new Error('EMPTY_CALENDAR');
      state.fixtures=matches; state.fixtureSource=p.primaryProvider||'multi-proveedor';
      renderFixtures(); if(status)status.textContent=`${matches.length} partidos cargados · fuente ${state.fixtureSource}`;
      window.dispatchEvent(new CustomEvent('fantasy:fixtures-updated',{detail:{fixtures:matches,source:state.fixtureSource}}));
    }catch(error){
      try{const r=await fetch('/official-fixtures-seed-2026-27.json',{cache:'no-store'});const p=await r.json();const matches=normalizeFixtures(p);state.fixtures=matches.filter(m=>new Date(m.utcDate).getTime()>=Date.now()-3600000);state.fixtureSource='LALIGA oficial · respaldo verificado';renderFixtures();if(status)status.textContent=`${state.fixtures.length} partidos · ${state.fixtureSource}`;}
      catch(seedError){state.fixtures=[];renderFixtures();if(status)status.textContent=`Calendario no disponible (${seedError.message||error.message})`;}
    }
  }

  function renderDashboard() {
    const payload=state.dashboard;if(!payload)return;
    const profile=payload.profile||{};const standing=arr(payload.standing);const mine=standing.find(r=>String(r.userId??r.id)===String(profile.id??profile.userId))||standing.find(r=>text(r.username??r.managerName??r.name).toLowerCase()===text(profile.username??profile.name??'').toLowerCase());const team=payload.team?.data??payload.team??{};const budget=payload.budget?.data??payload.budget??{};const model=BRAIN.analyze({dashboard:payload,fixtures:state.fixtures});
    set('v28Rank',mine?.rank??mine?.position??'—');set('v28Points',mine?.points??mine?.pfsy??team?.points??'—');set('v28Cash',money(budget.cash??budget.money??budget.balance??budget.available??budget.budget));set('v28Squad',String(model.players.length||'—'));set('v28TeamState',model.players.length?`${model.players.length} jugadores`:'Sin datos');
    const best=model.best,bm=model.bestMarket,risk=model.risk;set('v28Decision',best?`${best.recommendation} · ${best.name}`:'N/D');set('v28DecisionText',best?`Score ${best.score}/100 · confianza ${best.confidence}% · ${best.fixture.label}`:'Sin datos suficientes.');set('v28Best',best?.name||'N/D');set('v28BestText',best?`Score ${best.score} · ${best.position} · próximo: ${best.fixture.label}`:'Sin datos.');set('v28BestMarket',bm?.name||'N/D');set('v28BestMarketText',bm?`${bm.recommendation} · score ${bm.score} · ${money(bm.price)}`:'Sin mercado.');set('v28Risk',risk?.name||'N/D');set('v28RiskText',risk?`Rotación ${Math.round(risk.rotationRisk)}% · riesgo físico ${Math.round(risk.injuryRisk)}%`:'Sin datos.');set('v28Conn','✅ LALIGA conectada · LIVE');set('v28ConnText',`Datos oficiales cargados · última actualización ${new Intl.DateTimeFormat('es-ES',{timeStyle:'medium'}).format(new Date())}`);set('v28MarketState',model.market.length?`${model.market.length} anuncios`:'Sin anuncios');
    const squad=d.getElementById('v28SquadList');if(squad)squad.innerHTML=model.players.length?model.players.slice(0,40).map(p=>`<div class="v28row"><div><b>${esc(p.name)}</b><div class="tiny">${esc(p.position)} · Score ${p.score} · ${esc(p.fixture.label)}</div></div><span class="v28tag">${esc(p.recommendation)}</span></div>`).join(''):'<div class="v28empty">Plantilla no disponible.</div>';
    const market=d.getElementById('v28Market');if(market)market.innerHTML=model.market.length?model.market.slice(0,30).map(m=>`<div class="v28row"><div><b>${esc(m.name||'Jugador')}</b><div class="tiny">${money(m.price)} · Valor ${money(m.value)}</div></div><span class="v28tag">${esc(m.recommendation)}</span></div>`).join(''):'<div class="v28empty">No hay anuncios legibles en el estado actual.</div>';
    const league=d.getElementById('v28League');if(league)league.innerHTML=standing.length?standing.slice(0,20).map(r=>`<div class="v28row"><div><b>#${esc(r.rank??r.position??'—')} · ${esc(r.username??r.managerName??r.name??'Manager')}</b></div><span class="v28tag">${esc(r.points??r.pfsy??r.score??'—')} PFSY</span></div>`).join(''):'<div class="v28empty">Clasificación no disponible.</div>';
  }

  async function loadDashboard() {
    try { const s=await (await fetch('/api/session',{credentials:'include',cache:'no-store'})).json(); if(!s.authenticated){set('v28Conn','⚠️ Cuenta no conectada');set('v28ConnText','Pulsa conectar para usar datos oficiales.');set('v28MarketState','No conectada');return;} const r=await fetch('/api/fantasy/dashboard',{credentials:'include',cache:'no-store'});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||`HTTP_${r.status}`);state.dashboard=p;state.loadedAt=new Date();w.__laligaLiveDashboard=p;w.dispatchEvent(new CustomEvent('laliga:live-data',{detail:p}));renderDashboard();} catch(e){set('v28Conn','⚠️ Sin conexión LIVE');set('v28ConnText',e.message||'No se pudieron cargar los datos.');}
  }

  function observeLegacy(){const root=d.documentElement;if(!root)return;const observer=new MutationObserver(()=>hideLegacy());observer.observe(root,{childList:true,subtree:true});}

  async function boot(){mount();observeLegacy();await loadFixtures();await loadDashboard();renderDashboard();}

  w.FANTASY_APP_V28=Object.freeze({version:VERSION,state,BRAIN,mount,loadFixtures,loadDashboard,renderDashboard,normalizeFixtures});
  w.addEventListener('pageshow',()=>void loadDashboard());
  w.addEventListener('focus',()=>void loadDashboard());
  d.addEventListener('visibilitychange',()=>{if(d.visibilityState==='visible')void loadDashboard()});
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',()=>void boot(),{once:true});else void boot();
})();
