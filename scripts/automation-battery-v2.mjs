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
function walk(dir){const out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','.cache'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...walk(full));else out.push(path.relative(ROOT,full))}return out}
const script=String(pkg.scripts?.test||'');const commands=[...script.matchAll(/node\s+([^\s&]+)/g)].map(m=>m[1]).filter(Boolean);
for(const file of commands){if(!exists(file)){push(`test file exists: ${file}`,false,category(file),'missing test file');continue}const r=runNode(file);results.push({name:`test: ${file}`,ok:r.ok,domain:category(file),detail:r.output,durationMs:r.durationMs,exitCode:r.exitCode})}
const critical=['automation-hub-v1.js','app-dynamics-v37.js','calendar-autonomous-v35.js','connection-client.js','brain-host-v27.mjs','brain-client-v27.js','futbolfantasy-ui-v30.js','recording-client.js','config.mjs','sw.js','.github/workflows/maintenance-automation.yml','.github/workflows/self-healing-ai.yml'];
for(const file of critical)push(`critical asset exists: ${file}`,exists(file),'structural');
for(const file of critical.filter(p=>/\.(js|mjs)$/.test(p))){if(!exists(file))continue;const r=spawnSync(process.execPath,['--check',path.resolve(ROOT,file)],{cwd:ROOT,encoding:'utf8',timeout:30000});push(`syntax: ${file}`,r.status===0,'structural',`${r.stderr||''}`.trim())}

// Credential detector deliberately targets assignments/headers, not key names or test descriptions.
const credentialPatterns=[
  /(?:API_FOOTBALL_API_KEY|SPORTMONKS_API_TOKEN|FOOTBALL_DATA_TOKEN|OPTA_API_TOKEN|LALIGA_[A-Z0-9_]*(?:TOKEN|SECRET|KEY))\s*[:=]\s*['"`]([^'"`\n]{20,})['"`]/i,
  /(?:apiFootballKey|sportmonksToken|footballDataToken|optaToken)\s*[:=]\s*['"`]([^'"`\n]{20,})['"`]/i,
  /authorization\s*[:=]\s*['"`]?Bearer\s+([A-Za-z0-9._-]{20,})/i,
  /x-apisports-key\s*[:=]\s*['"`]([^'"`\n]{20,})['"`]/i
];
const placeholder=/^(?:YOUR_API_KEY|YOUR_TOKEN|REPLACE_ME|CHANGE_ME|PROCESS\.ENV\.[A-Z0-9_]+|\$\{[^}]+\})$/i;
function detectCredential(text){for(const re of credentialPatterns){const m=text.match(re);if(m&&m[1]&&!placeholder.test(m[1].trim()))return m[0]}return null}
const scanFiles=walk(ROOT).filter(p=>/\.(js|mjs|json|yml|yaml|html|env|txt)$/.test(p)).filter(p=>!/^automation-(battery|handoff)-report\./.test(path.basename(p)));
for(const file of scanFiles){let text='';try{text=read(file)}catch{continue}push(`secret assignment scan: ${file}`,!detectCredential(text),'security',detectCredential(text)?'credential-shaped assignment detected':'')}
push('secret detector ignores placeholders',!detectCredential('API_FOOTBALL_API_KEY="YOUR_API_KEY"'),'security');
push('secret detector catches synthetic credential',Boolean(detectCredential('API_FOOTBALL_API_KEY="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"')),'security');

const hub=exists('automation-hub-v1.js')?read('automation-hub-v1.js'):'';
const dyn=exists('app-dynamics-v37.js')?read('app-dynamics-v37.js'):'';
const cal=exists('calendar-autonomous-v35.js')?read('calendar-autonomous-v35.js'):'';
const conn=exists('connection-client.js')?read('connection-client.js'):'';
const cfg=exists('config.mjs')?read('config.mjs'):'';
const sw=exists('sw.js')?read('sw.js'):'';
const heal=exists('.github/workflows/self-healing-ai.yml')?read('.github/workflows/self-healing-ai.yml'):'';
const maint=exists('.github/workflows/maintenance-automation.yml')?read('.github/workflows/maintenance-automation.yml'):'';
const handoff=exists('scripts/automation-handoff-v1.mjs')?read('scripts/automation-handoff-v1.mjs'):'';
const contract=exists('automation-contract-v1.test.mjs')?read('automation-contract-v1.test.mjs'):'';
push('hub exposes versioned handoff schema',hub.includes("laliga-automation-handoff/v1"),'automation');
push('hub listens to calendar updates',hub.includes("laliga:calendar-updated"),'automation');
push('hub listens to calendar degradation',hub.includes("laliga:calendar-degraded"),'automation');
push('hub listens to calendar errors',hub.includes("laliga:calendar-error"),'automation');
push('hub listens to generic layer errors',hub.includes("laliga:layer-error"),'automation');
push('connection loads hub before dependent layers',conn.indexOf('/automation-hub-v1.js')>=0&&conn.indexOf('/automation-hub-v1.js')<conn.indexOf('/app-dynamics-v37.js'),'automation');
push('connection reports loading state',conn.includes("status:'loading'"),'automation');
push('calendar emits degraded without generic retry',cal.includes('laliga:calendar-degraded')&&cal.includes('retryable:false'),'calendar');
push('calendar emits terminal error with calendar marker',cal.includes('laliga:calendar-error')&&cal.includes('calendar:true')&&cal.includes('retryable:true'),'calendar');
push('dynamics filters non-calendar errors',dyn.includes('isCalendarFailure')&&dyn.includes('non-calendar-error'),'calendar');
push('dynamics listens to terminal calendar errors',dyn.includes('laliga:calendar-error')&&dyn.includes('onCalendarError'),'calendar');
push('dynamics retries only calendar refresh',dyn.includes('scheduleRetry()')&&dyn.includes('LALIGA_CALENDAR_V35.refresh'),'calendar');
push('dynamics does not blindly retry all layers',dyn.includes('if(!isCalendarFailure(e))'),'calendar');
push('dynamics clears retry on calendar recovery',dyn.includes('onCalendar(e)')&&dyn.includes('clearRetry()'),'calendar');
push('public registry contains hub',cfg.includes("'/automation-hub-v1.js'"),'deployment');
push('service worker cache version is current',sw.includes("fm-v309"),'deployment');
push('service worker caches hub',sw.includes('./automation-hub-v1.js'),'deployment');
push('handoff workflow is wired into maintenance',maint.includes('automation-handoff-v1.mjs')&&maint.includes('actions/upload-artifact@v4'),'ci-automation');
push('self-heal workflow attaches handoff',heal.includes('Generate ChatGPT handoff')&&heal.includes('self-healing-chatgpt-handoff'),'ci-automation');
push('self-heal remains bounded',heal.includes('SELF_HEAL_MAX_ATTEMPTS: 2'),'ci-automation');
push('handoff has stable schema',handoff.includes('laliga-automation-handoff/v1'),'ci-automation');
push('handoff samples critical workflow runs',handoff.includes('/actions/runs?per_page=40'),'ci-automation');
push('automation contract checks battery wiring',contract.includes("automation-battery-v2.mjs")&&contract.includes('automation-handoff-v1.mjs'),'ci-automation');

const byDomain={};for(const r of results){(byDomain[r.domain]??=[]).push(r)}
const failed=results.filter(r=>!r.ok),passed=results.length-failed.length;
const rec=[];
if(failed.some(r=>r.domain==='calendar'))rec.push('Revisar contratos de degradación/fallo terminal del calendario antes de ampliar recuperación.');
if(failed.some(r=>r.domain==='brain'))rec.push('Revisar memoria, calibración, fiabilidad y regresiones del cerebro antes de cambiar el modelo.');
if(failed.some(r=>r.domain==='ci-automation'))rec.push('Revisar contratos de CI y handoff antes de aumentar permisos o automatizaciones.');
if(failed.some(r=>r.domain==='security'))rec.push('Revisar únicamente asignaciones con forma de credencial y confirmar que ningún secreto llegue al cliente.');
if(!failed.length)rec.push('Mantener un único dueño del estado de automatización y usar este informe para escoger la siguiente mejora incremental.');
const report={schema:'laliga-automation-battery/v2',generatedAt:new Date().toISOString(),durationMs:Date.now()-started,summary:{total:results.length,passed,failed:failed.length,successRate:results.length?Number((passed/results.length*100).toFixed(2)):0},byDomain:Object.fromEntries(Object.entries(byDomain).map(([k,v])=>[k,{total:v.length,passed:v.filter(x=>x.ok).length,failed:v.filter(x=>!x.ok).length}])),failures:failed.slice(0,50),recommendations:rec,tests:results};
fs.writeFileSync(OUT_JSON,JSON.stringify(report,null,2)+'\n','utf8');
const lines=[`# Automation battery v2`,``,`Generated: ${report.generatedAt}`,`Total: **${report.summary.total}** · Passed: **${passed}** · Failed: **${failed.length}** · Success: **${report.summary.successRate}%**`,``,`## Domains`];
for(const[k,v]of Object.entries(report.byDomain))lines.push(`- ${k}: ${v.passed}/${v.total} passed${v.failed?` · ${v.failed} failed`:''}`);
lines.push('','## Failures');if(!failed.length)lines.push('No failures detected.');else for(const f of failed.slice(0,30))lines.push(`- **${f.domain}** · ${f.name}${f.detail?` — ${String(f.detail).replace(/\s+/g,' ').slice(0,500)}`:''}`);
lines.push('','## Recommendations');for(const r of rec)lines.push(`- ${r}`);fs.writeFileSync(OUT_MD,lines.join('\n')+'\n','utf8');
console.log(`AUTOMATION BATTERY v2: ${passed}/${results.length} passed · report=${path.basename(OUT_JSON)}`);
if(failed.length)process.exitCode=1;
