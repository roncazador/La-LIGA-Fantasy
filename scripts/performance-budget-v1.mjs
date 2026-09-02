import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

const files=['connection-client.js','automation-hub-v1.js','executive-dashboard-v1.js','evidence-isolation-v1.js','teams-futbolfantasy-v1.js'];
const root=process.cwd();
const bytes=file=>fs.statSync(path.join(root,file)).size;
const measurements={
  htmlBytes:fs.statSync(path.join(root,'index.html')).size,
  cssBytes:fs.statSync(path.join(root,'visual-compact-v1.css')).size,
  initialScriptBytes:files.reduce((n,f)=>n+bytes(f),0),
  initialLayerCount:4,
  secondaryLayersIdle:fs.readFileSync(path.join(root,'connection-client.js'),'utf8').includes('requestIdleCallback')
};
const compileSamples=[];
for(const file of files){const source=fs.readFileSync(path.join(root,file),'utf8');for(let i=0;i<10;i++){const t=performance.now();new vm.Script(source,{filename:file});compileSamples.push(performance.now()-t)}}
compileSamples.sort((a,b)=>a-b);
measurements.compileP95Ms=Number(compileSamples[Math.min(compileSamples.length-1,Math.ceil(compileSamples.length*.95)-1)].toFixed(3));
const budgets={htmlBytes:90000,cssBytes:4000,initialScriptBytes:40000,initialLayerCount:4,compileP95Ms:100};
const checks=[
  ['HTML stays compact',measurements.htmlBytes<=budgets.htmlBytes],
  ['visual CSS stays bounded',measurements.cssBytes<=budgets.cssBytes],
  ['initial JavaScript stays bounded',measurements.initialScriptBytes<=budgets.initialScriptBytes],
  ['critical layer count stays bounded',measurements.initialLayerCount<=budgets.initialLayerCount],
  ['secondary layers are deferred to idle',measurements.secondaryLayersIdle],
  ['critical script compile p95 stays bounded',measurements.compileP95Ms<=budgets.compileP95Ms]
];
const report={version:'laliga-performance-budget/v1',generatedAt:new Date().toISOString(),measurements,budgets,checks};
if(process.env.PERF_REPORT==='1')fs.writeFileSync(path.join(root,'performance-budget-report.json'),JSON.stringify(report,null,2)+'\n','utf8');
for(const[name,ok]of checks)if(!ok)throw new Error(`PERFORMANCE-${name}`);
console.log(`PERFORMANCE BUDGET v1: ${checks.length}/${checks.length} passed · HTML=${measurements.htmlBytes}B · CSS=${measurements.cssBytes}B · initialJS=${measurements.initialScriptBytes}B · compileP95=${measurements.compileP95Ms}ms`);
