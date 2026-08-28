import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DEFAULTS, VERSION, oidcConfigured, publicStaticPath, readConfig } from './config.mjs';
import { fixtureKey, normalizeApiFootball, normalizeFootballData, normalizeSportmonks, providerStatus } from './providers.mjs';
import { normalizeTeams, normalizePlayers, normalizeStandings, normalizeInjuries } from './realdata.mjs';

let checks = 0;
function check(value, message){ checks += 1; assert.ok(value, message); }

check(VERSION === '2.11.1', 'version runtime sincronizada');
check(DEFAULTS.laligaCompetitionId === '1', 'competición LALIGA');
check(DEFAULTS.apiFootballLeagueId === '140', 'API-Football LaLiga');
check(DEFAULTS.apiFootballSeason === '2026', 'temporada 2026');
check(DEFAULTS.sessionCookieName === 'fm_session', 'cookie canónica');
check(readConfig({}).host === '0.0.0.0', 'host por defecto público');
check(readConfig({}).port === 3005, 'puerto local por defecto');
check(readConfig({ PORT: '10000', HOST: '0.0.0.0' }).port === 10000, 'Render PORT');
check(readConfig({ PORT: '10000', HOST: '0.0.0.0' }).host === '0.0.0.0', 'Render HOST');
check(oidcConfigured(readConfig({})) === false, 'OIDC no inventado');
check(oidcConfigured({ laligaAuthorizeUrl:'https://x/authorize', laligaOAuthClientId:'x', laligaRedirectUri:'https://x/callback' }), 'OIDC completo');
check(publicStaticPath('/'), 'raíz pública');
check(publicStaticPath('/index.html'), 'HTML público');
check(publicStaticPath('/dashboard-client.js'), 'dashboard público');
check(publicStaticPath('/connection-client.js'), 'conexión pública');
check(!publicStaticPath('/server.mjs'), 'server privado');
check(!publicStaticPath('/config.mjs'), 'config privado');
check(!publicStaticPath('/.env'), 'env privado');

const api = { response:[{ fixture:{id:10,date:'2026-08-28T18:00:00Z',status:{short:'NS'}}, league:{id:140,round:'Regular Season - 2'}, teams:{home:{id:1,name:'FC Barcelona'},away:{id:2,name:'Real Madrid'}} }] };
const normalized = normalizeApiFootball(api);
check(normalized.length === 1, 'normaliza API-Football');
check(normalized[0].provider === 'api-football', 'provider correcto');
check(normalized[0].competitionId === '140', 'competición normalizada');
check(normalized[0].home === 'FC Barcelona', 'local normalizado');
check(normalized[0].away === 'Real Madrid', 'visitante normalizado');
check(normalized[0].status === 'NS', 'estado normalizado');
check(normalized[0].homeTeamId === 1 && normalized[0].awayTeamId === 2, 'IDs de equipos');
check(fixtureKey(normalized[0]) === '2026-08-28T18:00|barcelona|madrid', 'clave de partido estable');
check(normalizeApiFootball({}).length === 0, 'respuesta API vacía segura');
check(normalizeFootballData({ matches:[] }).length === 0, 'football-data vacío seguro');
check(normalizeSportmonks({ data:[] }).length === 0, 'Sportmonks vacío seguro');

const teamPayload = { response:[{team:{id:529,name:'FC Barcelona',code:'BAR',country:'Spain',logo:'x'},venue:{name:'Camp Nou',city:'Barcelona',capacity:99000}},{}] };
const teamRows = normalizeTeams(teamPayload);
check(teamRows.length === 1, 'equipos inválidos filtrados');
check(teamRows[0].id === 529 && teamRows[0].name === 'FC Barcelona', 'equipo normalizado');
const playerPayload = { response:[{player:{id:1001,name:'Jugador Real',age:25,nationality:'Spain'},statistics:[{games:{position:'M',appearences:2,lineups:2,minutes:180,rating:'7.2'},team:{id:529,name:'FC Barcelona'},goals:{total:1,assists:1}}]},{}] };
const playerRows = normalizePlayers(playerPayload);
check(playerRows.length === 1, 'jugadores inválidos filtrados');
check(playerRows[0].id === 1001 && playerRows[0].rating === 7.2, 'jugador normalizado');
const standingsPayload = { response:[{league:{standings:[[{rank:1,team:{id:529,name:'FC Barcelona'},points:6,all:{played:2,win:2,draw:0,lose:0,goals:{for:5,against:1}}}]]}}] };
const standings = normalizeStandings(standingsPayload);
check(standings.length === 1, 'clasificación normalizada');
check(standings[0].rank === 1 && standings[0].points === 6, 'datos clasificación');
check(normalizeStandings({ response:[{league:{}}] }).length === 0, 'clasificación incompleta segura');
const injuries = normalizeInjuries({ response:[{player:{id:1001,name:'Jugador Real',type:'Injury',reason:'Muscle injury'},team:{id:529,name:'FC Barcelona'},fixture:{id:555,date:'2026-08-28T00:00:00+00:00'}},{}] });
check(injuries.length === 1, 'lesiones inválidas filtradas');
check(injuries[0].playerId === 1001 && injuries[0].fixtureId === 555, 'lesión normalizada');

