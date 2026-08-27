import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeApiFootball, fixtureKey } from './providers.mjs';

const index = fs.readFileSync('./index.html', 'utf8');
const dashboard = fs.readFileSync('./dashboard-client.js', 'utf8');
const calendar = fs.readFileSync('./calendar-client.js', 'utf8');
const seed = JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json', 'utf8'));

let tests = 0;
const check = (condition, message) => {
  tests += 1;
  assert.ok(condition, `${tests}. ${message}`);
};

/* 1-20: calendario oficial de respaldo */
check(seed.season === '2026/27', 'semilla temporada 2026/27');
check(seed.competition === 'LaLiga EA SPORTS', 'semilla identifica la competición');
check(seed.source === 'LALIGA oficial', 'semilla identifica la fuente oficial');
check(seed.fixtures.length === 12, 'semilla contiene 12 partidos inmediatos');
check(seed.fixtures.every(x => x.utcDate && x.home && x.away), 'todos los partidos tienen fecha y equipos');
check(seed.fixtures.every(x => x.matchday === x.officialMatchday), 'jornada oficial coherente');
check(seed.fixtures[0].home === 'RC Celta', 'primer partido: Celta');
check(seed.fixtures[0].away === 'CA Osasuna', 'primer partido: Osasuna');
check(seed.fixtures[1].home === 'FC Barcelona', 'segundo partido: Barcelona');
check(seed.fixtures[1].away === 'Athletic Club', 'segundo partido: Athletic');
check(seed.fixtures[2].home === 'R. Racing Club', 'tercer partido: Racing');
check(seed.fixtures[2].away === 'Elche CF', 'tercer partido: Elche');
check(seed.fixtures[3].home === 'Deportivo Alavés', 'cuarto partido: Alavés');
check(seed.fixtures[3].away === 'Villarreal CF', 'cuarto partido: Villarreal');
check(seed.fixtures[4].matchday === 3, 'jornada 3 en primer bloque');
check(seed.fixtures[8].home === 'RC Deportivo', 'bloque domingo: Deportivo');
check(seed.fixtures[8].away === 'Valencia CF', 'bloque domingo: Valencia');
check(seed.fixtures[10].home === 'CA Osasuna', 'lunes: Osasuna');
check(seed.fixtures[11].away === 'Rayo Vallecano', 'lunes: Rayo');
check(new Set(seed.fixtures.map(x => x.id)).size === seed.fixtures.length, 'IDs únicos');

/* 21-40: normalización y claves */
for (let i = 0; i < 20; i += 1) {
  const payload = { response: [{
    fixture: { id: 10000 + i, date: `2026-08-${28 + (i % 3)}T1${i % 10}:00:00+00:00`, status: { short: i % 2 ? 'NS' : 'FT' } },
    league: { id: 140, round: `Regular Season - ${3 + (i % 4)}` },
    teams: { home: { id: 200 + i, name: `Equipo Local ${i}` }, away: { id: 300 + i, name: `Equipo Visitante ${i}` } }
  }] };
  const item = normalizeApiFootball(payload)[0];
  check(item.provider === 'api-football', `normalización proveedor ${i + 1}`);
  check(item.competitionId === '140', `normalización competición ${i + 1}`);
  check(item.id === String(10000 + i), `normalización ID ${i + 1}`);
  check(item.homeTeamId === 200 + i && item.awayTeamId === 300 + i, `normalización IDs de equipos ${i + 1}`);
  check(fixtureKey(item).includes(`equipo local ${i}`), `clave de fixture ${i + 1}`);
}

/* 41-60: no regresión del problema visual */
check(!dashboard.includes('source:\n          "football-data.org"'), 'dashboard ya no fuerza football-data.org como fuente');
check(dashboard.includes('API-Football'), 'dashboard conoce API-Football');
check(dashboard.includes('/api/fixtures/next'), 'dashboard llama al endpoint unificado');
check(dashboard.includes('credentials: \'include\''), 'dashboard conserva credenciales de sesión');
check(dashboard.includes('cache: \'no-store\''), 'dashboard evita cache obsoleta');
check(calendar.includes('/api/fixtures/next'), 'cliente calendario usa endpoint unificado');
check(calendar.includes('official-fixtures-seed-2026-27.json'), 'cliente calendario usa semilla oficial');
check(calendar.includes('LALIGA oficial (semilla verificada)'), 'cliente distingue la semilla de datos live');
check(calendar.includes('calendarBusy'), 'cliente evita peticiones concurrentes');
check(calendar.includes('stopImmediatePropagation'), 'cliente intercepta el handler antiguo');
check(calendar.includes('Cargar desde proveedor'), 'cliente localiza el control de carga');
check(calendar.includes('Actualizar calendario'), 'cliente aporta refresco explícito');
check(calendar.includes('Europe/Madrid'), 'cliente presenta hora en España');
check(calendar.includes('sources'), 'cliente conserva fuentes coincidentes');
check(calendar.includes('primaryProvider'), 'cliente muestra proveedor principal');
check(calendar.includes('officialCount'), 'cliente actualiza contador oficial');
check(calendar.includes('probableCount'), 'cliente conserva contador de probables');
check(calendar.includes('unknownCount'), 'cliente conserva contador N/D');
check(!calendar.includes('0 partidos cargados desde football-data.org'), 'no queda el texto antiguo erróneo');
check(!dashboard.includes('El proveedor externo no está disponible'), 'no queda mensaje genérico antiguo como único estado');

