import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const BRAIN_VERSION = '2.7.0';

const DEFAULT_WEIGHTS = Object.freeze({
  performance: 0.34,
  availability: 0.21,
  context: 0.20,
  market: 0.15,
  risk: 0.10
});

const POSITIONS = ['POR','DEF','MED','DEL','UNK'];
const clamp = (x,min=0,max=1) => Math.max(min, Math.min(max, Number.isFinite(Number(x)) ? Number(x) : min));
const num = x => Number.isFinite(Number(x)) ? Number(x) : null;
const text = x => String(x ?? '').trim();
const norm = x => text(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const nowIso = () => new Date().toISOString();

function position(raw){
  const p=text(raw).toUpperCase();
  if(['GK','POR','PORTERO'].includes(p)) return 'POR';
  if(['DF','DEF','DEFENSA'].includes(p)) return 'DEF';
  if(['MF','MED','MEDIO','MEDIOCENTRO','CEN'].includes(p)) return 'MED';
  if(['FW','DEL','DELANTERO'].includes(p)) return 'DEL';
  return POSITIONS.includes(p) ? p : 'UNK';
}

function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); return dir; }
function atomicWrite(file,data){ const tmp=`${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(tmp,data,'utf8'); fs.renameSync(tmp,file); }

function safeLoad(file,fallback){
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch { return fallback; }
}

function feature(value, fallback=0.5){ return clamp(value == null ? fallback : value); }

function pickWeeklyPoints(p){
  const keys=['weekPoints','weeklyPoints','pointsThisWeek','currentWeekPoints','pfsYWeek','pfsyWeek','pointsWeek','matchPoints','roundPoints','jornadaPoints'];
  for(const k of keys){ const v=num(p?.[k]); if(v!=null) return v; }
  return null;
}

function pickPoints(p){
  const keys=['points','pfsy','pfsY','fantasyPoints','totalPoints','score'];
  for(const k of keys){ const v=num(p?.[k]); if(v!=null) return v; }
  return 0;
}

function pickPrice(p){ return num(p?.price ?? p?.marketPrice ?? p?.currentPrice); }
function pickValue(p){ return num(p?.value ?? p?.marketValue ?? p?.estimatedValue); }

function playerIdentity(p){
  const name=text(p?.name ?? p?.playerName ?? p?.fullName ?? p?.player?.name);
  const team=text(p?.team?.name ?? p?.teamName ?? p?.clubName ?? p?.club ?? p?.team ?? p?.player?.team?.name);
  const id=text(p?.id ?? p?.playerId ?? p?.player?.id);
  return {name,team,id,key:id ? `id:${id}` : `${norm(name)}|${norm(team)}`};
}

export function extractFeatures(player, context={}){
  const points=pickPoints(player);
  const minutes=num(player?.minutes) ?? 0;
  const starts=num(player?.starts) ?? 0;
  const appearances=num(player?.appearances ?? player?.apps ?? player?.matches) ?? 0;
  const media=num(player?.media ?? player?.average ?? player?.rating);
  const price=pickPrice(player), value=pickValue(player);
  const status=text(player?.availability ?? player?.status ?? player?.healthStatus);
  const rotation=num(player?.rotationRisk), injury=num(player?.injuryRisk);
  const performance=feature(Math.min(1,points/25)*0.55 + Math.min(1,minutes/900)*0.25 + Math.min(1,starts/10)*0.12 + Math.min(1,appearances/15)*0.08);
  const observedAvailability=feature((Math.min(1,minutes/900)*0.55)+(Math.min(1,starts/10)*0.35)+(Math.min(1,appearances/15)*0.10),0.55);
  const unavailable=/(inj|lesi|duda|doubt|suspend|sanc|baja|out)/i.test(status);
  const availability=unavailable ? Math.min(observedAvailability,0.18) : observedAvailability;
  const teamFixture=context.fixture?.context;
  const homeAway=context.fixture?.homeAway;
  const baseContext=teamFixture==null ? 0.5 : clamp(Number(teamFixture)/100);
  const homeBoost=homeAway==='home'?0.04:homeAway==='away'?-0.02:0;
  const contextFeature=clamp(baseContext+homeBoost);
  const marketMargin=price>0 && value>0 ? (value-price)/value : null;
  const trend=num(player?.trend3d ?? player?.change3d ?? player?.trend7d ?? player?.change7d);
  const market=marketMargin==null ? feature(0.5 + clamp((trend ?? 0)/25,-0.5,0.5)*0.35) : feature(0.5+clamp(marketMargin,-0.5,0.5));
  const risk=feature(1 - ((rotation==null?0:rotation<=1?rotation:rotation/100)*0.65 + (injury==null?0:injury<=1?injury:injury/100)*0.35));
  return {performance,availability,context:contextFeature,market,risk,media,points,minutes,starts,appearances,price,value,weeklyPoints:pickWeeklyPoints(player),position:position(player?.position ?? player?.positionName ?? player?.role),unavailable};
}

function normalizeWeights(weights){
  const safe={...DEFAULT_WEIGHTS};
  for(const k of Object.keys(safe)) if(num(weights?.[k])!=null) safe[k]=Math.max(0.01,Number(weights[k]));
  const total=Object.values(safe).reduce((a,b)=>a+b,0);
  return Object.fromEntries(Object.entries(safe).map(([k,v])=>[k,v/total]));
}

function freshState(){
  return {
    schema:1,
    version:BRAIN_VERSION,
    createdAt:nowIso(),
    updatedAt:null,
    observations:0,
    labeledSamples:0,
    accuratePredictions:0,
    totalAbsoluteError:0,
    meanAbsoluteError:null,
    weights:{...DEFAULT_WEIGHTS},
    bias:0.15,
    positionBias:{POR:0,DEF:0,MED:0,DEL:0,UNK:0},
    sourceReliability:{official:1,auxiliary:0.75},
    pending:{},
    recentErrors:[],
    recentUpdates:[],
    drift:{score:0,status:'stable'},
    lastObservationAt:null,
    lastLearningAt:null
  };
}

export class BrainV27{
  constructor(options={}){
    this.dir=ensureDir(path.resolve(options.dir || process.env.BRAIN_STATE_DIR || './.brain-data'));
    this.stateFile=path.join(this.dir,'model-v27.json');
    this.eventFile=path.join(this.dir,'learning-v27.jsonl');
    this.state=safeLoad(this.stateFile,freshState());
    this.state.weights=normalizeWeights(this.state.weights);
    if(!this.state.version) this.state.version=BRAIN_VERSION;
    if(!this.state.positionBias) this.state.positionBias={POR:0,DEF:0,MED:0,DEL:0,UNK:0};
    if(!this.state.pending) this.state.pending={};
    if(this.state.accuratePredictions==null) this.state.accuratePredictions=0;
    if(this.state.totalAbsoluteError==null) this.state.totalAbsoluteError=0;
    if(this.state.meanAbsoluteError==null && this.state.labeledSamples>0) this.state.meanAbsoluteError=this.state.totalAbsoluteError/this.state.labeledSamples;
    this.learningRate=clamp(Number(options.learningRate ?? process.env.BRAIN_LEARNING_RATE ?? 0.035),0.001,0.2);
  }

  save(){ this.state.updatedAt=nowIso(); atomicWrite(this.stateFile,JSON.stringify(this.state,null,2)); }
  log(event){ fs.appendFileSync(this.eventFile,`${JSON.stringify({at:nowIso(),...event})}\n`,'utf8'); }

  predict(player,context={}){
    const f=extractFeatures(player,context);
    const base=f.performance*this.state.weights.performance + f.availability*this.state.weights.availability + f.context*this.state.weights.context + f.market*this.state.weights.market + f.risk*this.state.weights.risk;
    const pb=this.state.positionBias[f.position] ?? 0;
    const score=clamp(base + this.state.bias + pb);
    const expectedPoints=Math.max(0,Math.round((score*20 + (f.media ?? 0)*0.7)*10)/10);
    const confidence=Math.round(clamp(0.35 + this.state.labeledSamples/2000*0.45 + (f.weeklyPoints!=null?0.10:0) + (this.state.drift.status==='stable'?0.10:0),0,1)*100);
    return {score,expectedPoints,confidence,features:f,weights:{...this.state.weights},modelVersion:BRAIN_VERSION};
  }

  learn(sample){
    const expected=Number(sample.expected);
    const actual=Number(sample.actual);
    if(!Number.isFinite(expected)||!Number.isFinite(actual)) return {learned:false,reason:'invalid-label'};
    const error=actual-expected;
    const normalizedError=Math.max(-1,Math.min(1,error/20));
    const rate=this.learningRate;
    const f=sample.features || {};
    const map=['performance','availability','context','market','risk'];
    const before={...this.state.weights};
    for(const key of map){
      const gradient=(Number(f[key])||0)*normalizedError;
      this.state.weights[key]=Math.max(0.01,this.state.weights[key]+rate*gradient);
    }
    this.state.weights=normalizeWeights(this.state.weights);
    this.state.bias=clamp(this.state.bias + rate*normalizedError*0.45,-0.35,0.35);
    const pos=POSITIONS.includes(sample.position)?sample.position:'UNK';
    this.state.positionBias[pos]=clamp((this.state.positionBias[pos]||0)+rate*normalizedError*0.25,-0.20,0.20);
    this.state.labeledSamples+=1;
    this.state.totalAbsoluteError+=Math.abs(error);
    this.state.meanAbsoluteError=this.state.totalAbsoluteError/this.state.labeledSamples;
    if(Math.abs(error)<=3) this.state.accuratePredictions+=1;
    const ratio=Math.min(1,Math.abs(error)/20);
    this.state.drift.score=clamp(this.state.drift.score*0.94+ratio*0.06);
    this.state.drift.status=this.state.drift.score>0.28?'high':this.state.drift.score>0.14?'watch':'stable';
    this.state.recentErrors.push({at:nowIso(),error:Math.round(error*100)/100,expected,actual});
    this.state.recentErrors=this.state.recentErrors.slice(-250);
    this.state.recentUpdates.push({at:nowIso(),position:pos,error:Math.round(error*100)/100,before,after:{...this.state.weights}});
    this.state.recentUpdates=this.state.recentUpdates.slice(-100);
    this.state.lastLearningAt=nowIso();
    this.log({type:'learn',position:pos,error,weights:this.state.weights});
    this.save();
    return {learned:true,error,weights:this.state.weights};
  }

  observePlayers(players,context={}){
    const list=Array.isArray(players)?players:[];
    let learned=0, pending=0, observed=0;
    for(const raw of list){
      const id=playerIdentity(raw);
      if(!id.name) continue;
      observed+=1;
      const prediction=this.predict(raw,context);
      const week=text(context.week ?? context.matchday ?? 'unknown');
      const key=crypto.createHash('sha1').update(`${id.key}|${week}`).digest('hex');
      if(prediction.features.weeklyPoints!=null){
        const prior=this.state.pending[key];
        const expected=prior?.expected ?? prediction.expectedPoints;
        const result=this.learn({expected,actual:prediction.features.weeklyPoints,features:prior?.features ?? prediction.features,position:prediction.features.position});
        if(result.learned) learned+=1;
        delete this.state.pending[key];
      }else if(!this.state.pending[key]){
        this.state.pending[key]={createdAt:nowIso(),player:id,week,expected:prediction.expectedPoints,features:prediction.features};
        pending+=1;
      }
      this.state.observations+=1;
    }
    this.state.lastObservationAt=nowIso();
    this.save();
    return {observed,learned,pending,modelVersion:BRAIN_VERSION};
  }

  ingestDashboard(dashboard,meta={}){
    const team=dashboard?.team?.data ?? dashboard?.team ?? {};
    const players=Array.isArray(team?.players)?team.players:Array.isArray(team?.squad)?team.squad:Array.isArray(team?.roster)?team.roster:[];
    const market=Array.isArray(dashboard?.market)?dashboard.market:Array.isArray(dashboard?.market?.data)?dashboard.market.data:[];
    const week=dashboard?.week?.weekNumber ?? dashboard?.week?.number ?? dashboard?.week?.matchday ?? dashboard?.week?.currentWeek ?? meta.week;
    const result=this.observePlayers(players,{week,source:'official'});
    this.log({type:'ingest-dashboard',players:players.length,market:market.length,week,source:'official',result});
    return {players:players.length,market:market.length,week,...result};
  }

  ingestAuxiliary(payload={}){
    const count=Array.isArray(payload.players)?payload.players.length:0;
    const injuries=Array.isArray(payload.injuries)?payload.injuries.length:0;
    const standings=Array.isArray(payload.standings)?payload.standings.length:0;
    if(count||injuries||standings){
      this.state.sourceReliability.auxiliary=clamp(this.state.sourceReliability.auxiliary*0.98+0.02,0.1,0.95);
      this.log({type:'ingest-auxiliary',players:count,injuries,standings});
      this.save();
    }
    return {players:count,injuries,standings};
  }

  status(){
    return {
      version:BRAIN_VERSION,
      observations:this.state.observations,
      labeledSamples:this.state.labeledSamples,
      meanAbsoluteError:this.state.meanAbsoluteError==null?null:Math.round(this.state.meanAbsoluteError*100)/100,
      accuracy:this.state.labeledSamples?Math.round(this.state.accuratePredictions/this.state.labeledSamples*100):null,
      weights:this.state.weights,
      positionBias:this.state.positionBias,
      confidence:this.predict({name:'__system__'}).confidence,
      drift:this.state.drift,
      pendingSamples:Object.keys(this.state.pending).length,
      lastObservationAt:this.state.lastObservationAt,
      lastLearningAt:this.state.lastLearningAt,
      persistencePath:this.dir,
      sourcePolicy:'LALIGA oficial para calendario + fuentes auxiliares solo como señales de entrenamiento'
    };
  }
}

export const createBrain = options => new BrainV27(options);
