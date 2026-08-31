import { fetchFutbolFantasy } from './calendar-service-v29.mjs';
import { fetchPublicSources, FUTBOLFANTASY_PUBLIC_SOURCES } from './futbolfantasy-normalizer-v33.mjs';

let cache=null;

function text(x){return String(x??'');}

export async function fetchFutbolFantasyData(config={}){
  if(cache&&Date.now()-cache.at<5*60*1000)return cache.data;

  const base=text(config.futbolFantasyUrl||'https://www.futbolfantasy.com').replace(/\/$/,'');
  let normalized=null;
  try {
    if(base==='https://www.futbolfantasy.com') normalized=await fetchPublicSources();
    else normalized=await fetchPublicSources();
  } catch {
    normalized=null;
  }

  let calendar=[];
  try {
    const ff=await fetchFutbolFantasy({futbolFantasyUrl:base});
    calendar=Array.isArray(ff.matches)?ff.matches:[];
  } catch {}

  const data={
    version:'3.3.0',
    source:'public-fantasy-contrast',
    readOnly:true,
    sourcePolicy:'public-contrast-only',
    calendar,
    matches:normalized?.matches||[],
    players:normalized?.players||[],
    injuries:normalized?.injuries||[],
    stats:normalized?.stats||[],
    pages:normalized?.pages||[],
    references:(normalized?.matches||[]).map(match=>({
      home:match.home,
      away:match.away,
      evidence:match.evidence||[],
      playerCount:Array.isArray(match.players)?match.players.length:0
    })),
    availableSources:FUTBOLFANTASY_PUBLIC_SOURCES.map(({key,url})=>({key,url})),
    counts:{
      calendar:calendar.length,
      matches:normalized?.matches?.length||0,
      players:normalized?.players?.length||0,
      injuries:normalized?.injuries?.length||0,
      stats:normalized?.stats?.length||0,
      pages:normalized?.pages?.length||0
    },
    checkedAt:normalized?.retrievedAt||new Date().toISOString()
  };
  cache={at:Date.now(),data};
  return data;
}
