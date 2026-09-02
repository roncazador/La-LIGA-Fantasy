import fs from 'node:fs';
import path from 'node:path';

export const CULTIVOS_VERSION='1.4.0';
const MAX_EVENTS=300;
const KEYS=['data','prediction','reliability','automation','coverage','ux','sources'];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const base=()=>({version:CULTIVOS_VERSION,cycles:0,score:0,lastAt:null,dimensions:Object.fromEntries(KEYS.map(k=>[k,0])),events:[]});

export function createCultivos({dir='./.brain-data'}={}){
  const file=path.resolve(dir,'cultivos-v1.json');
  let s=base();
  try{const x=JSON.parse(fs.readFileSync(file,'utf8'));s={...s,...x,version:CULTIVOS_VERSION,dimensions:{...s.dimensions,...(x.dimensions||{})},events:Array.isArray(x.events)?x.events.slice(-MAX_EVENTS):[]}}catch{}
  const save=()=>{fs.mkdirSync(path.dirname(file),{recursive:true});const t=`${file}.${process.pid}.tmp`;fs.writeFileSync(t,JSON.stringify(s,null,2));fs.renameSync(t,file)};
  function observe({source='unknown',outcome='neutral',dimensions={},detail='',evidence=false}={}){
    for(const k of KEYS)if(Number.isFinite(Number(dimensions[k])))s.dimensions[k]=clamp(Number(s.dimensions[k])+Number(dimensions[k]),-100,100);
    const delta=outcome==='success'?1:outcome==='failure'?-1:0;
    s.score=clamp(Object.values(s.dimensions).reduce((a,b)=>a+b,0)/KEYS.length,-100,100);
    s.events.push({at:new Date().toISOString(),source:String(source).slice(0,120),outcome,delta,evidence,dimensions:{...dimensions},detail:String(detail).slice(0,400)});
    s.events=s.events.slice(-MAX_EVENTS);s.cycles++;s.lastAt=new Date().toISOString();save();return summary();
  }
  function sync(snapshot={}){return observe({source:'continuous-sync',dimensions:{...snapshot.dimensions},outcome:snapshot.failure?'failure':'neutral',evidence:snapshot.evidence===true,detail:snapshot.detail||'Sincronización supervisada de estado'})}
  function syncFromBrain(brainStatus={}){
    const accuracy=Number(brainStatus.accuracy),reliability=Number(brainStatus.reliability?.reliability),dataQuality=Number(brainStatus.reliability?.dataQuality);const dimensions={};
    if(Number.isFinite(accuracy))dimensions.prediction=clamp((accuracy-50)/10,-3,5);
    if(Number.isFinite(reliability))dimensions.reliability=clamp((reliability-.5)*8,-3,4);
    if(Number.isFinite(dataQuality))dimensions.data=clamp((dataQuality-.5)*6,-3,3);
    return observe({source:'brain-sync',outcome:'neutral',dimensions,detail:'Feedback continuo desde estado del cerebro'});
  }
  function syncFromAutomation(automationStatus={}){
    const events=Number(automationStatus.eventCount),errors=Array.isArray(automationStatus.recentErrors)?automationStatus.recentErrors.length:0;const dimensions={automation:clamp((events>0?1:0)-(errors>0?Math.min(errors,3):0),-3,2),coverage:clamp(events>0?1:0,-1,2)};
    return observe({source:'automation-sync',outcome:errors?'failure':'success',dimensions,detail:'Feedback del Automation Hub: eventos y errores recientes'});
  }
  function syncFromEvidence(evidenceStatus={}){
    const captures=Number(evidenceStatus.captureCount??evidenceStatus.captures),recordings=Number(evidenceStatus.recordingCount??evidenceStatus.recordings);const dimensions={coverage:clamp((Number.isFinite(captures)?Math.min(captures,2):0)+(Number.isFinite(recordings)?Math.min(recordings,2):0),0,4)};
    return observe({source:'evidence-sync',outcome:'neutral',dimensions,detail:'Cobertura de evidencias aisladas para corrección supervisada'});
  }
  function syncFromVideoEvidence(video={}){
    const confirmed=video.humanConfirmed===true,observations=Number(video.observationCount??video.observationsCount??0),hasHash=typeof video.sha256==='string'&&/^[a-f0-9]{64}$/i.test(video.sha256);const dimensions={coverage:clamp((hasHash?1:0)+(observations>0?1:0),0,2),data:confirmed?1:0};
    return observe({source:'video-evidence-sync',outcome:confirmed?'success':'neutral',dimensions,detail:confirmed?'Evidencia de vídeo confirmada por humano':'Evidencia de vídeo registrada sin alimentar automáticamente el aprendizaje'});
  }
  function syncFromHandoff(handoff={}){
    const failures=Array.isArray(handoff.failures)?handoff.failures.length:Number(handoff.failureCount??0),recommendations=Array.isArray(handoff.recommendations)?handoff.recommendations.length:0,actionable=handoff.status==='success'||handoff.summary?.failed===0;
    const dimensions={automation:clamp(actionable?1:failures?-Math.min(failures,3):0,-3,1),coverage:clamp(recommendations>0?1:0,-1,1),reliability:clamp(actionable?1:0,-1,1)};
    return observe({source:'handoff-sync',outcome:actionable?'success':failures?'failure':'neutral',dimensions,detail:'Retroalimentación estructurada de batería/handoff; no escribe en el cerebro'});
  }
  function summary(){return {version:s.version,cycles:s.cycles,score:Number(s.score.toFixed(2)),dimensions:{...s.dimensions},lastAt:s.lastAt,recentEvents:s.events.slice(-12)}}
  return {observe,sync,syncFromBrain,syncFromAutomation,syncFromEvidence,syncFromVideoEvidence,syncFromHandoff,summary,file};
}
