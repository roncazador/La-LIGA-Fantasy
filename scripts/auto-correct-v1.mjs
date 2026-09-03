import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const IDLE="function idle(fn){if('requestIdleCallback' in window)return window.requestIdleCallback(fn,{timeout:1500});return setTimeout(fn,250)}";
const RULES=[
  {file:'automation-contract-v1.test.mjs',find:"host.includes('./cultivos-v1.mjs')",replace:"host.includes('./cultivos-v1.4.mjs')",reason:'canonical Cultivos import'},
  {file:'config.mjs',find:"'/teams-futbolfantasy-v1.js'",replace:"'/visual-compact-v1.css'",reason:'public visual asset',ready:before=>before.includes("'/visual-compact-v1.css'")},
  {file:'connection-client.js',find:"function loadCss(src,version){",replace:`${IDLE}function loadCss(src,version){`,reason:'bounded idle scheduler',ready:before=>before.includes(IDLE)},
  {file:'sw.js',find:"const CACHE_NAME='fm-v314'",replace:"const CACHE_NAME='fm-v315'",reason:'service worker contract'},
];
const allowed=new Set(RULES.map(r=>r.file));
const mode=process.argv[2]||'--check';
if(!['--check','--write'].includes(mode))throw new Error('Usage: node scripts/auto-correct-v1.mjs --check|--write');
const needed=[];
function inspect(rule){
  const file=path.resolve(ROOT,rule.file);const before=fs.readFileSync(file,'utf8');
  if(typeof rule.ready==='function'&&rule.ready(before))return false;
  if(before.includes(rule.replace))return false;
  if(!before.includes(rule.find))return false;
  needed.push({file:rule.file,reason:rule.reason});
  if(mode==='--write')fs.writeFileSync(file,before.replace(rule.find,rule.replace),'utf8');
  return true;
}
for(const rule of RULES)inspect(rule);
if(mode==='--check'&&needed.length){for(const item of needed)console.error(`AUTO-CORRECT-NEEDED ${item.file}: ${item.reason}`);process.exitCode=1}
else if(mode==='--write')console.log(JSON.stringify({version:'laliga-auto-correct/v1',changed:needed,allowedFiles:[...allowed],count:needed.length}))
else console.log('AUTO-CORRECT v1: clean; no deterministic correction required');
