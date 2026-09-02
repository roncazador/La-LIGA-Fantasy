import { syncFutbolFantasyToBrain } from './brain-futbolfantasy-sync-v1.mjs';

export const AUTOSYNC_VERSION='1.0.0';
const enabled=process.env.FUTBOLFANTASY_BRAIN_AUTOSYNC!=='false';
const intervalMs=Math.max(10*60*1000,Number(process.env.FUTBOLFANTASY_BRAIN_SYNC_INTERVAL_MS)||20*60*1000);
let running=false;
export async function runFutbolFantasyBrainSync(){if(running)return{skipped:true,reason:'already-running'};running=true;try{return await syncFutbolFantasyToBrain()}finally{running=false}}
if(enabled&&process.env.NODE_ENV!=='test'){setTimeout(()=>void runFutbolFantasyBrainSync().catch(e=>console.error('[ff-brain-autosync]',e.message)),12000);setInterval(()=>void runFutbolFantasyBrainSync().catch(e=>console.error('[ff-brain-autosync]',e.message)),intervalMs).unref()}
