import crypto from 'node:crypto';

export const CALENDAR_VERSION='2.9.0';
const CACHE_TTL=5*60*1000;
const STALE_TTL=6*60*60*1000;
const TIMEOUT=10000;
const cache=new Map();
const breakers=new Map();

const text=x=>String(x??'').trim();
const arr=x=>Array.isArray(x)?x:[];
const clean=x=>text(x).replace(/\s+/g,' ').slice(0,180);
const norm=x=>clean(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function validDate(x){const d=new Date(x);return Number.isFinite(d.getTime())&&d.getUTCFullYear()>=2024&&d.getUTCFullYear()<=2032;}
function key(x){return `${new Date(x.utcDate).toISOString().slice(0,16)}|${norm(x.home)}|${norm(x.away)}`;}
function normalizeMatch(m,source){
  const home=clean(m?.home??m?.homeTeam?.name??m?.localTeam?.name??m?.home_team?.name);
  const away=clean(m?.away??m?.awayTeam?.name??m?.visitorTeam?.name??m?.away_team?.name);
  const date=m?.utcDate??m?.date??m?.startDate??m?.starting_at??m?.datetime;
  if(!home||!away||!validDate(date))return null;
  return {id:clean(m?.id??m?.fixtureId??`${home}-${away}-${date}`),utcDate:new Date(date).toISOString(),home,away,status:clean(m?.status?.short??m?.status??m?.state?.short_name??'PRÓXIMO'),matchday:Number.isFinite(Number(m?.matchday))?Number(m.matchday):null,homeScore:Number.isFinite(Number(m?.homeScore??m?.goals?.home))?Number(m?.homeScore??m?.goals?.home):null,awayScore:Number.isFinite(Number(m?.awayScore??m?.goals?.away))?Number(m?.awayScore??m?.goals?.away):null,source};
}
function collectJson(value,out=[]){
  if(value==null)return out;
  if(Array.isArray(value)){for(const v of value)collectJson(v,out);return out;}
  if(typeof value==='object'){
    if((value.home||value.homeTeam||value.localTeam)&&(value.away||value.awayTeam||value.visitorTeam)&&(value.utcDate||value.date||value.startDate||value.starting_at))out.push(value);
    for(const v of Object.values(value))if(typeof v==='object')collectJson(v,out);
  }
  return out;
}
function parseFutbolFantasyHtml(html){
  const raw=String(html||'');const found=[];
  const scripts=[...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
  for(const s of scripts){
    const trimmed=s.trim();
    if(!trimmed)continue;
    try{collectJson(JSON.parse(trimmed),found)}catch{}
    for(const marker of ['__NEXT_DATA__','__INITIAL_STATE__','__PRELOADED_STATE__']){
      const i=trimmed.indexOf(marker);if(i<0)continue;
      const start=trimmed.indexOf('{',i);if(start<0)continue;
      try{collectJson(JSON.parse(trimmed.slice(start)),found)}catch{}
    }
  }
  const dateRx=/(20\d{2}-\d{2}-\d{2}(?:T[^\"'<> ]*)?)/g;
  const textOnly=raw.replace(/<[^>]+>/g,' ');
  const dateMatches=[...textOnly.matchAll(dateRx)].map(m=>m[1]);
  for(const date of dateMatches){
    const idx=textOnly.indexOf(date);const chunk=textOnly.slice(Math.max(0,idx-180),idx+260);
    const teams=[...chunk.matchAll(/([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.'-]{2,}(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ.'-]{2,}){0,3})/g)].map(x=>clean(x[1])).filter(x=>x.length<70);
    if(teams.length>=2)found.push({home:teams[0],away:teams[1],date});
  }
  const matches=[];const seen=new Set();for(const m of found){const f=normalizeMatch(m,'futbolfantasy.com');if(!f)continue;const k=key(f);if(seen.has(k))continue;seen.add(k);matches.push(f)}return matches;
}
function breakerOpen(host){const b=breakers.get(host);return b&&b.openUntil>Date.now();}
function failure(host){const b=breakers.get(host)||{fails:0,openUntil:0};b.fails+=1;if(b.fails>=3)b.openUntil=Date.now()+5*60*1000;breakers.set(host,b);}
function success(host){breakers.set(host,{fails:0,openUntil:0});}
export async function fetchFutbolFantasy(config){
  const url=text(config.futbolFantasyUrl||'https://www.futbolfantasy.com');
  const host=new URL(url).host;
  const cached=cache.get(url);if(cached&&Date.now()-cached.at<CACHE_TTL)return {...cached.value,cache:'fresh'};
  if(breakerOpen(host)&&cached&&Date.now()-cached.at<STALE_TTL)return {...cached.value,cache:'stale-breaker'};
  try{
    const r=await fetch(url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'LALIGA-Fantasy-Manager/2.9.0 (read-only; source attribution)'},cache:'no-store',signal:AbortSignal.timeout(TIMEOUT)});
    if(!r.ok)throw new Error(`FUTBOLFANTASY_HTTP_${r.status}`);
    const html=await r.text();if(html.length>5_000_000)throw new Error('FUTBOLFANTASY_RESPONSE_TOO_LARGE');
    const matches=parseFutbolFantasyHtml(html);if(!matches.length)throw new Error('FUTBOLFANTASY_NO_VALID_FIXTURES');
    const value={source:'futbolfantasy.com',url,count:matches.length,matches,checkedAt:new Date().toISOString(),integrity:crypto.createHash('sha256').update(JSON.stringify(matches)).digest('hex')};
    cache.set(url,{at:Date.now(),value});success(host);return {...value,cache:'fresh'};
  }catch(error){failure(host);if(cached&&Date.now()-cached.at<STALE_TTL)return {...cached.value,cache:'stale-error',warning:error.message};throw error;}
}
export function mergeCalendarSources(sources=[]){
  const map=new Map();for(const source of sources){for(const m of arr(source?.matches)){const k=key(m);const old=map.get(k);if(!old)map.set(k,{...m,sources:[source.source]});else if(!old.sources.includes(source.source))old.sources.push(source.source)}}
  return [...map.values()].sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
}
