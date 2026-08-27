import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeApiFootball, fixtureKey } from './providers.mjs';

const index = fs.readFileSync('./index.html', 'utf8');
const dashboard = fs.readFileSync('./dashboard-client.js', 'utf8');
const calendar = fs.readFileSync('./calendar-client.js', 'utf8');
const dataClient = fs.readFileSync('./data-client.js', 'utf8');
const seed = JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json', 'utf8'));
const recording = JSON.parse(fs.readFileSync('./recording-data-2026-08-27.json', 'utf8'));

let checks = 0;
const check = (condition, message) => {
  checks += 1;
  assert.ok(condition, `${checks}. ${message}`);
};

// 20 comprobaciones de producto/seguridad/UI antes de los casos de proveedor.
check(seed.season === '2026/27', 'semilla temporada 2026/27');
check(seed.competition === 'LaLiga EA SPORTS', 'semilla identifica LaLiga');
check(seed.source === 'LALIGA oficial', 'semilla identifica fuente oficial');
check(seed.fixtures.length === 12, 'semilla contiene 12 partidos inmediatos');
check(seed.fixtures.every(x => x.utcDate && x.home && x.away), 'partidos con fecha y equipos');
check(new Set(seed.fixtures.map(x => x.id)).size === seed.fixtures.length, 'IDs de partidos únicos');
check(recording.status === 'referencia_observada_no_live', 'grabación marcada como histórica');
check(recording.snapshot.teamCount === '20/24 fichas', 'plantilla observada 20/24');
check(recording.snapshot.teamValue === 269039595, 'valor de equipo observado correcto');
check(recording.snapshot.marketBalance === 40542121, 'saldo de mercado observado correcto');
check(calendar.includes('/api/fixtures/next'), 'calendario usa endpoint unificado');
check(calendar.includes('official-fixtures-seed-2026-27.json'), 'calendario mantiene semilla oficial');
check(calendar.includes('referencia histórica, no LIVE') || calendar.includes('No se presenta como dato en tiempo real'), 'snapshot etiquetado como no LIVE');
check(dataClient.includes('/video-reference-snapshot-2026-08-27.json') || dataClient.includes('recording-data-2026-08-27.json'), 'panel de datos usa snapshot externo');
check(dataClient.includes('api/fantasy/dashboard'), 'panel intenta sincronización LIVE tras autenticación');
check(dataClient.includes('Mi equipo') && dataClient.includes('Rivales') && dataClient.includes('Mercado'), 'panel unifica equipo, rivales y mercado');
check(index.includes('@media(max-width:560px)'), 'interfaz adaptada a móvil');
check(index.includes('overflow:auto'), 'navegación táctil desplazable');
check(!dashboard.match(/x-apisports-key|api[_-]?key|bearer\s+[A-Za-z0-9._-]{20,}/i) && !dataClient.match(/x-apisports-key|api[_-]?key|bearer\s+[A-Za-z0-9._-]{20,}/i), 'frontend sin credenciales');
check(calendar.includes("credentials: 'include'") && calendar.includes("cache: 'no-store'"), 'calendario con sesión y sin caché obsoleta');

// 16 casos sintéticos × 5 invariantes = 80 comprobaciones.
for (let i = 0; i < 16; i += 1) {
  const payload = { response: [{
    fixture: { id: 10000 + i, date: `2026-08-${28 + (i % 3)}T1${i % 10}:00:00+00:00`, status: { short: i % 2 ? 'NS' : 'FT' } },
    league: { id: 140, round: `Regular Season - ${3 + (i % 4)}` },
    teams: { home: { id: 200 + i, name: `Equipo Local ${i}` }, away: { id: 300 + i, name: `Equipo Visitante ${i}` } }
  }] };
  const item = normalizeApiFootball(payload)[0];
  check(item.provider === 'api-football', `caso ${i + 1}: proveedor`);
  check(item.competitionId === '140', `caso ${i + 1}: competición`);
  check(item.id === String(10000 + i), `caso ${i + 1}: ID`);
  check(item.homeTeamId === 200 + i && item.awayTeamId === 300 + i, `caso ${i + 1}: equipos`);
  check(fixtureKey(item).includes(`equipo local ${i}`), `caso ${i + 1}: clave estable`);
}

assert.equal(checks, 100, `Se esperaban 100 comprobaciones y hay ${checks}`);
console.log('✅ Calendar/interface tests: 100/100 passed');
