import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync('./config.mjs','utf8');
const connection = fs.readFileSync('./connection-client.js','utf8');
const seed = JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json','utf8'));

for (const asset of ['/calendar-autonomous-v35.js','/match-detail-ui-v31.js','/focus-ui-v30.js','/futbolfantasy-ui-v30.js']) {
  assert.ok(config.includes(`'${asset}'`), `STATIC-${asset} must be publicly served`);
}
for (const pattern of [
  "loadInline('/calendar-autonomous-v35.js','35')",
  "loadInline('/focus-ui-v30.js','30')",
  "loadInline('/futbolfantasy-ui-v30.js','30')",
  "loadInline('/match-detail-ui-v31.js','33')"
]) assert.ok(connection.includes(pattern), `loader must use inline-safe path: ${pattern}`);

const loadedAssets = [...connection.matchAll(/['"](\/[^'"]+\.(?:js|json))['"]/g)].map(m => m[1]);
const missing = loadedAssets.filter(asset => asset.startsWith('/') && !config.includes(`'${asset}'`));
assert.deepEqual(missing, [], `loader assets missing from publicStaticPath: ${missing.join(', ')}`);
assert.ok(connection.includes("laliga:layer-error"), 'loader must surface asset errors instead of swallowing them');

assert.equal(seed.season, '2026/27');
assert.equal(seed.currentMatchday, 4, 'fallback keeps next available jornada as metadata');
assert.equal(seed.fixtures.filter(f => f.matchday === 3).length, 10, 'fallback must contain the complete jornada 3');
assert.equal(seed.fixtures.filter(f => f.matchday === 4).length, 10, 'fallback must contain the complete jornada 4');
assert.ok(seed.fixtures.filter(f => f.matchday === 3).every(f => f.status === 'FINISHED'), 'completed jornada 3 must be marked final');
assert.ok(seed.fixtures.filter(f => f.matchday === 4).every(f => f.status === 'SCHEDULED'), 'jornada 4 must remain scheduled');
assert.ok(seed.fixtures.every(f => Number.isFinite(Date.parse(f.utcDate))), 'every fixture date must be valid ISO');

console.log(`STATIC ASSETS CONTRACT v1: ${loadedAssets.length} loader assets · fallback J3/J4 complete · 0 missing`);
