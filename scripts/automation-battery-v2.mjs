import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd(),OUT_JSON=path.resolve(ROOT,'automation-battery-report.json'),OUT_MD=path.resolve(ROOT,'automation-battery-report.md');
const pkg=JSON.parse(fs.readFileSync(path.resolve(ROOT,'package.json'),'utf8'));
const started=Date.now(),results=[];
const read=p=>fs.readFileSync(path.resolve(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.resolve(ROOT,p));
const push=(name,ok,domain,detail='')=>results.push({name,ok:Boolean(ok),domain,detail:String(detail).slice(0,1000)});
function category(file){const p=String(file);if(/brain/i.test(p))return'brain';if(/calendar/i.test(p))return'calendar';if(/record|recording/i.test(p))return'recording';if(/futbolfantasy/i.test(p))return'fantasy-data';if(/ui|dashboard|focus|match-detail|connection/i.test(p))return'ui-runtime';if(/governance|automation|workflow|self-heal/i.test(p))return'ci-automation';return'structural'}
function runNode(file){const t=Date.now(),r=spawnSync(process.execPath,[file],{cwd:ROOT,encoding:'utf8',timeout:120000});const output=`${r.stdout||''}\n${r.stderr||''}`.trim();return{file,ok:r.status===0&&!r.error,durationMs:Date.now()-t,exitCode:r.status,output:output.slice(-1800)}}
const script=String(pkg.scripts?.test||'');const commands=[...script.matchAll(/node\s+([^\s&]+)/g)].map(m=>m[1]).filter(Boolean);
for(const file of commands){if(!exists(file)){push(`test file exists: ${file}`,false,category(file),'missing test file');continue}const r=runNode(file);results.push({name:`test: ${file}`,ok:r.ok,domain:category(file),detail:r.output,durationMs:r.durationMs,exitCode:r.exitCode})}
const critical=['automation-hub-v1.js','app-dynamics-v37.js','calendar-autonomous-v35.js','connection-client.js','brain-host-v27.mjs','brain-client-v27.js','futbolfantasy-ui-v30.js','recording-client.js','config.mjs','sw.js','.github/workflows/maintenance-automation.yml','.github/workflows/self-healing-ai.yml'];
for(const file of critical){push(`critical asset exists: ${file}`,exists(file),'structural')}
for(const file of critical.filter(p=>/\.(js|mjs)$/.test(p))){if(!exists(file))continue;const r=spawnSync(process.execPath,['--check',path.resolve(ROOT,file)],{cwd:ROOT,encoding:'utf8',timeout:30000});push(`syntax: ${file}`,r.status===0,'structural',`${r.stderr||''}`.trim())}
const secret=/(x-apisports-key|YOUR_API_KEY|authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}|apiFootballKey\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"])/i;
const scanDirs=['.github','scripts'];for(const file of fs.readdirSync(ROOT).filter(p=>/\.(js|mjs|json|yml|yaml|html)$/.test(p)))scanDirs.push(file);
const scanned=[...new Set(scanDirs)].filter(exists);for(const file of scanned){let text='';try{text=read(file)}catch{continue}push(`secret scan: ${file}`,!secret.test(text),'security')}
const hub=exists('automation-hub-v1.js')?read('automation-hub-v1.js'):'';
const dyn=exists('app-dynamics-v37.js')?read('app-dynamics-v37.js'):'';
const cal=exists('calendar-autonomous-v35.js')?read('calendar-autonomous-v35.js'):'';
const conn=exists('connection-client.js')?read('connection-client.js'):'';
const cfg=exists('config.mjs')?read('config.mjs'):'';
const sw=exists('sw.js')?read('sw.js'):'';
const heal=exists('.github/workflows/self-healing-ai.yml')?read('.github/workflows/self-healing-ai.yml'):'';
const maint=exists('.github/workflows/maintenance-automation.yml')?read('.github/workflows/maintenance-automation.yml'):'';
push('hub exposes versioned handoff schema',hub.includes("laliga-automation-handoff/v1"),'automation');
push('hub listens to calendar updates',hub.includes("laliga:calendar-updated"),'automation');
push('hub listens to calendar degradation',hub.includes("laliga:calendar-degraded"),'automation');
push('hub listens to calendar errors',hub.includes("laliga:calendar-error"),'automation');
push('hub listens to generic layer errors',hub.includes("laliga:layer-error"),'automation');
push('connection loads hub before dependent layers',conn.indexOf('/automation-hub-v1.js')>=0&&conn.indexOf('/automation-hub-v1.js')<conn.indexOf('/app-dynamics-v37.js'),'automation');
push('connection reports loading state',conn.includes("status:'loading'"),'automation');
push('calendar emits degraded without triggering generic recovery',cal.includes('laliga:calendar-degraded')&&cal.includes('announceDegraded'),'calendar');
push('calendar emits terminal error with calendar marker',cal.includes('laliga:calendar-error')&&cal.includes('calendar:true')&&cal.includes('retryable:true'),'calendar');
push('dynamics filters non-calendar layer errors',dyn.includes('isCalendarFailure')&&dyn.includes('non-calendar-error'),'calendar');
push('dynamics listens to terminal calendar errors',dyn.includes('laliga:calendar-error')&&dyn.includes('onCalendarError'),'calendar');
push('dynamics retries only calendar refresh',dyn.includes('scheduleRetry()')&&dyn.includes('LALIGA_CALENDAR_V35.refresh'),'calendar');
push('dynamics does not schedule generic layer retry',!dyn.match(/function onError[\s\S]{0,900}scheduleRetry\(\)/)||dyn.includes('if(!isCalendarFailure(e))'),'calendar');
push('public static registry contains hub',cfg.includes("'/automation-hub-v1.js'"),'deployment');
push('service worker cache version is current',sw.includes("fm-v308"),'deployment');
push('service worker caches hub',sw.includes('./automation-hub-v1.js'),'deployment');
push('self-heal workflow exists',heal.includes('self-heal-agent.mjs')&&heal.includes('workflow_run'),'ci-automation');
push('maintenance workflow runs expanded battery',maint.includes('automation-battery-v2.mjs'),'ci-automation');
push('maintenance workflow runs render preflight',maint.includes('npm run render:verify'),'ci-automation');
const byDomain={};for(const r of results){(byDomain[r.domain]??=[]).push(r)}
const failed=results.filter(r=>!r.ok),passed=results.length-failed.length;
const rec=[];
if(failed.some(r=>r.domain==='calendar'))rec.push('Revisar separación entre degradación del proveedor y fallo terminal del calendario antes de ampliar automatizaciones de recuperación.');
if(failed.some(r=>r.domain==='brain'))rec.push('Revisar regresiones del cerebro antes de modificar predicción, calibración o memoria.');
if(failed.some(r=>r.domain==='ci-automation'))rec.push('Revisar contratos de CI y handoff antes de añadir nuevas automatizaciones.');
if(!failed.length)rec.push('Mantener la recuperación acotada y usar el informe de batería como punto de entrada para la próxima mejora; evitar añadir otro dueño del estado.');
const report={schema:'laliga-automation-battery/v2',generatedAt:new Date().toISOString(),durationMs:Date.now()-started,summary:{total:results.length,passed,failed:failed.length,successRate:results.length?Number((passed/results.length*100).toFixed(2)):0},byDomain:Object.fromEntries(Object.entries(byDomain).map(([k,v])=>[k,{total:v.length,passed:v.filter(x=>x.ok).length,failed:v.filter(x=>!x.ok).length}])),failures:failed.slice(0,30),recommendations:rec,tests:results};
fs.writeFileSync(OUT_JSON,JSON.stringify(report,null,2)+'\n','utf8');
const lines=[`# Automation battery v2`,``,`Generated: ${report.generatedAt}`,`Total: **${report.summary.total}** · Passed: **${passed}** · Failed: **${failed.length}** · Success: **${report.summary.successRate}%**`,``,`## Domains`];
for(const[k,v]of Object.entries(report.byDomain))lines.push(`- ${k}: ${v.passed}/${v.total} passed${v.failed?` · ${v.failed} failed`:''}`);
lines.push('','## Failures');if(!failed.length)lines.push('No failures detected.');else for(const f of failed.slice(0,20))lines.push(`- **${f.domain}** · ${f.name}${f.detail?` — ${String(f.detail).replace(/\s+/g,' ').slice(0,300)}`:''}`);
lines.push('','## Recommendations');for(const r of rec)lines.push(`- ${r}`);fs.writeFileSync(OUT_MD,lines.join('\n')+'\n','utf8');
console.log(`AUTOMATION BATTERY v2: ${passed}/${results.length} passed · report=${path.basename(OUT_JSON)}`);
if(failed.length)process.exitCode=1;
