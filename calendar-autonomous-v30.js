(()=>{
'use strict';

const VERSION='3.1.0';
const API='/api/calendar/autonomous';
const SEED='/official-fixtures-seed-2026-27.json';
const LIVE=new Set(['1H','2H','HT','LIVE','IN_PLAY','PLAYING','EN DIRECTO','DESCANSO','PAUSED','HALFTIME']);
const FINAL=new Set(['FT','FINISHED','FINAL','ENDED','AET','PEN','COMPLETED']);
const REFRESH_MS=15000;
let renderToken=0;
let timer=null;
let observer=null;

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value);
const validDate=value=>{const d=date(value);return Number.isFinite(d.getTime())};
const status=value=>String(value?.short??value?.label??value??'PRÓXIMO').trim().toUpperCase();
const isLive=value=>LIVE.has(status(value));
const isFinal=value=>FINAL.has(status(value));
const score=value=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=99?Number(value):null;

function fmt(value){
  const d=date(value);
  if(!validDate(value)) return {day:'N/D',time:'N/D'};
  return {
    day:new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'2-digit',month:'long',timeZone:'Europe/Madrid'}).format(d),
    time:new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Madrid'}).format(d)
  };
}

function normalize(raw,source){
  if(!raw||typeof raw!=='object')return null;
  const home=String(raw.home??raw.homeTeam?.name??raw.localTeam?.name??raw.home_team?.name??'').trim();
  const away=String(raw.away??raw.awayTeam?.name??raw.visitorTeam?.name??raw.away_team?.name??'').trim();
  const utcDate=raw.utcDate??raw.date??raw.startDate??raw.starting_at??raw.datetime??raw.kickoff;
  if(!home||!away||!validDate(utcDate))return null;
  const sources=Array.isArray(raw.sources)&&raw.sources.length?raw.sources:[source||raw.source||'LALIGA oficial'];
  return {
    ...raw,
    id:String(raw.id??raw.fixtureId??raw.matchId??`${home}-${away}-${utcDate}`),
    utcDate:date(utcDate).toISOString(),
    home,
    away,
    status:status(raw.status),
    matchday:raw.matchday??raw.officialMatchday??raw.gameweek?.week??null,
    homeScore:score(raw.homeScore??raw.home_score??raw.goals?.home??raw.homeTeam?.score??raw.home_team?.score),
    awayScore:score(raw.awayScore??raw.away_score??raw.goals?.away??raw.awayTeam?.score??raw.away_team?.score),
    source:source||raw.source||'LALIGA oficial',
    sources:[...new Set(sources.map(String))]
  };
}

function key(match){
  return `${match.utcDate.slice(0,16)}|${match.home.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}|${match.away.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}`;
}

function mergeMatches(input){
  const map=new Map();
  for(const raw of Array.isArray(input)?input:[]){
    const m=normalize(raw,raw?.source);
    if(!m)continue;
    const k=key(m),old=map.get(k);
    if(!old){map.set(k,m);continue;}
    const merged={...old};
    if(merged.homeScore==null&&m.homeScore!=null)merged.homeScore=m.homeScore;
    if(merged.awayScore==null&&m.awayScore!=null)merged.awayScore=m.awayScore;
    if(merged.matchday==null&&m.matchday!=null)merged.matchday=m.matchday;
    if(isLive(m.status)&&!isFinal(merged.status))merged.status=m.status;
    if(isFinal(m.status))merged.status=m.status;
    merged.sources=[...new Set([...(old.sources||[]),...(m.sources||[]),m.source])];
    map.set(k,merged);
  }
  return [...map.values()].sort((a,b)=>date(a.utcDate)-date(b.utcDate));
}

