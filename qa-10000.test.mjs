import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fixtureKey, normalizeApiFootball, normalizeFootballData, normalizeSportmonks, daysWindow, providerStatus } from './providers.mjs';
import { VERSION, DEFAULTS, oidcConfigured, publicStaticPath } from './config.mjs';

const server = fs.readFileSync('./server.mjs','utf8');
const config = fs.readFileSync('./config.mjs','utf8');
const dashboardSource = fs.readFileSync('./dashboard-client.js','utf8');
const calendarSource = fs.readFileSync('./calendar-client.js','utf8');
const pkg = JSON.parse(fs.readFileSync('./package.json','utf8'));
const seed = JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json','utf8'));

assert.equal(VERSION,'2.12.0','runtime 2.12.0');
assert.equal(pkg.version,'2.12.0','package 2.12.0');
assert.equal(pkg.engines.node,'24.14.1','Node runtime fijo');
assert.ok(pkg.scripts.test.includes('qa-10000.test.mjs'),'npm test incluye 10000 casos');
assert.ok(server.includes("url.pathname === '/api/fixtures'"),'endpoint de calendario');
assert.ok(server.includes("fetchMultiProviderFixtures(config)"),'calendario multi-proveedor');
assert.ok(calendarSource.includes('FANTASY_APP_V28') || calendarSource.includes('bootBridge'),'puente calendario único');
assert.ok(dashboardSource.includes("fetch('/api/fixtures'"),'cliente usa endpoint de calendario real');
assert.ok(dashboardSource.includes('payload?.merged'),'cliente admite respuesta merged');
assert.ok(dashboardSource.includes("/api/fantasy/dashboard"),'cliente conecta dashboard LALIGA');
assert.ok(dashboardSource.includes('laliga:live-data'),'cerebro recibe evento LIVE');
assert.ok(dashboardSource.includes('FANTASY_BRAIN_V28'),'cerebro v28 integrado');
assert.ok(dashboardSource.includes('data-tab="cerebro"'),'apartado cerebro visible');
assert.ok(dashboardSource.includes('data-tab="partidos"'),'apartado partidos visible');
assert.ok(dashboardSource.includes('data-tab="mercado"'),'apartado mercado visible');
assert.ok(dashboardSource.includes('hideLegacy'),'UI antigua ocultable');
assert.ok(publicStaticPath('/dashboard-client.js'),'dashboard público');
assert.ok(publicStaticPath('/calendar-client.js'),'calendar público');
assert.ok(!publicStaticPath('/server.mjs'),'server privado');
assert.ok(oidcConfigured({laligaAuthorizeUrl:'https://x/a',laligaOAuthClientId:'x',laligaRedirectUri:'x'}),'OIDC contract');
assert.equal(DEFAULTS.laligaCompetitionId,'1','competition LALIGA');

const apiFixture={fixture:{id:10,date:'2026-08-29T18:00:00Z',status:{short:'NS'}},league:{id:140,round:'Regular Season - 3'},teams:{home:{id:529,name:'FC Barcelona'},away:{id:2,name:'Rayo Vallecano'}}};
const normalized=normalizeApiFootball({response:[apiFixture]});
assert.equal(normalized.length,1);
assert.equal(fixtureKey(normalized[0]),'2026-08-29T18:00|barcelona|rayo vallecano');
assert.equal(normalizeApiFootball({}).length,0);
assert.equal(normalizeFootballData({matches:[]}).length,0);
assert.equal(normalizeSportmonks({data:[]}).length,0);
assert.match(daysWindow(7).from,/^2026-\d\d-\d\d$/);
assert.ok(seed.fixtures?.length > 0,'semilla de partidos no vacía');

const sandbox = {
  window: { addEventListener(){}, dispatchEvent(){}, setTimeout(){}, FANTASY_BRAIN_V28:null },
  document: {
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null;},
    querySelector(){return null;},
    querySelectorAll(){return [];},
    createElement(){return {style:{},setAttribute(){},appendChild(){},addEventListener(){}};},
    head:{appendChild(){}},
    documentElement:{},
  },
  CustomEvent: class { constructor(type,init){this.type=type;this.detail=init?.detail;} },
  Intl,
  Date,
  Number,
  String,
  Math,
  JSON,
  console
};
sandbox.window.window=sandbox.window;
sandbox.globalThis=sandbox;
vm.runInNewContext(dashboardSource,sandbox,{filename:'dashboard-client.js'});
const brain=sandbox.window.FANTASY_BRAIN_V28;
const app=sandbox.window.FANTASY_APP_V28;
assert.ok(brain && typeof brain.analyze==='function','brain API');
assert.ok(app && typeof app.normalizeFixtures==='function','app API');

const fixturePayload={merged:[
  {id:'f1',utcDate:'2026-08-29T18:00:00Z',home:'FC Barcelona',away:'Rayo Vallecano',status:'TIMED',matchday:3,source:'api-football'},
  {id:'f2',utcDate:'2026-08-30T20:00:00Z',home:'Real Madrid',away:'Sevilla',status:'TIMED',matchday:3,source:'api-football'}
]};
assert.equal(app.normalizeFixtures(fixturePayload).length,2,'normaliza merged');
assert.equal(app.normalizeFixtures({matches:fixturePayload.merged}).length,2,'normaliza matches');
assert.ok(app.normalizeFixtures(fixturePayload)[0].home,'partido normalizado');

let cases=0;
for(let i=0;i<10000;i++){
  const points=i%31;
  const minutes=(i*17)%91;
  const starts=i%7;
  const price=500000 + (i%9)*125000;
  const value=price + ((i%13)-3)*25000;
  const rotationRisk=(i%6)/5;
  const injuryRisk=(i%5)/4;
  const player={name:`Jugador ${i}`,position:['POR','DEF','MED','DEL'][i%4],team:i%2?'FC Barcelona':'Real Madrid',points,minutes,starts,price,value,rotationRisk,injuryRisk,availability:i%29===0?'Suspendido':''};
  const model=brain.analyze({dashboard:{team:{players:[player]},market:{data:[{player:{name:`Mercado ${i}`},points:points/2,minutes:minutes,starts,price:value*.88,value,rotationRisk:0.1,injuryRisk:0.05,status:'OK'}]},standing:[]},fixtures:fixturePayload.merged});
  assert.equal(model.players.length,1,`caso ${i}: player count`);
  assert.equal(model.market.length,1,`caso ${i}: market count`);
  assert.ok(model.best.score>=0 && model.best.score<=100,`caso ${i}: score range`);
  assert.ok(model.best.confidence>=20 && model.best.confidence<=100,`caso ${i}: confidence range`);
  assert.ok(model.best.name === `Jugador ${i}`,`caso ${i}: best identity`);
  assert.ok(model.best.fixture && typeof model.best.fixture.label==='string',`caso ${i}: fixture context`);
  assert.ok(model.bestMarket.score>=0 && model.bestMarket.score<=100,`caso ${i}: market score range`);
  assert.ok(['PRIORIDAD','VIGILAR','NO FORZAR'].includes(model.bestMarket.recommendation),`caso ${i}: market decision`);
  cases++;
}
assert.equal(cases,10000,'exactamente 10000 casos de regresión');
console.log(`10000 REGRESSION CASES OK: ${cases}`);
console.log('Calendar + brain + LIVE connection + simplified UI contracts OK');
