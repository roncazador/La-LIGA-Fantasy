import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { VERSION, DEFAULTS, oidcConfigured, publicStaticPath, readConfig } from './config.mjs';
import { fixtureKey, normalizeApiFootball, normalizeFootballData, normalizeSportmonks, providerStatus } from './providers.mjs';
import { normalizeTeams, normalizePlayers, normalizeStandings, normalizeInjuries } from './realdata.mjs';

let checks=0;
function check(v,m){checks+=1;assert.ok(v,m)}

check(VERSION==='2.11.1','version runtime sincronizada');
check(DEFAULTS.laligaCompetitionId==='1','competición LALIGA'); check(DEFAULTS.laligaApiBaseUrl.endsWith('/api'),'API Fantasy incluye /api');
check(DEFAULTS.apiFootballLeagueId==='140','API-Football LaLiga');
check(DEFAULTS.apiFootballSeason==='2026','temporada 2026');
check(DEFAULTS.sessionCookieName==='fm_session','cookie canónica');
check(readConfig({}).host==='0.0.0.0','host por defecto público');
check(readConfig({}).port===3005,'puerto local por defecto');
check(readConfig({PORT:'10000',HOST:'0.0.0.0'}).port===10000,'Render PORT');
check(readConfig({PORT:'10000',HOST:'0.0.0.0'}).host==='0.0.0.0','Render HOST');
check(oidcConfigured(readConfig({})),'OIDC oficial por defecto');
check(oidcConfigured({laligaAuthorizeUrl:'https://x/authorize',laligaOAuthClientId:'x',laligaRedirectUri:'https://x/callback'}),'OIDC completo');
for(const p of ['/','/index.html','/dashboard-client.js','/connection-client.js','/brain-engine-v26.js'])check(publicStaticPath(p),`público ${p}`);
for(const p of ['/server.mjs','/config.mjs','/.env'])check(!publicStaticPath(p),`privado ${p}`);

const api={response:[{fixture:{id:10,date:'2026-08-28T18:00:00Z',status:{short:'NS'}},league:{id:140,round:'Regular Season - 2'},teams:{home:{id:1,name:'FC Barcelona'},away:{id:2,name:'Real Madrid'}}}]};
const n=normalizeApiFootball(api);
check(n.length===1,'normaliza API-Football');
check(n[0].provider==='api-football','provider correcto');
check(n[0].competitionId==='140','competición normalizada');
check(n[0].home==='FC Barcelona'&&n[0].away==='Real Madrid','equipos normalizados');
check(n[0].status==='NS','estado normalizado');
check(n[0].homeTeamId===1&&n[0].awayTeamId===2,'IDs equipos');
check(fixtureKey(n[0])==='2026-08-28T18:00|barcelona|madrid','clave estable');
check(normalizeApiFootball({}).length===0,'API vacía segura');
check(normalizeFootballData({matches:[]}).length===0,'football-data vacío');
check(normalizeSportmonks({data:[]}).length===0,'Sportmonks vacío');

