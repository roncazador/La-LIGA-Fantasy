import assert from 'node:assert/strict';

export const CALIBRATION_VERSION = '2.8.0';
export const BUCKET_COUNT = 10;

export function createCalibrationState(raw={}){
  const buckets=Array.from({length:BUCKET_COUNT},(_,bucket)=>{
    const source=raw?.buckets?.[bucket]||{};
    return {bucket,samples:Number(source.samples)||0,successful:Number(source.successful)||0};
  });
  return {version:CALIBRATION_VERSION,samples:Number(raw.samples)||0,buckets};
}

export function confidenceBucket(confidence){
  const value=Math.max(0,Math.min(100,Number(confidence)||0));
  return Math.min(BUCKET_COUNT-1,Math.floor(value/10));
}

export function recordCalibration(state,confidence,actualError,tolerance=3){
  const next=createCalibrationState(state);
  const bucket=confidenceBucket(confidence);
  next.samples+=1;
  next.buckets[bucket].samples+=1;
  if(Math.abs(Number(actualError))<=tolerance) next.buckets[bucket].successful+=1;
  return next;
}

export function calibrationSummary(state){
  const current=createCalibrationState(state);
  const buckets=current.buckets.map(b=>({
    bucket:b.bucket,
    confidenceMin:b.bucket*10,
    confidenceMax:b.bucket===9?100:b.bucket*10+9,
    samples:b.samples,
    successRate:b.samples?Math.round(b.successful/b.samples*10000)/100:null
  }));
  const populated=buckets.filter(b=>b.samples>0);
  const calibrationError=populated.length?Math.round(populated.reduce((sum,b)=>sum+Math.abs(((b.bucket*10+5)/100)-(b.successRate/100))*b.samples,0)/current.samples*10000)/100:null;
  return {version:current.version,samples:current.samples,calibrationError,buckets};
}

export function calibratedConfidence(rawConfidence,state){
  const raw=Math.max(0,Math.min(100,Number(rawConfidence)||0));
  const summary=calibrationSummary(state);
  if(summary.samples<30) return raw;
  const bucket=summary.buckets[confidenceBucket(raw)];
  if(!bucket || bucket.successRate==null || bucket.samples<5) return raw;
  return Math.round(raw*0.5+bucket.successRate*0.5);
}

export function assertCalibrationState(state){
  const normalized=createCalibrationState(state);
  assert.equal(normalized.version,CALIBRATION_VERSION);
  assert.equal(normalized.buckets.length,BUCKET_COUNT);
  assert.equal(normalized.samples,normalized.buckets.reduce((sum,b)=>sum+b.samples,0));
  return normalized;
}
