(() => {
  'use strict';

  const state = window.state || null;
  let busy = false;
  let referenceData = null;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const money = value => value == null ? 'N/D' : new Intl.NumberFormat('es-ES').format(Number(value)) + ' €';

  function madridDate(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return { date: 'N/D', time: 'N/D' };
    return {
      date: new Intl.DateTimeFormat('es-ES', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        timeZone: 'Europe/Madrid'
      }).format(d),
      time: new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: 'Europe/Madrid'
      }).format(d)
    };
  }

  function normalizeMatches(payload) {
    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    return matches
      .filter(m => m?.home && m?.away && m?.utcDate)
      .map(m => ({
        id: String(m.id ?? ''),
        utcDate: m.utcDate,
        home: String(m.home),
        away: String(m.away),
        homeTeam: m.homeTeam || { id: m.homeTeamId ?? null, name: m.home },
        awayTeam: m.awayTeam || { id: m.awayTeamId ?? null, name: m.away },
        status: m.status || null,
        matchday: m.officialMatchday ?? m.matchday ?? null,
        round: m.round || null,
        source: m.source || payload?.source || payload?.primaryProvider || 'Proveedor',
        sources: Array.isArray(m.sources) ? m.sources : [m.source || payload?.source || payload?.primaryProvider || 'Proveedor']
      }));
  }

  function normalizeSeed(payload) {
    const matches = Array.isArray(payload?.fixtures) ? payload.fixtures : [];
    return matches.map(m => ({
      id: String(m.id ?? ''),
      utcDate: m.utcDate,
      home: m.home,
      away: m.away,
      homeTeam: { id: m.homeTeamId ?? null, name: m.home },
      awayTeam: { id: m.awayTeamId ?? null, name: m.away },
      status: m.status || 'TIMED',
      matchday: m.officialMatchday ?? m.matchday ?? null,
      round: m.round || null,
      source: 'LALIGA oficial (semilla verificada)',
      sources: ['LALIGA oficial (semilla verificada)']
    }));
  }

  function setStatus(html) {
    const node = document.getElementById('fixturesStatus');
    if (node) node.innerHTML = html;
  }

  function setCount(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function render(matches, meta = {}) {
    const container = document.getElementById('fixtures');
    if (!container) return;

    const ordered = matches.slice().sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
    if (!ordered.length) {
      container.innerHTML = '<div class="empty">No hay próximos partidos disponibles.</div>';
      setCount('officialCount', 0);
      setCount('probableCount', Array.isArray(window.state?.probableXIs) ? window.state.probableXIs.length : 0);
      setCount('unknownCount', 0);
      return;
    }

    container.innerHTML = ordered.map(game => {
      const dt = madridDate(game.utcDate);
      const providerNames = (game.sources || [game.source]).filter(Boolean).map(esc).join(' · ');
      const md = game.matchday == null ? '' : `Jornada ${esc(game.matchday)}`;
      const status = game.status && game.status !== 'NS' ? `<span class="pill">${esc(game.status)}</span>` : '';
      return `<div class="match"><div class="match-title">${esc(game.home)} — ${esc(game.away)}</div><div class="tiny">${esc(dt.date)} · ${esc(dt.time)}${md ? ` · ${md}` : ''}</div><div class="sourceTag">${providerNames}</div>${status ? `<div style="margin-top:6px">${status}</div>` : ''}</div>`;
    }).join('');

    const official = ordered.filter(g => String(g.source || '').toLowerCase().includes('laliga')).length;
    const probable = Array.isArray(window.state?.probableXIs) ? window.state.probableXIs.length : 0;
    setCount('officialCount', official);
    setCount('probableCount', probable);
    setCount('unknownCount', Math.max(0, ordered.length - official));

    if (meta.sourceLabel) {
      const counts = meta.providers || {};
      const detail = Object.entries(counts).filter(([, v]) => v && (v.ok || v.count)).map(([name, v]) => `${name}: ${v.count ?? 0}`).join(' · ');
      setStatus(`✅ ${ordered.length} partidos cargados · fuente principal: <b>${esc(meta.sourceLabel)}</b>${detail ? ` · ${esc(detail)}` : ''}`);
    }
  }

  async function loadSeed() {
    const response = await fetch('/official-fixtures-seed-2026-27.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`SEED_HTTP_${response.status}`);
    return normalizeSeed(await response.json());
  }

  function installReferenceStyles() {
    if (document.getElementById('recordingReferenceStyles')) return;
    const style = document.createElement('style');
    style.id = 'recordingReferenceStyles';
    style.textContent = `
      #videoReference{margin:12px 0;padding:12px;border:1px solid #2d3547;border-radius:14px;background:#111622}
      #videoReference .vrTabs{display:flex;gap:6px;overflow:auto;margin:10px 0;padding-bottom:3px}
      #videoReference .vrTabs button{cursor:pointer}
      #videoReference .vrTabs button.active{background:#ff454c}
      #videoReference .vrMetricGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
      #videoReference .vrMetric{background:#0e131d;border:1px solid #293243;border-radius:10px;padding:9px}
      #videoReference .vrMetric .vrValue{font-size:17px;font-weight:900;margin-top:3px}
      #videoReference .vrGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      #videoReference .vrCard{background:#0e131d;border:1px solid #293243;border-radius:10px;padding:10px}
      #videoReference .vrHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:7px}
      #videoReference .vrName{font-weight:900}
      #videoReference .vrPlayer{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #232b3a}
      #videoReference .vrPlayer:last-child{border-bottom:0}
      #videoReference .vrSmall{font-size:10px;color:#9aa3b7}
      #videoReference .vrMarketRow{display:grid;grid-template-columns:1.2fr .55fr .8fr .8fr;gap:7px;padding:8px 0;border-bottom:1px solid #232b3a;font-size:10px;align-items:center}
      #videoReference .vrMarketRow:last-child{border-bottom:0}
      #videoReference .vrActivity{padding:8px 0;border-bottom:1px solid #232b3a;font-size:10px;line-height:1.35}
      #videoReference .vrActivity:last-child{border-bottom:0}
      @media(max-width:700px){#videoReference .vrMetricGrid{grid-template-columns:repeat(2,1fr)}#videoReference .vrGrid{grid-template-columns:1fr}}
      @media(max-width:560px){#videoReference .vrMetric .vrValue{font-size:15px}}
    `;
    document.head.appendChild(style);
  }

  function visibleManagers() {
    return Array.isArray(referenceData?.standingsVisible) ? referenceData.standingsVisible : [];
  }

  function rosterRows(manager) {
    return Array.isArray(referenceData?.rostersVisible?.[manager]) ? referenceData.rostersVisible[manager] : [];
  }

  function playerRow(p) {
    const status = p.availability === 'Suspendido' ? '<span class="vrSmall" style="color:#ff727b">Suspendido</span>' : '<span class="vrSmall" style="color:#2bd888">Alineable</span>';
    const lock = p.lockDays ? ` · bloqueo ${esc(p.lockDays)}d` : '';
    return `<div class="vrPlayer"><div><div class="vrName">${esc(p.name)}${p.star ? ' ⭐' : ''}</div><div class="vrSmall">${esc(p.position)} · ${status}${lock} · ${money(p.price)}</div></div><b>${esc(p.pfsy)}</b></div>`;
  }

  function managerCard(manager) {
    const row = visibleManagers().find(x => x.manager === manager) || {};
    const players = rosterRows(manager);
    return `<div class="vrCard"><div class="vrHead"><div><div class="vrName">${esc(manager)}</div><div class="vrSmall">Valor ${money(row.teamValue)}</div></div><b>#${esc(row.rank ?? 'N/D')} · ${esc(row.pfsy ?? 'N/D')} PFSY</b></div>${players.length ? players.map(playerRow).join('') : '<div class="vrSmall">Sin jugadores legibles.</div>'}</div>`;
  }

  function renderReferenceView(view) {
    const body = document.getElementById('videoReferenceBody');
    if (!body || !referenceData) return;
    if (view === 'rivals') {
      body.innerHTML = `<div class="vrGrid">${visibleManagers().filter(x => x.manager !== 'roncazador').map(x => managerCard(x.manager)).join('')}</div>`;
      return;
    }
    if (view === 'market') {
      const rows = Array.isArray(referenceData.marketListings) ? referenceData.marketListings : [];
      body.innerHTML = `<div class="vrMetricGrid"><div class="vrMetric"><div class="label">Saldo mercado</div><div class="vrValue">${money(referenceData.snapshot?.marketBalance)}</div></div><div class="vrMetric"><div class="label">Recompensa</div><div class="vrValue">${money(referenceData.snapshot?.dailyReward)}</div></div><div class="vrMetric"><div class="label">Anuncios visibles</div><div class="vrValue">${rows.length}</div></div><div class="vrMetric"><div class="label">Jornada</div><div class="vrValue">J${esc(referenceData.snapshot?.matchdayAtStart ?? 'N/D')}</div></div></div><div class="vrCard"><div class="vrMarketRow" style="font-weight:800"><span>Jugador / dueño</span><span>PFSY</span><span>Valor</span><span>Precio</span></div>${rows.map(p => `<div class="vrMarketRow"><span><b>${esc(p.player)}</b><br><span class="vrSmall">${esc(p.owner)} · ${esc(p.status)} · ${esc(p.remainingDays)}d</span></span><span>${esc(p.pfsy)}</span><span>${money(p.value)}</span><span><b>${money(p.price)}</b></span></div>`).join('')}</div>`;
      return;
    }
    if (view === 'activity') {
      const rows = Array.isArray(referenceData.recentActivity) ? referenceData.recentActivity : [];
      body.innerHTML = `<div class="vrCard">${rows.map(item => `<div class="vrActivity"><b>${esc(item.type)}</b> <span class="vrSmall">${esc(item.date)}</span><br>${esc(item.manager)} ${esc(item.action || '')}${item.player ? ` · <b>${esc(item.player)}</b>` : ''}${item.amount != null ? ` · <b>${money(item.amount)}</b>` : ''}</div>`).join('')}</div>`;
      return;
    }
    const me = visibleManagers().find(x => x.manager === 'roncazador') || {};
    const players = rosterRows('roncazador');
    const visiblePfsy = players.reduce((sum, p) => sum + Number(p.pfsy || 0), 0);
    body.innerHTML = `<div class="vrMetricGrid"><div class="vrMetric"><div class="label">Posición</div><div class="vrValue">#${esc(me.rank ?? 'N/D')}</div></div><div class="vrMetric"><div class="label">PFSY</div><div class="vrValue">${esc(me.pfsy ?? 'N/D')}</div></div><div class="vrMetric"><div class="label">Valor</div><div class="vrValue">${money(referenceData.snapshot?.teamValue)}</div></div><div class="vrMetric"><div class="label">Plantilla</div><div class="vrValue">${esc(referenceData.snapshot?.teamCount ?? 'N/D')}</div></div></div><div class="vrCard"><div class="vrSmall" style="margin-bottom:4px">Inicio Jornada 3 · vie 28 · 19:00h · jugadores legibles del vídeo: ${players.length} · PFSY visible sumado: ${visiblePfsy}</div>${players.map(playerRow).join('')}</div>`;
  }

  async function renderVideoReference() {
    if (document.getElementById('videoReference')) return;
    try {
      const response = await fetch('/video-reference-snapshot-2026-08-27.json', { cache: 'no-store' });
      if (!response.ok) return;
      referenceData = await response.json();
      installReferenceStyles();
      const anchor = document.getElementById('fixtures') || document.getElementById('fixturesStatus');
      if (!anchor?.parentElement) return;
      const card = document.createElement('div');
      card.id = 'videoReference';
      card.innerHTML = `
        <div class="flex" style="justify-content:space-between;align-items:flex-start">
          <div><div style="font-weight:900;font-size:14px">📱 Datos reales observados en la app LALIGA</div><div class="vrSmall">Grabación del 27/08/2026 · referencia histórica, no LIVE</div></div>
          <span class="pill">Solo lectura</span>
        </div>
        <div class="vrTabs"><button type="button" class="active" data-vr="team">👤 Mi equipo</button><button type="button" data-vr="rivals">👥 Rivales</button><button type="button" data-vr="market">💰 Mercado</button><button type="button" data-vr="activity">📰 Actividad</button></div>
        <div id="videoReferenceBody"></div>`;
      anchor.parentElement.insertBefore(card, anchor);
      card.querySelectorAll('[data-vr]').forEach(button => button.addEventListener('click', () => {
        card.querySelectorAll('[data-vr]').forEach(x => x.classList.toggle('active', x === button));
        renderReferenceView(button.dataset.vr);
      }));
      renderReferenceView('team');
    } catch {
      // La referencia visual nunca bloquea el calendario.
    }
  }

  async function loadFixtures() {
    if (busy) return;
    busy = true;
    setStatus('⏳ Consultando API-Football y fuentes de respaldo…');
    try {
      const response = await fetch('/api/fixtures/next', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      const matches = normalizeMatches(payload);
      if (matches.length) {
        if (state) state.fixtures = matches.map(m => ({ date: madridDate(m.utcDate).date, time: madridDate(m.utcDate).time, home: m.home, away: m.away, round: m.matchday, status: m.status, source: m.source, sources: m.sources, utcDate: m.utcDate }));
        if (state) state.lastSync = new Date().toISOString();
        if (typeof window.saveState === 'function') window.saveState();
        render(matches, { sourceLabel: payload.primaryProvider || payload.source || 'multi-proveedor', providers: payload.providers || {} });
        return;
      }

      const seed = await loadSeed();
      const futureSeed = seed.filter(m => new Date(m.utcDate).getTime() >= Date.now() - 60 * 60 * 1000);
      if (state) state.fixtures = futureSeed.map(m => ({ date: madridDate(m.utcDate).date, time: madridDate(m.utcDate).time, home: m.home, away: m.away, round: m.matchday, status: m.status, source: m.source, sources: m.sources, utcDate: m.utcDate }));
      if (state) state.lastSync = new Date().toISOString();
      if (typeof window.saveState === 'function') window.saveState();
      render(futureSeed, { sourceLabel: 'LALIGA oficial (semilla verificada)' });
      setStatus('🟡 API-Football no devolvió partidos; se muestra una semilla oficial verificada para evitar un calendario vacío.');
    } catch (error) {
      try {
        const seed = await loadSeed();
        const futureSeed = seed.filter(m => new Date(m.utcDate).getTime() >= Date.now() - 60 * 60 * 1000);
        render(futureSeed, { sourceLabel: 'LALIGA oficial (semilla verificada)' });
        setStatus(`🟡 Proveedor externo no disponible; se muestra la semilla oficial verificada. <span class="tiny">${esc(error.message || 'error')}</span>`);
      } catch (seedError) {
        setStatus(`⚠️ No se pudo cargar el calendario: ${esc(seedError.message || error.message || 'error')}`);
        const container = document.getElementById('fixtures');
        if (container) container.innerHTML = '<div class="empty">Calendario temporalmente no disponible.</div>';
      }
    } finally {
      busy = false;
    }
  }

  function interceptFixtureButtons() {
    const buttons = Array.from(document.querySelectorAll('button')).filter(button => /cargar desde proveedor/i.test(button.textContent || ''));
    for (const button of buttons) {
      if (button.dataset.calendarClient === '1') continue;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        void loadFixtures();
      }, true);
      button.dataset.calendarClient = '1';
    }
  }

  function ensureRefreshButton() {
    const status = document.getElementById('fixturesStatus');
    if (!status?.parentElement || document.getElementById('calendarRefresh')) return;
    const button = document.createElement('button');
    button.id = 'calendarRefresh';
    button.type = 'button';
    button.className = 'primary';
    button.textContent = '↻ Actualizar calendario';
    button.addEventListener('click', () => void loadFixtures());
    status.parentElement.insertBefore(button, status.nextSibling);
  }

  function boot() {
    interceptFixtureButtons();
    ensureRefreshButton();
    void loadFixtures();
    void renderVideoReference();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.reloadUnifiedCalendar = loadFixtures;
})();
