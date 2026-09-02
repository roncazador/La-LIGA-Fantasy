import { fetchFutbolFantasyData } from './futbolfantasy-data-v30.mjs';

export const FUTBOLFANTASY_BRAIN_ADAPTER_VERSION='1.0.0';
const safe=(v)=>Number.isFinite(Number(v))?Number(v):null;
const arr=(v)=>Array.isArray(v)?v:[];

export function normalizeContrastForBrain(data={}){
  const players=arr(data.players).map(p=>({
    id:p.id??p.playerId??'',name:String(p.name??p.playerName??p.fullName??''),team:String(p.team?.name??p.teamName??p.clubName??p.team??''),
    position:p.position??p.positionName??p.role,points:safe(p.points??p.fantasyPoints??p.totalPoints),weeklyPoints:safe(p.weeklyPoints??p.weekPoints??p.pointsThisWeek??p.matchPoints),
    minutes:safe(p.minutes),starts:safe(p.starts),appearances:safe(p.appearances??p.matches),media:safe(p.media??p.average??p.rating),price:safe(p.price??p.marketPrice),value:safe(p.value??p.marketValue),
    availability:p.availability??p.status??p.healthStatus,injuryRisk:safe(p.injuryRisk),rotationRisk:safe(p.rotationRisk),trend3d:safe(p.trend3d??p.change3d),trend7d:safe(p.trend7d??p.change7d)
  })).filter(p=>p.name);
  return {schema:'laliga-futbolfantasy-brain/v1',source:'futbolfantasy-public-contrast',readOnly:true,players,injuries:arr(data.injuries),stats:arr(data.stats),points:arr(data.points),matches:arr(data.matches),checkedAt:data.checkedAt||new Date().toISOString()};
}

export async function fetchContrastForBrain(config={}){
  const data=await fetchFutbolFantasyData(config);
  return normalizeContrastForBrain(data);
}
