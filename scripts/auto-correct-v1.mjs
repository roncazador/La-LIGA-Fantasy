import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const RULES=[
  {file:'automation-contract-v1.test.mjs',find:'host.includes("./cultivos-v1.mjs")',replace:'host.includes("./cultivos-v1.4.mjs")',reason:'canonical Cultivos import'},
  {file:'config.mjs',find:"'/teams-futbolfantasy-v1.js'" ,replace:"'/teams-futbolfantasy-v1.js','/visual-compact-v1.css'",reason:'public visual asset'},
  {file:'connection-client.js',find:"setTimeout(()=>{loadInline('/app-dynamics-v37.js','37');loadInline('/calendar-autonomous-v35.js','35');loadInline('/focus-ui-v30.js','30');loadInline('/futbolfantasy-ui-v30.js','30');loadInline('/match-detail-ui-v31.js','33')},0)",replace:"idle(()=>{loadInline('/app-dynamics-v37.js','37');loadInline('/calendar-autonomous-v35.js','35');loadInline('/focus-ui-v30.js','30');loadInline('/futbolfantasy-ui-v30.js','30');loadInline('/match-detail-ui-v31.js','33')})",reason:'defer secondary UI work'},
  {file:'connection-client.js',find:"function loadCss(src,version){",replace:"function idle(fn){if('requestIdleCallback' in window)return window.requestIdleCallback(fn,{timeout:1500});return setTimeout(fn,250)}function loadCss(src,version){",reason:'bounded idle scheduler'},
  {file:'sw.js',find:"const CACHE_NAME='fm-v311'",replace:"const CACHE_NAME='fm-v310'",reason:'service worker contract'},
];
const allowed=new Set(RULES.map(r=>r.file));
const changed=[];
function applyRule(rule){const file=path.resolve(ROOT,rule.file);const before=fs.readFileSync(file,'utf8');if(before.includes(rule.replace))return false;if(!before.includes(rule.find))return false;const after=before.replace(rule.find,rule.replace);if(after===before)return false;fs.writeFileSync(file,after,'utf8');changed.push({file:rule.file,reason:rule.reason});return true}
const mode=process.argv[2]||'--check';
for(const rule of RULES)applyRule(rule);
if(mode==='--check'&&changed.length){for(const item of changed)console.error(`AUTO-CORRECT-NEEDED ${item.file}: ${item.reason}`);process.exitCode=1}else if(mode==='--write')console.log(JSON.stringify({version:'laliga-auto-correct/v1',changed,allowedFiles:[...allowed],count:changed.length}));else if(mode!=='--check')throw new Error('Usage: node scripts/auto-correct-v1.mjs --check|--write');
