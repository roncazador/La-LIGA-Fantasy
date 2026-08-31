import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const workflow=read('.github/workflows/maintenance-automation.yml');
const governance=read('.github/workflows/ci-governance.yml');
const governanceTest=read('ci-governance-v1.mjs');
const pkg=JSON.parse(read('package.json'));
const hub=read('automation-hub-v1.js');
const calendar=read('calendar-autonomous-v35.js');
const dynamics=read('app-dynamics-v37.js');
const connection=read('connection-client.js');
const sw=read('sw.js');
const config=read('config.mjs');
const handoff=read('scripts/automation-handoff-v1.mjs');
const battery=read('scripts/automation-battery-v2.mjs');
const heal=read('scripts/self-heal-agent.mjs');
const preflight=read('render-preflight.mjs');

const checks=[
 ['automation workflow exists',workflow.includes('name: Maintenance automation')],
 ['automation is pull-request aware',workflow.includes('pull_request:')],
 ['automation runs on main pushes',workflow.includes('branches: [main]')],
 ['automation can be dispatched manually',workflow.includes('workflow_dispatch:')],
 ['automation has scheduled housekeeping',workflow.includes('cron:')],
 ['automation keeps read-only permissions',workflow.includes('actions: read')&&workflow.includes('contents: read')&&!workflow.includes('contents: write')],
 ['automation uses pinned Node runtime',workflow.includes('node-version: 24.14.1')],
 ['automation runs expanded battery',workflow.includes('npm run test:automation')],
 ['automation generates ChatGPT handoff',workflow.includes('automation-handoff-v1.mjs')],
 ['automation uploads reports',workflow.includes('actions/upload-artifact@v4')&&workflow.includes('automation-reports')],
 ['automation publishes summary',workflow.includes('GITHUB_STEP_SUMMARY')],
 ['CI governance workflow exists',governance.includes('name: CI governance')],
 ['CI governance is pull-request aware',governance.includes('pull_request:')],
 ['CI governance uses pinned Node runtime',governance.includes('node-version: 24.14.1')],
 ['CI governance executes its audit',governance.includes('node ci-governance-v1.mjs')],
 ['CI governance audit is in main test battery',pkg.scripts.test.includes('ci-governance-v1.mjs')],
 ['governance audit scans all workflow files',governanceTest.includes('fs.readdirSync(workflowDir)')],
 ['npm test still includes automation contract',pkg.scripts.test.includes('automation-contract-v1.test.mjs')],
 ['automation battery command is exposed',pkg.scripts['test:automation']==='node scripts/automation-battery-v2.mjs'],
 ['hub exposes versioned state schema',hub.includes('laliga-automation-state/v1')],
 ['hub exposes ChatGPT handoff schema',hub.includes('laliga-automation-handoff/v1')],
 ['hub handoff is explicitly read-only',hub.includes('readOnly:true')],
 ['hub records bounded errors',hub.includes('MAX_ERRORS=40')&&hub.includes('recentErrors')],
 ['hub records bounded events',hub.includes('MAX_EVENTS=200')&&hub.includes('recentEvents')],
 ['hub listens to calendar updates',hub.includes('laliga:calendar-updated')],
 ['hub listens to calendar degradation',hub.includes('laliga:calendar-degraded')],
 ['hub listens to calendar terminal errors',hub.includes('laliga:calendar-error')],
 ['hub listens to generic layer errors',hub.includes('laliga:layer-error')],
 ['hub inspects dependent layers',hub.includes('LALIGA_CALENDAR_V35')&&hub.includes('LALIGA_APP_DYNAMICS_V37')],
 ['connection loads hub first',connection.indexOf('/automation-hub-v1.js')>=0&&connection.indexOf('/automation-hub-v1.js')<connection.indexOf('/app-dynamics-v37.js')],
 ['connection reports layer loading',connection.includes("status:'loading'" )],
 ['connection reports layer failures',connection.includes('laliga:layer-error')],
 ['calendar marks its own errors',calendar.includes('calendar:true')&&calendar.includes("src:'/calendar-autonomous-v35.js'")],
 ['calendar separates degradation from terminal failure',calendar.includes('announceDegraded')&&calendar.includes('announceError')],
 ['calendar degradation is non-retryable',calendar.includes('retryable:false')],
 ['calendar terminal failure is retryable',calendar.includes('retryable:true')],
 ['dynamics filters non-calendar errors',dynamics.includes('isCalendarFailure')&&dynamics.includes('non-calendar-error')],
 ['dynamics retries terminal calendar error',dynamics.includes('onCalendarError')&&dynamics.includes('scheduleRetry()')],
 ['dynamics keeps bounded backoff',dynamics.includes('RETRY_DELAYS=[5000,15000,30000]')],
 ['dynamics does not blindly retry all layers',dynamics.includes('if(!isCalendarFailure(e))')],
 ['dynamics clears retry on calendar recovery',dynamics.includes('onCalendar(e)')&&dynamics.includes('clearRetry()')],
 ['public registry contains hub',config.includes("'/automation-hub-v1.js'" )],
 ['service worker cache is bumped',sw.includes("CACHE_NAME='fm-v309'" )],
 ['service worker caches hub',sw.includes('./automation-hub-v1.js')],
 ['handoff report has stable schema',handoff.includes('laliga-automation-handoff/v1')],
 ['handoff samples critical workflow runs',handoff.includes('/actions/runs?per_page=40')],
 ['handoff includes failed job logs',handoff.includes('/actions/jobs/${job.id}/logs')],
 ['handoff carries recommendations',handoff.includes('recommendations')],
 ['handoff limits failure records',handoff.includes('slice(0,10)')&&handoff.includes('slice(0,8)')],
 ['battery emits machine-readable JSON',battery.includes('laliga-automation-battery/v2')&&battery.includes('automation-battery-report.json')],
 ['battery emits markdown report',battery.includes('automation-battery-report.md')],
 ['battery continues after individual test failure',battery.includes('for(const file of commands)')],
 ['battery performs syntax checks',battery.includes("['--check'")],
 ['battery scans secret-like patterns',battery.includes('const secret=')],
 ['battery recursively scans repository',battery.includes('function walk(dir)')],
 ['self-heal agent remains present',heal.includes('self-heal-agent')||heal.includes('SELF_HEAL_SUCCESS')],
 ['render preflight remains available',preflight.includes('RENDER_PREFLIGHT_OK')]
];

assert.equal(checks.length,58,`Se esperaban 58 comprobaciones y hay ${checks.length}`);
for(const [i,[name,ok]] of checks.entries()) assert.ok(ok,`AUTOMATION-${String(i+1).padStart(3,'0')}: ${name}`);
console.log('AUTOMATION CONTRACT v1: 58/58 checks passed');
