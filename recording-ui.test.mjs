import assert from 'node:assert/strict';
import fs from 'node:fs';

const ref = JSON.parse(fs.readFileSync('./video-reference-snapshot-2026-08-27.json', 'utf8'));
const calendar = fs.readFileSync('./calendar-client.js', 'utf8');
const dataClient = fs.readFileSync('./data-client.js', 'utf8');
const config = fs.readFileSync('./config.mjs', 'utf8');
const checks = [];
const check = (condition, label) => checks.push([label, Boolean(condition)]);

/* 1-10: snapshot base */
check(ref && typeof ref === 'object' && !Array.isArray(ref), 'snapshot objeto');
check(typeof ref.capturedAt === 'string' && ref.capturedAt.length > 0, 'fecha de captura');
check(ref.status === 'referencia_observada_no_live', 'snapshot marcado como histórico');
check(ref.league === 'La Liga', 'liga');
check(Number.isInteger(ref.snapshot?.matchdayAtStart), 'jornada válida');
check(ref.snapshot?.teamCount === '20/24 fichas', 'plantilla 20/24');
check(Number.isFinite(ref.snapshot?.teamValue), 'valor de plantilla numérico');
check(Number.isFinite(ref.snapshot?.dailyReward), 'recompensa numérica');
check(Number.isFinite(ref.snapshot?.marketBalance), 'saldo de mercado numérico');
check(ref.source?.includes('grabación'), 'fuente identificada');

/* 11-29: standings: 2 checks per visible manager + array/length */
const standings = Array.isArray(ref.standingsVisible) ? ref.standingsVisible : [];
check(standings.length === 9, '9 managers visibles');
for (const row of standings) {
  check(Number.isInteger(row.rank) && row.rank > 0, `rank válido ${row.manager}`);
  check(typeof row.manager === 'string' && row.manager.length > 0 && Number.isFinite(row.pfsy), `manager/PFSY válidos ${row.manager}`);
}

/* 30-35: roster containers */
const rosterManagers = ['roncazador','Jonymessi','SURIKT097','saugarr','AlvaroNP96','kubakar'];
for (const manager of rosterManagers) check(Array.isArray(ref.rostersVisible?.[manager]), `roster ${manager}`);

/* 36-83: every visible player has name + PFSY */
const players = Object.values(ref.rostersVisible || {}).flat();
for (const player of players) {
  check(typeof player.name === 'string' && player.name.length > 0, `nombre jugador ${player.name ?? 'N/D'}`);
  check(Number.isFinite(player.pfsy), `PFSY jugador ${player.name ?? 'N/D'}`);
}

/* 84-93: market */
const market = Array.isArray(ref.marketListings) ? ref.marketListings : [];
check(market.length === 3, '3 anuncios de mercado visibles');
check(market.every(x => typeof x.owner === 'string' && x.owner), 'mercado con propietarios');
check(market.every(x => Number.isFinite(x.value)), 'mercado con valores');
check(market.every(x => Number.isFinite(x.price)), 'mercado con precios');
check(market.every(x => typeof x.status === 'string' && x.status), 'mercado con estados');
check(market.some(x => x.player === 'Isaac' && x.pfsy === 13), 'Isaac 13 PFSY');
check(market.some(x => x.player === 'Isaac' && x.price === 6460286), 'precio Isaac');
check(market.some(x => x.player === 'Juan Iglesias' && x.status === 'Dudoso'), 'Juan Iglesias dudoso');
check(market.some(x => x.player === 'Juan Iglesias' && x.price === 18000000), 'precio Juan Iglesias');
check(Number.isFinite(ref.snapshot.marketBalance) && Number.isFinite(ref.snapshot.dailyReward), 'métricas de mercado numéricas');

/* 94-97: activity */
const activity = Array.isArray(ref.recentActivity) ? ref.recentActivity : [];
check(activity.length === 21, '21 operaciones/eventos observados');
check(activity.every(x => typeof x.date === 'string' && x.date), 'actividad con fecha');
check(activity.every(x => typeof x.type === 'string' && x.type), 'actividad con tipo');
check(activity.some(x => x.player === 'Álex Balde' && x.amount === 25001999), 'operación Álex Balde');

/* 98-100: frontend hygiene */
check(calendar.includes('/video-reference-snapshot-2026-08-27.json'), 'calendar usa snapshot externo');
check(dataClient.includes('/video-reference-snapshot-2026-08-27.json'), 'data client usa snapshot externo');
check(!calendar.match(/x-apisports-key|api[_-]?key|bearer\s+[A-Za-z0-9._-]{20,}/i) && !dataClient.match(/x-apisports-key|api[_-]?key|bearer\s+[A-Za-z0-9._-]{20,}/i) && !config.match(/YOUR_API_KEY|token_en_claro/i), 'frontend/config sin secretos ni placeholders inseguros');

assert.equal(checks.length, 100, `Se esperaban 100 comprobaciones y hay ${checks.length}`);
for (const [index, [label, ok]] of checks.entries()) assert.ok(ok, `UI-${String(index + 1).padStart(3, '0')}: ${label}`);
console.log('✅ Recording/UI contract tests: 100/100 passed');
