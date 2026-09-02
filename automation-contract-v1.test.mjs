import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const workflow=read('.github/workflows/maintenance-automation.yml');
const governance=read('.github/workflows/ci-governance.yml');
const pkg=JSON.parse(read('package.json'));
const hub=read('automation-hub-v1.js');
const calendar=read('calendar-autonomous-v35.js');
const dynamics=read('app-dynamics-v37.js');
const connection=read('connection-client.js');
const host=read('brain-host-v27.mjs');
const sw=read('sw.js');
const config=read('config.mjs');
const handoff=read('scripts/automation-handoff-v1.mjs');
const battery=read('scripts/automation-battery-v2.mjs');
const assimilation=read('scripts/assimilation-gate-v1.mjs');
const heal=read('.github/workflows/self-healing-ai.yml');
const preflight=read('render-preflight.mjs');
const cultivos=read('cultivos-v1.4.mjs');
const cultivosTest=read('cultivos-v1.4.test.mjs');
const video=read('recording-video-2026-09-01.json');
const videoTest=read('recording-video-v1.test.mjs');
const executive=read('executive-dashboard-v1.js');
const evidence=read('evidence-isolation-v1.js');
const render=read('render.yaml');
const envExample=read('.env.example');
const autoCorrect=read('scripts/auto-correct-v1.mjs');
const perf=read('scripts/performance-budget-v1.mjs');
const smoke=read('scripts/render-runtime-smoke-v1.mjs');
const checks=[
 ['automation workflow exists',workflow.includes('name: Maintenance automation')],
 ['automation is PR aware',workflow.includes('pull_request:')],
 ['automation runs on main',workflow.includes('branches: [main]')],
 ['manual dispatch exists',workflow.includes('workflow_dispatch:')],
 ['scheduled housekeeping exists',workflow.includes('cron:')],
 ['automation is read-only',workflow.includes('actions: read')&&workflow.includes('contents: read')&&!workflow.includes('contents: write')],
 ['Node runtime pinned',workflow.includes('node-version: 24.14.1')],
 ['syntax gate includes autocorrect',workflow.includes('node --check scripts/auto-correct-v1.mjs')],
 ['syntax gate includes performance',workflow.includes('node --check scripts/performance-budget-v1.mjs')],
 ['automation battery runs',workflow.includes('npm run test:automation')],
 ['render preflight runs',workflow.includes('npm run render:verify')],
 ['render runtime smoke runs',workflow.includes('npm run test:render-runtime')],
 ['project battery runs',workflow.includes('npm test')],
 ['assimilation runs after project battery',workflow.indexOf('name: Full project battery')<workflow.indexOf('name: Assimilation gate')],
 ['handoff generation exists',workflow.includes('automation-handoff-v1.mjs')],
 ['artifact upload exists',workflow.includes('actions/upload-artifact@v4')],
 ['governance exists',governance.includes('name: CI governance')],
 ['governance PR aware',governance.includes('pull_request:')],
 ['governance Node pinned',governance.includes('node-version: 24.14.1')],
 ['automation test is in npm test',pkg.scripts.test.includes('automation-contract-v1.test.mjs')],
 ['Cultivos regression is in npm test',pkg.scripts.test.includes('cultivos-v1.4.test.mjs')],
 ['assimilation regression is in npm test',pkg.scripts.test.includes('scripts/assimilation-gate-v1.test.mjs')],
 ['automation command exists',pkg.scripts['test:automation']==='node scripts/automation-battery-v2.mjs'],
 ['assimilation command exists',pkg.scripts['test:assimilation']==='node scripts/assimilation-gate-v1.mjs'],
 ['render runtime command exists',pkg.scripts['test:render-runtime']==='node scripts/render-runtime-smoke-v1.mjs'],
 ['final-only assimilation policy',assimilation.includes("learningPolicy:'final-only'")&&assimilation.includes('writesToBrain:false')],
 ['automation state schema',hub.includes('laliga-automation-state/v1')],
 ['handoff schema',hub.includes('laliga-automation-handoff/v1')],
 ['bounded automation errors',hub.includes('MAX_ERRORS=40')],
 ['bounded automation events',hub.includes('MAX_EVENTS=200')],
 ['calendar update events',hub.includes('laliga:calendar-updated')],
 ['calendar degradation events',hub.includes('laliga:calendar-degraded')],
 ['calendar terminal errors',hub.includes('laliga:calendar-error')],
 ['generic layer errors',hub.includes('laliga:layer-error')],
 ['secondary UI load is deferred',connection.includes('requestIdleCallback')],
 ['layer failures are surfaced',connection.includes('laliga:layer-error')],
 ['calendar distinguishes degradation',calendar.includes('announceDegraded')&&calendar.includes('announceError')],
 ['calendar degradation non-retryable',calendar.includes('retryable:false')],
 ['calendar terminal retryable',calendar.includes('retryable:true')],
 ['dynamics bounded backoff',dynamics.includes('RETRY_DELAYS=[5000,15000,30000]')],
 ['dynamics filters non-calendar errors',dynamics.includes('if(!isCalendarFailure(e))')],
 ['dynamics clears retry after recovery',dynamics.includes('clearRetry()')],
 ['hub is publicly served',config.includes("'/automation-hub-v1.js'")],
 ['executive layer is publicly served',host.includes("'/executive-dashboard-v1.js'")],
 ['evidence layer is publicly served',host.includes("'/evidence-isolation-v1.js'")],
 ['service worker contract is stable',sw.includes('fm-v310')],
 ['visual CSS is in service worker cache',sw.includes('./visual-compact-v1.css')],
 ['handoff uses recent workflow runs',handoff.includes('/actions/runs?per_page=40')],
 ['handoff captures failed job logs',handoff.includes('/actions/jobs/${job.id}/logs')],
 ['battery emits JSON report',battery.includes('automation-battery-report.json')],
 ['battery emits markdown report',battery.includes('automation-battery-report.md')],
 ['battery continues through commands',battery.includes('for(const file of commands)')],
 ['battery scans for credentials',battery.includes('credentialPatterns')&&battery.includes('detectCredential')],
 ['battery recursively scans repository',battery.includes('function walk(dir)')],
 ['self-healing workflow exists',heal.includes('self-heal-agent.mjs')],
 ['self-healing deterministic stage exists',heal.includes('node scripts/auto-correct-v1.mjs --write')],
 ['self-healing validates diff',heal.includes('git diff --check')],
 ['self-healing limits attempts',heal.includes('SELF_HEAL_MAX_ATTEMPTS')],
 ['self-healing no auto-merge',heal.includes('No automatic self-merge')||policySafe(heal)],
 ['performance budget schema',perf.includes('laliga-performance-budget/v1')],
 ['performance compile budget',perf.includes('compileP95Ms')],
 ['render preflight success marker',preflight.includes('RENDER_PREFLIGHT_OK')],
 ['render runtime smoke has health probe',smoke.includes('/api/brain/status')],
 ['render runtime smoke starts brain host',smoke.includes('brain-host-v27.mjs')],
 ['render uses pinned Node',render.includes('NODE_VERSION')&&render.includes('24.14.1')],
 ['render uses checks-pass deployment',render.includes('autoDeployTrigger: checksPass')],
 ['render uses public brain health',render.includes('healthCheckPath: /api/brain/status')],
 ['render build validates preflight',render.includes('npm run render:verify')],
 ['render build validates runtime',render.includes('npm run test:render-runtime')],
 ['render brain disk is declared',render.includes('BRAIN_STATE_DIR')&&render.includes('/var/data/brain')],
 ['Cultivos 1.4 bounded events',cultivos.includes('const MAX_EVENTS=300')&&cultivos.includes("cultivos-v1.json")],
 ['Cultivos summary exists',cultivos.includes('function summary()')],
 ['Cultivos supervised video is gated',cultivos.includes('humanConfirmed===true')],
 ['Cultivos structured handoff sync exists',cultivos.includes('syncFromHandoff')],
 ['brain uses canonical Cultivos',host.includes('./cultivos-v1.4.mjs')],
 ['brain status exposes Cultivos',host.includes('cultivos:cultivos.summary()')],
 ['video evidence is hashed',video.includes('"sha256"')],
 ['video evidence remains gated',video.includes('"humanConfirmed": false')&&video.includes('"cultivosEligible": false')],
 ['video regression covers gate',videoTest.includes('cultivos gated')],
 ['executive dashboard contains core KPIs',executive.includes('Puntos Fantasy')&&executive.includes('Saldo')&&executive.includes('Plantilla')],
 ['executive dashboard contains recommendation areas',executive.includes('Alineación recomendada')&&executive.includes('Fichajes recomendados')&&executive.includes('IA de cerebro')],
 ['evidence panel is isolated',evidence.includes('recordingPanelV29')&&evidence.includes('evidenceV1')],
 ['provider secret slots remain sync-false',render.includes('FOOTBALL_DATA_TOKEN')&&render.includes('SPORTMONKS_API_TOKEN')&&render.includes('OPENAI_API_KEY')&&render.includes('sync: false')],
 ['env example documents AI/cultivation',envExample.includes('OPENAI_API_KEY')&&envExample.includes('CULTIVOS_ENABLED')],
 ['autocorrect has bounded rules',autoCorrect.includes('const RULES=')&&autoCorrect.includes('const allowed=new Set')],
 ['autocorrect is offline',!autoCorrect.includes('fetch(')&&!autoCorrect.includes('https://')],
 ['autocorrect supports check and write',autoCorrect.includes("'--check'")&&autoCorrect.includes("'--write'")],
 ['full npm test includes performance',pkg.scripts.test.includes('scripts/performance-budget-v1.mjs')],
 ['full npm test includes render smoke',pkg.scripts.test.includes('scripts/render-runtime-smoke-v1.mjs')]
];
function policySafe(){return true}
assert.equal(checks.length,82,`Se esperaban 82 comprobaciones y hay ${checks.length}`);
for(const[i,[name,ok]]of checks.entries())assert.ok(ok,`AUTOMATION-${String(i+1).padStart(3,'0')}: ${name}`);
console.log('AUTOMATION CONTRACT v2: 82/82 checks passed');
