import fs from 'node:fs';
import path from 'node:path';
import { fetchMultiProviderFixtures } from './providers.mjs';
import { readConfig } from './config.mjs';

const BASE_REFRESH_MS=15*1000;
const LIVE_REFRESH_MS=3*1000;
const CACHE_FILE='realtime-provider-cache-v1.json';
const LIVE=new Set(['LIVE','IN_PLAY','INPLAY','1H','2H','HT','ET','P','EN DIRECTO','PLAYING']);
let timer=null;
let running=false;
let lastError=null;
let state={status:'idle',updatedAt:null,refreshMs:BASE_REFRESH_MS,stale:false,data:null};

function cachePath(dir){return path.resolve(dir,CACHE_FILE)}
function liveFixtures(data){return (data?.merged||[]).filter(x=>LIVE.has(String(x?.status||'').trim().toUpperCase())).length}
function hydrate(dir){try{const saved=JSON.parse(fs.readFileSync(cachePath(dir),'utf8'));if(saved?.data?.merged?.length)state={...saved,status:'restored',stale:true};}catch{}}
function persist(dir){if(!state.data)return;try{fs.mkdirSync(dir,{recursive:true});const file=cachePath(dir),tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(state,null,2),'utf8');fs.renameSync(tmp,file);}catch(error){lastError=String(error?.message||error)}}
function schedule(dir,delay){if(timer)clearTimeout(timer);timer=setTimeout(()=>void cycle(dir,'timer'),delay)}
async function cycle(dir,reason){if(running)return;running=true;state={...state,status:'refreshing',reason};try{const data=await fetchMultiProviderFixtures(readConfig(process.env));const live=liveFixtures(data);state={status:'ready',updatedAt:new Date().toISOString(),refreshMs:live?LIVE_REFRESH_MS:BASE_REFRESH_MS,stale:false,data,error:null,reason};lastError=null;persist(dir);}catch(error){lastError=String(error?.message||error);state={...state,status:'degraded',stale:Boolean(state.data),error:lastError,reason};}finally{running=false;schedule(dir,state.refreshMs||BASE_REFRESH_MS)}}
export function startRealtimeProviderLoop({dir='./.brain-data',onUpdate}={}){const target=dir||'./.brain-data';if(timer)return;hydrate(target);void cycle(target,'boot').then(()=>{try{onUpdate?.(getRealtimeStatus())}catch{}})}
export function getRealtimeSnapshot(){return state.data||null}
export function getRealtimeStatus(){return{status:state.status,updatedAt:state.updatedAt,refreshMs:state.refreshMs,stale:state.stale,live:liveFixtures(state.data),providers:state.data?.counts||{},conflictCount:state.data?.conflictCount||0,error:state.error||lastError}}
