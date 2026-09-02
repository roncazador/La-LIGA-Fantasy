import fs from 'node:fs';
import path from 'node:path';
export const CULTIVOS_VERSION='1.4.0';
const MAX_EVENTS=300;
const KEYS=['data','prediction','reliability','automation','coverage','ux','sources'];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const base=()=>({version:CULTIVOS_VERSION,cycles:0,score:0,lastAt:null,dimensions:Object.fromEntries(KEYS.map(k=>[k,0])),events:[]});
export function createCultivos({dir='./.brain-data'}={}){
 const file=path.resolve(dir,'cultivos-v1.json');let s=base();
 try{const x=JSON.parse(fs.readFileSync(file,'utf8'));s={...s,...x,version:CULTIVOS_VERSION,dimensions:{...s.dimensions,...(x.dimensions||{})},events:Array.isArray(x.events)?x.events.slice(-MAX_EVENTS):[]}}catch{}
 const save=()=>{fs.mkdirSync(path.dirname(file),{recursive:true});const t=`${file}.${process.pid}.tmp`;fs.writeFileSync(t,JSON.stringify(s,null,2));fs.renameSync(t,file)};
 function observe({source='unknown',outcome='neutral',dimensions={},detail='',evidence=false}={}){for(const k of KEYS)if(Number.isFinite(Number(dimensions[k])))s.dimensions[k]=clamp(Number(s.dimensions[k])+Number(dimensions[k]),-100,100);const delta=outcome==='success'?1:outcome==='failure'?-1:0;s.score=clamp(Object.values(s.dimensions).reduce((a,b)=>a+b,0)/KEYS.length,-100,100);s.events.push({at:new Date().toISOString(),source:String(source).slice(0,120),outcome,delta,evidence,dimensions:{...dimensions},detail:String(detail).slice(0,400)});s.events=s.events.slice(-MAX_EVENTS);s.cycles++;s.lastAt=new Date().toISOString();save();return summary()}
 function sync(snapshot={}){return observe({source:'continuous-sync',dimensions:{...snapshot.dimensions},outcome:snapshot.failure?'failure':'neutral',evidence:snapshot.evidence===true,detail:snapshot.detail||'Sincronización supervisada de estado'})}
 function summary(){return {version:s.version,cycles:s.cycles,score:Number(s.score.toFixed(2)),dimensions:{...s.dimensions},lastAt:s.lastAt,recentEvents:s.events.slice(-12)}}
 return {observe,sync,summary,file};
}
