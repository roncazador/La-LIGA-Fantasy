import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const file=fs.readFileSync('./render-preflight.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
const render=fs.readFileSync('./render.yaml','utf8');
const smoke=fs.readFileSync('./scripts/render-runtime-smoke-v1.mjs','utf8');
const checks=[
  ['missing guard',file.includes('RENDER_PREFLIGHT_MISSING')],
  ['node guard',file.includes('RENDER_PREFLIGHT_NODE_TOO_OLD')],
  ['start guard',file.includes('RENDER_PREFLIGHT_START_COMMAND_MISMATCH')],
  ['port guard',file.includes("process.env.PORT || '10000'")],
  ['syntax executor',file.includes("execFileSync(process.execPath,['--check',file]")],
  ['Node pinned',pkg.engines.node==='24.14.1'],
  ['history hook in start',pkg.scripts.start.includes('--import ./brain-history-hook-v28.mjs')],
  ['reliability hook in start',pkg.scripts.start.includes('--import ./brain-reliability-hook-v29.mjs')],
  ['Render start command',render.includes('startCommand: npm start')],
  ['Render health path',render.includes('healthCheckPath: /api/brain/status')],
  ['Render checks pass gating',render.includes('autoDeployTrigger: checksPass')],
  ['Render preflight build',render.includes('npm run render:verify')],
  ['Render runtime smoke build gate',render.includes('npm run test:render-runtime')],
  ['Render max shutdown',render.includes('maxShutdownDelaySeconds: 60')],
  ['Render brain directory',render.includes('BRAIN_STATE_DIR')&&render.includes('/var/data/brain')],
  ['runtime smoke probes public brain host',smoke.includes('/api/brain/status')&&smoke.includes('brain-host-v27.mjs')],
  ['runtime smoke verifies read-only',smoke.includes("body.readOnly,true")],
  ['reliability asset required',file.includes("'brain-reliability-v29.mjs'")&&file.includes("'brain-reliability-hook-v29.mjs'")]
];
for(const[name,ok]of checks)assert.ok(ok,`RENDER-${name}`);
execFileSync(process.execPath,['render-preflight.mjs'],{encoding:'utf8',env:{...process.env,RENDER:'true',PORT:'10000'}});
assert.equal(checks.length,18);
console.log('RENDER PREFLIGHT CONTRACT v2: 18/18 checks passed');
