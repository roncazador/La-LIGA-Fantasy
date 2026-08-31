import assert from 'node:assert/strict';
import {estimateFantasyPoints,scorePlayerSignal,scoreNormalizedPlayers} from './fantasy-points-model-v34.mjs';

assert.equal(estimateFantasyPoints({points:10,probability:100,probable:true}),10.4);
assert.equal(estimateFantasyPoints({points:10,probability:0}),6.5);
assert.equal(estimateFantasyPoints({points:10,probability:100,status:'lesionado'}),9.6);
assert.equal(estimateFantasyPoints({points:100,probability:100}),20);

const signal=scorePlayerSignal({name:'Jugador Uno',team:'Barcelona',points:8,probability:90,probable:true});
assert.equal(signal.name,'Jugador Uno');
assert.equal(signal.possiblePoints,8.1);
assert.equal(signal.learned,false);
assert.ok(signal.basis.includes('historical_points'));
assert.ok(signal.basis.includes('starter_probability'));

const ranked=scoreNormalizedPlayers([
  {name:'B',points:6,probability:80},
  {name:'A',points:9,probability:95}
]);
assert.deepEqual(ranked.map(x=>x.name),['A','B']);
console.log('FANTASY POINTS MODEL v34: 10/10 assertions passed');
