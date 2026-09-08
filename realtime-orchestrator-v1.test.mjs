import assert from 'node:assert/strict';
import fs from 'node:fs';
const realtime=fs.readFileSync('./realtime-orchestrator-v1.js','utf8');
const connection=fs.readFileSync('./connection-client.js','utf8');
const config=fs.readFileSync('./config.mjs','utf8');
const sw=fs.readFileSync('./sw.js','utf8');
const detail=fs.readFileSync('./teams-detail-futbolfantasy-v1.js','utf8');
const checks=[
 ['3 second cadence',realtime.includes('REFRESH_MS=3000')],
 ['calendar-independent controller is exposed',realtime.includes('window.LALIGA_REALTIME')],
 ['no-store network policy',realtime.includes("cache:'no-store'")],
 ['online recovery',realtime.includes("addEventListener('online'")],
 ['offline state',realtime.includes("addEventListener('offline'")],
 ['visibility recovery',realtime.includes('visibilitychange')],
 ['single-flight guard',realtime.includes('running||!visible||!online')],
 ['team data endpoint',realtime.includes("FF_API='/api/futbolfantasy/data?realtime=1'")||realtime.includes("'/api/futbolfantasy/data'")],
 ['detail reuses realtime payload',detail.includes('window.LALIGA_REALTIME_DATA||await get()')],
 ['detail listens for updates',detail.includes('laliga:fantasy-data-updated')],
 ['loader activates orchestrator',connection.includes("loadInline('/realtime-orchestrator-v1.js','1')")],
 ['asset is public',config.includes("'/realtime-orchestrator-v1.js'")],
 ['asset is cached',sw.includes("'./realtime-orchestrator-v1.js'")],
 ['cache version advanced',sw.includes("CACHE_NAME='fm-v317'")]
];
for(const[name,ok] of checks)assert.ok(ok,`REALTIME-${name}`);
console.log(`REALTIME ORCHESTRATOR v1: ${checks.length}/${checks.length} checks passed`);
