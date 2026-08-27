import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeTeams, normalizeStandings, normalizePlayers, normalizeInjuries, fetchTeams, fetchPlayers, fetchStandings, fetchInjuries } from './realdata.mjs';
import { readConfig } from './config.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, `${checks}. ${message}`); };

const teamsPayload = {
  response: [{ team: { id: 529, name: 'FC Barcelona', code: 'BAR', country: 'Spain', logo: 'https://media.test/bar.png' }, venue: { name: 'Spotify Camp Nou', city: 'Barcelona', capacity: 99787 } }]
};
const standingsPayload = {
  response: [{ league: { standings: [[{ rank: 1, team: { id: 529, name: 'FC Barcelona', logo: 'bar.png' }, points: 6, all: { played: 2, win: 2, draw: 0, lose: 0, goals: { for: 7, against: 1 } }, goalsDiff: 6, form: 'WW' }]] } }]
};
const playersPayload = {
  response: [{
    player: { id: 1001, name: 'Jugador Real', age: 24, nationality: 'Spain', photo: 'photo.png' },
    statistics: [{ team: { id: 529, name: 'FC Barcelona' }, games: { position: 'F', appearences: 2, lineups: 2, minutes: 170, rating: '7.80' }, goals: { total: 2, assists: 1 }, shots: { total: 5, on: 3 }, passes: { total: 41, key: 6 }, duels: { total: 8, won: 5 }, tackles: { total: 2, interceptions: 1 }, cards: { yellow: 1, red: 0 } }]
  }]
};
const injuriesPayload = {
  response: [{ player: { id: 1001, name: 'Jugador Real', type: 'Injury', reason: 'Muscle injury' }, team: { id: 529, name: 'FC Barcelona' }, fixture: { id: 555, date: '2026-08-30T19:30:00+00:00' } }]
};

/* 1-20 teams */
const teams = normalizeTeams(teamsPayload);
check(Array.isArray(teams), 'equipos siempre devuelve array');
check(teams.length === 1, 'un equipo normalizado');
check(teams[0].id === 529, 'ID de equipo');
check(teams[0].name === 'FC Barcelona', 'nombre de equipo');
check(teams[0].code === 'BAR', 'código de equipo');
check(teams[0].country === 'Spain', 'país de equipo');
check(teams[0].logo === 'https://media.test/bar.png', 'logo de equipo');
check(teams[0].venue === 'Spotify Camp Nou', 'estadio');
check(teams[0].city === 'Barcelona', 'ciudad');
check(teams[0].capacity === 99787, 'capacidad');
check(normalizeTeams({}).length === 0, 'payload vacío de equipos');
check(normalizeTeams({ response: [] }).length === 0, 'respuesta vacía de equipos');
check(normalizeTeams({ response: [{ team: null }] }).length === 0, 'equipo inválido filtrado');
check(normalizeTeams({ response: [{ team: { id: 1 } }] }).length === 0, 'equipo sin nombre filtrado');
check(normalizeTeams({ response: [{ team: { name: 'Sin ID' } }] }).length === 0, 'equipo sin ID filtrado');
check(normalizeTeams({ response: [null, teamsPayload.response[0]] }).length === 1, 'null parcial no rompe');
check(teams[0].venue.includes('Camp Nou'), 'venue preservada');
check(teams[0].city.includes('Barcelona'), 'city preservada');
check(teams.every(x => x.id != null), 'todos los equipos tienen ID');
check(teams.every(x => x.name), 'todos los equipos tienen nombre');

/* 21-40 standings */
const standings = normalizeStandings(standingsPayload);
check(Array.isArray(standings), 'clasificación siempre devuelve array');
check(standings.length === 1, 'una fila normalizada');
check(standings[0].rank === 1, 'posición');
check(standings[0].teamId === 529, 'ID de equipo clasificación');
check(standings[0].team === 'FC Barcelona', 'nombre clasificación');
check(standings[0].points === 6, 'puntos');
check(standings[0].played === 2, 'partidos jugados');
check(standings[0].wins === 2, 'victorias');
check(standings[0].draws === 0, 'empates');
check(standings[0].losses === 0, 'derrotas');
check(standings[0].goalsFor === 7, 'goles a favor');
check(standings[0].goalsAgainst === 1, 'goles en contra');
check(standings[0].goalDiff === 6, 'diferencia de goles');
check(standings[0].form === 'WW', 'forma');
check(normalizeStandings({}).length === 0, 'clasificación vacía');
check(normalizeStandings({ response: [] }).length === 0, 'clasificación respuesta vacía');
check(normalizeStandings({ response: [{ league: { standings: [] } }] }).length === 0, 'sin tabla no rompe');
check(normalizeStandings({ response: [{ league: { standings: [[null, {}]] } }] }).length === 2, 'filas parciales conservan contrato');
check(standings.every(x => Object.hasOwn(x, 'points')), 'campo puntos presente');
check(standings.every(x => Object.hasOwn(x, 'goalDiff')), 'campo diferencia presente');

/* 41-60 players */
const players = normalizePlayers(playersPayload);
check(Array.isArray(players), 'jugadores siempre array');
check(players.length === 1, 'un jugador normalizado');
check(players[0].id === 1001, 'ID jugador');
check(players[0].name === 'Jugador Real', 'nombre jugador');
check(players[0].age === 24, 'edad jugador');
check(players[0].nationality === 'Spain', 'nacionalidad');
check(players[0].photo === 'photo.png', 'foto');
check(players[0].position === 'F', 'posición');
check(players[0].teamId === 529, 'equipo del jugador');
check(players[0].team === 'FC Barcelona', 'nombre del equipo');
check(players[0].appearances === 2, 'apariciones');
check(players[0].starts === 2, 'titularidades');
check(players[0].minutes === 170, 'minutos');
check(players[0].rating === 7.8, 'rating numérico');
check(players[0].goals === 2, 'goles');
check(players[0].assists === 1, 'asistencias');
check(players[0].shots === 5 && players[0].shotsOn === 3, 'tiros');
check(players[0].passes === 41 && players[0].keyPasses === 6, 'pases');
check(players[0].duels === 8 && players[0].duelsWon === 5, 'duelos');
check(players[0].tackles === 2 && players[0].interceptions === 1, 'entradas/intercepciones');

/* 61-80 injuries + edge cases */
const injuries = normalizeInjuries(injuriesPayload);
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

/* 81-100 request contracts mocked: no live key is embedded */
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
check(fs.readFileSync('./data-client.js', 'utf8').includes('Europe/Madrid') === false, 'no se fuerza zona horaria incorrecta en esta capa');
check(fs.readFileSync('./data-client.js', 'utf8').includes('credentials: \'include\''), 'cliente usa cookies');
check(fs.readFileSync('./data-client.js', 'utf8').includes("cache: 'no-store'"), 'cliente evita datos obsoletos');
check(fs.readFileSync('./data-client.js', 'utf8').includes('API-Football'), 'fuente visible');
check(checks === 100, 'exactamente 100 comprobaciones ejecutadas');

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
} finally {
  global.fetch = originalFetch;
}

console.log(`✅ Real-data tests: ${checks}/110 passed (100 contract checks + 10 request checks)`);
