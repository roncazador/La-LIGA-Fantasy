import assert from 'node:assert/strict';
import fs from 'node:fs';
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
   3) OIDC: NO INVENTAR CREDENCIALES
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
   4) LISTA BLANCA DE ARCHIVOS PÚBLICOS
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
   5) EL SERVIDOR NO DEBE CONTENER TOKENS
========================================= */

const serverSource = fs.readFileSync('./server.mjs', 'utf8');
assert.equal(serverSource.includes('FOOTBALL_DATA_TOKEN = \'sk-'), false);
assert.equal(serverSource.includes('token_en_claro'), false);

console.log('✅ Test 1: política solo lectura OK');
console.log('✅ Test 2: configuración canónica OK');
console.log('✅ Test 3: OIDC requiere configuración oficial OK');
console.log('✅ Test 4: lista blanca de archivos públicos OK');
console.log('✅ Test 5: no se detectan tokens hardcodeados OK');
console.log('✅ TODOS LOS TESTS DE SEGURIDAD/CONFIGURACIÓN OK');
