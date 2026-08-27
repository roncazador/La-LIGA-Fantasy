(() => {
  'use strict';

  const state = window.state || null;
  let busy = false;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

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

    const ordered = matches
      .slice()
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

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
      const status = game.status && game.status !== 'NS'
        ? `<span class="pill">${esc(game.status)}</span>`
        : '';
      return `
        <div class="match">
          <div class="match-title">${esc(game.home)} — ${esc(game.away)}</div>
          <div class="tiny">${esc(dt.date)} · ${esc(dt.time)}${md ? ` · ${md}` : ''}</div>
          <div class="sourceTag">${providerNames}</div>
          ${status ? `<div style="margin-top:6px">${status}</div>` : ''}
        </div>`;
    }).join('');

    const official = ordered.filter(g => String(g.source || '').toLowerCase().includes('laliga')).length;
    const probable = Array.isArray(window.state?.probableXIs) ? window.state.probableXIs.length : 0;
    setCount('officialCount', official);
    setCount('probableCount', probable);
    setCount('unknownCount', Math.max(0, ordered.length - official));

    if (meta.sourceLabel) {
      const counts = meta.providers || {};
      const detail = Object.entries(counts)
        .filter(([, v]) => v && (v.ok || v.count))
        .map(([name, v]) => `${name}: ${v.count ?? 0}`)
        .join(' · ');
      setStatus(`✅ ${ordered.length} partidos cargados · fuente principal: <b>${esc(meta.sourceLabel)}</b>${detail ? ` · ${esc(detail)}` : ''}`);
    }
  }

  async function loadSeed() {
    const response = await fetch('/official-fixtures-seed-2026-27.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`SEED_HTTP_${response.status}`);
    return normalizeSeed(await response.json());
  }

  async function loadFixtures() {
    if (busy) return;
    busy = true;
    setStatus('⏳ Consultando API-Football y fuentes de respaldo…');
    try {
      const response = await fetch('/api/fixtures/next', {
        credentials: 'include',
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      const matches = normalizeMatches(payload);

      if (matches.length) {
        if (state) state.fixtures = matches.map(m => ({
          date: madridDate(m.utcDate).date,
          time: madridDate(m.utcDate).time,
          home: m.home,
          away: m.away,
          round: m.matchday,
          status: m.status,
          source: m.source,
          sources: m.sources,
          utcDate: m.utcDate
        }));
        if (state) state.lastSync = new Date().toISOString();
        if (typeof window.saveState === 'function') window.saveState();
        render(matches, {
          sourceLabel: payload.primaryProvider || payload.source || 'multi-proveedor',
          providers: payload.providers || {}
        });
        return;
      }

      const seed = await loadSeed();
      const now = Date.now();
      const futureSeed = seed.filter(m => new Date(m.utcDate).getTime() >= now - 60 * 60 * 1000);
      if (state) state.fixtures = futureSeed.map(m => ({
        date: madridDate(m.utcDate).date,
        time: madridDate(m.utcDate).time,
        home: m.home,
        away: m.away,
        round: m.matchday,
        status: m.status,
        source: m.source,
        sources: m.sources,
        utcDate: m.utcDate
      }));
      if (state) state.lastSync = new Date().toISOString();
      if (typeof window.saveState === 'function') window.saveState();
      render(futureSeed, { sourceLabel: 'LALIGA oficial (semilla verificada)' });
      setStatus(`🟡 API-Football no devolvió partidos; se muestra una semilla oficial verificada para evitar un calendario vacío.`);
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
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter(button => /cargar desde proveedor/i.test(button.textContent || ''));
    for (const button of buttons) {
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.reloadUnifiedCalendar = loadFixtures;
})();
