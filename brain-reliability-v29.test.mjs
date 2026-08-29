import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessPredictionReliability } from './brain-reliability-v29.mjs';

const samples=[
  {rawConfidence:90,calibratedConfidence:88,driftScore:0.05,labeledSamples:120,featureValues:{performance:.9,availability:.9,context:.8,market:.8,risk:.9},sourceQuality:1,observedAt:new Date().toISOString()},
  {rawConfidence:80,calibratedConfidence:78,driftScore:0.7,labeledSamples:4,featureValues:{performance:.8,availability:.8,context:.5,market:.4,risk:.7},sourceQuality:.7,observedAt:new Date(Date.now()-240*3600000).toISOString()},
  {rawConfidence:50,calibratedConfidence:50,driftScore:0.1,labeledSamples:0,featureValues:{},sourceQuality:.5,observedAt:null},
  {rawConfidence:100,calibratedConfidence:100,driftScore:0,labeledSamples:1000,featureValues:{performance:1,availability:1,context:1,market:1,risk:1},sourceQuality:1,observedAt:new Date().toISOString()},
  {rawConfidence:0,calibratedConfidence:0,driftScore:1,labeledSamples:0,featureValues:{performance:null,availability:null},sourceQuality:0,observedAt:new Date(Date.now()-1000*3600000).toISOString()}
];
for(const input of samples){const out=assessPredictionReliability(input);assert.ok(out.displayedConfidence>=0&&out.displayedConfidence<=100);assert.ok(out.reliability>=0&&out.reliability<=1);assert.ok(out.dataQuality>=0&&out.dataQuality<=1);assert.ok(out.freshness>=0&&out.freshness<=1);assert.ok(out.evidenceLevel>=0&&out.evidenceLevel<=1);assert.ok(Number.isInteger(out.confidenceBucket));}
assert.equal(assessPredictionReliability(samples[0]).reason,'señales consistentes');
assert.equal(assessPredictionReliability(samples[2]).reason,'pocas muestras');
assert.ok(assessPredictionReliability(samples[3]).reliability>assessPredictionReliability(samples[4]).reliability);
assert.ok(assessPredictionReliability({featureValues:{a:1,b:null}}).dataQuality<1);
const source=fs.readFileSync('./brain-reliability-hook-v29.mjs','utf8');
assert.ok(source.includes('BrainV27.prototype.predict'));
assert.ok(source.includes('BrainV27.prototype.status'));
assert.ok(source.includes('rawConfidence'));
assert.ok(source.includes('reliabilityVersion'));
console.log('BRAIN RELIABILITY v2.9: 16/16 checks passed');
