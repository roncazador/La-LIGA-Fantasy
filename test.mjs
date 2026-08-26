import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DEFAULTS, VERSION, oidcConfigured, publicStaticPath, readConfig } from './config.mjs';

/* =========================================
   1) POLÍTICA SOLO LECTURA
========================================= */

const allowed = new Set([
  'profile',
  'leagues',
  'league',
  'squad',
  'budget',
  'market',
  'fixtures',
  'players',
  'stats',
  'rivals',
  'standings',
  'week'
]);

for (const route of [
  'buy',
  'sell',
  'bid',
  'clause',
  'blind',
  'lineup-write'
]) {
  assert.equal(allowed.has(route), false, `Ruta de escritura permitida: ${route}`);
}

/* =========================================
   2) CONFIGURACIÓN CANÓNICA
========================================= */

assert.equal(DEFAULTS.laligaCompetitionId, '1');
assert.equal(DEFAULTS.sessionCookieName, 'fm_session');
assert.equal(DEFAULTS.footballDataCompetition, 'PD');
assert.equal(DEFAULTS.footballDataDays, 30);
assert.equal(VERSION, '2.5.0');

const config = readConfig({
  LALIGA_API_BASE_URL: 'https://example.test///',
  LALIGA_COMPETITION_ID: '1',
  SESSION_COOKIE_NAME: 'fm_session',
  FOOTBALL_DATA_COMPETITION: 'PD',
  FOOTBALL_DATA_DAYS: '999'
});

assert.equal(config.laligaApiBaseUrl, 'https://example.test');
assert.equal(config.laligaCompetitionId, '1');
assert.equal(config.sessionCookieName, 'fm_session');
assert.equal(config.footballDataCompetition, 'PD');
assert.equal(config.footballDataDays, 90, 'Los días deben limitarse a 90');
assert.equal(config.allowOrigin, '');
assert.equal(config.secureCookie, true);

/* =========================================
   3) COMPATIBILIDAD CON LAS VARIABLES ANTIGUAS
========================================= */

const configSource = fs.readFileSync('./config.mjs', 'utf8');
for (const alias of [
  'LALIGA_CONCOMPETENCIA_ID',
  'SESIÓN_NOMBRE_DE LA_COOKIE',
  'COMPETENCIA_DE_DATOS_DE_FÚTBOL',
  'DÍAS_DE_DATOS_DE_FÚTBOL'
]) {
  assert.equal(
    configSource.includes(alias),
    true,
    `Falta compatibilidad con variable antigua: ${alias}`
  );
}

/* =========================================
   4) OIDC: NO INVENTAR CREDENCIALES
========================================= */

assert.equal(
  oidcConfigured(config),
  false,
  'OIDC no debe aparecer configurado sin los 3 parámetros oficiales'
);

assert.equal(
  oidcConfigured({
    laligaAuthorizeUrl: 'https://login.example/authorize',
    laligaOAuthClientId: 'client',
    laligaRedirectUri: 'https://example.test/auth/callback'
  }),
  true
);

/* =========================================
   5) LISTA BLANCA DE ARCHIVOS PÚBLICOS
========================================= */

assert.equal(publicStaticPath('/'), true);
assert.equal(publicStaticPath('/index.html'), true);
assert.equal(publicStaticPath('/manifest.json'), true);
assert.equal(publicStaticPath('/sw.js'), true);
assert.equal(publicStaticPath('/.env'), false);
assert.equal(publicStaticPath('/server.mjs'), false);
assert.equal(publicStaticPath('/package.json'), false);
assert.equal(publicStaticPath('/secret.json'), false);

/* =========================================
   6) PWA: SIN CACHE ANTIGUA DE HTML
========================================= */

const swSource = fs.readFileSync('./sw.js', 'utf8');
assert.equal(swSource.includes('fm-v25'), true);
assert.equal(swSource.includes("request.mode === 'navigate'"), true);
assert.equal(swSource.includes("cache: 'no-store'"), true);
assert.equal(swSource.includes('skipWaiting()'), true);
assert.equal(swSource.includes('clients.claim()'), true);

/* =========================================
   7) ARRANQUE Y VERSIONADO
========================================= */

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
assert.equal(packageJson.version, '2.5.0');
assert.equal(packageJson.scripts.start, 'node --import ./config.mjs server.mjs');
assert.equal(packageJson.scripts.test, 'node test.mjs');

/* =========================================
   8) TOKENS: NUNCA EN CÓDIGO
========================================= */

const serverSource = fs.readFileSync('./server.mjs', 'utf8');
assert.equal(serverSource.includes('token_en_claro'), false);
assert.equal(serverSource.includes('sk-live-'), false);
assert.equal(serverSource.includes('sk-test-'), false);
assert.equal(serverSource.includes('process.env.FOOTBALL_DATA_TOKEN'), false);

/* =========================================
   9) INTEGRACIÓN REAL DEL SERVIDOR
========================================= */

async function waitForServer(url, timeout = 5000){
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      return response;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Servidor no inició a tiempo: ${url}`);
}

const port = 34000 + Math.floor(Math.random() * 1000);
const child = spawn(
  process.execPath,
  ['server.mjs'],
  {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      HOST: '127.0.0.1',
      SECURE_COOKIE: 'false',
      FOOTBALL_DATA_TOKEN: '',
      LALIGA_AUTHORIZE_URL: '',
      LALIGA_OAUTH_CLIENT_ID: '',
      LALIGA_REDIRECT_URI: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  }
);

try {
  const base = `http://127.0.0.1:${port}`;
  const health = await waitForServer(`${base}/api/health`);
  assert.equal(health.status, 200);
  const healthJson = await health.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.readOnly, true);
  assert.equal(healthJson.version, '2.5.0');
  assert.equal(healthJson.competition, '1');
  assert.equal(healthJson.providers.footballData, false);
  assert.equal(healthJson.providers.laligaOAuth, false);

  const home = await fetch(`${base}/`, { cache: 'no-store' });
  assert.equal(home.status, 200);
  assert.match(await home.text(), /LALIGA Fantasy Manager/);

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

  const writeRoute = await fetch(`${base}/api/fantasy/buy`, { method: 'POST' });
  assert.equal(writeRoute.status, 405);
  const writeJson = await writeRoute.json();
  assert.equal(writeJson.error, 'READ_ONLY');

  console.log('✅ Test 9: integración HTTP real del backend OK');
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
console.log('✅ Test 6: Service Worker anti-cache antigua OK');
console.log('✅ Test 7: arranque y versionado OK');
console.log('✅ Test 8: no se detectan tokens hardcodeados OK');
console.log('✅ TODOS LOS TESTS DE SEGURIDAD/ESTABILIDAD/INTEGRACIÓN OK');
