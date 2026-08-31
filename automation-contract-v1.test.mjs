import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const workflow=read('.github/workflows/maintenance-automation.yml');
const governance=read('.github/workflows/ci-governance.yml');
const governanceTest=read('ci-governance-v1.mjs');
const pkg=JSON.parse(read('package.json'));
const calendar=read('calendar-autonomous-v35.js');
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
  ['CI governance workflow exists',governance.includes('name: CI governance')],
  ['CI governance is pull-request aware',governance.includes('pull_request:')],
  ['CI governance uses pinned Node runtime',governance.includes('node-version: 24.14.1')],
  ['CI governance executes its audit',governance.includes('node ci-governance-v1.mjs')],
  ['CI governance audit is in main test battery',pkg.scripts.test.includes('ci-governance-v1.mjs')],
  ['governance audit scans all workflow files',governanceTest.includes("fs.readdirSync(workflowDir)")],
  ['npm test includes automation contract',pkg.scripts.test.includes('automation-contract-v1.test.mjs')],
  ['calendar refresh remains bounded',calendar.includes('REFRESH_MS=15000')],
  ['calendar jornada navigation remains present',calendar.includes('Jornada anterior')&&calendar.includes('Jornada siguiente')],
  ['calendar keeps live state',calendar.includes('EN DIRECTO')],
  ['loader keeps single calendar owner',connection.includes("loadInline('/calendar-autonomous-v35.js','35')")],
  ['service worker caches current calendar',sw.includes('./calendar-autonomous-v35.js')],
  ['render preflight remains available',preflight.includes('RENDER_PREFLIGHT_OK')]
];

assert.equal(checks.length,22);
for(const [name,ok] of checks) assert.ok(ok,name);
console.log('AUTOMATION CONTRACT v1: 22/22 checks passed');
