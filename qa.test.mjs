import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { VERSION, DEFAULTS, publicStaticPath } from './config.mjs';

let checks=0;
const ok=(v,m)=>{checks++;assert.ok(v,m)};
const source=fs.readFileSync('./calendar-client.js','utf8');
const dashboard=fs.readFileSync('./dashboard-client.js','utf8');
const connection=fs.readFileSync('./connection-client.js','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
const seed=JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json','utf8'));

ok(VERSION==='2.12.0'||VERSION==='2.13.0','runtime version is known');
ok(pkg.version==='2.13.0','package v2.13');
ok(pkg.engines.node==='24.14.1','Node runtime');
ok(pkg.scripts.test.includes('qa-100000.test.mjs'),'100000 gate enabled');
ok(DEFAULTS.laligaCompetitionId==='1','LALIGA competition');
ok(publicStaticPath('/calendar-client.js'),'official UI static file public');
ok(!publicStaticPath('/server.mjs'),'server private');
ok(source.includes("OFF='LALIGA oficial'"),'official source contract');
ok(source.includes("/api/fantasy/fixtures?week="),'official authenticated calendar route');
ok(source.includes(SEED_URL=>'')||source.includes('official-fixtures-seed-2026-27.json'),'official seed route');
ok(source.includes('EN DIRECTO'),'live state');
ok(source.includes('of213-tabs'),'large navigation');
ok(source.includes('min-height:64px'),'large buttons');
ok(!source.includes('api-football'),'no active API-Football calendar');
ok(!source.includes('football-data'),'no active football-data calendar');
ok(!source.includes('sportmonks'),'no active Sportmonks calendar');
ok(!source.includes('opta'),'no active Opta calendar');
ok(dashboard.includes('FANTASY_LEGACY_DASHBOARD_DISABLED'),'legacy dashboard disabled');
ok(connection.includes('LALIGA_LEGACY_CONNECTION_DISABLED'),'legacy connection disabled');
ok(seed.source==='LALIGA oficial','seed official source');
ok(seed.fixtures.length>0,'seed contains fixtures');

const sandbox={
  window:{addEventListener(){},setTimeout(){},clearTimeout(){},location:{assign(){}}},
  document:{readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null},createElement(){return{style:{},appendChild(){},addEventListener(){}}},head:{appendChild(){}},body:{appendChild(){}},documentElement:{}},
  Intl,Date,Number,String,Math,JSON,console,fetch:async()=>({ok:false,json:async()=>({})})
};
sandbox.window.window=sandbox.window;sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'calendar-client.js'});
const api=sandbox.window.OFFICIAL_LALIGA_UI_V213;
ok(api&&typeof api.normalize==='function','normalizer exported');
const sample={fixtures:[{id:'1',utcDate:'2099-01-01T18:00:00Z',home:'A',away:'B',status:'2H',score:{home:2,away:1}},{id:'1b',utcDate:'2099-01-01T18:00:00Z',home:'A',away:'B',status:'2H',score:{home:2,away:1}}]};
const normalized=api.normalize(sample);
ok(normalized.length===1,'dedup');
ok(normalized[0].source==='LALIGA oficial','only official source');
ok(normalized[0].homeScore===2&&normalized[0].awayScore===1,'live score');
ok(normalized[0].status==='EN DIRECTO','live status');
ok(normalized[0].matchday===null||normalized[0].matchday!==undefined,'matchday shape');
console.log(`QA OK: ${checks} comprobaciones superadas`);