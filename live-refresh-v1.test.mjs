import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./live-refresh-v1.js', import.meta.url), 'utf8');
assert.match(source, /CHECK_MS=60000/);
assert.match(source, /cache:'no-store'/);
assert.match(source, /credentials:'include'/);
assert.match(source, /\/api\/data\/teams/);
assert.match(source, /\/api\/data\/players\?page=1/);
assert.match(source, /\/api\/data\/standings/);
assert.match(source, /\/api\/fixtures/);
assert.match(source, /window\.location\.reload\(\)/);
assert.match(source, /INPUT\|TEXTAREA\|SELECT/);
assert.match(source, /visibilityState/);
assert.match(source, /laliga:data-changed/);
console.log('LIVE REFRESH v1: contract passed');
