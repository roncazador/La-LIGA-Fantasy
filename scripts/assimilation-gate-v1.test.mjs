import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assimilate, ASSIMILATION_VERSION } from './assimilation-gate-v1.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'laliga-assimilation-'));
const battery={summary:{total:4,passed:4,failed:0}};
const cwd=process.cwd();
const out=path.join(dir,'automation-battery-report.json');
fs.writeFileSync(out,JSON.stringify(battery),'utf8');
process.env.AUTOMATION_BATTERY_REPORT=out;
process.chdir(dir);
try{
  const report=assimilate({battery,cultivosDir:dir});
  assert.equal(ASSIMILATION_VERSION,'1.0.0');
  assert.equal(report.schema,'laliga-assimilation/v1');
  assert.equal(report.decision,'accepted');
  assert.equal(report.learningPolicy,'final-only');
  assert.equal(report.writesToBrain,false);
  assert.equal(report.recommendations.length,0);
  assert.equal(fs.existsSync(path.join(dir,'assimilation-report.json')),true);
  const state=JSON.parse(fs.readFileSync(path.join(dir,'cultivos-v1.json'),'utf8'));
  assert.equal(state.cycles,1);
  assert.equal(state.events[0].source,'assimilation-gate');
} finally {process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true});}
console.log('ASSIMILATION v1: 8/8 checks passed');
