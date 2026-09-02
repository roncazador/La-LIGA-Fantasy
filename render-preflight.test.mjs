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
  ['Render direct health path',render.includes('healthCheckPath: /api/health')],
  ['Render checks pass gating',render.includes('autoDeployTrigger: checksPass')],
  ['Render preflight build',render.includes('npm run render:verify')],
  ['Render runtime smoke build gate',render.includes('npm run test:render-runtime')],
  ['Render max shutdown',render.includes('maxShutdownDelaySeconds: 60')],
  ['Render brain directory',render.includes('BRAIN_STATE_DIR')&&render.includes('/var/data/brain')],
  ['runtime smoke probes direct health',smoke.includes('/api/health')&&smoke.includes('brain-host-v27.mjs')],
  ['runtime smoke waits for backend',smoke.includes('body.backendReady')],
  ['runtime smoke verifies read-only',smoke.includes("body.readOnly,true")],
  ['preflight includes render yaml',file.includes("'render.yaml'")],
  ['preflight checks widget assets',file.includes("'visual-compact-v1.css'")&&file.includes("'decision-learning-v1.js'")&&file.includes("'teams-detail-v1.js'")],
  ['preflight checks widget loader',file.includes("loadCss('/visual-compact-v1.css','1')")],
  ['widget regression in npm test',pkg.scripts.test.includes('widget-ui-v1.test.mjs')]
];
for(const[name,ok]of checks)assert.ok(ok,`RENDER-${name}`);
execFileSync(process.execPath,['render-preflight.mjs'],{encoding:'utf8',env:{...process.env,RENDER:'true',PORT:'10000'}});
assert.equal(checks.length,22);
console.log('RENDER PREFLIGHT CONTRACT v3: 22/22 checks passed');