async function json(url){
  const response=await fetch(url,{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`HTTP_${response.status}`);
  return response.json();
}

async function loadData(){
  try{
    const data=await json(API);
    const matches=mergeMatches(data?.matches);
    if(matches.length||data?.fallback)return {version:VERSION,...data,matches,live:matches.filter(m=>isLive(m.status)).length};
    throw new Error('EMPTY_CALENDAR');
  }catch(error){
    try{
      const seed=await json(SEED);
      const matches=mergeMatches((seed?.fixtures||[]).map(m=>({...m,source:'LALIGA oficial · semilla protegida'})));
      return {version:VERSION,sourcePolicy:'LALIGA oficial · respaldo automático',officialAvailable:false,officialMode:'protected-seed',futbolFantasyAvailable:false,fallback:'protected-seed',matches,live:matches.filter(m=>isLive(m.status)).length,updatedAt:new Date().toISOString(),warning:error.message};
    }catch(seedError){
      return {version:VERSION,matches:[],live:0,fallback:'empty',updatedAt:new Date().toISOString(),warning:`${error.message}; ${seedError.message}`};
    }
  }
}

function ensureStyles(){
  if(document.getElementById('cal31style'))return;
  const style=document.createElement('style');
  style.id='cal31style';
  style.textContent=`#calendar30{background:linear-gradient(145deg,#111827,#0b1019);border:1px solid #303b50;border-radius:20px;padding:16px;margin:0 0 16px;box-shadow:0 14px 35px rgba(0,0,0,.24)}#calendar30 .c31head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}#calendar30 .c31title{font-size:22px;font-weight:950}#calendar30 .c31sub{font-size:10px;color:#9aa3b7;margin-top:4px}#calendar30 .c31badge{padding:8px 10px;border-radius:999px;background:#182334;border:1px solid #354158;font-size:9px;font-weight:950;white-space:nowrap}#calendar30 .live{color:#ff6b73}#calendar30 .ok{color:#2bd888}#calendar30 .muted{color:#9aa3b7}#calendar30 .c31hero{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}#calendar30 .c31pill{padding:10px 12px;border:1px solid #2b3548;border-radius:13px;background:#151d2a}#calendar30 .c31pill span{display:block;font-size:9px;color:#9aa3b7}#calendar30 .c31pill b{display:block;font-size:18px;margin-top:4px}#calendar30 .c31day{font-size:10px;color:#9aa3b7;text-transform:uppercase;font-weight:950;letter-spacing:.7px;margin:15px 0 7px}#calendar30 .c31match{display:grid;grid-template-columns:minmax(0,1fr) 88px minmax(0,1fr);gap:8px;align-items:center;padding:13px 0;border-bottom:1px solid #273246}#calendar30 .c31team{font-size:13px;font-weight:950}#calendar30 .c31away{text-align:right}#calendar30 .c31mid{text-align:center}#calendar30 .c31score{font-size:21px;font-weight:950}#calendar30 .c31status{font-size:8px;font-weight:950;margin-top:4px}#calendar30 .c31meta{font-size:8px;color:#78aaff;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#calendar30 .c31empty{text-align:center;padding:28px 12px;color:#9aa3b7}#calendar30 .c31foot{margin-top:12px;padding:10px;border-radius:11px;background:#0d141f;border:1px solid #263044;font-size:9px;color:#9aa3b7;line-height:1.5}@media(max-width:620px){#calendar30 .c31hero{grid-template-columns:repeat(2,1fr)}#calendar30 .c31title{font-size:19px}#calendar30 .c31match{grid-template-columns:minmax(0,1fr) 70px minmax(0,1fr)}#calendar30 .c31team{font-size:12px}}`;
  document.head.appendChild(style);
}

function removeLegacyControls(){
  document.getElementById('loadFixtures')?.remove();
  document.getElementById('loadSeed')?.remove();
  document.getElementById('fixturesStatus')?.remove();
  const legacy=document.getElementById('fixtures');
  if(legacy){legacy.innerHTML='';legacy.style.display='none';}
}

function host(){return document.getElementById('partidos');}

function ensureBox(){
  const section=host();
  if(!section)return null;
  removeLegacyControls();
  ensureStyles();
  let box=document.getElementById('calendar30');
  if(!box){
    box=document.createElement('div');
    box.id='calendar30';
    box.setAttribute('aria-live','polite');
    section.prepend(box);
  }
  return box;
}

function render(data){
  const box=ensureBox();
  if(!box)return false;
  const token=++renderToken;
  const matches=mergeMatches(data?.matches);
  const live=matches.filter(m=>isLive(m.status));
  const finished=matches.filter(m=>isFinal(m.status));
  const upcoming=matches.filter(m=>!isFinal(m.status)&&date(m.utcDate)>=new Date()).slice(0,3);
  const grouped=new Map();
  for(const match of matches){const f=fmt(match.utcDate);if(!grouped.has(f.day))grouped.set(f.day,[]);grouped.get(f.day).push(match)}
  if(token!==renderToken)return false;
  const warning=data?.warning?`<div class="c31foot">Sincronización: ${esc(data.warning)}. El calendario permanece visible con el último respaldo válido.</div>`:'';
  box.innerHTML=`<div class="c31head"><div><div class="c31title">📅 Partidos · LIVE</div><div class="c31sub">Carga automática · resultados y estados en directo cuando están disponibles · actualización cada 15 s</div></div><div class="c31badge ${live.length?'live':'ok'}">${live.length?`● ${live.length} EN DIRECTO`:'● ACTIVO'}</div></div><div class="c31hero"><div class="c31pill"><span>Partidos</span><b>${matches.length}</b></div><div class="c31pill"><span>En directo</span><b class="${live.length?'live':''}">${live.length}</b></div><div class="c31pill"><span>Finalizados</span><b>${finished.length}</b></div><div class="c31pill"><span>Siguientes</span><b>${upcoming.length}</b></div></div>${[...grouped.entries()].map(([day,items])=>`<div class="c31day">${esc(day)}</div>${items.map(m=>{const f=fmt(m.utcDate),st=status(m.status),hasScore=m.homeScore!=null||m.awayScore!=null;const scoreText=hasScore?`${m.homeScore??0} - ${m.awayScore??0}`:f.time;const source=(m.sources||[m.source||'LALIGA oficial']).join(' · ');return `<div class="c31match"><div class="c31team">${esc(m.home)}</div><div class="c31mid"><div class="c31score">${esc(scoreText)}</div><div class="c31status ${isLive(st)?'live':'muted'}">${isLive(st)?'● EN DIRECTO':isFinal(st)?'FINALIZADO':esc(st)}</div><div class="c31meta">${esc(source)}</div></div><div class="c31team c31away">${esc(m.away)}</div></div>`}).join('')}`).join('')||'<div class="c31empty">Sin partidos disponibles en este momento. Se seguirá intentando automáticamente.</div>'}${warning||`<div class="c31foot"><b>Datos:</b> identidad oficial LALIGA cuando está disponible; contraste público y respaldo automático sin controles manuales.</div>`}`;
  return true;
}

async function refresh(){
  const box=ensureBox();
  if(!box)return false;
  if(!box.dataset.initialized)box.innerHTML='<div class="c31empty">⏳ Cargando calendario automáticamente…</div>';
  try{return render(await loadData())}catch{return render({matches:[],warning:'No se pudo consultar el calendario'})}
}

function boot(){
  ensureStyles();
  ensureBox();
  void refresh();
  if(timer)clearInterval(timer);
  timer=setInterval(()=>void refresh(),REFRESH_MS);
  if(observer)observer.disconnect();
  if(document.body){
    observer=new MutationObserver(()=>{if(host()&&!document.getElementById('calendar30'))void refresh()});
    observer.observe(document.body,{childList:true,subtree:true});
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
