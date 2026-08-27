(() => {
  'use strict';

  const SNAPSHOT_URL = '/recording-data-2026-08-27.json';
  const WEIGHTS = Object.freeze({ performance: 0.30, availability: 0.25, context: 0.20, market: 0.15, risk: 0.10 });
  const text = value => String(value ?? '').trim();
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, finite(value) ?? min));
  const money = value => finite(value) === null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(value)) + ' €';
  const pct = value => `${Math.round(clamp(value))}%`;
  const signedPct = value => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
  const norm = value => text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function playerPoints(player) { return finite(player?.pfsy ?? player?.pfsY ?? player?.points) ?? 0; }
  function marketDelta(player) {
    const value = finite(player?.value), price = finite(player?.price);
    if (!(value > 0 && price > 0)) return null;
    return (value - price) / value;
  }

  function scoreSnapshotPlayer(player) {
    const points = playerPoints(player);
    const media = finite(player?.media ?? player?.average);
    const performance = clamp(Math.max(points * 4, (media ?? 0) * 8));
    const availability = norm(player?.availability).includes('suspend') ? 0 : 72;
    const fixture = clamp(finite(player?.fixture?.[0]) ?? 50);
    const delta = marketDelta(player);
    const market = delta === null ? 50 : clamp(50 + delta * 100);
    const risk = norm(player?.availability).includes('suspend') ? 0 : 78;
    return Math.round(clamp(performance * WEIGHTS.performance + availability * WEIGHTS.availability + fixture * WEIGHTS.context + market * WEIGHTS.market + risk * WEIGHTS.risk));
  }

  function confidence(player, score) {
    let value = 45;
    if (player?.pfsy !== undefined || player?.pfsY !== undefined) value += 15;
    if (player?.value > 0) value += 10;
    if (player?.price > 0) value += 10;
    if (player?.media !== undefined || player?.average !== undefined) value += 8;
    if (player?.availability) value += 7;
    if (score >= 70) value += 5;
    return Math.round(clamp(value));
  }

  function recommendation(player, score) {
    const delta = marketDelta(player);
    if (norm(player?.availability).includes('suspend')) return 'EVITAR';
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

  function marketOpportunities(snapshot, players) {
    const listings = Array.isArray(snapshot?.marketListings) ? snapshot.marketListings : [];
    return listings.map(listing => {
      const match = players.find(player => norm(player.name) === norm(listing.player));
      const merged = { ...(match || {}), ...listing, price: listing.price, value: listing.value };
      const delta = marketDelta(merged);
      const score = match ? scoreSnapshotPlayer(merged) : clamp(50 + (delta ?? 0) * 100);
      return { ...merged, brainScore: Math.round(score), confidence: confidence(merged, score), recommendation: recommendation(merged, score), margin: delta };
    }).sort((a, b) => (b.brainScore + (b.margin ?? -1) * 100) - (a.brainScore + (a.margin ?? -1) * 100));
  }

  function rivalPressure(snapshot) {
    const rows = Array.isArray(snapshot?.standingsVisible) ? snapshot.standingsVisible : [];
    const mine = rows.find(row => norm(row.manager) === 'roncazador');
    if (!mine) return null;
    const nearest = rows.filter(row => row.manager !== mine.manager && finite(row.pfsy) !== null)
      .sort((a, b) => Math.abs((finite(a.pfsy) ?? 0) - (finite(mine.pfsy) ?? 0)) - Math.abs((finite(b.pfsy) ?? 0) - (finite(mine.pfsy) ?? 0)))[0];
    if (!nearest) return null;
    const gap = (finite(mine.pfsy) ?? 0) - (finite(nearest.pfsy) ?? 0);
    return { manager: nearest.manager, gap, pressure: clamp(100 - Math.abs(gap) * 5) };
  }

  function buildModel(snapshot) {
    const players = allPlayers(snapshot).map(player => {
      const score = scoreSnapshotPlayer(player);
      return { ...player, brainScore: score, confidence: confidence(player, score), recommendation: recommendation(player, score) };
    }).sort((a, b) => b.brainScore - a.brainScore);
    const opportunities = marketOpportunities(snapshot, players);
    const risks = players.slice().sort((a, b) => {
      const riskA = norm(a.availability).includes('suspend') ? 100 : 100 - a.brainScore;
      const riskB = norm(b.availability).includes('suspend') ? 100 : 100 - b.brainScore;
      return riskB - riskA;
    });
    return {
      players,
      best: players[0] || null,
      bestMarket: opportunities[0] || null,
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

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function ensurePanel() {
    const brain = document.getElementById('brain');
    if (!brain || document.getElementById('brainIntelligence')) return document.getElementById('brainIntelligence');
    const card = document.createElement('div');
    card.id = 'brainIntelligence';
    card.className = 'card';
    card.innerHTML = `
      <div class="flex"><h3 style="margin-right:auto">🧠 Cerebro 2 · análisis contextual</h3><span id="brainConfidence" class="pill blue">Confianza N/D</span></div>
      <div class="three" style="margin-top:9px">
        <div class="source"><div class="label">Decisión principal</div><b id="brainDecision">N/D</b><div id="brainDecisionText" class="tiny">Esperando datos.</div></div>
        <div class="source"><div class="label">Mercado actual</div><b id="brainOpportunity">N/D</b><div id="brainOpportunityText" class="tiny">Sin anuncios.</div></div>
        <div class="source"><div class="label">Rival más cercano</div><b id="brainRival">N/D</b><div id="brainRivalText" class="tiny">Sin clasificación.</div></div>
      </div>
      <div class="source" style="margin-top:9px"><b>Cómo decide:</b> rendimiento 30% · minutos/disponibilidad 25% · contexto 20% · mercado 15% · riesgo 10%. <span id="brainDataQuality" class="tiny"></span></div>`;
    const anchor = brain.querySelector('.grid2');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling); else brain.prepend(card);
    return card;
  }

  function renderModel(model) {
    ensurePanel();
    const best = model.best, opportunity = model.bestMarket, pressure = model.pressure;
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    set('brainConfidence', best ? `Confianza ${best.confidence}%` : 'Confianza N/D');
    set('brainDecision', best ? `${best.recommendation} · ${best.name}` : 'N/D');
    set('brainDecisionText', best ? `Score ${best.brainScore}/100 · ${best.position || 'POS'} · ${money(best.value)}` : 'Esperando datos.');
    set('brainOpportunity', opportunity ? opportunity.player : 'N/D');
    set('brainOpportunityText', opportunity ? `${signedPct(opportunity.margin ?? 0)} margen · ${money(opportunity.price)} · ${opportunity.owner || 'mercado'}` : 'Sin anuncios.');
    set('brainRival', pressure ? pressure.manager : 'N/D');
    set('brainRivalText', pressure ? `${Math.abs(pressure.gap)} PFSY de diferencia · presión ${pct(pressure.pressure)}` : 'Sin clasificación.');
    set('brainDataQuality', ` · Observados: ${model.counts.players} jugadores · ${model.counts.listings} anuncios · ${model.counts.activity} operaciones.`);

    const rows = document.getElementById('brainRows');
    if (rows && model.players.length) {
      const filter = document.getElementById('brainFilter')?.value || 'all';
      const filtered = model.players.filter(player => filter === 'all' || player.position === filter).slice(0, 50);
      rows.innerHTML = filtered.map(player => `<tr><td><b>${escapeHtml(player.name || '—')}</b><br><small>${escapeHtml(player.manager || '')}</small></td><td>${escapeHtml(player.position || '—')}</td><td><span class="score ${player.brainScore >= 75 ? 'green' : player.brainScore >= 60 ? 'yellow' : 'red'}">${player.brainScore}</span></td><td>${player.confidence}%</td><td>${escapeHtml(player.recommendation)}</td><td>${money(player.price)}</td></tr>`).join('');
    }
  }

  async function boot() {
    try {
      const response = await fetch(SNAPSHOT_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      window.__brainModel = buildModel(snapshot);
      renderModel(window.__brainModel);
      const status = document.getElementById('brainStatus');
      if (status) status.textContent = `Activo · ${window.__brainModel.counts.players} jugadores · mercado + rivales + contexto`;
    } catch (error) {
      const status = document.getElementById('brainStatus');
      if (status) status.textContent = `Activo · sin snapshot (${error.message})`;
    }
  }

  window.LALIGA_BRAIN = Object.freeze({ version: '2.1', weights: WEIGHTS, buildModel, scoreSnapshotPlayer, marketOpportunities });
  window.addEventListener('load', boot, { once: true });
})();
