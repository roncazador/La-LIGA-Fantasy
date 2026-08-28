import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrainV27 } from './brain-core-v27.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'laliga-brain-fuzz-'));
try{
  const brain=new BrainV27({dir});
  const positions=['POR','DEF','MED','DEL','GK','DF','MF','FW','???',null,''];
  const statuses=['OK','injured','doubt','sanc','Baja',null,''];
  for(let i=0;i<25000;i++){
    const weird=i%17===0;
    const player={
      name:i%23===0?'':`Jugador ${i}`,
      position:positions[i%positions.length],
      team:i%19===0?null:`Club ${i%31}`,
      points:weird?(i%2?Infinity:-Infinity):((i*37)%61)-10,
      minutes:weird?NaN:(i*91)%1200,
      starts:weird?null:(i*7)%15,
      appearances:weird?undefined:(i*11)%20,
      price:i%13===0?0:1_000_000+(i%40)*125_000,
      value:i%17===0?0:1_000_000+(i%55)*175_000,
      availability:statuses[i%statuses.length],
      rotationRisk:i%29===0?250:(i%10)/10,
      injuryRisk:i%31===0?-3:(i%8)/10,
      trend3d:i%37===0?Infinity:((i%21)-10)/2
    };
    const pred=brain.predict(player,{fixture:{context:i%140-20,homeAway:i%3===0?'home':i%3===1?'away':'neutral'},week:i%38});
    assert.ok(Number.isFinite(pred.score));
    assert.ok(Number.isFinite(pred.expectedPoints));
    assert.ok(Number.isFinite(pred.confidence));
    assert.ok(pred.score>=0&&pred.score<=1);
    assert.ok(pred.confidence>=0&&pred.confidence<=100);
    if(i%2500===0){
      const result=brain.observePlayers([{...player,name:`Jugador ${i}`,weekPoints:i%41}],{week:i%9,fixture:{context:55,homeAway:'home'}});
      assert.ok(result.observed>=0);
      assert.ok(brain.state.observations>=0);
      assert.ok(Object.values(brain.state.weights).every(Number.isFinite));
    }
  }
  const corrupted=path.join(dir,'model-v27.json');
  fs.writeFileSync(corrupted,'{invalid json','utf8');
  const recovered=new BrainV27({dir});
  assert.equal(recovered.state.version,'2.7.0');
  assert.ok(Object.values(recovered.state.weights).every(Number.isFinite));
  recovered.save();
  assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(corrupted,'utf8')));
  console.log('BRAIN FUZZ v2.7: OK · 25000 edge-case predictions · corruption recovery');
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
