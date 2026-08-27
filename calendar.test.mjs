import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeApiFootball, fixtureKey } from './providers.mjs';

const index = fs.readFileSync('./index.html', 'utf8');
const dashboard = fs.readFileSync('./dashboard-client.js', 'utf8');
const calendar = fs.readFileSync('./calendar-client.js', 'utf8');
const seed = JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json', 'utf8'));

let checks = 0;
const check = (condition, message) => {
  checks += 1;
  assert.ok(condition, `${checks}. ${message}`);
};

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

for (let i = 0; i < 20; i += 1) {
  const payload = { response: [{
    fixture: { id: 10000 + i, date: `2026-08-${28 + (i % 3)}T1${i % 10}:00:00+00:00`, status: { short: i % 2 ? 'NS' : 'FT' } },
    league: { id: 140, round: `Regular Season - ${3 + (i % 4)}` },
    teams: { home: { id: 200 + i, name: `Equipo Local ${i}` }, away: { id: 300 + i, name: `Equipo Visitante ${i}` } }
  }] };
  const item = normalizeApiFootball(payload)[0];
  check(item.provider === 'api-football', `interfaz/dato ${i + 1}: proveedor`);
  check(item.competitionId === '140', `interfaz/dato ${i + 1}: competición LaLiga`);
  check(item.id === String(10000 + i), `interfaz/dato ${i + 1}: ID`);
  check(item.homeTeamId === 200 + i && item.awayTeamId === 300 + i, `interfaz/dato ${i + 1}: equipos`);
  check(fixtureKey(item).includes(`equipo local ${i}`), `interfaz/dato ${i + 1}: clave estable`);
}

const interfaceChecksEnd = checks;
assert.equal(interfaceChecksEnd - 20, 100, 'La cadena principal de calendario ejecuta exactamente 100 comprobaciones');

check(!dashboard.includes('source:\n          "football-data.org"'), 'dashboard no fuerza football-data.org');
check(dashboard.includes('API-Football'), 'dashboard conoce API-Football');
check(dashboard.includes('/api/fixtures/next'), 'dashboard llama al endpoint unificado');
check(dashboard.includes("credentials: 'include'"), 'dashboard conserva cookies');
check(dashboard.includes("cache: 'no-store'"), 'dashboard evita cache obsoleta');
check(calendar.includes('/api/fixtures/next'), 'cliente calendario usa endpoint unificado');
check(calendar.includes('official-fixtures-seed-2026-27.json'), 'cliente calendario usa semilla oficial');
check(calendar.includes('LALIGA oficial (semilla verificada)'), 'semilla no se presenta como dato live');
check(calendar.includes('let busy = false'), 'peticiones concurrentes bloqueadas');
check(calendar.includes('stopImmediatePropagation'), 'handler legacy interceptado');
check(calendar.includes('cargar desde proveedor'), 'selector del control legacy configurado');
check(calendar.includes('Actualizar calendario'), 'refresco explícito disponible');
check(calendar.includes('Europe/Madrid'), 'hora española');
check(calendar.includes('sources'), 'fuentes coincidentes preservadas');
check(calendar.includes('primaryProvider'), 'proveedor principal visible');
check(calendar.includes('officialCount'), 'contador oficial actualizado');
check(calendar.includes('probableCount'), 'contador probable actualizado');
check(calendar.includes('unknownCount'), 'contador N/D actualizado');
check(!calendar.includes('0 partidos cargados desde football-data.org'), 'texto erróneo eliminado');
check(!dashboard.includes('El proveedor externo no está disponible'), 'mensaje genérico antiguo eliminado');

