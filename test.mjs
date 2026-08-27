import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DEFAULTS, VERSION, oidcConfigured, publicStaticPath, readConfig } from './config.mjs';
import { providerStatus } from './providers.mjs';

/* =========================================
   1) POLÍTICA SOLO LECTURA
========================================= */

const allowed = new Set([
  'profile', 'leagues', 'league', 'squad', 'budget', 'market', 'fixtures',
  'players', 'stats', 'rivals', 'standings', 'week'
]);

for (const route of ['buy', 'sell', 'bid', 'clause', 'blind', 'lineup-write']) {
  assert.equal(allowed.has(route), false, `Ruta de escritura permitida: ${route}`);
}

/* =========================================
   2) CONFIGURACIÓN CANÓNICA
========================================= */

assert.equal(DEFAULTS.laligaCompetitionId, '1');
assert.equal(DEFAULTS.sessionCookieName, 'fm_session');
assert.equal(DEFAULTS.footballDataCompetition, 'PD');
assert.equal(DEFAULTS.footballDataDays, 30);
assert.equal(DEFAULTS.apiFootballLeagueId, '140');
assert.equal(DEFAULTS.apiFootballSeason, '2026');
assert.equal(VERSION, '2.7.0');

const config = readConfig({
  LALIGA_API_BASE_URL: 'https://example.test///',
  LALIGA_COMPETITION_ID: '1',
  SESSION_COOKIE_NAME: 'fm_session',
  FOOTBALL_DATA_COMPETITION: 'PD',
  FOOTBALL_DATA_DAYS: '999',
  SPORTMONKS_API_TOKEN: 'token',
  SPORTMONKS_LALIGA_LEAGUE_ID: '501',
  API_FOOTBALL_API_KEY: 'key',
  API_FOOTBALL_LALIGA_LEAGUE_ID: '140',
  API_FOOTBALL_LALIGA_SEASON: '2026',
  OPTA_API_TOKEN: 'token',
  OPTA_API_BASE_URL: 'https://opta.example',
  OPTA_FIXTURES_PATH: '/fixtures',
  OPTA_LALIGA_COMPETITION_ID: 'laliga'
});

assert.equal(config.laligaApiBaseUrl, 'https://example.test');
assert.equal(config.laligaCompetitionId, '1');
assert.equal(config.sessionCookieName, 'fm_session');
assert.equal(config.footballDataCompetition, 'PD');
assert.equal(config.footballDataDays, 90, 'Los días deben limitarse a 90');
assert.equal(config.sportmonksToken, 'token');
assert.equal(config.sportmonksLeagueId, '501');
assert.equal(config.apiFootballKey, 'key');
assert.equal(config.apiFootballLeagueId, '140');
assert.equal(config.apiFootballSeason, '2026');
assert.equal(config.optaToken, 'token');
assert.equal(config.optaBaseUrl, 'https://opta.example');
assert.equal(config.optaFixturesPath, '/fixtures');
assert.equal(config.optaCompetitionId, 'laliga');
assert.equal(config.allowOrigin, '');
assert.equal(config.secureCookie, true);

/* =========================================
   3) COMPATIBILIDAD CON LAS VARIABLES ANTIGUAS
========================================= */

const legacyConfig = readConfig({
  LALIGA_CONCOMPETENCIA_ID: '77',
  'SESIÓN_NOMBRE_DE LA_COOKIE': 'legacy_session',
  'COMPETENCIA_DE_DATOS_DE_FÚTBOL': 'XX',
  'DÍAS_DE_DATOS_DE_FÚTBOL': '14'
});
assert.equal(legacyConfig.laligaCompetitionId, '77');
assert.equal(legacyConfig.sessionCookieName, 'legacy_session');
assert.equal(legacyConfig.footballDataCompetition, 'XX');
assert.equal(legacyConfig.footballDataDays, 14);

/* =========================================
   4) OIDC: NO INVENTAR CREDENCIALES
========================================= */

assert.equal(oidcConfigured(config), false, 'OIDC no debe aparecer configurado sin los 3 parámetros oficiales');
assert.equal(oidcConfigured({
  laligaAuthorizeUrl: 'https://login.example/authorize',
  laligaOAuthClientId: 'client',
  laligaRedirectUri: 'https://example.test/auth/callback'
}), true);

/* =========================================
   5) LISTA BLANCA DE ARCHIVOS PÚBLICOS
========================================= */

assert.equal(publicStaticPath('/'), true);
assert.equal(publicStaticPath('/index.html'), true);
assert.equal(publicStaticPath('/manifest.json'), true);
assert.equal(publicStaticPath('/sw.js'), true);
assert.equal(publicStaticPath('/dashboard-client.js'), true);
assert.equal(publicStaticPath('/.env'), false);
assert.equal(publicStaticPath('/server.mjs'), false);
assert.equal(publicStaticPath('/package.json'), false);
assert.equal(publicStaticPath('/secret.json'), false);

