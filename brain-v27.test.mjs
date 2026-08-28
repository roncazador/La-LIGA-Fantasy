import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrainV27, BRAIN_VERSION, extractFeatures } from './brain-core-v27.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'laliga-brain-v27-'));
try{
  const brain=new BrainV27({dir,learningRate:0.06});
  const player={name:'Jugador Demo',position:'MED',team:'Club Demo',points:10,minutes:540,starts:6,price:100,value:125,availability:'OK'};
  const p1=brain.predict(player,{fixture:{context:75,homeAway:'home'},week:1});
  assert.equal(p1.modelVersion,BRAIN_VERSION);
  assert.ok(p1.score>=0&&p1.score<=1);
  assert.ok(p1.expectedPoints>=0);
  assert.ok(p1.confidence>=0&&p1.confidence<=100);
  const before={...brain.state.weights};
  const features=extractFeatures(player,{fixture:{context:75,homeAway:'home'}});
  const learned=brain.learn({expected:p1.expectedPoints,actual:p1.expectedPoints+8,features,position:'MED'});
  assert.equal(learned.learned,true);
  assert.ok(Object.values(brain.state.weights).every(Number.isFinite));
  assert.ok(Math.abs(Object.values(brain.state.weights).reduce((a,b)=>a+b,0)-1)<1e-9);
  assert.notDeepEqual(brain.state.weights,before);
  assert.equal(brain.state.accuratePredictions,0);

  const accurate=brain.learn({expected:10,actual:12,features,position:'MED'});
  assert.equal(accurate.learned,true);
  assert.equal(brain.state.accuratePredictions,1);
  assert.equal(brain.status().accuracy,50);

  const positive={...player,weekPoints:18};
  const observed=brain.observePlayers([positive],{week:2,fixture:{context:80,homeAway:'home'}});
  assert.equal(observed.observed,1);
  assert.equal(observed.learned>=1,true);
  assert.equal(brain.state.observations>=1,true);

  const second=brain.observePlayers([{...player,weekPoints:25}],{week:2,fixture:{context:80,homeAway:'home'}});
  assert.equal(second.learned>=1,true);
  assert.ok(brain.state.labeledSamples>=4);
  assert.ok(brain.state.meanAbsoluteError>=0);
  assert.ok(['stable','watch','high'].includes(brain.state.drift.status));

  const reloaded=new BrainV27({dir,learningRate:0.06});
  assert.equal(reloaded.state.labeledSamples,brain.state.labeledSamples);
  assert.deepEqual(reloaded.state.weights,brain.state.weights);
  assert.equal(reloaded.status().version,BRAIN_VERSION);
  assert.ok(fs.existsSync(path.join(dir,'model-v27.json')));
  assert.ok(fs.existsSync(path.join(dir,'learning-v27.jsonl')));

  const invalid=reloaded.learn({expected:'bad',actual:4,features,position:'MED'});
  assert.equal(invalid.learned,false);
  assert.equal(invalid.reason,'invalid-label');

  let loops=0;
  for(let i=1;i<=100000;i++){
    const synthetic={...player,points:8+(i%12),minutes:450+(i%360),starts:4+(i%5),price:9000000+(i%11)*100000,value:10000000+(i%13)*150000};
    const pred=reloaded.predict(synthetic,{fixture:{context:40+(i%61),homeAway:i%2?'home':'away'},week:10+i%20});
    assert.ok(Number.isFinite(pred.score));
    assert.ok(Number.isFinite(pred.expectedPoints));
    assert.ok(Number.isFinite(pred.confidence));
    if(i%10===0){
      const f=extractFeatures(synthetic,{fixture:{context:40+(i%61),homeAway:'home'}});
      const actual=pred.expectedPoints+(i%3===0?4:-2);
      reloaded.learn({expected:pred.expectedPoints,actual,features:f,position:f.position});
      assert.ok(Math.abs(Object.values(reloaded.state.weights).reduce((a,b)=>a+b,0)-1)<1e-9);
      assert.ok(Object.values(reloaded.state.weights).every(x=>Number.isFinite(x)&&x>0));
      assert.ok(Number.isFinite(reloaded.state.bias));
      assert.ok(Object.values(reloaded.state.positionBias).every(Number.isFinite));
      assert.ok(reloaded.state.accuratePredictions>=0&&reloaded.state.accuratePredictions<=reloaded.state.labeledSamples);
      loops++;
    }
  }
  assert.equal(loops,10000);
  assert.ok(reloaded.state.labeledSamples>=10004);
  console.log(`BRAIN v${BRAIN_VERSION}: OK · 100000 micro-pasos · 10000 ciclos de corrección`);
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
