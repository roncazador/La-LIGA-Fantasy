import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPlayerHistory, HISTORY_VERSION } from './brain-history-v28.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'laliga-history-'));
const h=createPlayerHistory({dir,maxPerPlayer:4});
const players=[{id:10,name:'Jugador Uno',teamName:'Equipo A',weekPoints:8,minutes:90,starts:1},{id:11,name:'Jugador Dos',teamName:'Equipo B',weekPoints:2,minutes:45,starts:0}];
let r=h.observe(players,{week:1,source:'official',weekComplete:false});
assert.equal(r.players,2);assert.equal(r.newPlayers,2);assert.equal(r.duplicates,0);
assert.equal(h.profile('10').labeledSamples,0);
const repeat=h.observe(players,{week:1,source:'official',weekComplete:false});
assert.equal(repeat.duplicates,2);assert.equal(h.summary().observations,2);

r=h.observe([{...players[0],weekPoints:12},{...players[1],weekPoints:4}],{week:2,source:'official',weekComplete:true});
assert.equal(r.players,2);
let p=h.profile('10');assert.equal(p.found,true);assert.equal(p.labeledSamples,1);assert.equal(p.recentAveragePoints,12);
const reloaded=createPlayerHistory({dir,maxPerPlayer:4});assert.equal(reloaded.profile('10').recentAveragePoints,12);assert.equal(reloaded.state.version,HISTORY_VERSION);
reloaded.observe([{id:10,name:'Jugador Uno',teamName:'Equipo A',weekPoints:15}],{week:3,source:'official',weekComplete:true});
assert.equal(reloaded.profile('10').labeledSamples,2);
const repeatedFinal=reloaded.observe([{id:10,name:'Jugador Uno',teamName:'Equipo A',weekPoints:15}],{week:3,source:'official',weekComplete:true});
assert.equal(repeatedFinal.duplicates,1);assert.equal(reloaded.profile('10').labeledSamples,2);
console.log('History dedup/final-only regression: 100% passed');