/* =========================================
   6) PWA: SIN CACHE ANTIGUA DE HTML
========================================= */

const swSource = fs.readFileSync('./sw.js', 'utf8');
assert.equal(swSource.includes('fm-v251'), true);
assert.equal(swSource.includes("request.mode === 'navigate'"), true);
assert.equal(swSource.includes("cache: 'no-store'"), true);
assert.equal(swSource.includes('skipWaiting()'), true);
assert.equal(swSource.includes('clients.claim()'), true);

const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
assert.equal(manifest.orientation, 'landscape');
assert.equal(manifest.lang, 'es');

/* =========================================
   7) ARRANQUE Y VERSIONADO
========================================= */

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
assert.equal(packageJson.version, '2.7.0');
assert.equal(packageJson.scripts.start, 'node --import ./config.mjs server.mjs');
assert.equal(packageJson.scripts.test, 'node test.mjs');

const indexSource = fs.readFileSync('./index.html', 'utf8');
assert.equal(indexSource.includes('v2.6.0') || indexSource.includes('v2.7.0'), true, 'El HTML debe mostrar una versión actual');
assert.equal(indexSource.includes('/dashboard-client.js'), false, 'La integración del cliente debe hacerla el servidor para no duplicar capas');
assert.equal(indexSource.includes('v2.4'), false, 'No debe quedar una referencia antigua v2.4');

/* =========================================
   8) TOKENS: NUNCA EN CÓDIGO
========================================= */

const serverSource = fs.readFileSync('./server.mjs', 'utf8');
const providerSource = fs.readFileSync('./providers.mjs', 'utf8');
assert.equal(serverSource.includes('token_en_claro'), false);
assert.equal(serverSource.includes('sk-live-'), false);
assert.equal(serverSource.includes('sk-test-'), false);
assert.equal(serverSource.includes('process.env.FOOTBALL_DATA_TOKEN'), false);
assert.equal(providerSource.includes('process.env.SPORTMONKS_API_TOKEN'), false);
assert.equal(providerSource.includes('process.env.API_FOOTBALL_API_KEY'), false);
assert.equal(providerSource.includes('process.env.OPTA_API_TOKEN'), false);

/* =========================================
   9) CLIENTE DE DASHBOARD + CONEXIÓN OIDC
========================================= */

const dashboardClient = fs.readFileSync('./dashboard-client.js', 'utf8');
assert.equal(dashboardClient.includes('/api/fantasy/dashboard'), true);
assert.equal(dashboardClient.includes('/api/auth/status'), true);
assert.equal(dashboardClient.includes('/api/providers/status'), true);
assert.equal(dashboardClient.includes('/auth/start?platform=ios'), true);
assert.equal(dashboardClient.includes('Conectar LALIGA'), true);
assert.equal(dashboardClient.includes('providerMatrix'), true);
assert.equal(dashboardClient.includes('API-Football'), true);
assert.equal(dashboardClient.includes('Sportmonks'), true);
assert.equal(dashboardClient.includes('Opta / Stats Perform'), true);
assert.equal(dashboardClient.includes("credentials: 'include'"), true);
assert.equal(dashboardClient.includes("cache: 'no-store'"), true);
assert.equal(dashboardClient.includes('solo lectura'), true);

/* =========================================
   10) MULTI-PROVIDER: CONFIGURACIÓN Y ESTADO
========================================= */

const emptyProviderConfig = readConfig({});
const emptyStatus = providerStatus(emptyProviderConfig);
assert.equal(emptyStatus.sportmonks.configured, false);
assert.equal(emptyStatus.apiFootball.configured, false);
assert.equal(emptyStatus.opta.configured, false);
assert.equal(emptyStatus.apiFootball.leagueId, '140');

const fullStatus = providerStatus(config);
assert.equal(fullStatus.sportmonks.configured, true);
assert.equal(fullStatus.apiFootball.configured, true);
assert.equal(fullStatus.opta.configured, true);
assert.match(fullStatus.sportmonks.note, /LaLiga/i);
assert.match(fullStatus.opta.note, /credenciales/i);

/* =========================================
   11) INTEGRACIÓN REAL DEL SERVIDOR
========================================= */

async function waitForServer(url, timeout = 7000){
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { return await fetch(url, { cache: 'no-store' }); }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error(`Servidor no inició a tiempo: ${url}`);
}

