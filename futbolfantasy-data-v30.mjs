import { fetchFutbolFantasy } from './calendar-service-v29.mjs';
import { fetchPublicSources, FUTBOLFANTASY_PUBLIC_SOURCES } from './futbolfantasy-normalizer-v33.mjs';

let cache=null;
let lastGood=null;

function text(x){return String(x??'');}
function ageMs(value){return Date.now()-Number(value||0);}
function hasRows(value){return Array.isArray(value)&&value.length>0;}

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

  const previous=lastGood?.base===base?lastGood.data:null;
  const sections={
    calendar:hasRows(calendar)?calendar:(hasRows(previous?.calendar)?previous.calendar:[]),
    matches:hasRows(normalized?.matches)?normalized.matches:(hasRows(previous?.matches)?previous.matches:[]),
    players:hasRows(normalized?.players)?normalized.players:(hasRows(previous?.players)?previous.players:[]),
    injuries:hasRows(normalized?.injuries)?normalized.injuries:(hasRows(previous?.injuries)?previous.injuries:[]),
    stats:hasRows(normalized?.stats)?normalized.stats:(hasRows(previous?.stats)?previous.stats:[]),
    points:hasRows(normalized?.points)?normalized.points:(hasRows(previous?.points)?previous.points:[]),
    pages:hasRows(normalized?.pages)?normalized.pages:(hasRows(previous?.pages)?previous.pages:[]),
    references:hasRows(normalized?.references)?normalized.references:(hasRows(previous?.references)?previous.references:[])
  };

  const usedStale={
    calendar:!hasRows(calendar)&&hasRows(previous?.calendar),
    matches:!hasRows(normalized?.matches)&&hasRows(previous?.matches),
    players:!hasRows(normalized?.players)&&hasRows(previous?.players),
    injuries:!hasRows(normalized?.injuries)&&hasRows(previous?.injuries),
    stats:!hasRows(normalized?.stats)&&hasRows(previous?.stats),
    points:!hasRows(normalized?.points)&&hasRows(previous?.points),
    pages:!hasRows(normalized?.pages)&&hasRows(previous?.pages),
    references:!hasRows(normalized?.references)&&hasRows(previous?.references)
  };

  const data={
    version:'3.3.1',
    source:'public-fantasy-contrast',
    readOnly:true,
    sourcePolicy:'public-contrast-only',
    degraded:Boolean(normalizedError||calendarError||Object.values(usedStale).some(Boolean)),
    stale:Object.values(usedStale).some(Boolean),
    calendar:sections.calendar,
    matches:sections.matches,
    players:sections.players,
    injuries:sections.injuries,
    stats:sections.stats,
    points:sections.points,
    pages:sections.pages,
    references:sections.references,
    availableSources:FUTBOLFANTASY_PUBLIC_SOURCES.map(({key,path})=>({key,path})),
    counts:Object.fromEntries(Object.entries(sections).filter(([key])=>key!=='references').map(([key,value])=>[key,value.length])),
    errors:{
      normalized:normalizedError?.message||null,
      calendar:calendarError?.message||null
    },
    staleSections:Object.entries(usedStale).filter(([,value])=>value).map(([key])=>key),
    checkedAt:normalized?.retrievedAt||new Date().toISOString()
  };
  cache={at:Date.now(),base,data};
  if (hasRows(calendar)||normalized) lastGood={at:Date.now(),base,data};
  return data;
}
