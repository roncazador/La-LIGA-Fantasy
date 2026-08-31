(()=>{'use strict';
const VERSION='1.0.0',MAX_ERRORS=40,MAX_EVENTS=200;
const state={startedAt:Date.now(),lastEventAt:0,lastCalendarAt:0,eventCount:0,errors:[],events:[],layers:new Map()};
const text=v=>String(v??'').slice(0,500);
const push=(arr,value,max)=>{arr.push(value);if(arr.length>max)arr.splice(0,arr.length-max)};
function register(name,meta={}){const key=text(name)||'unknown',old=state.layers.get(key)||{};state.layers.set(key,{...old,...meta,lastSeenAt:Date.now(),name:key});return snapshot()}
function record(type,detail={}){const now=Date.now();state.lastEventAt=now;state.eventCount++;const item={type,at:now,source:text(detail.src||detail.source||'unknown'),stage:text(detail.stage||''),error:text(detail.error||detail.message||'')};push(state.events,item,MAX_EVENTS);if(type.includes('error'))push(state.errors,item,MAX_ERRORS);if(type==='calendar-updated')state.lastCalendarAt=now;return item}
function inspectLayers(){const scripts=document.querySelectorAll('script[data-fantasy-layer]');for(const s of scripts)register(s.dataset.fantasyLayer||'script',{status:'loaded'});const known={
  calendar:typeof window.LALIGA_CALENDAR_V35==='object',dynamics:typeof window.LALIGA_APP_DYNAMICS_V37==='object',brainPanel:Boolean(document.getElementById('brain27Panel')),recording:Boolean(document.querySelector('script[data-fantasy-layer="/recording-client.js"]')),futbolfantasy:Boolean(document.querySelector('script[data-fantasy-layer="/futbolfantasy-ui-v30.js"]')),matchDetail:Boolean(document.querySelector('script[data-fantasy-layer="/match-detail-ui-v31.js"]')),connection:Boolean(window.LALIGA_CONNECTION)};
  for(const[name,ready]of Object.entries(known))register(name,{status:ready?'ready':'pending'});return known}
function snapshot(){return{version:VERSION,schema:'laliga-automation-state/v1',startedAt:state.startedAt,lastEventAt:state.lastEventAt,lastCalendarAt:state.lastCalendarAt,eventCount:state.eventCount,layers:[...state.layers.values()].sort((a,b)=>a.name.localeCompare(b.name)),recentErrors:state.errors.slice(-12),recentEvents:state.events.slice(-20)}}
function handoff(){const s=snapshot();return{schema:'laliga-automation-handoff/v1',generatedAt:new Date().toISOString(),repository:'roncazador/La-LIGA-Fantasy',automation:s,providers:inspectLayers(),readOnly:true}}
function onUpdated(e){record('calendar-updated',e.detail||{});register('calendar',{status:e.detail?.error?'degraded':'healthy',lastUpdateAt:Date.now()})}
function onDegraded(e){record('calendar-degraded',e.detail||{});register('calendar',{status:'degraded',lastDegradedAt:Date.now(),degradedError:text(e.detail?.error)})}
function onCalendarError(e){record('calendar-error',e.detail||{});register('calendar',{status:'error',lastErrorAt:Date.now(),error:text(e.detail?.error)})}
function onLayerError(e){record('layer-error',e.detail||{});const src=text(e.detail?.src||'unknown');register(src,{status:'error',lastErrorAt:Date.now(),error:text(e.detail?.error)})}
function boot(){window.addEventListener('laliga:calendar-updated',onUpdated);window.addEventListener('laliga:calendar-degraded',onDegraded);window.addEventListener('laliga:calendar-error',onCalendarError);window.addEventListener('laliga:layer-error',onLayerError);if(document.body){const observer=new MutationObserver(()=>inspectLayers());observer.observe(document.body,{childList:true,subtree:true});}inspectLayers();window.LALIGA_AUTOMATIONS=Object.freeze({VERSION,register,record,snapshot,handoff})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();})();