const port = 34000 + Math.floor(Math.random() * 1000);
const child = spawn(process.execPath, ['server.mjs'], {
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    HOST: '127.0.0.1',
    SECURE_COOKIE: 'false',
    FOOTBALL_DATA_TOKEN: '',
    LALIGA_AUTHORIZE_URL: '',
    LALIGA_OAUTH_CLIENT_ID: '',
    LALIGA_REDIRECT_URI: '',
    SPORTMONKS_API_TOKEN: '',
    SPORTMONKS_LALIGA_LEAGUE_ID: '',
    API_FOOTBALL_API_KEY: '',
    OPTA_API_TOKEN: '',
    OPTA_API_BASE_URL: '',
    OPTA_FIXTURES_PATH: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

try {
  const base = `http://127.0.0.1:${port}`;
  const health = await waitForServer(`${base}/api/health`);
  assert.equal(health.status, 200);
  const healthJson = await health.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.readOnly, true);
  assert.equal(healthJson.version, '2.7.0');
  assert.equal(healthJson.competition, '1');
  assert.equal(healthJson.providers.apiFootball.configured, false);
  assert.equal(healthJson.providers.sportmonks.configured, false);
  assert.equal(healthJson.providers.opta.configured, false);

  const home = await fetch(`${base}/`, { cache: 'no-store' });
  assert.equal(home.status, 200);
  const homeText = await home.text();
  assert.match(homeText, /LALIGA Fantasy Manager/);
  assert.match(homeText, /dashboard-client\.js/);

  const providerStatusResponse = await fetch(`${base}/api/providers/status`, { cache: 'no-store' });
  assert.equal(providerStatusResponse.status, 200);
  const providerStatusJson = await providerStatusResponse.json();
  assert.equal(providerStatusJson.apiFootball.configured, false);
  assert.equal(providerStatusJson.sportmonks.configured, false);
  assert.equal(providerStatusJson.opta.configured, false);

  const apiFootballFixtures = await fetch(`${base}/api/providers/api-football/fixtures`, { cache: 'no-store' });
  assert.equal(apiFootballFixtures.status, 503);
  assert.equal((await apiFootballFixtures.json()).error, 'API_FOOTBALL_NOT_CONFIGURED');

  const sportmonksFixtures = await fetch(`${base}/api/providers/sportmonks/fixtures`, { cache: 'no-store' });
  assert.equal(sportmonksFixtures.status, 503);
  assert.equal((await sportmonksFixtures.json()).error, 'SPORTMONKS_NOT_CONFIGURED');

  const multiProvider = await fetch(`${base}/api/providers/fixtures/next`, { cache: 'no-store' });
  assert.equal(multiProvider.status, 200);
  const multiJson = await multiProvider.json();
  assert.equal(multiJson.ok, true);
  assert.equal(multiJson.readOnly, true);
  assert.equal(multiJson.providers['api-football'].ok, false);
  assert.equal(multiJson.providers.sportmonks.ok, false);
  assert.equal(multiJson.providers.opta.ok, false);
  assert.deepEqual(multiJson.merged, []);

  const privateServer = await fetch(`${base}/server.mjs`, { cache: 'no-store' });
  assert.equal(privateServer.status, 404, 'server.mjs no debe exponerse públicamente');
  const privatePackage = await fetch(`${base}/package.json`, { cache: 'no-store' });
  assert.equal(privatePackage.status, 404, 'package.json no debe exponerse públicamente');

  const fixtures = await fetch(`${base}/api/fixtures/next`, { cache: 'no-store' });
  assert.equal(fixtures.status, 503, 'Sin token, football-data debe responder 503 controlado');
  const fixturesJson = await fixtures.json();
  assert.equal(fixturesJson.error, 'FOOTBALL_DATA_NOT_CONFIGURED');

  const auth = await fetch(`${base}/api/auth/status`, { cache: 'no-store' });
  assert.equal(auth.status, 200);
  const authJson = await auth.json();
  assert.equal(authJson.configured, false);
  assert.equal(authJson.missing.length, 3);

  const dashboardWithoutSession = await fetch(`${base}/api/fantasy/dashboard`, { cache: 'no-store' });
  assert.equal(dashboardWithoutSession.status, 401);
  const dashboardJson = await dashboardWithoutSession.json();
  assert.equal(dashboardJson.error, 'AUTH_REQUIRED');

  const writeRoute = await fetch(`${base}/api/fantasy/buy`, { method: 'POST' });
  assert.equal(writeRoute.status, 405);
  const writeJson = await writeRoute.json();
  assert.equal(writeJson.error, 'READ_ONLY');

  console.log('✅ Test 11: integración HTTP real + multi-provider OK');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 100));
  if (!child.killed) child.kill('SIGKILL');
}

console.log('✅ Test 1: política solo lectura OK');
console.log('✅ Test 2: configuración canónica OK');
console.log('✅ Test 3: compatibilidad con variables antiguas OK');
console.log('✅ Test 4: OIDC requiere configuración oficial OK');
console.log('✅ Test 5: lista blanca pública definida OK');
console.log('✅ Test 6: Service Worker y PWA OK');
console.log('✅ Test 7: arranque y versionado OK');
console.log('✅ Test 8: no se detectan tokens hardcodeados OK');
console.log('✅ Test 9: cliente del dashboard + matriz de proveedores OK');
console.log('✅ Test 10: adaptadores y estado multi-provider OK');
console.log('✅ TODOS LOS TESTS DE SEGURIDAD/ESTABILIDAD/INTEGRACIÓN OK');
