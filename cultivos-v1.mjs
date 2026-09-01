import fs from 'node:fs';
import path from 'node:path';

export const CULTIVOS_VERSION='1.2.0';
const MAX_EVENTS=200;
const KEYS=['data','prediction','reliability','automation','coverage'];
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const baseState=()=>({version:CULTIVOS_VERSION,cycles:0,events:[],dimensions:{data:0,prediction:0,reliability:0,automation:0,coverage:0},score:0,lastAt:null});

export function createCultivos({dir='./.brain-data'}={}){
  const file=path.resolve(dir,'cultivos-v1.json');
  let state=baseState();
  try{const raw=JSON.parse(fs.readFileSync(file,'utf8'));if(raw&&typeof raw==='object')state={...state,...raw,version:CULTIVOS_VERSION,dimensions:{...state.dimensions,...(raw.dimensions||{})},events:Array.isArray(raw.events)?raw.events.slice(-MAX_EVENTS):[]}}catch{}
  function save(){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(state,null,2),'utf8');fs.renameSync(tmp,file)}
  function observe({source='unknown',outcome='neutral',dimensions={},detail=''}={}){
    const now=new Date().toISOString();
    const delta=outcome==='success'?1:outcome==='failure'?-1:0;
    for(const key of KEYS) if(Number.isFinite(Number(dimensions[key]))) state.dimensions[key]=clamp(Number(state.dimensions[key])+Number(dimensions[key]),-100,100);
    state.score=clamp(Object.values(state.dimensions).reduce((a,b)=>a+b,0)/KEYS.length,-100,100);
    state.events.push({at:now,source:String(source).slice(0,120),outcome,delta,dimensions:{...dimensions},detail:String(detail).slice(0,300)});state.events=state.events.slice(-MAX_EVENTS);state.cycles++;state.lastAt=now;save();return summary();
  }
  function syncFromBrain(brainStatus={}){
    const accuracy=Number(brainStatus.accuracy);const reliability=Number(brainStatus.reliability?.reliability);const dataQuality=Number(brainStatus.reliability?.dataQuality);
    const dimensions={};
    if(Number.isFinite(accuracy)) dimensions.prediction=clamp((accuracy-50)/10,-3,5);
    if(Number.isFinite(reliability)) dimensions.reliability=clamp((reliability-.5)*8,-3,4);
    if(Number.isFinite(dataQuality)) dimensions.data=clamp((dataQuality-.5)*6,-3,3);
    return observe({source:'brain-sync',outcome:'neutral',dimensions,detail:'Feedback continuo desde estado del cerebro'});
  }
  function syncFromAutomation(automationStatus={}){
    const events=Number(automationStatus.eventCount);const errors=Array.isArray(automationStatus.recentErrors)?automationStatus.recentErrors.length:0;
    const dimensions={automation:clamp((events>0?1:0)-(errors>0?Math.min(errors,3):0),-3,2),coverage:clamp(events>0?1:0,-1,2)};
    return observe({source:'automation-sync',outcome:errors?'failure':'success',dimensions,detail:'Feedback del Automation Hub: eventos y errores recientes'});
  }
  function syncFromEvidence(evidenceStatus={}){
    const captures=Number(evidenceStatus.captureCount??evidenceStatus.captures);const recordings=Number(evidenceStatus.recordingCount??evidenceStatus.recordings);
    const dimensions={coverage:clamp((Number.isFinite(captures)?Math.min(captures,2):0)+(Number.isFinite(recordings)?Math.min(recordings,2):0),0,4)};
    return observe({source:'evidence-sync',outcome:'neutral',dimensions,detail:'Cobertura de evidencias aisladas para corrección supervisada'});
  }
  function syncFromVideoEvidence(video={}){
    const confirmed=video.humanConfirmed===true;
    const observations=Number(video.observationCount??video.observationsCount??0);
    const hasHash=typeof video.sha256==='string'&&/^[a-f0-9]{64}$/i.test(video.sha256);
    const dimensions={coverage:clamp((hasHash?1:0)+(observations>0?1:0),0,2),data:confirmed?1:0};
    return observe({source:'video-evidence-sync',outcome:confirmed?'success':'neutral',dimensions,detail:confirmed?'Evidencia de vídeo confirmada por humano':'Evidencia de vídeo registrada sin alimentar automáticamente el aprendizaje'});
  }
  function summary(){return {version:state.version,cycles:state.cycles,score:Number(state.score.toFixed(2)),dimensions:{...state.dimensions},lastAt:state.lastAt,recentEvents:state.events.slice(-12)}}
  return {observe,syncFromBrain,syncFromAutomation,syncFromEvidence,syncFromVideoEvidence,summary,file};
}
