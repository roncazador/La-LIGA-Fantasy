const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

export function estimateFantasyPoints(player={}) {
  const historical=Number.isFinite(Number(player.points))?Number(player.points):null;
  const probability=Number.isFinite(Number(player.probability))?clamp(Number(player.probability),0,100):null;
  const values=Array.isArray(player.values)?player.values.map(Number).filter(Number.isFinite):[];
  const base=historical!=null?historical:(values[0]??0);
  let estimate=base;

  if(probability!=null) estimate*=0.65+0.35*(probability/100);
  if(player.probable===true) estimate+=0.35;
  if(typeof player.status==='string'){
    const status=player.status.toLowerCase();
    if(/lesion|molest|baja|sancion|duda|tocado/.test(status)) estimate-=0.75;
    if(/alta|disponible/.test(status)) estimate+=0.15;
  }

  return clamp(Math.round(estimate*10)/10,0,20);
}

export function scorePlayerSignal(player={}) {
  const probability=Number.isFinite(Number(player.probability))?clamp(Number(player.probability),0,100):null;
  const observed=Number.isFinite(Number(player.points))?Number(player.points):null;
  const possiblePoints=estimateFantasyPoints(player);
  const confidence=probability==null?0.35:0.35+0.65*(probability/100);
  return {
    name:player.name??null,
    team:player.team??null,
    possiblePoints,
    probability,
    observedPoints:observed,
    confidence:Math.round(clamp(confidence,0,1)*100)/100,
    basis:[
      observed!=null?'historical_points':'fallback_values',
      probability!=null?'starter_probability':'no_starter_probability',
      player.status?'availability_status':null
    ].filter(Boolean),
    learned:false
  };
}

export function scoreNormalizedPlayers(players=[]) {
  return (Array.isArray(players)?players:[])
    .filter(p=>p&&p.name)
    .map(scorePlayerSignal)
    .sort((a,b)=>b.possiblePoints-a.possiblePoints || a.name.localeCompare(b.name));
}
