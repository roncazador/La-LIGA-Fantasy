(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = v => v == null ? 'N/D' : `${Math.round(Number(v))}%`;

  async function getStatus(){
    const r=await fetch('/api/brain/status',{credentials:'include',cache:'no-store'});
    if(!r.ok) throw Error(`BRAIN_HTTP_${r.status}`);
    return r.json();
  }

  function mount(status){
    const view=document.querySelector('.of213-view[data-view="cerebro"]');
    if(!view) return false;
    let panel=document.getElementById('brain27Panel');
    if(!panel){panel=document.createElement('div');panel.id='brain27Panel';panel.className='of213-card';view.prepend(panel);}
    const stable=status.drift?.status==='stable';
    const h=status.history||{};
    const calibration=status.calibration||{};
    const reliability=status.reliability||{};
    panel.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div><h3 style="margin:0">🧠 Cerebro propio · ${esc(status.version||'2.7.0')}</h3>
        <div class="of213-muted">Aprende de observaciones y resultados reales. Reajusta sus propios pesos, calibra la confianza, vigila su deriva y conserva memoria histórica por jugador.</div></div>
        <span class="of213-tag ${stable?'ofGreen':'ofYellow'}">${stable?'● ESTABLE':'◐ APRENDIENDO'}</span>
      </div>
      <div class="of213-g4" style="margin-top:10px">
        <div class="of213-card of213-metric"><div class="of213-label">Observaciones</div><div class="of213-value">${esc(status.observations)}</div></div>
        <div class="of213-card of213-metric"><div class="of213-label">Muestras con resultado</div><div class="of213-value">${esc(status.labeledSamples)}</div></div>
        <div class="of213-card of213-metric"><div class="of213-label">Precisión ≤3 puntos</div><div class="of213-value">${pct(status.accuracy)}</div></div>
        <div class="of213-card of213-metric"><div class="of213-label">Error medio</div><div class="of213-value">${status.meanAbsoluteError==null?'N/D':esc(status.meanAbsoluteError)}</div></div>
      </div>
      <div class="of213-g2" style="margin-top:2px">
        <div class="of213-card"><h3>Confianza calibrada · v${esc(status.calibrationVersion||'2.8.0')}</h3><div class="of213-row"><span>Confianza actual</span><b>${pct(status.confidence)}</b></div><div class="of213-row"><span>Confianza sin calibrar</span><b>${pct(status.rawConfidence)}</b></div><div class="of213-row"><span>Muestras calibradas</span><b>${esc(calibration.samples??0)}</b></div><div class="of213-row"><span>Error de calibración</span><b>${calibration.calibrationError==null?'N/D':esc(calibration.calibrationError)+' pp'}</b></div><div class="of213-note">La calibración no modifica el <b>score</b> del jugador.</div></div>
        <div class="of213-card"><h3>Fiabilidad de la predicción</h3><div class="of213-row"><span>Fiabilidad</span><b>${pct(Number(reliability.reliability||0)*100)}</b></div><div class="of213-row"><span>Calidad de datos</span><b>${pct(Number(reliability.dataQuality||0)*100)}</b></div><div class="of213-row"><span>Frescura</span><b>${pct(Number(reliability.freshness||0)*100)}</b></div><div class="of213-row"><span>Motivo</span><b>${esc(reliability.reason||'N/D')}</b></div></div>
      </div>
      <div class="of213-g2" style="margin-top:2px">
        <div class="of213-card"><h3>Memoria histórica</h3><div class="of213-row"><span>Jugadores registrados</span><b>${esc(h.players??0)}</b></div><div class="of213-row"><span>Observaciones históricas</span><b>${esc(h.observations??0)}</b></div><div class="of213-row"><span>Resultados guardados</span><b>${esc(h.labeledSamples??0)}</b></div><div class="of213-note">Retención: ${esc(h.retentionPerPlayer??24)} registros por jugador.</div></div>
        <div class="of213-card"><h3>Control de deriva</h3><div class="of213-row"><span>Estado</span><b class="${stable?'ofGreen':'ofYellow'}">${esc(status.drift?.status||'N/D')}</b></div><div class="of213-row"><span>Nivel</span><b>${pct(Number(status.drift?.score||0)*100)}</b></div><div class="of213-row"><span>Muestras pendientes</span><b>${esc(status.pendingSamples)}</b></div></div>
      </div>
      <div class="of213-g2" style="margin-top:2px">
        <div class="of213-card"><h3>Pesos aprendidos</h3><div class="of213-list">${Object.entries(status.weights||{}).map(([k,v])=>`<div class="of213-row"><span>${esc(k)}</span><b>${(Number(v)*100).toFixed(1)}%</b></div>`).join('')}</div></div>
        <div class="of213-card"><h3>Posiciones</h3><div class="of213-list">${Object.entries(status.positionBias||{}).map(([k,v])=>`<div class="of213-row"><span>${esc(k)}</span><b>${Number(v)>=0?'+':''}${(Number(v)*100).toFixed(1)}%</b></div>`).join('')}</div></div>
      </div>
      <div class="of213-card"><h3>Intervalos de calibración</h3><div class="of213-list">${(calibration.buckets||[]).filter(b=>b.samples>0).slice(-5).map(b=>`<div class="of213-row"><span>${b.confidenceMin}-${b.confidenceMax}% · ${b.samples} muestras</span><b>${b.successRate==null?'N/D':b.successRate+'%'}</b></div>`).join('')||'<div class="of213-note">Aún no hay suficientes muestras calibradas.</div>'}</div></div>
      <div class="of213-note">Fuente de aprendizaje: <b>${esc(status.sourcePolicy)}</b>. El calendario visible continúa usando únicamente LALIGA oficial; las fuentes auxiliares solo aportan señales de entrenamiento.</div>
    `;
    return true;
  }

  async function refresh(){
    try{mount(await getStatus());}
    catch(error){
      const view=document.querySelector('.of213-view[data-view="cerebro"]');
      if(view&&!document.getElementById('brain27Panel')){const p=document.createElement('div');p.id='brain27Panel';p.className='of213-note';p.textContent=`Cerebro preparando aprendizaje (${error.message})…`;view.prepend(p);}
    }
  }
  function boot(){refresh();const observer=new MutationObserver(()=>{const view=document.querySelector('.of213-view[data-view="cerebro"]');if(view&&!document.getElementById('brain27Panel'))refresh();});observer.observe(document.body,{childList:true,subtree:true});setInterval(refresh,30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
