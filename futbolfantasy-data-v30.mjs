import { fetchFutbolFantasy } from './calendar-service-v29.mjs';
import { fetchPublicSources, FUTBOLFANTASY_PUBLIC_SOURCES } from './futbolfantasy-normalizer-v33.mjs';

let cache=null;

function text(x){return String(x??'');}

export async function fetchFutbolFantasyData(config={}){
  if(cache&&Date.now()-cache.at<5*60*1000)return cache.data;

  const base=text(config.futbolFantasyUrl||'https://www.futbolfantasy.com').replace(/\/$/,'');
  let normalized=null;
  try { normalized=await fetchPublicSources({baseUrl:base}); }
  catch { normalized=null; }

  let calendar=[];
  try {
    const ff=await fetchFutbolFantasy({futbolFantasyUrl:base});
    calendar=Array.isArray(ff.matches)?ff.matches:[];
  } catch {}

  const data={
    version:'3.3.1',
    source:'public-fantasy-contrast',
    readOnly:true,
    sourcePolicy:'public-contrast-only',
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
    checkedAt:normalized?.retrievedAt||new Date().toISOString()
  };
  cache={at:Date.now(),data};
  return data;
}
