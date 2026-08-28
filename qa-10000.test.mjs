import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fixtureKey, normalizeApiFootball, normalizeFootballData, normalizeSportmonks, daysWindow } from './providers.mjs';
import { VERSION, DEFAULTS, oidcConfigured, publicStaticPath } from './config.mjs';

const server=fs.readFileSync('./server.mjs','utf8');
const config=fs.readFileSync('./config.mjs','utf8');
const dashboardSource=fs.readFileSync('./dashboard-client.js','utf8');
const calendarSource=fs.readFileSync('./calendar-client.js','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
const seed=JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json','utf8'));

assert.equal(VERSION,'2.12.0');
assert.equal(pkg.version,'2.12.0');
assert.equal(pkg.engines.node,'24.14.1');
assert.ok(pkg.scripts.test.includes('qa-10000.test.mjs'));
assert.ok(server.includes("url.pathname === '/api/fixtures'"));
assert.ok(server.includes('fetchMultiProviderFixtures(config)'));
assert.ok(calendarSource.includes('FANTASY_APP_V28') || calendarSource.includes('bootBridge'));
assert.ok(dashboardSource.includes("fetch('/api/fixtures'"));
assert.ok(dashboardSource.includes('payload?.merged'));
assert.ok(dashboardSource.includes('Array.isArray(payload?.fixtures)'));
assert.ok(dashboardSource.includes("/api/fantasy/dashboard"));
assert.ok(dashboardSource.includes('laliga:live-data'));
assert.ok(dashboardSource.includes('FANTASY_BRAIN_V28'));
for(const tab of ['resumen','cerebro','equipo','partidos','mercado','liga']) assert.ok(dashboardSource.includes(`data-tab="${tab}"`));
assert.ok(dashboardSource.includes('hideLegacy'));
assert.ok(publicStaticPath('/dashboard-client.js'));
assert.ok(publicStaticPath('/calendar-client.js'));
assert.ok(!publicStaticPath('/server.mjs'));
assert.ok(oidcConfigured({laligaAuthorizeUrl:'https://x/a',laligaOAuthClientId:'x',laligaRedirectUri:'x'}));
assert.equal(DEFAULTS.laligaCompetitionId,'1');

const apiFixture={fixture:{id:10,date:'2026-08-29T18:00:00Z',status:{short:'NS'}},league:{id:140,round:'Regular Season - 3'},teams:{home:{id:529,name:'FC Barcelona'},away:{id:2,name:'Rayo Vallecano'}}};
const normalized=normalizeApiFootball({response:[apiFixture]});
assert.equal(normalized.length,1);
assert.equal(fixtureKey(normalized[0]),'2026-08-29T18:00|barcelona|rayo vallecano');
assert.equal(normalizeApiFootball({}).length,0);
assert.equal(normalizeFootballData({matches:[]}).length,0);
assert.equal(normalizeSportmonks({data:[]}).length,0);
assert.match(daysWindow(7).from,/^2026-\d\d-\d\d$/);
assert.ok(seed.fixtures?.length>0);

const sandbox={window:{addEventListener(){},dispatchEvent(){},setTimeout(){}},document:{readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},createElement(){return{style:{},addEventListener(){},appendChild(){}}},head:{appendChild(){}},documentElement:{}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},Intl,Date,Number,String,Math,JSON,console};
sandbox.window.window=sandbox.window;sandbox.globalThis=sandbox;
vm.runInNewContext(dashboardSource,sandbox,{filename:'dashboard-client.js'});
const brain=sandbox.window.FANTASY_BRAIN_V28;
const app=sandbox.window.FANTASY_APP_V28;
assert.ok(brain&&typeof brain.analyze==='function');
assert.ok(app&&typeof app.normalizeFixtures==='function');
const fixturePayload={merged:[{id:'f1',utcDate:'2026-08-29T18:00:00Z',home:'FC Barcelona',away:'Rayo Vallecano',status:'TIMED',matchday:3,source:'api-football'},{id:'f2',utcDate:'2026-08-30T20:00:00Z',home:'Real Madrid',away:'Sevilla',status:'TIMED',matchday:3,source:'api-football'}]};
assert.equal(app.normalizeFixtures(fixturePayload).length,2);
assert.equal(app.normalizeFixtures({matches:fixturePayload.merged}).length,2);
assert.equal(app.normalizeFixtures({fixtures:seed.fixtures}).length,seed.fixtures.length);

let cases=0;
for(let i=0;i<10000;i++){
  const points=i%31,minutes=(i*17)%91,starts=i%7,price=500000+(i%9)*125000,value=price+((i%13)-3)*25000,rotationRisk=(i%6)/5,injuryRisk=(i%5)/4;
  const player={name:`Jugador ${i}`,position:['POR','DEF','MED','DEL'][i%4],team:i%2?'FC Barcelona':'Real Madrid',points,minutes,starts,price,value,rotationRisk,injuryRisk,availability:i%29===0?'Suspendido':''};
  const market={player:{name:`Mercado ${i}`},points:points/2,minutes,starts,price:value*.88,value,rotationRisk:.1,injuryRisk:.05,status:'OK'};
  const model=brain.analyze({dashboard:{team:{players:[player]},market:{data:[market]},standing:[]},fixtures:fixturePayload.merged});
  assert.equal(model.players.length,1,`caso ${i}: players`);
  assert.equal(model.market.length,1,`caso ${i}: market`);
  assert.ok(model.best.score>=0&&model.best.score<=100,`caso ${i}: score`);
  assert.ok(model.best.confidence>=20&&model.best.confidence<=100,`caso ${i}: confidence`);
  assert.equal(model.best.name,`Jugador ${i}`,`caso ${i}: identity`);
  assert.ok(typeof model.best.fixture.label==='string',`caso ${i}: fixture context`);
  assert.ok(model.bestMarket.score>=0&&model.bestMarket.score<=100,`caso ${i}: market score`);
  assert.ok(['PRIORIDAD','VIGILAR','NO FORZAR'].includes(model.bestMarket.recommendation),`caso ${i}: decision`);
  cases++;
}
assert.equal(cases,10000);
console.log(`10000 REGRESSION CASES OK: ${cases}`);
console.log('Calendar + brain + LIVE connection + simplified UI contracts OK');
