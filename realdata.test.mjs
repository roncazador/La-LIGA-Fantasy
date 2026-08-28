check(Array.isArray(injuries), 'lesiones siempre array');
check(injuries.length === 1, 'una lesión normalizada');
check(injuries[0].playerId === 1001, 'ID de jugador lesionado');
check(injuries[0].player === 'Jugador Real', 'jugador lesionado');
check(injuries[0].type === 'Injury', 'tipo de incidencia');
check(injuries[0].reason === 'Muscle injury', 'motivo');
check(injuries[0].teamId === 529, 'equipo lesión');
check(injuries[0].team === 'FC Barcelona', 'nombre equipo lesión');
check(injuries[0].fixtureId === 555, 'partido asociado');
check(injuries[0].date.endsWith('+00:00'), 'fecha conservada');
check(normalizeInjuries({}).length === 0, 'lesiones vacías');
check(normalizeInjuries({ response: [] }).length === 0, 'respuesta lesiones vacía');
check(normalizeInjuries({ response: [{ player: { id: 1 } }] }).length === 0, 'lesión sin nombre filtrada');
check(normalizePlayers({ response: [{ player: { id: 1 } }] }).length === 0, 'jugador sin nombre filtrado');
check(normalizeStandings({ response: [{ league: {} }] }).length === 0, 'league sin standings');
check(normalizeTeams({ response: [null, {}] }).length === 0, 'equipos inválidos múltiples');
check(normalizeInjuries({ response: [null, {}] }).length === 0, 'lesiones inválidas múltiples');
check(normalizePlayers({ response: [null, {}] }).length === 0, 'jugadores inválidos múltiples');
check(normalizeStandings({ response: [null, {}] }).length === 0, 'clasificación inválida múltiple');

assert.equal(checks, 78, `Se esperaban 78 comprobaciones base y hay ${checks}`);

/* 79-100 request/config contracts: no live key is embedded */
const config = readConfig({ API_FOOTBALL_API_KEY: 'test-key', API_FOOTBALL_LALIGA_LEAGUE_ID: '140', API_FOOTBALL_LALIGA_SEASON: '2026' });
check(config.apiFootballKey === 'test-key', 'config API key leída desde entorno');
check(config.apiFootballLeagueId === '140', 'config LaLiga ID 140');
check(config.apiFootballSeason === '2026', 'config temporada 2026');
check(!fs.readFileSync('./realdata.mjs', 'utf8').includes('x-apisports-key: YOUR'), 'sin clave de ejemplo hardcodeada');
check(!fs.readFileSync('./data-client.js', 'utf8').includes('API_FOOTBALL_API_KEY'), 'cliente sin clave API');
check(!fs.readFileSync('./realdata.mjs', 'utf8').includes('Bearer ey'), 'sin bearer hardcodeado');
check(fs.readFileSync('./realdata.mjs', 'utf8').includes("'/teams'"), 'endpoint equipos definido');
check(fs.readFileSync('./realdata.mjs', 'utf8').includes("'/players'"), 'endpoint jugadores definido');
check(fs.readFileSync('./realdata.mjs', 'utf8').includes("'/standings'"), 'endpoint clasificación definido');
check(fs.readFileSync('./realdata.mjs', 'utf8').includes("'/injuries'"), 'endpoint lesiones definido');
check(fs.readFileSync('./server.mjs', 'utf8').includes("'/api/data/teams'"), 'ruta equipos expuesta');
check(fs.readFileSync('./server.mjs', 'utf8').includes("'/api/data/players'"), 'ruta jugadores expuesta');
check(fs.readFileSync('./server.mjs', 'utf8').includes("'/api/data/standings'"), 'ruta clasificación expuesta');
check(fs.readFileSync('./server.mjs', 'utf8').includes("'/api/data/injuries'"), 'ruta lesiones expuesta');
check(fs.readFileSync('./server.mjs', 'utf8').includes("'data-client.js'"), 'cliente real-data servido');
check(fs.readFileSync('./config.mjs', 'utf8').includes("'/data-client.js'"), 'data-client en allowlist');
check(fs.readFileSync('./data-client.js', 'utf8').includes('api/fantasy/dashboard'), 'cliente sincroniza panel LIVE LALIGA');
check(fs.readFileSync('./data-client.js', 'utf8').includes("credentials: 'include'"), 'cliente usa cookies');
check(fs.readFileSync('./data-client.js', 'utf8').includes("cache: 'no-store'"), 'cliente evita datos obsoletos');
check(fs.readFileSync('./data-client.js', 'utf8').includes('LIVE'), 'estado LIVE visible');
assert.equal(checks, 100, `Se esperaban exactamente 100 comprobaciones de contrato y hay ${checks}`);

/* Request functions are exercised by mocked fetch so no external credential is needed. */
const originalFetch = global.fetch;
let requests = [];
global.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  const address = String(url);
  if (address.includes('/teams?')) return new Response(JSON.stringify(teamsPayload));
  if (address.includes('/players?')) return new Response(JSON.stringify({ ...playersPayload, paging: { current: 1, total: 2 }, results: 1 }));
  if (address.includes('/standings?')) return new Response(JSON.stringify(standingsPayload));
  if (address.includes('/injuries?')) return new Response(JSON.stringify(injuriesPayload));
  return new Response(JSON.stringify({ response: [] }));
};
try {
  const gotTeams = await fetchTeams(config);
  const gotPlayers = await fetchPlayers(config, 2);
  const gotStandings = await fetchStandings(config);
  const gotInjuries = await fetchInjuries(config);
  check(gotTeams.length === 1, 'fetchTeams usa normalizador');
  check(gotPlayers.players.length === 1 && gotPlayers.page === 1 && gotPlayers.totalPages === 2, 'fetchPlayers respeta paginación');
  check(gotStandings.length === 1, 'fetchStandings usa normalizador');
  check(gotInjuries.length === 1, 'fetchInjuries usa normalizador');
  check(requests.length === 4, 'cuatro peticiones esperadas');
  check(requests[0].url.includes('league=140'), 'teams incluye league 140');
  check(requests[0].url.includes('season=2026'), 'teams incluye season 2026');
  check(requests[1].url.includes('page=2'), 'players incluye page 2');
  check(requests.every(x => x.options.headers['x-apisports-key'] === 'test-key'), 'todas las llamadas usan header seguro');
  check(requests.every(x => x.options.method === undefined || x.options.method === 'GET'), 'peticiones de proveedor son solo lectura');
} finally {
  global.fetch = originalFetch;
}

console.log(`✅ Real-data tests: ${checks}/110 passed (100 contract checks + 10 request checks)`);
