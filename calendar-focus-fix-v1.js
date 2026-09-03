(()=>{'use strict';
/* Compatibility bridge: team-name normalization at the data boundary; no duplicate calendar engine. */
const core=()=>window.LALIGA_CALENDAR_FOCUS_V1||null;
const N=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const FF=new Map([
['athleticclub','Athletic'],['athletic','Athletic'],['atleticodemadrid','Atlético'],['atletico','Atlético'],
['caosasuna','Osasuna'],['osasuna','Osasuna'],['deportivoalaves','Alavés'],['alaves','Alavés'],
['fcbarcelona','Barcelona'],['barcelona','Barcelona'],['rcdespanyoldebarcelona','Espanyol'],['espanyol','Espanyol'],
['realbetis','Betis'],['betis','Betis'],['realmadrid','Real Madrid'],['realsociedad','Real Sociedad'],
['sevillafc','Sevilla'],['sevilla','Sevilla'],['valenciacf','Valencia'],['valencia','Valencia'],
['villarrealcf','Villarreal'],['villarreal','Villarreal'],['rayovallecano','Rayo'],['rayo','Rayo'],
['getafecf','Getafe'],['getafe','Getafe'],['levanteud','Levante'],['levante','Levante'],
['elchecf','Elche'],['elche','Elche'],['celta','Celta'],['malagacf','Málaga'],['malaga','Málaga'],
['rracingclub','Racing'],['racing','Racing'],['rcdeportivo','Deportivo'],['deportivo','Deportivo']
]);
const ffName=v=>FF.get(N(v))??'';
const adaptMatch=m=>m?({...m,home:ffName(m.home),away:ffName(m.away)}):m;
const adaptFixtures=data=>{
 const mapList=value=>Array.isArray(value)?value.map(item=>({...item,home:ffName(item?.home??item?.homeTeam?.name),away:ffName(item?.away??item?.awayTeam?.name)})):value;
 if(!data||typeof data!=='object')return data;
 return {...data,matches:mapList(data.matches),fixtures:mapList(data.fixtures),merged:mapList(data.merged)};
};
function wrap(){
 const c=core();
 if(!c||c.__teamIdentityBridge)return false;
 if(typeof c.openMatch==='function'){
  const originalOpenMatch=c.openMatch;
  c.openMatch=match=>originalOpenMatch(adaptMatch(match));
 }
 if(typeof c.openTeam==='function'){
  const originalOpenTeam=c.openTeam;
  c.openTeam=async team=>{
   const savedFetch=window.fetch;
   window.fetch=async(url,...args)=>{
    const response=await savedFetch(url,...args);
    if(!String(url).includes('/api/fixtures'))return response;
    const data=await response.clone().json().catch(()=>null);
    if(!data||typeof data!=='object')return response;
    return new Response(JSON.stringify(adaptFixtures(data)),{status:response.status,headers:{'Content-Type':'application/json'}});
   };
   try{return await originalOpenTeam(team)}finally{window.fetch=savedFetch}
  };
 }
 c.__teamIdentityBridge=true;
 return true;
}
function boot(){
 let attempts=0;
 const timer=setInterval(()=>{attempts+=1;if(wrap()||attempts>=40)clearInterval(timer)},250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.LALIGA_CALENDAR_FOCUS_FIX_V1=Object.freeze({
 refreshStandings:()=>core()?.refreshStandings?.()??Promise.resolve(false),
 logoFor:team=>core()?.logoFor?.(team)??'',
 ffName
});
})();
