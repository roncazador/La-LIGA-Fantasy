import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const pkg=JSON.parse(read('./package.json'));
const render=read('./render.yaml');
const host=read('./brain-host-v27.mjs');
const core=read('./brain-core-v27.mjs');
const calendar=read('./calendar-autonomous-v35.js');
const dynamics=read('./app-dynamics-v37.js');
const automation=read('./automation-contract-v1.test.mjs');
const cultivos=read('./cultivos-v1.mjs');
const cultivosTest=read('./cultivos-v1.test.mjs');
const video=read('./recording-video-2026-09-01.json');
const videoTest=read('./recording-video-v1.test.mjs');
const executive=read('./executive-dashboard-v1.js');
const evidence=read('./evidence-isolation-v1.js');
const sw=read('./sw.js');
const config=read('./config.mjs');
const checks=[
 ['Node pinned',pkg.engines.node==='24.14.1'],['Brain host start',pkg.scripts.start.includes('brain-host-v27.mjs')],['Render checksPass',render.includes('autoDeployTrigger: checksPass')],['Render health',render.includes('healthCheckPath: /api/health')],['Render brain state',render.includes('BRAIN_STATE_DIR')],['Render AI secret slot',render.includes('OPENAI_API_KEY')&&render.includes('sync: false')],['Cultivos enabled',render.includes('CULTIVOS_ENABLED')],['Automation enabled',render.includes('AUTOMATION_ENABLED')],['Brain status route',host.includes('/api/brain/status')],['Cultivos status route',host.includes('/api/cultivos/status')],['Final-only learning guard',core.includes('outcomeIsFinal')&&core.includes('sample.final!==true')],['Protected final-result intake',host.includes('/api/cultivos/final-result')&&host.includes('CULTIVOS_FINAL_FORBIDDEN')],['Calendar v35 live state',calendar.includes('EN DIRECTO')&&calendar.includes('inferCurrentMatchday')],['Calendar retry bounded',dynamics.includes('RETRY_DELAYS=[5000,15000,30000]')],['Calendar retry scoped',dynamics.includes('if(!isCalendarFailure(e))')],['Automation contract current',automation.includes('AUTOMATION CONTRACT v1: 81/81')],['Cultivos v1.4',cultivos.includes("CULTIVOS_VERSION='1.4.0'")],['Cultivos final-only method',cultivos.includes('recordFinalOutcome')],['Cultivos video sync',cultivos.includes('syncFromVideoEvidence')],['Cultivos handoff sync',cultivos.includes('syncFromHandoff')],['Cultivos regression',cultivosTest.includes('CULTIVOS v1.4: 14/14')],['Video hash',/"sha256": "[a-f0-9]{64}"/.test(video)],['Video human gate',video.includes('"humanConfirmed": false')&&video.includes('"cultivosEligible": false')],['Video regression',videoTest.includes('cultivos gated')],['Cultivos handoff regression',pkg.scripts.test.includes('cultivos-handoff-v1.test.mjs')],['Executive order',executive.indexOf('Puntos Fantasy')<executive.indexOf('Saldo')&&executive.indexOf('Saldo')<executive.indexOf('Plantilla')&&executive.indexOf('Plantilla')<executive.indexOf('Alineación recomendada')&&executive.indexOf('Alineación recomendada')<executive.indexOf('Jugadores con más puntos probables')&&executive.indexOf('Jugadores con más puntos probables')<executive.indexOf('Fichajes recomendados')&&executive.indexOf('Fichajes recomendados')<executive.indexOf('IA de cerebro')&&executive.indexOf('IA de cerebro')<executive.indexOf('Calendario')],['Evidence isolation',evidence.includes('evidenceV1')],['PWA current assets',sw.includes('./automation-hub-v1.js')&&sw.includes('./calendar-autonomous-v35.js')&&sw.includes('./executive-dashboard-v1.js')],['Public hub registry',config.includes("'/automation-hub-v1.js'")]
];
assert.equal(checks.length,28);for(const[i,[name,ok]]of checks.entries())assert.ok(ok,`DEPLOY28-${String(i+1).padStart(3,'0')}: ${name}`);console.log('DEPLOYMENT CONTRACT v5.8: 28/28 checks passed');
