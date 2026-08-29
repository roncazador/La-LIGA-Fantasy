import { confidenceBucket } from './brain-calibration-v28.mjs';

export const RELIABILITY_VERSION = '2.9.0';
const clamp=(x,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(Number(x))?Number(x):min));

export function assessPredictionReliability({rawConfidence=0,calibratedConfidence=rawConfidence,driftScore=0,labeledSamples=0,featureValues={},sourceQuality=1,observedAt=null,now=Date.now()}={}){
  const keys=Object.keys(featureValues||{});
  const complete=keys.filter(k=>featureValues[k]!==null&&featureValues[k]!==undefined&&Number.isFinite(Number(featureValues[k]))).length;
  const completeness=keys.length?complete/keys.length:0;
  const ageHours=observedAt?Math.max(0,(Number(now)-new Date(observedAt).getTime())/3600000):Infinity;
  const freshness=Number.isFinite(ageHours)?Math.exp(-ageHours/72):0.35;
  const evidence=clamp(labeledSamples/60);
  const drift=1-clamp(driftScore);
  const dataQuality=clamp(0.45*completeness+0.25*freshness+0.2*clamp(sourceQuality)+0.1*evidence);
  const reliability=clamp(0.45*(Number(calibratedConfidence)/100)+0.2*dataQuality+0.2*drift+0.15*evidence);
  const displayedConfidence=Math.round(clamp(Number(calibratedConfidence)/100*reliability*100,0,100));
  let reason='evidencia limitada';
  if(drift<0.72) reason='deriva elevada';
  else if(evidence<0.25) reason='pocas muestras';
  else if(freshness<0.6) reason='datos antiguos';
  else if(sourceQuality<0.7) reason='fuente secundaria';
  else reason='señales consistentes';
  return {version:RELIABILITY_VERSION,rawConfidence:Number(rawConfidence),calibratedConfidence:Number(calibratedConfidence),displayedConfidence,confidenceBucket:confidenceBucket(calibratedConfidence),dataQuality:Math.round(dataQuality*100)/100,reliability:Math.round(reliability*100)/100,evidenceLevel:Math.round(evidence*100)/100,freshness:Math.round(freshness*100)/100,reason};
}
