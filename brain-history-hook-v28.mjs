import { createPlayerHistory, HISTORY_VERSION } from './brain-history-v28.mjs';
import { BrainV27 } from './brain-core-v27.mjs';

const dir=process.env.BRAIN_STATE_DIR||'./.brain-data';
const history=createPlayerHistory({dir});
const originalIngest=BrainV27.prototype.ingestDashboard;
const originalStatus=BrainV27.prototype.status;

BrainV27.prototype.ingestDashboard=function(dashboard,meta={}){
  const result=originalIngest.call(this,dashboard,meta);
  try{
    const team=dashboard?.team?.data??dashboard?.team??{};
    const players=Array.isArray(team?.players)?team.players:Array.isArray(team?.squad)?team.squad:Array.isArray(team?.roster)?team.roster:[];
    const week=dashboard?.week?.weekNumber??dashboard?.week?.number??dashboard?.week?.matchday??dashboard?.week?.currentWeek??meta.week;
    history.observe(players,{week,source:'official'});
  }catch(error){console.error(`[brain-history] dashboard history skipped: ${error.message}`)}
  return result;
};

BrainV27.prototype.status=function(){
  return {...originalStatus.call(this),history:history.summary(),historyVersion:HISTORY_VERSION};
};

export { history, HISTORY_VERSION };