const teams=normalizeTeams({response:[{team:{id:529,name:'FC Barcelona',code:'BAR',country:'Spain',logo:'x'},venue:{name:'Camp Nou',city:'Barcelona',capacity:99000}},{}]});
check(teams.length===1,'equipos inválidos filtrados');
check(teams[0].id===529,'equipo normalizado');
const players=normalizePlayers({response:[{player:{id:1001,name:'Jugador Real'},statistics:[{games:{position:'M',appearences:2,lineups:2,minutes:180,rating:'7.2'},team:{id:529,name:'FC Barcelona'},goals:{total:1,assists:1}}]},{}]});
check(players.length===1,'jugadores inválidos filtrados');
check(players[0].id===1001&&players[0].rating===7.2,'jugador normalizado');
const standings=normalizeStandings({response:[{league:{standings:[[{rank:1,team:{id:529,name:'FC Barcelona'},points:6,all:{played:2,win:2,draw:0,lose:0,goals:{for:5,against:1}}]]}}]});
check(standings.length===1,'clasificación normalizada');
check(standings[0].rank===1&&standings[0].points===6,'clasificación');
check(normalizeStandings({response:[{league:{}}]}).length===0,'clasificación incompleta');
const injuries=normalizeInjuries({response:[{player:{id:1001,name:'Jugador Real',type:'Injury',reason:'Muscle injury'},team:{id:529,name:'FC Barcelona'},fixture:{id:555,date:'2026-08-28T00:00:00+00:00'}},{}]});
check(injuries.length===1,'lesiones filtradas');
check(injuries[0].playerId===1001&&injuries[0].fixtureId===555,'lesión normalizada');

const status=providerStatus(readConfig({API_FOOTBALL_API_KEY:'x',SPORTMONKS_API_TOKEN:'y',SPORTMONKS_LALIGA_LEAGUE_ID:'1',OPTA_API_TOKEN:'z',OPTA_API_BASE_URL:'https://opta',OPTA_FIXTURES_PATH:'/fixtures'}));
check(status.apiFootball.configured,'API-Football status');
check(status.sportmonks.configured,'Sportmonks status');
check(status.opta.configured,'Opta status');

const serverSource=fs.readFileSync('./server.mjs','utf8');
const connectionSource=fs.readFileSync('./connection-client.js','utf8');
const brain26Source=fs.readFileSync('./brain-engine-v26.js','utf8');
check(/server\.listen\(\s*config\.port\s*,\s*config\.host/.test(serverSource),'servidor escucha PORT/HOST');
check(serverSource.includes("url.pathname === '/api/health'"),'health route');
check(serverSource.includes('cookieHeader'),'cookie helper');
check(serverSource.includes('READ_ROUTES'),'allowlist lectura');
check(serverSource.includes('grant_type:\'password\''),'login directo LALIGA');
check(serverSource.includes('B2C_1A_ResourceOwnerv2'),'policy login directo');
check(serverSource.includes('connection-client.js'),'cliente de conexión cargable');
check(serverSource.includes("content.includes('connection-client.js')"),'loader evita duplicados');
check(connectionSource.includes("/api/auth/login"),'cliente login directo');
check(connectionSource.includes('autocomplete="current-password"'),'campo contraseña compatible con iOS');
check(connectionSource.includes('passwordNode.value = \''\''),'contraseña limpiada tras intento');
check(!connectionSource.includes('localStorage.setItem(\'laligaPassword'),'contraseña no persistida');
check(!/console\.log\(.*password/i.test(serverSource),'sin log de contraseña');
check(serverSource.includes("/api/auth/google/start"),'Google start route'); check(serverSource.includes("/api/auth/google/finish"),'Google finish route'); check(!serverSource.includes("case'buy'"),'sin compra');
check(!serverSource.includes("case'sell'"),'sin venta');
check(connectionSource.includes("fetch('/brain-engine-v26.js'"),'cerebro v2.6 cargado por el cliente de conexión');
check(connectionSource.includes('__fantasyBrain26Loaded'),'cerebro v2.6 no se duplica');
check(brain26Source.includes("const BRAIN_VERSION = '2.6'"),'versión cerebro v2.6');
check(brain26Source.includes('dataQuality'),'calidad de datos por campo');
check(brain26Source.includes('transferScore'),'señal específica de mercado');
check(brain26Source.includes('FALTA INFORMACIÓN'),'decisión por incertidumbre');
check(brain26Source.includes('No se inventan datos nuevos'),'sin inventar datos en fallback');

const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
check(pkg.version===VERSION,'package/runtime sincronizados');
check(pkg.engines.node==='24.14.1','Node fijado');
check(pkg.scripts.start.includes('server.mjs'),'start válido');
for(const f of ['server.mjs','config.mjs','providers.mjs','realdata.mjs','brain-engine.js','brain-engine-v25.js','brain-engine-v26.js','connection-client.js'])check(fs.existsSync(f),`archivo crítico ${f}`);

const port=39000+Math.floor(Math.random()*500);
const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,NODE_ENV:'test',PORT:String(port),HOST:'0.0.0.0',SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
let boot=''; child.stdout.on('data',d=>boot+=d); child.stderr.on('data',d=>boot+=d);
async function wait(){const end=Date.now()+8000;while(Date.now()<end){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{cache:'no-store'});if(r.ok)return r}catch{} await new Promise(r=>setTimeout(r,100))}throw new Error(`server boot failed: ${boot}`)}
try{
  const h=await wait();
  const hb=await h.json();
  check(hb.ok===true,'health ok');
  check(hb.readOnly===true,'health read-only');
  check(hb.competition==='1','health competition');
  check(hb.version===VERSION,'health version');
  const html=await (await fetch(`http://127.0.0.1:${port}/`,{cache:'no-store'})).text();
  check(html.includes('<script src="/connection-client.js" defer></script>'),'index carga connection-client');
  const brain=await fetch(`http://127.0.0.1:${port}/brain-engine-v26.js`,{cache:'no-store'});
  check(brain.status===200,'brain v2.6 servido públicamente');
  const brainText=await brain.text();
  check(brainText.includes("BRAIN_VERSION = '2.6'"),'brain v2.6 accesible');
  const s=await fetch(`http://127.0.0.1:${port}/api/session`,{cache:'no-store'});
  const sb=await s.json();
  check(s.status===200&&sb.authenticated===false,'session anónima');
  const bad=await fetch(`http://127.0.0.1:${port}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  check(bad.status===400,'login inválido');
  const no=await fetch(`http://127.0.0.1:${port}/api/fantasy/squad`,{cache:'no-store'});
  check(no.status===401,'Fantasy exige sesión');
}finally{child.kill('SIGTERM')}
console.log(`QA OK: ${checks} comprobaciones superadas`);