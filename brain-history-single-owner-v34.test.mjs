import assert from 'node:assert/strict';
import fs from 'node:fs';
const host=fs.readFileSync('./brain-host-v27.mjs','utf8');
const hook=fs.readFileSync('./brain-history-hook-v28.mjs','utf8');
assert.ok(host.includes("import { history, HISTORY_VERSION } from './brain-history-hook-v28.mjs'"));
assert.equal((host.match(/history\.observe\(players/g)||[]).length,1); // auxiliary cycle only
assert.equal((host.match(/const history=createPlayerHistory/g)||[]).length,0);
assert.ok(hook.includes('BrainV27.prototype.ingestDashboard'));
console.log('Single-owner brain history v34: 4/4 passed');