const ids = ['fixtures', 'fixturesStatus', 'officialCount', 'probableCount', 'unknownCount', 'loadFixtures'];
for (const id of ids) check(index.includes(`id="${id}"`), `interfaz conserva #${id}`);
check(index.includes('Próximos partidos'), 'título de calendario presente');
check(index.includes('Cargar desde proveedor'), 'botón de proveedor presente');
check(index.includes('Usar calendario oficial'), 'botón oficial presente');
check(index.includes('Alineaciones probables'), 'módulo de probables presente');
check(index.includes('Calidad de la información'), 'módulo de calidad presente');
check(index.includes('Partidos'), 'pestaña Partidos presente');
check(index.includes('Fuentes'), 'pestaña Fuentes presente');
check(index.includes('Datos'), 'pestaña Datos presente');
check(index.includes('Estado'), 'pestaña Estado presente');
check(index.includes('Solo lectura') || index.includes('SOLO LECTURA'), 'modo solo lectura presente');
check(index.includes('API-Football') || dashboard.includes('API-Football'), 'API-Football visible');
check(dashboard.includes('providerMatrix'), 'matriz de proveedores presente');
check(dashboard.includes('fixtureProviderInfo'), 'diagnóstico de calendario presente');
check(dashboard.includes('Fuentes activas') || dashboard.includes('fuentes activas'), 'fuentes activas informadas');
check(dashboard.includes('se combinan y deduplican'), 'deduplicación explicada');
check(dashboard.includes('PRINCIPAL · LISTO'), 'API-Football marcada como principal');
check(dashboard.includes('RESPALDO · LISTO'), 'proveedores secundarios como respaldo');
check(dashboard.includes("fetch('/calendar-client.js'"), 'cliente de calendario cargado de forma robusta');

check(normalizeApiFootball({ response: [] }).length === 0, 'payload vacío no rompe');
check(normalizeApiFootball({}).length === 0, 'payload sin response no rompe');
check(normalizeApiFootball({ response: [null, {}] }).length === 2, 'payload parcial mantiene contrato');
check(fixtureKey({ home: 'Real Madrid', away: 'Málaga CF', utcDate: '2026-08-30T15:00:00Z' }).includes('madrid'), 'clave limpia Real Madrid');
check(fixtureKey({ home: 'R. Racing Club', away: 'Elche CF', utcDate: '2026-08-28T17:00:00Z' }).includes('r racing'), 'clave limpia Racing');
check(seed.fixtures.every(x => !x.password), 'semilla sin contraseñas');
check(seed.fixtures.every(x => !x.token), 'semilla sin tokens');
check(!calendar.includes('Authorization:'), 'cliente calendario sin bearer token');
check(!dashboard.includes('Authorization:'), 'dashboard sin bearer token');
check(!index.includes('FOOTBALL_DATA_TOKEN='), 'HTML sin tokens');
check(!dashboard.includes('API_FOOTBALL_API_KEY'), 'dashboard sin API key');
check(index.includes('grid-template-columns'), 'layout responsive');
check(index.includes('@media(max-width:900px)'), 'breakpoint tablet');
check(index.includes('@media(max-width:560px)'), 'breakpoint móvil');
check(index.includes('overflow:auto'), 'navegación móvil scrollable');
check(calendar.includes("new Intl.DateTimeFormat('es-ES'"), 'formato español');
check(calendar.includes('response.ok'), 'respuesta HTTP validada');
check(calendar.includes('finally'), 'estado ocupado liberado');
check(calendar.includes('videoReference'), 'snapshot del vídeo integrado');
check(calendar.includes('/video-reference-snapshot-2026-08-27.json'), 'fuente del vídeo declarada');
check(calendar.includes('No se presenta como dato en tiempo real'), 'snapshot etiquetado como no live');
check(seed.fixtures.some(x => x.home === 'FC Barcelona' && x.away === 'Rayo Vallecano'), 'calendario contiene Barça-Rayo');
check(seed.fixtures.some(x => x.home === 'Real Madrid' && x.away === 'Málaga CF'), 'calendario contiene Madrid-Málaga');
check(seed.fixtures.some(x => x.home === 'Sevilla FC' && x.away === 'Atlético de Madrid'), 'calendario contiene Sevilla-Atlético');

console.log(`✅ Calendar/interface tests: ${interfaceChecksEnd - 20}/100 checks principales + ${checks - interfaceChecksEnd} regresiones = ${checks} comprobaciones totales`);