const status = providerStatus(readConfig({ API_FOOTBALL_API_KEY:'x', SPORTMONKS_API_TOKEN:'y', SPORTMONKS_LALIGA_LEAGUE_ID:'1', OPTA_API_TOKEN:'z', OPTA_API_BASE_URL:'https://opta', OPTA_FIXTURES_PATH:'/fixtures' }));
check(status.apiFootball.configured, 'estado API-Football');
check(status.sportmonks.configured, 'estado Sportmonks');
check(status.opta.configured, 'estado Opta');
check(status.apiFootball.leagueId === '140', 'ID proveedor por defecto');

const serverSource = fs.readFileSync('./server.mjs','utf8');
check(serverSource.includes('server.listen(config.port,config.host'), 'servidor escucha PORT/HOST');
check(serverSource.includes("'/api/health'"), 'health route');
check(serverSource.includes('sendJsonWithCookie'), 'respuesta de login definida');
check(serverSource.includes('cookieHeader'), 'cookie helper definido');
check(serverSource.includes('credentials'), 'sesión protegida');
check(serverSource.includes('READ_ROUTES'), 'allowlist lectura');
check(!serverSource.includes("case'buy'"), 'sin ruta de compra');
check(!serverSource.includes("case'sell'"), 'sin ruta de venta');
check(!serverSource.includes('console.log(email'), 'sin log de credenciales');
check(!serverSource.includes('console.log(password'), 'sin log de contraseña');
const packageJson = JSON.parse(fs.readFileSync('./package.json','utf8'));
check(packageJson.version === VERSION, 'package y runtime sincronizados');
check(packageJson.engines.node === '24.14.1', 'Node fijado');
check(packageJson.scripts.start.includes('server.mjs'), 'start válido');

for (const file of ['server.mjs','config.mjs','providers.mjs','realdata.mjs','brain-engine.js','brain-engine-v25.js']) {
  check(fs.existsSync(file), `archivo crítico presente: ${file}`);
}

const childPort = 39000 + Math.floor(Math.random()*500);
const child = spawn(process.execPath, ['server.mjs'], { env:{...process.env,NODE_ENV:'test',PORT:String(childPort),HOST:'0.0.0.0',SECURE_COOKIE:'false'}, stdio:['ignore','pipe','pipe'] });
let bootOutput='';
child.stdout.on('data', d => bootOutput += d.toString());
child.stderr.on('data', d => bootOutput += d.toString());
async function waitHealth(){
  const deadline = Date.now()+8000;
  while(Date.now()<deadline){
    try { const r=await fetch(`http://127.0.0.1:${childPort}/api/health`,{cache:'no-store'}); if(r.ok)return r; } catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error(`server boot failed: ${bootOutput}`);
}
try {
  const health = await waitHealth();
  const body = await health.json();
  check(body.ok === true, 'health ok');
  check(body.readOnly === true, 'health read-only');
  check(body.competition === '1', 'health competition');
  check(body.version === VERSION, 'health version');
  const session = await fetch(`http://127.0.0.1:${childPort}/api/session`,{cache:'no-store'});
  const sessionBody = await session.json();
  check(session.status === 200 && sessionBody.authenticated === false, 'session anónima');
  const invalid = await fetch(`http://127.0.0.1:${childPort}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})});
  check(invalid.status === 400, 'login inválido no rompe servidor');
  const missing = await fetch(`http://127.0.0.1:${childPort}/api/fantasy/squad`,{cache:'no-store'});
  check(missing.status === 401, 'ruta Fantasy exige sesión');
} finally {
  child.kill('SIGTERM');
}

console.log(`QA OK: ${checks} comprobaciones superadas`);
