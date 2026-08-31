import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const workflow=read('.github/workflows/maintenance-automation.yml');
const pkg=JSON.parse(read('package.json'));
const calendar=read('calendar-autonomous-v34.js');
const connection=read('connection-client.js');
const sw=read('sw.js');
const preflight=read('render-preflight.mjs');

const checks=[
  ['automation workflow exists',workflow.includes('name: Maintenance automation')],
  ['automation is pull-request aware',workflow.includes('pull_request:')],
  ['automation runs on main pushes',workflow.includes('branches: [main]')],
  ['automation can be dispatched manually',workflow.includes('workflow_dispatch:')],
  ['automation has scheduled housekeeping',workflow.includes('cron:')],
  ['automation is read-only',workflow.includes('contents: read')&&!workflow.includes('contents: write')],
  ['automation uses pinned Node runtime',workflow.includes('node-version: 24.14.1')],
  ['automation runs contract test',workflow.includes('node automation-contract-v1.test.mjs')],
  ['automation checks render preflight',workflow.includes('npm run render:verify')],
  ['npm test includes automation contract',pkg.scripts.test.includes('automation-contract-v1.test.mjs')],
  ['calendar refresh remains bounded',calendar.includes('REFRESH_MS=15000')],
  ['calendar jornada navigation remains present',calendar.includes('Jornada anterior')&&calendar.includes('Jornada siguiente')],
  ['calendar keeps live state',calendar.includes('EN DIRECTO')],
  ['loader keeps single calendar owner',connection.includes("loadInline('/calendar-autonomous-v34.js','34')")],
  ['service worker caches current calendar',sw.includes('./calendar-autonomous-v34.js')],
  ['render preflight remains available',preflight.includes('RENDER_PREFLIGHT_OK')]
];

assert.equal(checks.length,16);
for(const [name,ok] of checks) assert.ok(ok,name);
console.log('AUTOMATION CONTRACT v1: 16/16 checks passed');
