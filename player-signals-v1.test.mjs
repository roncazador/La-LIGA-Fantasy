import assert from 'node:assert/strict';
import {buildPlayerSignals,marketTrend,sourceConfidence,startingProbability,explainPlayerSignals} from './player-signals-v1.mjs';

const now=Date.parse('2026-09-04T10:00:00Z');
const strong=buildPlayerSignals({startingProbability:82},{sources:['futbolfantasy','official','provider-b'],timestamp:'2026-09-04T08:00:00Z',conflicts:0,now,marketHistory:[{timestamp:'2026-09-03T08:00:00Z',value:10},{timestamp:'2026-09-04T08:00:00Z',value:11}]});
assert.equal(strong.startingProbability.value,82);
assert.equal(strong.marketTrend.direction,'SUBE');
assert.equal(strong.marketTrend.percent,10);
assert.equal(strong.confidence.label,'ALTA');
assert.ok(explainPlayerSignals(strong)[0].includes('82%'));

const stale=sourceConfidence({sources:['futbolfantasy'],timestamp:'2026-09-02T00:00:00Z',now,maxAgeHours:24});
assert.equal(stale.score,0);
const conflict=sourceConfidence({sources:['a','b','c'],timestamp:'2026-09-04T09:00:00Z',now,conflicts:2});
assert.ok(conflict.score<80);

assert.deepEqual(startingProbability({},{}),{value:null,basis:'SIN EVIDENCIA',evidence:false});
assert.deepEqual(startingProbability({role:'titular'},{}),{value:90,basis:'TITULAR CONFIRMADO',evidence:true});
assert.deepEqual(startingProbability({status:'lesionado'},{}),{value:0,basis:'NO DISPONIBLE',evidence:true});
assert.equal(marketTrend([]).evidence,false);
assert.equal(marketTrend([{timestamp:'2026-09-04T00:00:00Z',value:10}]).evidence,false);
assert.equal(marketTrend([{timestamp:'2026-09-03T00:00:00Z',value:10},{timestamp:'2026-09-04T00:00:00Z',value:10}]).direction,'ESTABLE');
console.log('PLAYER SIGNALS v1: 10/10 checks passed');
