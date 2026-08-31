import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const index=read('index.html');
const connection=read('connection-client.js');
const legacyCalendar=read('calendar-client.js');
const autonomous=read('calendar-autonomous-v30.js');
const detail=read('match-detail-ui-v31.js');
const packageJson=JSON.parse(read('package.json'));
const projectState=read('PROJECT_STATE.md');
const next=read('NEXT_IMPROVEMENT.md');
const sw=read('sw.js');
const brain=read('brain-core-v27.mjs');
const reliabilityHook=read('brain-reliability-hook-v29.mjs');
const selfHealAgent=read('scripts/self-heal-agent-v2.test.mjs');
const selfHealMemory=read('scripts/self-heal-memory-v2.test.mjs');

const checks=[
  ['brain rejects learning without final:true',brain.includes("sample.final!==true")],
  ['brain confidence independent of weeklyPoints',!brain.includes("f.weeklyPoints!=null?0.10")],
  ['dashboard has one shared state declaration',((index.match(/let state=loadState\(\);/g)||[]).length===1)],
  ['calendar legacy client disabled',legacyCalendar.includes('LALIGA_CALENDAR_LEGACY_DISABLED')],
  ['single autonomous calendar renderer',connection.includes("load('/calendar-autonomous-v30.js',")&&!connection.includes("load('/calendar-autonomous-v29.js')")],
  ['calendar renderer does not clear parent host',!autonomous.includes("host.innerHTML=''")&&!autonomous.includes('host.innerHTML =')],
  ['calendar uses persistent DOM observer',autonomous.includes('MutationObserver')],
  ['calendar has one refresh controller',((autonomous.match(/setInterval\(/g)||[]).length===1)],
  ['calendar supports live state',autonomous.includes('EN DIRECTO')],
  ['calendar supports final state',autonomous.includes('FINALIZADO')&&autonomous.includes('FT')],
  ['calendar rows are interactive',autonomous.includes('c33match')&&autonomous.includes('openDetail(match)')&&!detail.includes("closest?.('.c31match')")],
  ['match detail uses existing FutbolFantasy endpoint',detail.includes("/api/futbolfantasy/data")],
  ['match detail reads optional lineups only',detail.includes('lineups')&&detail.includes('alineaciones')],
  ['match detail never fabricates missing player data',detail.includes("Alineación probable todavía no disponible")],
  ['project preserves read-only mode',projectState.includes('solo lectura')],
  ['self-healing remains contractual',selfHealAgent.includes('npm test')&&selfHealMemory.includes('correcc')],
  ['reliability hook separates confidence layers',reliabilityHook.includes('rawConfidence')&&reliabilityHook.includes('calibratedConfidence')],
  ['PWA caches calendar and detail layers',sw.includes('./calendar-autonomous-v30.js')&&sw.includes('./match-detail-ui-v31.js')],
  ['test script includes structural audit',packageJson.scripts.test.includes('structural-audit-v31.test.mjs')],
  ['roadmap keeps structural pass first',next.includes('corrección estructural del sistema existente')]
];

assert.equal(checks.length,20);
for(const [name,ok] of checks) assert.ok(ok,name);
console.log('STRUCTURAL AUDIT v31: 20/20 checks passed');
