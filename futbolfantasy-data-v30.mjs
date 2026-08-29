import { fetchFutbolFantasy } from './calendar-service-v29.mjs';
const text=x=>String(x??'');
let cache=null;
export async function fetchFutbolFantasyData(config={}){
  if(cache&&Date.now()-cache.at<5*60*1000)return cache.data;
  const base=text(config.futbolFantasyUrl||'https://www.futbolfantasy.com').replace(/\/$/,'');
  const paths=['/','/laliga','/laliga/alineaciones-probables','/laliga/lesionados','/laliga/estadisticas'];
  const pages=(await Promise.all(paths.map(async suffix=>{try{const r=await fetch(`${base}${suffix}`,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'LALIGA-Fantasy-Manager/3.0.0 (read-only)'},cache:'no-store',signal:AbortSignal.timeout(7000)});if(!r.ok)return null;const html=await r.text();if(html.length>5000000)return null;const links=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).filter(Boolean).slice(0,250);const headings=[...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,100);return{path:suffix,status:r.status,bytes:html.length,links,headings,hasStructuredData:/application\/ld\+json|__NEXT_DATA__|__INITIAL_STATE__|__PRELOADED_STATE__/i.test(html)}}catch{return null}}))).filter(Boolean);
  let calendar=[];try{const ff=await fetchFutbolFantasy(config);calendar=Array.isArray(ff.matches)?ff.matches:[]}catch{}
  const data={source:'futbolfantasy.com',readOnly:true,calendar,pages,availablePages:pages.map(p=>p.path),counts:{calendar:calendar.length,pages:pages.length,links:pages.reduce((n,p)=>n+p.links.length,0),headings:pages.reduce((n,p)=>n+p.headings.length,0)},checkedAt:new Date().toISOString()};
  cache={at:Date.now(),data};return data;
}
