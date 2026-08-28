import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('./calendar-client.js','utf8');
const dashboard = fs.readFileSync('./dashboard-client.js','utf8');
const connection = fs.readFileSync('./connection-client.js','utf8');
const seed = JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json','utf8'));
const pkg = JSON.parse(fs.readFileSync('./package.json','utf8'));

assert.equal(pkg.engines.node,'24.14.1');
assert.equal(pkg.version,'2.13.0');
assert.ok(source.includes("const V='2.13.0'"));
assert.ok(source.includes("OFF='LALIGA oficial'"));
assert.ok(source.includes("/api/fantasy/fixtures?week="));
assert.ok(source.includes('EN DIRECTO'));
assert.ok(source.includes('officialFantasyApp'));
assert.ok(source.includes('of213-tabs'));
assert.ok(source.includes('min-height:64px'));
assert.ok(!source.includes('api-football'));
assert.ok(!source.includes('football-data'));
assert.ok(!source.includes('sportmonks'));
assert.ok(!source.includes('opta'));
assert.ok(dashboard.includes('FANTASY_LEGACY_DASHBOARD_DISABLED'));
assert.ok(connection.includes('LALIGA_LEGACY_CONNECTION_DISABLED'));
assert.ok(seed.source === 'LALIGA oficial');
assert.ok(seed.fixtures.length > 0);

const sandbox = {
  window: { addEventListener(){}, setTimeout(){}, clearTimeout(){}, location:{assign(){}} },
  document: {
    readyState:'loading',
    addEventListener(){},
    querySelector(){return null;},
    querySelectorAll(){return[];},
    getElementById(){return null;},
    createElement(){return {style:{},appendChild(){},addEventListener(){},setAttribute(){},classList:{add(){},remove(){},toggle(){}}};},
    head:{appendChild(){}},
    body:{appendChild(){}},
    documentElement:{}
  },
  CustomEvent: class { constructor(type,init){this.type=type;this.detail=init?.detail;} },
  Intl, Date, Number, String, Math, JSON, console, fetch: async()=>({ok:false,json:async()=>({})})
};
sandbox.window.window=sandbox.window;
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'calendar-client.js'});
const api = sandbox.window.OFFICIAL_LALIGA_UI_V213;
assert.ok(api && typeof api.normalize === 'function');

const sample = {
  fixtures:[
    {id:'a',utcDate:'2026-08-29T19:30:00Z',home:'Sevilla FC',away:'Atlético de Madrid',status:'NS',matchday:3},
    {id:'a2',utcDate:'2026-08-29T19:30:00Z',home:'Sevilla FC',away:'Atlético de Madrid',status:'NS',matchday:3},
    {id:'b',utcDate:'2026-08-30T15:00:00Z',home:'Real Madrid',away:'Málaga CF',status:'1H',score:{home:1,away:0},matchday:3}
  ]
};

let microSteps = 0;
let verificationBlocks = 0;
for (let i=1;i<=100000;i++) {
  const payload=i%3===0?sample:{fixtures:seed.fixtures.slice(0,Math.min(seed.fixtures.length,1+(i%6)))};
  const a=api.normalize(payload);
  const b=api.normalize(a);
  assert.ok(Array.isArray(a),`step ${i}: normalize array`);
  assert.ok(a.every(x=>x.home&&x.away&&x.utcDate),`step ${i}: identity`);
  assert.ok(a.every(x=>x.source==='LALIGA oficial'),`step ${i}: official source only`);
  assert.ok(a.every(x=>x.sources===undefined),`step ${i}: no multi-source leak`);
  assert.equal(new Set(a.map(x=>`${x.utcDate}|${x.home}|${x.away}`)).size,a.length,`step ${i}: no duplicates`);
  assert.ok(a.every(x=>['PRÓXIMO','EN DIRECTO','DESCANSO','FINALIZADO','CANCELADO','APLAZADO'].includes(x.status)),`step ${i}: status`);
  assert.ok(a.every(x=>x.homeScore===null||Number.isInteger(x.homeScore)),`step ${i}: home score`);
  assert.ok(a.every(x=>x.awayScore===null||Number.isInteger(x.awayScore)),`step ${i}: away score`);
  assert.equal(b.length,a.length,`step ${i}: idempotent length`);
  assert.deepEqual(b.map(x=>x.id),a.map(x=>x.id),`step ${i}: idempotent ids`);
  if(i%10===0){
    verificationBlocks++;
    const live=api.normalize({fixtures:[{id:'live',utcDate:'2026-08-29T20:00:00Z',home:'A',away:'B',status:'2H',score:{home:2,away:1}}]})[0];
    const upcoming=api.normalize({fixtures:[{id:'up',utcDate:'2099-01-01T20:00:00Z',home:'A',away:'B',status:'NS'}]})[0];
    assert.equal(live.status,'EN DIRECTO',`block ${verificationBlocks}: live status`);
    assert.equal(live.homeScore,2,`block ${verificationBlocks}: live home`);
    assert.equal(live.awayScore,1,`block ${verificationBlocks}: live away`);
    assert.equal(live.source,'LALIGA oficial',`block ${verificationBlocks}: live source`);
    assert.equal(upcoming.status,'PRÓXIMO',`block ${verificationBlocks}: upcoming status`);
    assert.equal(upcoming.homeScore,null,`block ${verificationBlocks}: upcoming no fake home score`);
    assert.equal(upcoming.awayScore,null,`block ${verificationBlocks}: upcoming no fake away score`);
    assert.equal(upcoming.source,'LALIGA oficial',`block ${verificationBlocks}: upcoming source`);
    assert.equal(api.version,'2.13.0',`block ${verificationBlocks}: version`);
    assert.ok(source.includes('LALIGA oficial'),`block ${verificationBlocks}: official-only UI`);
  }
  microSteps++;
}
assert.equal(microSteps,100000);
assert.equal(verificationBlocks,10000);
console.log('100000 MICRO-STEPS OK');
console.log('10000 VERIFICATION BLOCKS OK (10 assertions per block)');
console.log('Official-only calendar, deduplication, live score normalization and large-button UI contracts OK');
