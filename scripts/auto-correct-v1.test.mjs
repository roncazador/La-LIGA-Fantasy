import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=fs.readFileSync('./scripts/auto-correct-v1.mjs','utf8');
const config=fs.readFileSync('./config.mjs','utf8');
const connection=fs.readFileSync('./connection-client.js','utf8');
const sw=fs.readFileSync('./sw.js','utf8');
const result=spawnSync(process.execPath,['scripts/auto-correct-v1.mjs','--check'],{encoding:'utf8'});
const diagnostics=(result.stderr||'').trim();
const checks=[
 ['versioned schema',source.includes('laliga-auto-correct/v1')],
 ['bounded allowlist',source.includes("const allowed=new Set(RULES.map(r=>r.file))")],
 ['canonical cultivation correction',source.includes('cultivos-v1.4.mjs')],
 ['visual asset correction',source.includes('visual-compact-v1.css')],
 ['semantic ready guard',source.includes('rule.ready')&&source.includes('ready:before=>before.includes')],
 ['idle scheduling correction',source.includes('requestIdleCallback')],
 ['service worker correction',source.includes("fm-v314")],
 ['check is read-only',source.includes("mode==='--write'")&&source.includes("mode==='--check'&&needed.length")],
 ['no network dependency',!source.includes('fetch(')&&!source.includes('http://')&&!source.includes('https://')],
 ['current config exposes CSS',config.includes("'/visual-compact-v1.css'")],
 ['current loader uses idle',connection.includes('requestIdleCallback')],
 ['current SW preserves cache contract',sw.includes("const CACHE_NAME='fm-v314'")],
 ['repo currently needs no correction',result.status===0]
];
for(const[name,ok]of checks)assert.ok(ok,`AUTO-CORRECT-${name}${diagnostics?` · diagnostics=${diagnostics}`:''}`);
assert.equal(checks.length,13);
console.log('AUTO-CORRECT v1 CONTRACT: 13/13 checks passed');