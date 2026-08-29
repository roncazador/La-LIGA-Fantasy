import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const file=fs.readFileSync('./render-preflight.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
const render=fs.readFileSync('./render.yaml','utf8');
assert.ok(file.includes('RENDER_PREFLIGHT_MISSING'));
assert.ok(file.includes('RENDER_PREFLIGHT_NODE_TOO_OLD'));
assert.ok(file.includes('RENDER_PREFLIGHT_START_COMMAND_MISMATCH'));
assert.ok(file.includes("process.env.PORT || '10000'"));
assert.ok(file.includes("execFileSync(process.execPath,['--check',file]"));
assert.equal(pkg.engines.node,'24.14.1');
assert.equal(pkg.scripts.start,'node --import ./brain-history-hook-v28.mjs brain-host-v27.mjs');
assert.ok(render.includes('startCommand: npm start'));
assert.ok(render.includes('healthCheckPath: /api/health'));
execFileSync(process.execPath,['render-preflight.mjs'],{encoding:'utf8',env:{...process.env,RENDER:'true',PORT:'10000'}});
console.log('RENDER PREFLIGHT CONTRACT: 10/10 checks passed');
