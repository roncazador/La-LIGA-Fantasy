import assert from 'node:assert/strict';
import fs from 'node:fs';
const loop=fs.readFileSync('./realtime-provider-loop-v1.mjs','utf8');
const host=fs.readFileSync('./brain-host-v27.mjs','utf8');
const data=fs.readFileSync('./futbolfantasy-data-v30.mjs','utf8');
const checks=[
 ['idle refresh is bounded',loop.includes('BASE_REFRESH_MS=15*1000')],
 ['live refresh is 3 seconds',loop.includes('LIVE_REFRESH_MS=3*1000')],
 ['persistent cache exists',loop.includes('realtime-provider-cache-v1.json')],
 ['multi-provider source aggregation',loop.includes('fetchMultiProviderFixtures')],
 ['single-flight execution',loop.includes('if(running)return')],
 ['stale restoration',loop.includes('hydrate(target)')&&loop.includes('stale:true')],
 ['persistent write path',loop.includes('persist(dir)')],
 ['runtime status export',loop.includes('getRealtimeStatus')],
 ['host starts provider loop',host.includes('startRealtimeProviderLoop')],
 ['status endpoint exists',host.includes('/api/realtime/status')],
 ['requested week preserved',host.includes("if(!week&&!sessionRaw.length&&realtimeSnapshot?.merged?.length)")],
 ['realtime FutbolFantasy TTL is explicit',data.includes('config.realtime===true?3000:5*60*1000')],
 ['realtime mode is reported',data.includes('realtime:config.realtime===true')],
 ['upstream realtime query is enabled',host.includes("realtime:url.searchParams.get('realtime')==='1'")]
];
for(const[name,ok] of checks)assert.ok(ok,`REALTIME-LOOP-${name}`);
console.log(`REALTIME PROVIDER LOOP v1: ${checks.length}/${checks.length} checks passed`);
