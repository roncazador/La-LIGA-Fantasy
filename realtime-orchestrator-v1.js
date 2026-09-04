(()=>{'use strict';
const VERSION='1.0.1',REFRESH_MS=3000,FF_API='/api/futbolfantasy/data?realtime=1';
let timer=null,running=false,last=0,visible=document.visibilityState!=='hidden',online=navigator.onLine!==false;
const event=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail:{version:VERSION,at:Date.now(),...detail}}));
const readJson=async(url)=>{const r=await fetch(url,{credentials:'include',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error(`HTTP_${r.status}`);return r.json()};
const register=(status,extra={})=>window.LALIGA_AUTOMATIONS?.register('realtime',{status,version:VERSION,refreshMs:REFRESH_MS,...extra});
async function tick(reason='interval'){if(running||!visible||!online)return false;running=true;try{register('refreshing',{reason});event('laliga:realtime-tick',{reason});if(document.querySelector('#teamDetailModal[style*="display: flex"]')){const data=await readJson(FF_API);window.LALIGA_REALTIME_DATA=data;event('laliga:fantasy-data-updated',{data,reason});}else if(document.querySelector('#teamsDataV5')){event('laliga:fantasy-data-refresh-available',{reason});}last=Date.now();register('ready',{lastRefreshAt:last});return true}catch(error){register('degraded',{error:String(error?.message||error),lastRefreshAt:last});event('laliga:realtime-error',{error:String(error?.message||error),reason});return false}finally{running=false}}
function schedule(){if(timer)clearInterval(timer);timer=setInterval(()=>void tick('interval'),REFRESH_MS)}
function boot(){register('booting');visible=document.visibilityState!=='hidden';online=navigator.onLine!==false;window.addEventListener('online',()=>{online=true;register('online');void tick('online')});window.addEventListener('offline',()=>{online=false;register('offline');event('laliga:realtime-offline')});document.addEventListener('visibilitychange',()=>{visible=document.visibilityState!=='hidden';if(visible)void tick('visibility')});schedule();void tick('boot');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.LALIGA_REALTIME={version:VERSION,refreshMs:REFRESH_MS,refresh:(reason='manual')=>tick(reason),status:()=>({version:VERSION,refreshMs:REFRESH_MS,lastRefreshAt:last,visible,online,running})};
})();
