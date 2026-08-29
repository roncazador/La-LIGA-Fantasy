import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCalibrationState, confidenceBucket, recordCalibration, calibrationSummary, calibratedConfidence, assertCalibrationState } from './brain-calibration-v28.mjs';
import { BrainV27 } from './brain-core-v27.mjs';

const state=createCalibrationState();
assert.equal(confidenceBucket(0),0);
assert.equal(confidenceBucket(9),0);
assert.equal(confidenceBucket(10),1);
assert.equal(confidenceBucket(99),9);
assert.equal(confidenceBucket(100),9);

let learned=createCalibrationState();
for(let i=0;i<30;i++) learned=recordCalibration(learned,80,i<24?2:8);
assertCalibrationState(learned);
const summary=calibrationSummary(learned);
assert.equal(summary.samples,30);
assert.equal(summary.buckets[8].samples,30);
assert.equal(summary.buckets[8].successRate,80);
assert.equal(calibratedConfidence(80,createCalibrationState()),80);
assert.equal(calibratedConfidence(80,learned),80);
assert.ok(summary.calibrationError>=0);

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brain-calibration-'));
try{
  const brain=new BrainV27({dir});
  const player={id:'cal-1',name:'Calibration Player',position:'MED',points:12,minutes:900,starts:10,appearances:10};
  const prediction=brain.predict(player,{week:1});
  assert.ok(Number.isInteger(prediction.confidence));
  assert.equal(prediction.calibrationVersion,'2.8.0');
  brain.learn({expected:prediction.expectedPoints,actual:prediction.expectedPoints,features:prediction.features,position:'MED',confidence:prediction.confidence});
  const status=brain.status();
  assert.equal(status.calibrationVersion,'2.8.0');
  assert.equal(status.calibration.samples,1);
  const reloaded=new BrainV27({dir});
  assert.equal(reloaded.status().calibration.samples,1);
  assert.equal(reloaded.status().calibration.buckets[prediction.confidence>=90?9:Math.floor(prediction.confidence/10)].samples,1);
}finally{fs.rmSync(dir,{recursive:true,force:true});}

console.log('BRAIN CALIBRATION v2.8: bucket · learning · persistence · status OK');
