import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync('./config.mjs','utf8');
const connection = fs.readFileSync('./connection-client.js','utf8');

for (const asset of ['/calendar-autonomous-v34.js','/match-detail-ui-v31.js','/focus-ui-v30.js','/futbolfantasy-ui-v30.js']) {
  assert.ok(config.includes(`'${asset}'`), `STATIC-${asset} must be publicly served`);
}
for (const pattern of [
  "loadInline('/calendar-autonomous-v34.js','34')",
  "loadInline('/focus-ui-v30.js','30')",
  "loadInline('/futbolfantasy-ui-v30.js','30')",
  "loadInline('/match-detail-ui-v31.js','33')"
]) assert.ok(connection.includes(pattern), `loader must use inline-safe path: ${pattern}`);

const loadedAssets = [...connection.matchAll(/['"](\/[^'"]+\.(?:js|json))['"]/g)].map(m => m[1]);
const missing = loadedAssets.filter(asset => asset.startsWith('/') && !config.includes(`'${asset}'`));
assert.deepEqual(missing, [], `loader assets missing from publicStaticPath: ${missing.join(', ')}`);
assert.ok(connection.includes("laliga:layer-error"), 'loader must surface asset errors instead of swallowing them');
console.log(`STATIC ASSETS CONTRACT v1: ${loadedAssets.length} loader assets checked · 0 missing`);