/* 61-80: contrato de interfaz */
const ids = ['fixtures', 'fixturesStatus', 'officialCount', 'probableCount', 'unknownCount', 'loadFixtures'];
for (const id of ids) check(index.includes(`id="${id}"`), `interfaz conserva #${id}`);
check(index.includes('Próximos partidos'), 'interfaz mantiene título de calendario');
check(index.includes('Cargar desde proveedor'), 'interfaz mantiene carga manual');
check(index.includes('Usar calendario oficial'), 'interfaz mantiene opción oficial');
check(index.includes('Alineaciones probables'), 'interfaz mantiene módulo de probables');
check(index.includes('Calidad de la información'), 'interfaz mantiene calidad');
check(index.includes('Partidos'), 'interfaz mantiene pestaña Partidos');
check(index.includes('Fuentes'), 'interfaz mantiene pestaña Fuentes');
check(index.includes('Datos'), 'interfaz mantiene pestaña Datos');
check(index.includes('Estado'), 'interfaz mantiene pestaña Estado');
check(index.includes('Solo lectura') || index.includes('SOLO LECTURA'), 'interfaz mantiene lectura');
check(index.includes('API-Football') || dashboard.includes('API-Football'), 'interfaz expone API-Football');
check(dashboard.includes('providerMatrix'), 'matriz de proveedores presente');
check(dashboard.includes('fixtureProviderInfo'), 'diagnóstico de calendario presente');
check(dashboard.includes('fuentes activas') || dashboard.includes('Fuentes activas'), 'interfaz informa de fuentes activas');
check(dashboard.includes('se combinan y deduplican'), 'interfaz explica deduplicación');
check(dashboard.includes('PRINCIPAL · LISTO'), 'API-Football se marca como principal');
check(dashboard.includes('RESPALDO · LISTO'), 'proveedores secundarios se marcan como respaldo');
check(dashboard.includes('/calendar-client.js'), 'cliente dedicado de calendario se carga');

/* 81-100: escenarios extremos y datos innecesarios */
check(normalizeApiFootball({ response: [] }).length === 0, 'respuesta vacía no rompe');
check(normalizeApiFootball({}).length === 0, 'payload sin response no rompe');
check(normalizeApiFootball({ response: [null, {}] }).length === 2, 'payload parcial mantiene forma estable');
check(fixtureKey({ home: 'Real Madrid', away: 'Málaga CF', utcDate: '2026-08-30T15:00:00Z' }).includes('real madrid'.replace('real ', '')), 'clave normaliza nombre local');
check(fixtureKey({ home: 'R. Racing Club', away: 'Elche CF', utcDate: '2026-08-28T17:00:00Z' }).includes('racing club'), 'clave limpia sufijo de club');
check(seed.fixtures.every(x => !x.password), 'semilla no contiene credenciales');
check(seed.fixtures.every(x => !x.token), 'semilla no contiene tokens');
check(!calendar.includes('Authorization:'), 'cliente calendario no contiene bearer token');
check(!dashboard.includes('Authorization:'), 'dashboard no contiene bearer token');
check(!index.includes('FOOTBALL_DATA_TOKEN='), 'HTML no contiene token de proveedor');
check(!dashboard.includes('API_FOOTBALL_API_KEY'), 'dashboard no contiene clave API');
check(index.includes('grid-template-columns'), 'layout responsive presente');
check(index.includes('@media(max-width:900px)'), 'breakpoint tablet presente');
check(index.includes('@media(max-width:560px)'), 'breakpoint móvil presente');
check(index.includes('overflow:auto'), 'navegación móvil desplazable');
check(calendar.includes('new Intl.DateTimeFormat(\'es-ES\''), 'formateador de fecha español presente');
check(calendar.includes('status.ok'), 'estado de proveedor controlado');
check(calendar.includes('response.ok'), 'respuesta HTTP validada');
check(calendar.includes('finally'), 'bloque de limpieza de estado presente');
check(tests === 100, 'exactamente 100 comprobaciones ejecutadas');

console.log(`✅ Calendar/interface tests: ${tests}/100 passed`);
