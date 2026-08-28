(() => {
  'use strict';

  const VERSION = '2.13.0';
  const OFFICIAL_SOURCE = 'LALIGA oficial';
  const SEED_URL = '/official-fixtures-seed-2026-27.json';
  const state = {
    dashboard: null,
    fixtures: [],
    authenticated: false,
    fixtureMode: 'seed',
    lastFixtureUpdate: null,
    activeTab: 'inicio'
  };

  const w = window;
  const d = document;
  let refreshTimer = null;
  let mounted = false;

  const text = v => String(v ?? '').trim();
  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const esc = v => text(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr = v => Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : Array.isArray(v?.items) ? v.items : Array.isArray(v?.content) ? v.content : [];
  const money = v => num(v) == null ? '—' : new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(Number(v)) + ' €';
  const norm = v => text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(fc|cf|sd|ud|real|club|rcd|ca|deportivo)\b/g,'').replace(/[^a-z0-9]/g,'');

  function dateParts(iso) {
    const dt = new Date(iso);
    if (!Number.isFinite(dt.getTime())) return { date:'N/D', time:'N/D', dayKey:'invalid' };
    return {
      date: new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'Europe/Madrid'}).format(dt),
      time: new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Madrid'}).format(dt),
      dayKey: new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Madrid'}).format(dt)
    };
  }

  function scoreValue(v) {
    if (v == null) return null;
    if (typeof v === 'object') return num(v.value ?? v.goals ?? v.score);
    return num(v);
  }

  function pickScore(match, side) {
    const sideObj = match?.[side === 'home' ? 'homeTeam' : 'awayTeam'];
    const candidates = side === 'home'
      ? [match.homeScore, match.homeGoals, match.home?.score, match.score?.home, match.score?.fullTime?.home, match.score?.current?.home, match.goals?.home, sideObj?.score, sideObj?.goals]
      : [match.awayScore, match.awayGoals, match.away?.score, match.score?.away, match.score?.fullTime?.away, match.score?.current?.away, match.goals?.away, sideObj?.score, sideObj?.goals];
    for (const value of candidates) {
      const n = scoreValue(value);
      if (n != null) return n;
    }
    return null;
  }

  function normalizeStatus(raw, homeScore, awayScore, utcDate) {
    const s = text(raw).toUpperCase();
    if (['FT','AET','PEN','FINISHED','FINALIZADO','FINAL'].includes(s)) return 'FINALIZADO';
    if (['HT','HALF_TIME','DESCANSO'].includes(s)) return 'DESCANSO';
    if (['1H','2H','LIVE','IN_PLAY','PLAYING','ET','P','Q1','Q2','Q3','Q4'].includes(s)) return 'EN DIRECTO';
    if (homeScore != null || awayScore != null) return 'EN DIRECTO';
    if (['CANC','CAN','CANCELLED','CANCELADO'].includes(s)) return 'CANCELADO';
    if (['PST','POSTPONED','APLAZADO'].includes(s)) return 'APLAZADO';
    if (new Date(utcDate).getTime() < Date.now() - 3 * 3600000) return 'FINALIZADO';
    return 'PRÓXIMO';
  }

  function normalizeFixture(m, fallbackSource = OFFICIAL_SOURCE) {
    const utcDate = text(m?.utcDate ?? m?.date ?? m?.startDate ?? m?.starting_at);
    const home = text(m?.home ?? m?.homeTeam?.name ?? m?.home?.name ?? m?.localTeam?.name);
    const away = text(m?.away ?? m?.awayTeam?.name ?? m?.away?.name ?? m?.visitorTeam?.name);
    const homeScore = pickScore(m,'home');
    const awayScore = pickScore(m,'away');
    return {
      id: text(m?.id ?? m?.fixtureId ?? `${home}-${away}-${utcDate}`),
      utcDate,
      home,
      away,
      homeTeam: m?.homeTeam ?? {id:m?.homeTeamId ?? null,name:home},
      awayTeam: m?.awayTeam ?? {id:m?.awayTeamId ?? null,name:away},
      status: normalizeStatus(m?.status ?? m?.fixture?.status?.short ?? m?.state?.short_name,homeScore,awayScore,utcDate),
      rawStatus: text(m?.status ?? m?.fixture?.status?.short ?? m?.state?.short_name),
      matchday: m?.officialMatchday ?? m?.matchday ?? m?.round?.matchday ?? null,
      round: text(m?.round ?? m?.league?.round),
      homeScore,
      awayScore,
      source: fallbackSource,
      sources: [OFFICIAL_SOURCE]
    };
  }

  function normalizeFixtures(payload) {
    const raw = Array.isArray(payload?.fixtures) ? payload.fixtures
      : Array.isArray(payload?.matches) ? payload.matches
      : Array.isArray(payload?.calendar) ? payload.calendar
      : Array.isArray(payload?.data?.fixtures) ? payload.data.fixtures
      : Array.isArray(payload?.data?.matches) ? payload.data.matches
      : arr(payload);
    const map = new Map();
    for (const item of raw) {
      const f = normalizeFixture(item);
      if (!f.home || !f.away || !f.utcDate) continue;
      const key = `${new Date(f.utcDate).getTime()}|${norm(f.home)}|${norm(f.away)}`;
      const previous = map.get(key);
      if (!previous || (previous.homeScore == null && f.homeScore != null) || previous.status === 'PRÓXIMO' && f.status !== 'PRÓXIMO') map.set(key,f);
    }
    return [...map.values()].sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
  }

  function officialWeek(dashboard, fallbackFixtures) {
    const candidates = [dashboard?.week?.weekNumber,dashboard?.week?.number,dashboard?.week?.matchday,dashboard?.week?.currentWeek,dashboard?.week?.week?.number];
    for (const value of candidates) if (num(value) != null) return Math.trunc(num(value));
    const future = fallbackFixtures.filter(f=>new Date(f.utcDate) >= new Date(Date.now()-6*3600000));
    const matchdays = future.map(f=>num(f.matchday)).filter(v=>v != null).sort((a,b)=>a-b);
    return matchdays[0] ?? 3;
  }

  async function jsonFetch(url) {
    const r = await fetch(url,{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
    const body = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(body?.error || `HTTP_${r.status}`);
    return body;
  }

  async function loadSeed() {
    const payload = await jsonFetch(SEED_URL);
    const matches = normalizeFixtures(payload);
    if (!matches.length) throw new Error('OFFICIAL_SEED_EMPTY');
    return matches;
  }

  async function loadOfficialCalendar() {
    const seed = await loadSeed();
    try {
      const session = await jsonFetch('/api/session');
      state.authenticated = Boolean(session.authenticated);
    } catch {
      state.authenticated = false;
    }

    if (!state.authenticated) {
      state.fixtureMode = 'seed';
      return seed.filter(f=>new Date(f.utcDate).getTime() >= Date.now()-2*3600000);
    }

    const week = officialWeek(state.dashboard || {}, seed);
    try {
      const live = await jsonFetch(`/api/fantasy/fixtures?week=${encodeURIComponent(week)}`);
      const officialMatches = normalizeFixtures(live);
      if (officialMatches.length) {
        state.fixtureMode = 'official-live';
        return officialMatches;
      }
    } catch {
      // El respaldo oficial sigue siendo válido para el calendario estático.
    }

    state.fixtureMode = 'seed';
    return seed.filter(f=>new Date(f.utcDate).getTime() >= Date.now()-2*3600000);
  }

  function isLive(f) { return f.status === 'EN DIRECTO' || f.status === 'DESCANSO'; }
  function isFinished(f) { return f.status === 'FINALIZADO'; }

  function relevantFixtures(limit=50) {
    return state.fixtures.filter(f=>new Date(f.utcDate).getTime() >= Date.now()-6*3600000).slice(0,limit);
  }

  function hideLegacy() {
    d.querySelectorAll('.app > *').forEach(node => {
      if (node.id !== 'officialFantasyApp') node.style.setProperty('display','none','important');
    });
    d.querySelectorAll('.nav,.panel,#fantasyV28').forEach(node => node.style.setProperty('display','none','important'));
  }

  function installStyles() {
    if (d.getElementById('officialFantasyV213Style')) return;
    const style = d.createElement('style');
    style.id = 'officialFantasyV213Style';
    style.textContent = `
      #officialFantasyApp{margin:0 auto;max-width:1240px;padding:4px 0 40px}
      #officialFantasyApp *{box-sizing:border-box}
      .ofTop{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:14px}
      .ofTitle{font-size:24px;font-weight:950;line-height:1.05}.ofSub{margin-top:5px;color:#9aa3b7;font-size:12px}
      .ofBadge{padding:9px 12px;border-radius:999px;background:#171c28;border:1px solid #2a3141;font-size:10px;font-weight:900;white-space:nowrap}
      .ofTabs{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;position:sticky;top:0;z-index:10;padding:5px 0 12px;background:rgba(8,11,18,.96);backdrop-filter:blur(12px)}
      .ofTabs button{min-height:62px;font-size:13px;font-weight:950;border:1px solid #31394b;background:#161b27;border-radius:14px}
      .ofTabs button.active{background:#ff454c;border-color:#ff454c}
      .ofView{display:none}.ofView.active{display:block}
      .ofGrid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.ofGrid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .ofCard{background:#131722;border:1px solid #2a3141;border-radius:16px;padding:14px;margin-bottom:12px}.ofCard h3{margin:0 0 9px}
      .ofMetric{min-height:104px}.ofLabel{font-size:9px;color:#9aa3b7;text-transform:uppercase;letter-spacing:.5px}.ofValue{font-size:23px;font-weight:950;margin-top:8px}
      .ofButton{width:100%;min-height:56px;font-size:14px;font-weight:950;border-radius:13px;border:0}.ofButton.primary{background:#ff454c}.ofButton.secondary{background:#202636}
      .ofList{display:grid;gap:8px}.ofRow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #2a3141}.ofRow:last-child{border-bottom:0}
      .ofMuted{color:#9aa3b7;font-size:11px;line-height:1.5}.ofTag{display:inline-flex;padding:5px 8px;border-radius:999px;background:#202636;font-size:9px;font-weight:900}.ofGreen{color:#2bd888}.ofYellow{color:#ffd166}.ofRed{color:#ff727b}
      .ofMatch{display:grid;grid-template-columns:1.15fr auto 1.15fr;gap:12px;align-items:center;padding:14px;border:1px solid #2a3141;background:#0f131c;border-radius:14px}.ofTeam{font-size:15px;font-weight:950}.ofAway{text-align:right}.ofScore{font-size:27px;font-weight:950;white-space:nowrap;text-align:center}.ofMeta{text-align:center;margin-top:4px;font-size:9px;color:#9aa3b7}.ofLive{color:#ff727b}.ofFinal{color:#2bd888}.ofNext{color:#9aa3b7}
      .ofDay{margin:16px 0 8px;font-size:11px;font-weight:950;text-transform:uppercase;color:#9aa3b7;letter-spacing:.7px}
      .ofHeroMatch{border:1px solid #3a4355;background:linear-gradient(135deg,#171d2c,#10141d)}
      .ofHeroMatch .ofMatch{border:0;background:transparent;padding:0}.ofHeroScore{font-size:32px}
      .ofEmpty{text-align:center;padding:30px 15px;color:#9aa3b7}
      .ofNotice{padding:10px 12px;border-radius:11px;background:#171c28;border:1px solid #2a3141;font-size:11px;margin-bottom:12px}
      .ofSectionHead{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.ofSectionHead h2{margin:0;font-size:19px}
      .ofSmallButton{min-height:48px;padding:10px 14px;border-radius:12px;font-weight:900}
      .ofScoreLine{font-size:11px;color:#9aa3b7}.ofScoreStrong{font-weight:950;color:#fff}
      @media(max-width:900px){.ofTabs{grid-template-columns:repeat(3,1fr)}.ofGrid4{grid-template-columns:repeat(2,1fr)}.ofGrid2{grid-template-columns:1fr}}
      @media(max-width:560px){.ofTabs{grid-template-columns:repeat(2,1fr)}.ofTop{flex-direction:column}.ofBadge{align-self:flex-start}.ofMatch{grid-template-columns:1fr auto 1fr;gap:7px}.ofTeam{font-size:13px}.ofScore{font-size:23px}.ofGrid4{grid-template-columns:1fr 1fr}}
    `;
    d.head.appendChild(style);
  }

  function root() {
    let el = d.getElementById('officialFantasyApp');
    if (el) return el;
    const app = d.querySelector('.app') || d.body;
    el = d.createElement('main');
    el.id = 'officialFantasyApp';
    app.appendChild(el);
    return el;
  }

  function fixtureCard(f, hero=false) {
    const dt = dateParts(f.utcDate);
    const live = isLive(f), finished = isFinished(f);
    const score = f.homeScore != null || f.awayScore != null ? `${f.homeScore ?? 0} - ${f.awayScore ?? 0}` : '—';
    const statusClass = live ? 'ofLive' : finished ? 'ofFinal' : 'ofNext';
    const status = live ? '● EN DIRECTO' : finished ? 'FINALIZADO' : f.status;
    return `<div class="of${hero ? 'HeroMatch' : ''}"><div class="ofMatch">
      <div><div class="ofTeam">${esc(f.home)}</div></div>
      <div><div class="ofScore ${hero ? 'ofHeroScore' : ''}">${esc(score)}</div><div class="ofMeta ${statusClass}">${esc(status)}</div><div class="ofMeta">${esc(dt.time)}</div></div>
      <div class="ofAway"><div class="ofTeam">${esc(f.away)}</div></div>
    </div></div>`;
  }

  function renderHome() {
    const future = relevantFixtures(3);
    const live = state.fixtures.filter(isLive).slice(0,3);
    const next = live[0] || future[0];
    const dashboard = state.dashboard || {};
    const profile = dashboard.profile || {};
    const standing = arr(dashboard.standing);
    const mine = standing.find(r => String(r.userId ?? r.id) === String(profile.id ?? profile.userId)) || standing.find(r => text(r.username ?? r.managerName ?? r.name).toLowerCase() === text(profile.username ?? profile.name ?? '').toLowerCase());
    const team = dashboard.team?.data ?? dashboard.team ?? {};
    const players = arr(team.players).length ? arr(team.players) : arr(team.squad);
    return `<section class="ofView active" data-view="inicio">
      <div class="ofGrid4">
        <div class="ofCard ofMetric"><div class="ofLabel">Posición</div><div class="ofValue">${esc(mine?.rank ?? mine?.position ?? '—')}</div></div>
        <div class="ofCard ofMetric"><div class="ofLabel">PFSY</div><div class="ofValue">${esc(mine?.points ?? mine?.pfsy ?? team.points ?? '—')}</div></div>
        <div class="ofCard ofMetric"><div class="ofLabel">Plantilla</div><div class="ofValue">${players.length || '—'}</div></div>
        <div class="ofCard ofMetric"><div class="ofLabel">Calendario</div><div class="ofValue">${state.fixtures.length}</div></div>
      </div>
      <div class="ofGrid2">
        <div class="ofCard ofHeroMatch"><div class="ofSectionHead"><h3>${live.length ? '🔴 Partido en directo' : '📅 Próximo partido'}</h3><span class="ofTag">${esc(OFFICIAL_SOURCE)}</span></div>${next ? fixtureCard(next,true) : '<div class="ofEmpty">No hay partidos cargados.</div>'}</div>
        <div class="ofCard"><h3>🔐 Conexión oficial</h3><div class="ofMuted">${state.authenticated ? 'Cuenta LALIGA conectada. El panel usa datos oficiales.' : 'Conecta tu cuenta para recibir calendario y marcadores oficiales cuando la sesión los permita.'}</div><button id="ofConnect" class="ofButton ${state.authenticated ? 'secondary' : 'primary'}" style="margin-top:10px">${state.authenticated ? 'Actualizar datos' : 'Conectar con LALIGA'}</button></div>
      </div>
      <div class="ofCard"><div class="ofSectionHead"><h3>📅 Calendario</h3><button id="ofGoCalendar" class="ofSmallButton">Ver calendario completo</button></div><div class="ofList" style="margin-top:8px">${future.map(fixtureCard).join('') || '<div class="ofEmpty">No hay próximos partidos.</div>'}</div></div>
    </section>`;
  }

  function renderBrain() {
    const brain = w.FANTASY_BRAIN_V28;
    const model = brain?.analyze ? brain.analyze({dashboard:state.dashboard || {},fixtures:state.fixtures}) : null;
    const best = model?.best;
    const market = model?.bestMarket;
    const risk = model?.risk;
    return `<section class="ofView" data-view="cerebro">
      <div class="ofGrid2">
        <div class="ofCard"><div class="ofLabel">MEJOR JUGADOR</div><div class="ofValue">${esc(best?.name || 'N/D')}</div><div class="ofMuted">${best ? `${esc(best.recommendation)} · score ${best.score}/100 · confianza ${best.confidence}% · ${esc(best.fixture?.label || 'Sin rival')}` : 'Conecta la cuenta para analizar tu plantilla.'}</div></div>
        <div class="ofCard"><div class="ofLabel">MEJOR OPORTUNIDAD</div><div class="ofValue">${esc(market?.name || 'N/D')}</div><div class="ofMuted">${market ? `${esc(market.recommendation)} · ${money(market.price)}` : 'Mercado no disponible.'}</div></div>
      </div>
      <div class="ofCard"><div class="ofLabel">MAYOR RIESGO</div><div class="ofValue">${esc(risk?.name || 'N/D')}</div><div class="ofMuted">${risk ? `Rotación ${Math.round(risk.rotationRisk)}% · riesgo físico ${Math.round(risk.injuryRisk)}%` : 'Sin datos.'}</div></div>
      <div class="ofCard"><h3>Cómo decide el cerebro</h3><div class="ofMuted">Rendimiento · disponibilidad · próximo partido · señal de mercado · riesgo. Los datos del calendario proceden únicamente de LALIGA oficial y se reutilizan directamente aquí.</div></div>
    </section>`;
  }

  function renderTeam() {
    const brain = w.FANTASY_BRAIN_V28;
    const model = brain?.analyze ? brain.analyze({dashboard:state.dashboard || {},fixtures:state.fixtures}) : null;
    const players = model?.players || [];
    return `<section class="ofView" data-view="equipo"><div class="ofCard"><div class="ofSectionHead"><h2>👥 Mi equipo</h2><span class="ofTag">${players.length} jugadores</span></div><div class="ofList" style="margin-top:6px">${players.length ? players.slice(0,40).map(p=>`<div class="ofRow"><div><b>${esc(p.name)}</b><div class="ofMuted">${esc(p.position)} · ${esc(p.fixture?.label || 'Sin rival')}</div></div><span class="ofTag">${esc(p.recommendation)}</span></div>`).join('') : '<div class="ofEmpty">Conecta la cuenta para mostrar la plantilla.</div>'}</div></div></section>`;
  }

  function renderCalendar() {
    const relevant = relevantFixtures(60);
    const groups = new Map();
    for (const f of relevant) {
      const key = dateParts(f.utcDate).dayKey;
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(f);
    }
    const body = [...groups.entries()].map(([key, games])=>{
      const label = dateParts(games[0].utcDate).date;
      return `<div class="ofDay">${esc(label)}</div>${games.map(fixtureCard).join('')}`;
    }).join('');
    return `<section class="ofView" data-view="partidos"><div class="ofCard"><div class="ofSectionHead"><h2>📅 Calendario de partidos</h2><button id="ofRefresh" class="ofSmallButton">Actualizar</button></div><div class="ofNotice" style="margin-top:10px">Fuente única: <b>${esc(OFFICIAL_SOURCE)}</b> · ${state.fixtureMode === 'official-live' ? 'datos oficiales de sesión' : 'calendario oficial verificado'}${state.lastFixtureUpdate ? ` · actualizado ${esc(state.lastFixtureUpdate)}` : ''}</div>${body || '<div class="ofEmpty">No hay partidos para mostrar.</div>'}</div></section>`;
  }

  function renderMarket() {
    const brain = w.FANTASY_BRAIN_V28;
    const model = brain?.analyze ? brain.analyze({dashboard:state.dashboard || {},fixtures:state.fixtures}) : null;
    const rows = model?.market || [];
    return `<section class="ofView" data-view="mercado"><div class="ofCard"><div class="ofSectionHead"><h2>💰 Mercado</h2><span class="ofTag">${rows.length} oportunidades</span></div><div class="ofList" style="margin-top:7px">${rows.length ? rows.slice(0,30).map(x=>`<div class="ofRow"><div><b>${esc(x.name || 'Jugador')}</b><div class="ofMuted">${money(x.price)} · Valor ${money(x.value)}</div></div><span class="ofTag">${esc(x.recommendation)}</span></div>`).join('') : '<div class="ofEmpty">No hay mercado disponible.</div>'}</div></div></section>`;
  }

  function renderLeague() {
    const standing = arr(state.dashboard?.standing);
    return `<section class="ofView" data-view="liga"><div class="ofCard"><h2>🏆 Liga</h2><div class="ofList">${standing.length ? standing.slice(0,30).map(r=>`<div class="ofRow"><b>#${esc(r.rank ?? r.position ?? '—')} · ${esc(r.username ?? r.managerName ?? r.name ?? 'Manager')}</b><span class="ofTag">${esc(r.points ?? r.pfsy ?? r.score ?? '—')}</span></div>`).join('') : '<div class="ofEmpty">Clasificación no disponible.</div>'}</div></div></section>`;
  }

  function render() {
    const el = root();
    const sections = [renderHome(),renderBrain(),renderTeam(),renderCalendar(),renderMarket(),renderLeague()].join('');
    el.innerHTML = `<div class="ofTop"><div><div class="ofTitle">⚽ LALIGA Fantasy</div><div class="ofSub">Panel simplificado · fuente única oficial · v${VERSION}</div></div><div class="ofBadge">${state.authenticated ? '🟢 LALIGA LIVE' : '⚪ CALENDARIO OFICIAL'}</div></div><div class="ofTabs"><button data-tab="inicio" class="${state.activeTab==='inicio'?'active':''}">🏠 Inicio</button><button data-tab="cerebro" class="${state.activeTab==='cerebro'?'active':''}">🧠 Cerebro</button><button data-tab="equipo" class="${state.activeTab==='equipo'?'active':''}">👥 Equipo</button><button data-tab="partidos" class="${state.activeTab==='partidos'?'active':''}">📅 Partidos</button><button data-tab="mercado" class="${state.activeTab==='mercado'?'active':''}">💰 Mercado</button><button data-tab="liga" class="${state.activeTab==='liga'?'active':''}">🏆 Liga</button></div>${sections}`;

    el.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{state.activeTab=btn.dataset.tab;render();}));
    el.querySelector('#ofRefresh')?.addEventListener('click',()=>loadAndRender(true));
    el.querySelector('#ofConnect')?.addEventListener('click',()=>w.location.assign('/auth/start?platform=ios'));
    el.querySelector('#ofGoCalendar')?.addEventListener('click',()=>{state.activeTab='partidos';render();});
  }

  async function loadDashboard() {
    try {
      const session = await jsonFetch('/api/session');
      state.authenticated = Boolean(session.authenticated);
      if (!state.authenticated) { state.dashboard = null; return; }
      const data = await jsonFetch('/api/fantasy/dashboard');
      state.dashboard = data;
      w.__officialFantasyLive = data;
      w.dispatchEvent(new CustomEvent('laliga:live-data',{detail:data}));
    } catch {
      state.dashboard = null;
    }
  }

  async function loadAndRender(force=false) {
    if (force) state.lastFixtureUpdate = null;
    await loadDashboard();
    try {
      state.fixtures = await loadOfficialCalendar();
    } catch {
      state.fixtures = [];
    }
    state.lastFixtureUpdate = new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Madrid'}).format(new Date());
    render();
    scheduleRefresh();
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    const live = state.fixtures.some(isLive);
    refreshTimer = setTimeout(()=>loadAndRender(true),live ? 30000 : 300000);
  }

  function boot() {
    if (mounted) return;
    mounted = true;
    hideLegacy();
    installStyles();
    loadAndRender();
  }

  w.addEventListener('laliga:live-data',e=>{ if (e?.detail) { state.dashboard=e.detail; state.authenticated=true; render(); } });
  w.reloadUnifiedCalendar = () => loadAndRender(true);
  w.OFFICIAL_LALIGA_UI_V213 = Object.freeze({ version:VERSION, state, normalizeFixtures, loadAndRender });

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
