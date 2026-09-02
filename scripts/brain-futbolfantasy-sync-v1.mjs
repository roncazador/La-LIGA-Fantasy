import fs from 'node:fs';
import path from 'node:path';
import { createBrain } from '../brain-core-v27.mjs';
import { fetchContrastForBrain } from '../futbolfantasy-brain-adapter-v1.mjs';
import { createCultivos } from '../cultivos-v1.mjs';

export const SYNC_VERSION='1.0.0';
const dir=process.env.BRAIN_STATE_DIR||'./.brain-data';

export async function syncFutbolFantasyToBrain({brainDir=dir, fetcher=fetchContrastForBrain}={}){
  const brain=createBrain({dir:brainDir});
  const cultivos=createCultivos({dir:brainDir});
  const data=await fetcher({futbolFantasyUrl:process.env.FUTBOLFANTASY_URL||'https://www.futbolfantasy.com'});
  const result=brain.observePlayers(data.players,{source:'futbolfantasy-public-contrast',week:data.week??data.matchday,weekComplete:false});
  brain.log({type:'futbolfantasy-contrast',schema:'laliga-futbolfantasy-brain/v1',checkedAt:data.checkedAt,players:data.players.length,injuries:data.injuries.length,stats:data.stats.length,points:data.points.length,learned:result.learned,pending:result.pending,policy:'observe-now; learn-only-final'});
  const cultivation=cultivos.observe({source:'futbolfantasy-sync',outcome:'success',dimensions:{data:data.players.length?1:-1,coverage:data.players.length?1:0,automation:1},detail:`players=${data.players.length}; injuries=${data.injuries.length}; stats=${data.stats.length}; points=${data.points.length}; learned=${result.learned}`});
  return {version:SYNC_VERSION,schema:'laliga-futbolfantasy-brain-sync/v1',source:data.source,observed:result.observed,learned:result.learned,pending:result.pending,counts:{players:data.players.length,injuries:data.injuries.length,stats:data.stats.length,points:data.points.length},cultivation};
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.url.replace('file://',''))){
  syncFutbolFantasyToBrain().then(r=>{fs.writeFileSync('futbolfantasy-brain-sync-report.json',JSON.stringify(r,null,2)+'\n');console.log(`FUTBOLFANTASY BRAIN SYNC v1: observed=${r.observed} learned=${r.learned} pending=${r.pending}`)}).catch(e=>{console.error(e.message);process.exitCode=1});
}
