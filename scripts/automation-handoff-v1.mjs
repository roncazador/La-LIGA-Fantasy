import fs from 'node:fs';
import path from 'node:path';

const repo=process.env.GITHUB_REPOSITORY||'roncazador/La-LIGA-Fantasy';
const token=process.env.GITHUB_TOKEN||'';
const eventPath=process.env.GITHUB_EVENT_PATH||'';
const outJson=path.resolve('automation-handoff.json'),outMd=path.resolve('automation-handoff.md');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const event=eventPath&&fs.existsSync(eventPath)?readJson(eventPath):{};
const trigger=event.workflow_run||{};
const api=async(p,init={})=>{if(!token)throw new Error('GITHUB_TOKEN missing');const r=await fetch(`https://api.github.com/repos/${repo}${p}`,{...init,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...(init.headers||{})}});const t=await r.text();if(!r.ok)throw new Error(`GitHub API ${r.status}: ${t.slice(0,600)}`);return t?JSON.parse(t):{}};
const truncate=v=>String(v??'').slice(-3500);
async function main(){
  const runs=(await api('/actions/runs?per_page=40')).workflow_runs||[];
  const relevant=runs.filter(r=>['Project tests','Brain v2.7 tests','Calendar interface tests','Recording UI contract tests','Maintenance automation','CI governance','Server smoke test','Integrate LALIGA connection client'].includes(r.name));
  const failedRuns=relevant.filter(r=>r.conclusion==='failure').slice(0,10);
  const failures=[];
  for(const run of failedRuns){const jobs=(await api(`/actions/runs/${run.id}/jobs?per_page=100`)).jobs||[];for(const job of jobs.filter(j=>j.conclusion==='failure').slice(0,8)){let log='';try{const r=await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${job.id}/logs`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});log=truncate(await r.text())}catch(error){log=`LOG_FETCH_ERROR: ${error.message}`}failures.push({workflow:run.name,runId:run.id,runNumber:run.run_number,job:job.name,jobId:job.id,url:job.html_url,log})}}
  const report=fs.existsSync('automation-battery-report.json')?readJson('automation-battery-report.json'):null;
  const recommendations=[];
  const names=failures.map(f=>`${f.workflow} ${f.job}`.toLowerCase()).join(' | ');
  if(/calendar/.test(names))recommendations.push('Priorizar contratos de evento y recuperación del calendario antes de cambiar fuentes de datos.');
  if(/brain/.test(names))recommendations.push('Revisar memoria, calibración, fiabilidad y regresiones del cerebro antes de cambiar el modelo.');
  if(/recording|ui/.test(names))recommendations.push('Comprobar contratos de UI y assets antes de tocar la capa visual.');
  if(/maintenance|governance/.test(names))recommendations.push('Revisar el contrato de automatizaciones y CI antes de ampliar permisos o workflows.');
  if(!recommendations.length)recommendations.push('No hay fallos recientes en los workflows críticos; mantener la arquitectura centralizada y ampliar cobertura con pruebas antes de añadir nuevas acciones.');
  const data={schema:'laliga-automation-handoff/v1',generatedAt:new Date().toISOString(),repository:repo,trigger:{workflow:trigger.name||'manual',runId:trigger.id||null,conclusion:trigger.conclusion||null,sha:trigger.head_sha||process.env.GITHUB_SHA||null},criticalRuns:relevant.slice(0,12).map(r=>({name:r.name,runId:r.id,conclusion:r.conclusion,status:r.status,sha:r.head_sha,url:r.html_url})),failures,recommendations,battery:report?{summary:report.summary,byDomain:report.byDomain,failures:report.failures,recommendations:report.recommendations}:null,chatgptInstruction:'Use this report as read-only engineering context. Prioritize concrete failing contracts, avoid inventing data, and propose the smallest safe next improvement.'};
  fs.writeFileSync(outJson,JSON.stringify(data,null,2)+'\n','utf8');
  const lines=[`# ChatGPT automation handoff v1`,``,`Generated: ${data.generatedAt}`,`Trigger: ${data.trigger.workflow} · ${data.trigger.conclusion||'manual'} · ${data.trigger.sha||'unknown'}`,``,`## Critical workflows`];
  for(const r of data.criticalRuns)lines.push(`- ${r.name}: **${r.conclusion||r.status}** · run ${r.runId}`);
  lines.push('','## Failures');if(!failures.length)lines.push('No critical workflow failures found in the sampled runs.');else for(const f of failures)lines.push(`- **${f.workflow} / ${f.job}** (run ${f.runNumber})\n  - ${f.log.replace(/\s+/g,' ').slice(0,700)}`);
  lines.push('','## Recommended next actions');for(const r of recommendations)lines.push(`- ${r}`);
  lines.push('','## Handoff contract',data.chatgptInstruction);fs.writeFileSync(outMd,lines.join('\n')+'\n','utf8');
  console.log(`AUTOMATION HANDOFF v1: ${failures.length} failure records · report=${outJson}`);
}
await main();
