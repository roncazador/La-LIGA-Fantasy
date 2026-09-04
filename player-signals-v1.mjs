import assert from 'node:assert/strict';

const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):min));
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const pick=(o,keys)=>keys.map(k=>o?.[k]).find(v=>v!==undefined&&v!==null&&v!=='');
const ageHours=(timestamp,now=Date.now())=>{const t=Date.parse(timestamp||'');return Number.isFinite(t)?Math.max(0,(now-t)/36e5):null};

export function sourceFreshness(timestamp,{now=Date.now(),maxHours=24}={}){
  const h=ageHours(timestamp,now); if(h===null)return 0;
  return clamp(100-(h/maxHours)*100);
}

export function sourceConfidence({sources=[],degraded=false,timestamp=null,conflicts=0,now=Date.now(),maxAgeHours=24}={}){
  const valid=[...new Set((Array.isArray(sources)?sources:[]).map(String).map(s=>s.trim()).filter(Boolean))];
  const diversity=clamp(valid.length*25);
  const freshness=timestamp?sourceFreshness(timestamp,{now,maxHours:maxAgeHours}):0;
  const conflictPenalty=Math.min(50,Math.max(0,Number(conflicts)||0)*20);
  // A provided observation that is already outside its freshness window is not
  // evidence for a current decision. Keep the confidence at zero rather than
  // allowing source diversity to mask stale data.
  if(timestamp && freshness<=0)return {score:0,label:'SIN EVIDENCIA',sources:valid.length,conflicts:Math.max(0,Number(conflicts)||0)};
  const score=clamp(Math.round((diversity*0.35)+(freshness*0.45)+((degraded?0:100)*0.20)-conflictPenalty));
  return {score,label:score>=80?'ALTA':score>=55?'MEDIA':score>0?'BAJA':'SIN EVIDENCIA',sources:valid.length,conflicts:Math.max(0,Number(conflicts)||0)};
}

export function startingProbability(player={},context={}){
  const explicit=num(pick(player,['startingProbability','starterProbability','startProbability']));
  if(explicit!==null)return {value:clamp(explicit),basis:'FUENTE EXTERNA',evidence:true};
  const starter=player.isStarter===true||player.starter===true||String(player.role||'').toLowerCase()==='titular';
  const bench=player.isBench===true||player.bench===true||String(player.role||'').toLowerCase()==='suplente';
  const availability=String(player.status||player.availability||'').toLowerCase();
  if(/lesion|injur|sancion|suspend|baja|out/.test(availability))return {value:0,basis:'NO DISPONIBLE',evidence:true};
  if(starter)return {value:90,basis:'TITULAR CONFIRMADO',evidence:true};
  if(bench)return {value:35,basis:'SUPLENTE/ROTACIÓN',evidence:true};
  if(context.officialLineupPending===true)return {value:null,basis:'SIN XI CONFIRMADO',evidence:false};
  return {value:null,basis:'SIN EVIDENCIA',evidence:false};
}

export function marketTrend(history=[]){
  const rows=(Array.isArray(history)?history:[]).map(x=>({t:Date.parse(x?.timestamp||x?.date||''),value:num(pick(x,['value','marketValue','price']))})).filter(x=>Number.isFinite(x.t)&&x.value!==null).sort((a,b)=>a.t-b.t);
  if(rows.length<2)return {direction:'SIN HISTORIAL',delta:null,percent:null,evidence:false};
  const first=rows[0].value,last=rows.at(-1).value,delta=last-first,percent=first===0?null:(delta/first)*100;
  return {direction:delta>0?'SUBE':delta<0?'BAJA':'ESTABLE',delta,percent:percent===null?null:Number(percent.toFixed(2)),evidence:true,points:rows.length};
}

export function buildPlayerSignals(player={},options={}){
  const p=startingProbability(player,options);
  const c=sourceConfidence({sources:options.sources,timestamp:options.timestamp,conflicts:options.conflicts,degraded:options.degraded,now:options.now,maxAgeHours:options.maxAgeHours});
  const trend=marketTrend(options.marketHistory);
  return {schema:'laliga-player-signals/v1',startingProbability:p,confidence:c,marketTrend:trend,evidenceOnly:p.evidence||trend.evidence};
}

export function explainPlayerSignals(signals){
  const lines=[];
  lines.push(signals?.startingProbability?.value==null?'Titularidad: sin evidencia':'Titularidad: '+signals.startingProbability.value+'% · '+signals.startingProbability.basis);
  lines.push('Confianza: '+(signals?.confidence?.label||'SIN EVIDENCIA')+(signals?.confidence?.sources?` · ${signals.confidence.sources} fuente(s)`:''));
  lines.push(signals?.marketTrend?.evidence?`Mercado: ${signals.marketTrend.direction}${signals.marketTrend.percent!==null?` · ${signals.marketTrend.percent>0?'+':''}${signals.marketTrend.percent}%`:''}`:'Mercado: sin historial');
  return lines;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const demo=buildPlayerSignals({isStarter:true},{sources:['futbolfantasy','official'],timestamp:new Date().toISOString(),marketHistory:[{timestamp:'2026-09-01T10:00:00Z',value:100},{timestamp:'2026-09-02T10:00:00Z',value:110}]});
  assert.equal(demo.schema,'laliga-player-signals/v1');
  console.log('PLAYER SIGNALS v1: self-check OK',JSON.stringify(demo));
}
