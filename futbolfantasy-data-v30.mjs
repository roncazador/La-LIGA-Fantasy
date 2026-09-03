import { fetchFutbolFantasy } from './calendar-service-v29.mjs';
import { fetchPublicSources, FUTBOLFANTASY_PUBLIC_SOURCES } from './futbolfantasy-normalizer-v33.mjs';

let cache=null;
let lastGood=null;

function text(x){return String(x??'');}
function ageMs(value){return Date.now()-Number(value||0);}

export async function fetchFutbolFantasyData(config={}){
  const base=text(config.futbolFantasyUrl||'https://www.futbolfantasy.com').replace(/\/$/,'');
  if(cache&&cache.base===base&&ageMs(cache.at)<5*60*1000)return cache.data;

  let normalized=null;
  let normalizedError=null;
  try { normalized=await fetchPublicSources({baseUrl:base}); }
  catch (error) { normalizedError=error; }

  let calendar=[];
  let calendarError=null;
  try {
    const ff=await fetchFutbolFantasy({futbolFantasyUrl:base});
    calendar=Array.isArray(ff.matches)?ff.matches:[];
  } catch (error) { calendarError=error; }

  if (!normalized && !calendar.length && lastGood?.base===base) {
    const degraded={
      ...lastGood.data,
      degraded:true,
      stale:true,
      staleAgeMs:ageMs(lastGood.at),
      errors:{
        normalized:normalizedError?.message||'FUTBOLFANTASY_NORMALIZER_UNAVAILABLE',
        calendar:calendarError?.message||'FUTBOLFANTASY_CALENDAR_UNAVAILABLE'
      },
      checkedAt:new Date().toISOString()
    };
    cache={at:Date.now(),base,data:degraded};
    return degraded;
  }

  const data={
    version:'3.3.1',
    source:'public-fantasy-contrast',
    readOnly:true,
    sourcePolicy:'public-contrast-only',
    degraded:Boolean(normalizedError||calendarError),
    calendar,
    matches:normalized?.matches||[],
    players:normalized?.players||[],
    injuries:normalized?.injuries||[],
    stats:normalized?.stats||[],
    points:normalized?.points||[],
    pages:normalized?.pages||[],
    references:normalized?.references||[],
    availableSources:FUTBOLFANTASY_PUBLIC_SOURCES.map(({key,path})=>({key,path})),
    counts:{
      calendar:calendar.length,
      matches:normalized?.matches?.length||0,
      players:normalized?.players?.length||0,
      injuries:normalized?.injuries?.length||0,
      stats:normalized?.stats?.length||0,
      points:normalized?.points?.length||0,
      pages:normalized?.pages?.length||0
    },
    errors:{
      normalized:normalizedError?.message||null,
      calendar:calendarError?.message||null
    },
    checkedAt:normalized?.retrievedAt||new Date().toISOString()
  };
  cache={at:Date.now(),base,data};
  if (normalized || calendar.length) lastGood={at:Date.now(),base,data};
  return data;
}
