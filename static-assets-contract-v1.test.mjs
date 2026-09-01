import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync('./config.mjs','utf8');
const connection = fs.readFileSync('./connection-client.js','utf8');
const host = fs.readFileSync('./brain-host-v27.mjs','utf8');
const seed = JSON.parse(fs.readFileSync('./official-fixtures-seed-2026-27.json','utf8'));
const publicAssets=['/app-dynamics-v37.js','/calendar-autonomous-v35.js','/match-detail-ui-v31.js','/focus-ui-v30.js','/futbolfantasy-ui-v30.js','/automation-hub-v1.js'];
for (const asset of publicAssets) assert.ok(config.includes(`'${asset}'`), `STATIC-${asset} must be publicly served`);
for (const asset of ['/executive-dashboard-v1.js','/evidence-isolation-v1.js']) assert.ok(host.includes(`'${asset}'`), `STATIC-${asset} must be served by brain host`);
for (const pattern of ["loadInline('/automation-hub-v1.js','1')","loadInline('/executive-dashboard-v1.js','1')","loadInline('/evidence-isolation-v1.js','1')","loadInline('/app-dynamics-v37.js','37')","loadInline('/calendar-autonomous-v35.js','35')","loadInline('/focus-ui-v30.js','30')","loadInline('/futbolfantasy-ui-v30.js','30')","loadInline('/match-detail-ui-v31.js','33')"]) assert.ok(connection.includes(pattern), `loader must use inline-safe path: ${pattern}`);
const loadedAssets=[...connection.matchAll(/['"](\/[^'"]+\.(?:js|json))['"]/g)].map(m=>m[1]);
const missing=loadedAssets.filter(asset=>asset.startsWith('/')&&!config.includes(`'${asset}'`)&&!host.includes(`'${asset}'`));assert.deepEqual(missing,[],`loader assets missing from public registry/server: ${missing.join(', ')}`);
assert.ok(connection.includes('laliga:layer-error'),'loader must surface asset errors instead of swallowing them');
assert.equal(seed.season,'2026/27');assert.equal(seed.currentMatchday,4,'fallback keeps next available jornada as metadata');assert.equal(seed.fixtures.filter(f=>f.matchday===3).length,10,'fallback must contain complete jornada 3');assert.equal(seed.fixtures.filter(f=>f.matchday===4).length,10,'fallback must contain complete jornada 4');assert.ok(seed.fixtures.filter(f=>f.matchday===3).every(f=>f.status==='FINISHED'),'completed jornada 3 must be final');assert.ok(seed.fixtures.filter(f=>f.matchday===4).every(f=>f.status==='SCHEDULED'),'jornada 4 must be scheduled');assert.ok(seed.fixtures.every(f=>Number.isFinite(Date.parse(f.utcDate))),'fixture dates must be valid ISO');
console.log(`STATIC ASSETS CONTRACT v1: ${loadedAssets.length} loader assets · fallback J3/J4 complete · 0 missing`);
