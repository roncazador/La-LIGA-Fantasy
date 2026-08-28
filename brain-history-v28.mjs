import fs from 'node:fs';
import path from 'node:path';

export const HISTORY_VERSION = '1.0.0';
const clamp=(x,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(Number(x))?Number(x):min));
const num=x=>Number.isFinite(Number(x))?Number(x):null;
const text=x=>String(x??'').trim();
const norm=x=>text(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

function identity(p){
  const name=text(p?.name??p?.playerName??p?.fullName??p?.player?.name);
  const team=text(p?.team?.name??p?.teamName??p?.clubName??p?.club??p?.team??p?.player?.team?.name);
  const id=text(p?.id??p?.playerId??p?.player?.id);
  return {id,name,team,key:id?`id:${id}`:`${norm(name)}|${norm(team)}`};
}
function points(p){
  for(const k of ['weekPoints','weeklyPoints','pointsThisWeek','currentWeekPoints','pfsYWeek','pfsyWeek','pointsWeek','matchPoints','roundPoints','jornadaPoints']){
    const v=num(p?.[k]); if(v!=null)return v;
  }
  return null;
}

export class PlayerHistoryV28{
  constructor(options={}){
    this.dir=path.resolve(options.dir||process.env.BRAIN_STATE_DIR||'./.brain-data');
    fs.mkdirSync(this.dir,{recursive:true});
    this.file=path.join(this.dir,'player-history-v28.json');
    this.maxPerPlayer=Number(options.maxPerPlayer||24);
    this.state=this.load();
  }
  load(){
    try{const s=JSON.parse(fs.readFileSync(this.file,'utf8'));if(s&&s.version===HISTORY_VERSION&&s.players)return s;}catch{}
    return {version:HISTORY_VERSION,createdAt:new Date().toISOString(),updatedAt:null,players:{},observations:0};
  }
  save(){this.state.updatedAt=new Date().toISOString();const tmp=`${this.file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(this.state,null,2));fs.renameSync(tmp,this.file);}
  observe(players,context={}){
    let added=0,updated=0;
    const week=text(context.week??context.matchday??'unknown');
    for(const p of Array.isArray(players)?players:[]){
      const id=identity(p); if(!id.name)continue;
      const key=id.key;
      let record=this.state.players[key];
      if(!record){record={id:id.id,name:id.name,team:id.team,samples:[]};this.state.players[key]=record;added++;}
      record.name=id.name;record.team=id.team||record.team;
      const sample={week,at:new Date().toISOString(),points:points(p),minutes:num(p?.minutes),starts:num(p?.starts),availability:text(p?.availability??p?.status??'')||null,fixture:context.fixture??null};
      const same=record.samples.findIndex(s=>s.week===week);
      if(same>=0)record.samples[same]=sample;else record.samples.push(sample);
      record.samples=record.samples.slice(-this.maxPerPlayer);updated++;
    }
    this.state.observations+=updated;this.save();return {players:updated,newPlayers:added};
  }
  profile(playerOrId){
    const id=identity(typeof playerOrId==='object'?playerOrId:{id:String(playerOrId)});
    const r=this.state.players[id.key];
    if(!r)return {found:false,key:id.key,samples:0};
    const samples=r.samples.filter(s=>s.points!=null);
    const recent=samples.slice(-5);
    const avg=samples.length?samples.reduce((a,s)=>a+s.points,0)/samples.length:null;
    const recentAvg=recent.length?recent.reduce((a,s)=>a+s.points,0)/recent.length:null;
    const trend=avg!=null&&recentAvg!=null?Math.round((recentAvg-avg)*100)/100:null;
    return {found:true,id:r.id,name:r.name,team:r.team,samples:r.samples.length,labeledSamples:samples.length,averagePoints:avg==null?null:Math.round(avg*100)/100,recentAveragePoints:recentAvg==null?null:Math.round(recentAvg*100)/100,formTrend:trend,recent:r.samples.slice(-8)};
  }
  summary(){
    const records=Object.values(this.state.players);let labeled=0;
    for(const r of records)labeled+=r.samples.filter(s=>s.points!=null).length;
    return {version:HISTORY_VERSION,players:records.length,observations:this.state.observations,labeledSamples:labeled,persistencePath:this.file,retentionPerPlayer:this.maxPerPlayer};
  }
}

export const createPlayerHistory=options=>new PlayerHistoryV28(options);
