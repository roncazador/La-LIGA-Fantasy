import assert from 'node:assert/strict';
import { mergeCalendarSources } from './calendar-service-v29.mjs';

let cases=0,assertions=0;
const check=(ok,msg)=>{assertions+=1;assert.ok(ok,msg)};
const teams=['Real Madrid','Barcelona','Atlético de Madrid','Sevilla','Betis','Athletic Club','Valencia','Villarreal','Getafe','Girona'];
for(let i=0;i<10000;i++){
  const home=teams[i%teams.length],away=teams[(i+3)%teams.length],date=`2026-09-${String((i%28)+1).padStart(2,'0')}T${String(i%22).padStart(2,'0')}:00:00Z`;
  const official={source:'LALIGA oficial',matches:[{id:`o-${i}`,utcDate:date,home,away,status:i%7===0?'LIVE':'TIMED',matchday:(i%8)+1}]};
  const ff={source:'futbolfantasy.com',matches:[{id:`f-${i}`,utcDate:date,home,away,status:i%11===0?'LIVE':'PRÓXIMO',matchday:(i%8)+1}]};
  const merged=mergeCalendarSources([official,ff]);
  check(merged.length===1,`caso ${i+1}: deduplicación`);
  check(merged[0].home===home && merged[0].away===away,`caso ${i+1}: equipos`);
  check(merged[0].sources.length===2,`caso ${i+1}: doble confirmación`);
  check(Boolean(merged[0].utcDate),`caso ${i+1}: fecha válida`);
  check(merged[0].source==='LALIGA oficial',`caso ${i+1}: prioridad oficial`);
  cases+=1;
}
assert.equal(cases,10000);
console.log(`AUTONOMOUS CALENDAR v3.0: ${cases}/10000 cases · ${assertions} assertions passed`);
