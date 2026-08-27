(() => {
  'use strict';

  const SNAPSHOT_URL = '/recording-data-2026-08-27.json';
  const WEIGHTS = Object.freeze({ performance: 0.30, availability: 0.25, context: 0.20, market: 0.15, risk: 0.10 });

  const text = value => String(value ?? '').trim();
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, finite(value) ?? min));
  const money = value => finite(value) === null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(value)) + ' €';
  const pct = value => `${Math.round(clamp(value))}%`;
  const norm = value => text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function playerPoints(player) {
    return finite(player?.pfsy ?? player?.pfsY ?? player?.points) ?? 0;
  }

  function marketDelta(player) {
    const value = finite(player?.value);
    const price = finite(player?.price);
    if (!(value > 0 && price > 0)) return null;
    return (value - price) / value;
  }

  function scoreSnapshotPlayer(player, fixtureIndex = 0) {
    const points = playerPoints(player);
    const media = finite(player?.media ?? player?.average);
    const performance = clamp(Math.max(points * 4, (media ?? 0) * 8));
    const availability = text(player?.availability).toLowerCase().includes('suspend') ? 0 : 72;
    const fixture = clamp(finite(player?.fixture?.[fixtureIndex]) ?? 50);
    const delta = marketDelta(player);
    const market = delta === null ? 50 : clamp(50 + delta * 100);
    const risk = text(player?.availability).toLowerCase().includes('suspend') ? 0 : 78;
    return Math.round(clamp(
      performance * WEIGHTS.performance +
      availability * WEIGHTS.availability +
      fixture * WEIGHTS.context +
      market * WEIGHTS.market +
      risk * WEIGHTS.risk
    ));
  }

  function confidence(player, score) {
    let c = 45;
    if (player?.pfsy !== undefined || player?.pfsY !== undefined) c += 15;
    if (player?.value > 0) c += 10;
    if (player?.price > 0) c += 10;
    if (player?.media !== undefined || player?.average !== undefined) c += 8;
    if (player?.availability) c += 7;
    if (score >= 70) c += 5;
    return Math.round(clamp(c));
  }

  function recommendation(player, score) {
    const delta = marketDelta(player);
    const availability = norm(player?.availability);
    if (availability.includes('suspend')) return 'EVITAR';
    if (score >= 75 && delta !== null && delta >= 0.08) return 'COMPRA FUERTE';
    if (score >= 68 && (delta === null || delta >= 0.03)) return 'COMPRA';
    if (score < 45 && delta !== null && delta < -0.05) return 'VENTA';
    if (score >= 72) return 'MANTENER';
    return 'VIGILAR';
  }

  function allPlayers(snapshot) {
    const rosters = snapshot?.rostersVisible || {};
    const result = [];
    for (const [manager, roster] of Object.entries(rosters)) {
      for (const player of Array.isArray(roster) ? roster : []) result.push({ ...player, manager });
    }
    return result;
  }

  function rivalPressure(snapshot) {
    const rows = Array.isArray(snapshot?.standingsVisible) ? snapshot.standingsVisible : [];
    const mine = rows.find(row => norm(row.manager) === 'roncazador');
    if (!mine) return null;
    const nearest = rows
      .filter(row => row.manager !== mine.manager && finite(row.pfsy) !== null)
      .sort((a, b) => Math.abs((finite(a.pfsy) ?? 0) - (finite(mine.pfsy) ?? 0)) - Math.abs((finite(b.pfsy) ?? 0) - (finite(mine.pfsy) ?? 0)))[0];
    if (!nearest) return null;
    return {
      manager: nearest.manager,
      gap: (finite(mine.pfsy) ?? 0) - (finite(nearest.pfsy) ?? 0),
      pressure: clamp(100 - Math.abs((finite(mine.pfsy) ?? 0) - (finite(nearest.pfsy) ?? 0)) * 5)
    };
  }

  function buildModel(snapshot) {
    const players = allPlayers(snapshot).map(player => {
      const score = scoreSnapshotPlayer(player);
      return { ...player, brainScore: score, confidence: confidence(player, score), recommendation: recommendation(player, score) };
    }).sort((a, b) => b.brainScore - a.brainScore);

    const market = players.filter(player => marketDelta(player) !== null)
      .sort((a, b) => (marketDelta(b) ?? -1) - (marketDelta(a) ?? -1));
    const risks = players.slice().sort((a, b) => {
      const riskA = norm(a.availability).includes('suspend') ? 100 : 0;
      const riskB = norm(b.availability).includes('suspend') ? 100 : 0;
      return riskB - riskA || a.brainScore - b.brainScore;
    });
    return {
      players,
      best: players[0] || null,
      bestMarket: market[0] || null,
      highestRisk: risks[0] || null,
      pressure: rivalPressure(snapshot),
      counts: {
        players: players.length,
        managers: Array.isArray(snapshot?.standingsVisible) ? snapshot.standingsVisible.length : 0,
        listings: Array.isArray(snapshot?.marketListings) ? snapshot.marketListings.length : 0,
        activity: Array.isArray(snapshot?.recentActivity) ? snapshot.recentActivity.length : 0
      }
    };
  }

  function ensurePanel() {
    const brain = document.getElementById('brain');
    if (!brain || document.getElementById('brainIntelligence')) return document.getElementById('brainIntelligence');
    const card = document.createElement('div');
    card.id = 'brainIntelligence';
    card.className = 'card';
    card.innerHTML = `
      <div class="flex">
        <h3 style="margin-right:auto">🧠 Cerebro 2 · análisis contextual</h3>
        <span id="brainConfidence" class="pill blue">Confianza N/D</span>
      </div>
      <div class="three" style="margin-top:9px">
        <div class="source"><div class="label">Decisión principal</div><b id="brainDecision">N/D</b><div id="brainDecisionText" class="tiny">Esperando datos.</div></div>
        <div class="source"><div class="label">Oportunidad</div><b id="brainOpportunity">N/D</b><div id="brainOpportunityText" class="tiny">Sin mercado suficiente.</div></div>
        <div class="source"><div class="label">Rival más cercano</div><b id="brainRival">N/D</b><div id="brainRivalText" class="tiny">Sin clasificación.</div></div>
      </div>
      <div class="source" style="margin-top:9px">
        <b>Cómo decide:</b> rendimiento 30% · minutos/disponibilidad 25% · contexto 20% · mercado 15% · riesgo 10%.
        <span id="brainDataQuality" class="tiny"></span>
      </div>
    `;
    const anchor = brain.querySelector('.grid2');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
    else brain.prepend(card);
    return card;
  }

  function renderModel(model) {
    ensurePanel();
    const best = model.best;
    const opportunity = model.bestMarket;
    const pressure = model.pressure;
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    set('brainConfidence', best ? `Confianza ${best.confidence}%` : 'Confianza N/D');
    set('brainDecision', best ? `${best.recommendation} · ${best.name}` : 'N/D');
    set('brainDecisionText', best ? `Score ${best.brainScore}/100 · ${best.position || 'POS'} · ${money(best.value)}` : 'Esperando datos.');
    set('brainOpportunity', opportunity ? opportunity.name : 'N/D');
    set('brainOpportunityText', opportunity ? `${pct((marketDelta(opportunity) ?? 0) * 100)} de margen · precio ${money(opportunity.price)}` : 'Sin mercado suficiente.');
    set('brainRival', pressure ? pressure.manager : 'N/D');
    set('brainRivalText', pressure ? `${Math.abs(pressure.gap)} PFSY de diferencia · presión ${pct(pressure.pressure)}` : 'Sin clasificación.');
    set('brainDataQuality', ` · Datos observados: ${model.counts.players} fichas de jugadores, ${model.counts.listings} anuncios y ${model.counts.activity} operaciones.`);

    const rows = document.getElementById('brainRows');
    if (rows && model.players.length) {
      const filter = document.getElementById('brainFilter')?.value || 'all';
      const filtered = model.players.filter(player => filter === 'all' || player.position === filter).slice(0, 50);
      rows.innerHTML = filtered.map(player => `
        <tr>
          <td><b>${escapeHtmlSafe(player.name || '—')}</b><br><small>${escapeHtmlSafe(player.manager || '')}</small></td>
          <td>${escapeHtmlSafe(player.position || '—')}</td>
          <td><span class="score ${player.brainScore >= 75 ? 'green' : player.brainScore >= 60 ? 'yellow' : 'red'}">${player.brainScore}</span></td>
          <td>${player.confidence}%</td>
          <td>${escapeHtmlSafe(player.recommendation)}</td>
          <td>${money(player.price)}</td>
        </tr>
      `).join('');
    }
  }

  function escapeHtmlSafe(value) {
    return text(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  async function boot() {
    try {
      const response = await fetch(SNAPSHOT_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      window.__brainModel = buildModel(snapshot);
      renderModel(window.__brainModel);
      const status = document.getElementById('brainStatus');
      if (status) status.textContent = `Activo · ${window.__brainModel.counts.players} jugadores · análisis contextual`;
    } catch (error) {
      const status = document.getElementById('brainStatus');
      if (status) status.textContent = `Activo · sin snapshot (${error.message})`;
    }
  }

  window.LALIGA_BRAIN = Object.freeze({ version: '2.0', weights: WEIGHTS, buildModel });
  window.addEventListener('load', boot, { once: true });
})();
