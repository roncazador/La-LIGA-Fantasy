(()=>{
  'use strict';

  const VERSION='3.3.0';
  const API='/api/calendar/autonomous';
  const SEED='/official-fixtures-seed-2026-27.json';
  const REFRESH_MS=15000;
  const LIVE=new Set(['1H','2H','HT','LIVE','IN_PLAY','PLAYING','EN DIRECTO','DESCANSO','PAUSED','HALFTIME']);
  const FINAL=new Set(['FT','FINISHED','FINAL','ENDED','AET','PEN','COMPLETED']);
  let timer=null;
  let observer=null;
  let renderToken=0;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asDate=value=>new Date(value);
  const validDate=value=>Number.isFinite(asDate(value).getTime());
  const statusOf=value=>String(value?.short??value?.label??value??'PRÓXIMO').trim().toUpperCase();
  const isLive=value=>LIVE.has(statusOf(value));
  const isFinal=value=>FINAL.has(statusOf(value));
  const scoreOf=value=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=99?Number(value):null;

  function formatDate(value){
    const d=asDate(value);
    if(!validDate(value)) return {day:'N/D',time:'N/D'};
    return {
      day:new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'2-digit',month:'long',timeZone:'Europe/Madrid'}).format(d),
      time:new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Madrid'}).format(d)
    };
  }

  function normalize(raw,source){
    if(!raw||typeof raw!=='object') return null;
    const home=String(raw.home??raw.homeTeam?.name??raw.localTeam?.name??raw.home_team?.name??'').trim();
    const away=String(raw.away??raw.awayTeam?.name??raw.visitorTeam?.name??raw.away_team?.name??'').trim();
    const utcDate=raw.utcDate??raw.date??raw.startDate??raw.starting_at??raw.datetime??raw.kickoff;
    if(!home||!away||!validDate(utcDate)) return null;
    const sources=Array.isArray(raw.sources)&&raw.sources.length?raw.sources:[source||raw.source||'LALIGA oficial'];
    return {
      ...raw,
      id:String(raw.id??raw.fixtureId??raw.matchId??`${home}-${away}-${utcDate}`),
      utcDate:asDate(utcDate).toISOString(),home,away,
      status:statusOf(raw.status),
      matchday:raw.matchday??raw.officialMatchday??raw.gameweek?.week??null,
      homeScore:scoreOf(raw.homeScore??raw.home_score??raw.goals?.home??raw.homeTeam?.score??raw.home_team?.score),
      awayScore:scoreOf(raw.awayScore??raw.away_score??raw.goals?.away??raw.awayTeam?.score??raw.away_team?.score),
      source:source||raw.source||'LALIGA oficial',
      sources:[...new Set(sources.map(String))]
    };
  }

  function matchKey(match){
    return `${match.utcDate.slice(0,16)}|${match.home.toLowerCase()}|${match.away.toLowerCase()}`;
  }

  function mergeMatches(input){
    const map=new Map();
    for(const raw of Array.isArray(input)?input:[]){
      const match=normalize(raw,raw?.source);
      if(!match) continue;
      const key=matchKey(match);
      const old=map.get(key);
      if(!old){ map.set(key,match); continue; }
      const merged={...old};
      if(merged.homeScore==null&&match.homeScore!=null) merged.homeScore=match.homeScore;
      if(merged.awayScore==null&&match.awayScore!=null) merged.awayScore=match.awayScore;
      if(merged.matchday==null&&match.matchday!=null) merged.matchday=match.matchday;
      if(isLive(match.status)&&!isFinal(merged.status)) merged.status=match.status;
      if(isFinal(match.status)) merged.status=match.status;
      merged.sources=[...new Set([...(old.sources||[]),...(match.sources||[]),match.source])];
      map.set(key,merged);
    }
    return [...map.values()].sort((a,b)=>asDate(a.utcDate)-asDate(b.utcDate));
  }

  async function getJson(url){
    const response=await fetch(url,{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  async function loadData(){
    try{
      const data=await getJson(API);
      const matches=mergeMatches(data?.matches);
      if(matches.length||data?.fallback) return {...data,version:VERSION,matches,live:matches.filter(isLive).length};
      throw new Error('EMPTY_CALENDAR');
    }catch(error){
      try{
        const seed=await getJson(SEED);
        const matches=mergeMatches((seed?.fixtures||[]).map(item=>({...item,source:'LALIGA oficial · semilla protegida'})));
        return {version:VERSION,sourcePolicy:'LALIGA oficial · respaldo automático',matches,live:matches.filter(isLive).length,fallback:'protected-seed',updatedAt:new Date().toISOString(),warning:error.message};
      }catch(seedError){
        return {version:VERSION,matches:[],live:0,fallback:'empty',updatedAt:new Date().toISOString(),warning:`${error.message}; ${seedError.message}`};
      }
    }
  }

  function styles(){
    if(document.getElementById('cal33style')) return;
    const style=document.createElement('style');
    style.id='cal33style';
    style.textContent=`#calendar30{background:radial-gradient(circle at 15% 0%,#25385c 0,#121b2b 38%,#090f18 100%);border:1px solid #3a4b69;border-radius:22px;padding:18px;margin:0 0 16px;box-shadow:0 18px 45px rgba(0,0,0,.28);color:#eef4ff}#calendar30 .c33head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.c33title{font-size:24px;font-weight:950}.c33sub{font-size:10px;color:#9da9bd;margin-top:5px}.c33badge{padding:8px 11px;border-radius:999px;background:#182538;border:1px solid #3b4c68;font-size:9px;font-weight:950}.c33live{color:#ff6f78}.c33ok{color:#39db91}.c33hero{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:15px}.c33pill{padding:11px 12px;border:1px solid #30405a;border-radius:14px;background:rgba(20,31,47,.8)}.c33pill span{display:block;font-size:9px;color:#9da9bd}.c33pill b{display:block;font-size:19px;margin-top:4px}.c33day{display:flex;align-items:center;gap:9px;font-size:10px;color:#9da9bd;text-transform:uppercase;font-weight:950;letter-spacing:.7px;margin:17px 0 8px}.c33day:after{content:'';height:1px;background:#2d3b52;flex:1}.c33match{display:grid;grid-template-columns:minmax(0,1fr) 100px minmax(0,1fr);gap:8px;align-items:center;padding:13px 11px;margin:5px 0;border:1px solid transparent;border-radius:15px;transition:.15s;background:rgba(16,25,39,.42);cursor:pointer;touch-action:manipulation}.c33match:hover{border-color:#526a92;background:#172438;transform:translateY(-1px)}.c33team{font-size:13px;font-weight:950}.c33away{text-align:right}.c33mid{text-align:center}.c33score{font-size:21px;font-weight:950}.c33status{font-size:8px;font-weight:950;margin-top:4px}.c33meta{font-size:8px;color:#7fa9e9;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.c33cta{font-size:7px;color:#aab6c9;margin-top:5px}.c33foot{margin-top:13px;padding:11px;border-radius:12px;background:#0c1420;border:1px solid #28364c;font-size:9px;color:#9da9bd;line-height:1.5}@media(max-width:620px){.c33hero{grid-template-columns:repeat(2,1fr)}.c33title{font-size:20px}.c33match{grid-template-columns:minmax(0,1fr) 74px minmax(0,1fr);padding:11px 7px}.c33team{font-size:12px}}`;
    document.head.appendChild(style);
  }

  function removeLegacy(){
    document.getElementById('loadFixtures')?.remove();
    document.getElementById('loadSeed')?.remove();
    const status=document.getElementById('fixturesStatus');
    if(status){ status.hidden=true; status.setAttribute('aria-hidden','true'); }
    const legacy=document.getElementById('fixtures');
    if(legacy){ legacy.hidden=true; legacy.setAttribute('aria-hidden','true'); }
  }

  function getHost(){return document.getElementById('partidos');}

  function ensureBox(){
    const section=getHost();
    if(!section) return null;
    removeLegacy();
    styles();
    let box=document.getElementById('calendar30');
    if(!box){
      box=document.createElement('div');
      box.id='calendar30';
      box.setAttribute('aria-live','polite');
      section.prepend(box);
    }
    return box;
  }

  function openDetail(match){
    if(window.LALIGA_MATCH_DETAIL?.open){
      window.LALIGA_MATCH_DETAIL.open(match);
      return;
    }
    const fallback=document.createElement('div');
    fallback.textContent='Cargando detalle del partido…';
    fallback.style.cssText='position:fixed;inset:0;z-index:99999;background:#0b111c;color:white;display:grid;place-items:center';
    document.body.appendChild(fallback);
  }

  function render(data){
    const box=ensureBox();
    if(!box) return false;
    const token=++renderToken;
    const matches=mergeMatches(data?.matches);
    const live=matches.filter(isLive);
    const finished=matches.filter(isFinal);
    const now=new Date();
    const upcoming=matches.filter(match=>!isFinal(match.status)&&asDate(match.utcDate)>=now).slice(0,3);
    const grouped=new Map();
    for(const match of matches){
      const key=formatDate(match.utcDate).day;
      if(!grouped.has(key)) grouped.set(key,[]);
      grouped.get(key).push(match);
    }
    if(token!==renderToken) return false;
    const groups=[...grouped.entries()].map(([day,items])=>`<div class="c33day">${esc(day)}</div>${items.map(match=>{
      const formatted=formatDate(match.utcDate);
      const state=statusOf(match.status);
      const hasScore=match.homeScore!=null||match.awayScore!=null;
      const display=hasScore?`${match.homeScore??0} - ${match.awayScore??0}`:formatted.time;
      return `<div class="c33match" data-match-id="${esc(match.id)}" role="button" tabindex="0" aria-label="Ver detalle ${esc(match.home)} contra ${esc(match.away)}"><div class="c33team">${esc(match.home)}</div><div class="c33mid"><div class="c33score">${esc(display)}</div><div class="c33status ${isLive(state)?'c33live':''}">${isLive(state)?'● EN DIRECTO':isFinal(state)?'FINALIZADO':esc(state)}</div><div class="c33meta">${esc((match.sources||[match.source||'LALIGA oficial']).join(' · '))}</div><div class="c33cta">Tocar para ver alineaciones y posibles puntos</div></div><div class="c33team c33away">${esc(match.away)}</div></div>`;
    }).join('')}`).join('');

    box.innerHTML=`<div class="c33head"><div><div class="c33title">⚽ Calendario LaLiga</div><div class="c33sub">Resultados, directo y detalle fantasy · toca cualquier partido para abrir sus datos</div></div><div class="c33badge ${live.length?'c33live':'c33ok'}">${live.length?`● ${live.length} EN DIRECTO`:'● ACTIVO'}</div></div><div class="c33hero"><div class="c33pill"><span>Partidos</span><b>${matches.length}</b></div><div class="c33pill"><span>En directo</span><b class="${live.length?'c33live':''}">${live.length}</b></div><div class="c33pill"><span>Finalizados</span><b>${finished.length}</b></div><div class="c33pill"><span>Próximos</span><b>${upcoming.length}</b></div></div>${groups||'<div class="c33foot">Sin partidos disponibles.</div>'}${data?.warning?`<div class="c33foot">Sincronización: ${esc(data.warning)}. Se mantiene el respaldo automático.</div>`:'<div class="c33foot"><b>Fuente base:</b> calendario oficial. <b>Fantasy:</b> contraste público integrado sin mostrar ni convertir estimaciones en puntos oficiales.</div>'}`;

    box.querySelectorAll('.c33match').forEach((element,index)=>{
      const handler=()=>openDetail(matches.find(match=>String(match.id)===String(element.dataset.matchId))||matches[index]);
      element.addEventListener('click',handler);
      element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();handler();}});
    });
    box.dataset.initialized='1';
    return true;
  }

  async function refresh(){
    const box=ensureBox();
    if(!box) return false;
    if(box.dataset.initialized!=='1') box.innerHTML='<div class="c33foot">⏳ Cargando calendario automáticamente…</div>';
    try{return render(await loadData());}
    catch{return render({matches:[],warning:'No se pudo consultar el calendario'});}
  }

  function boot(){
    styles();
    ensureBox();
    void refresh();
    if(timer) clearInterval(timer);
    timer=setInterval(()=>void refresh(),REFRESH_MS);
    if(observer) observer.disconnect();
    if(document.body){
      observer=new MutationObserver(()=>{
        if(getHost()&&!document.getElementById('calendar30')) void refresh();
      });
      observer.observe(document.body,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
