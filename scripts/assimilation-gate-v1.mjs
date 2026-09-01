import fs from 'node:fs';
import path from 'node:path';
import { createCultivos } from '../cultivos-v1.mjs';

export const ASSIMILATION_VERSION='1.0.0';
const REPORT='assimilation-report.json';
const batteryPath=process.env.AUTOMATION_BATTERY_REPORT||'automation-battery-report.json';
const stateDir=process.env.BRAIN_STATE_DIR||'./.brain-data';

function readBattery(){
  try{return JSON.parse(fs.readFileSync(path.resolve(batteryPath),'utf8'))}
  catch{return {status:'missing',summary:{passed:0,total:0,failed:0},recommendations:['Ejecutar la batería de automatización antes de asimilar.']}}
}

export function assimilate({battery=readBattery(),cultivosDir=stateDir}={}){
  const summary=battery.summary||{};
  const total=Number(summary.total)||0;
  const passed=Number(summary.passed)||0;
  const failed=Number(summary.failed)||0;
  const complete=total>0&&failed===0&&passed===total;
  const cultivation=createCultivos({dir:cultivosDir});
  const feedback=cultivation.observe({
    source:'assimilation-gate',
    outcome:complete?'success':failed>0?'failure':'neutral',
    dimensions:{
      automation:complete?2:failed?-2:0,
      coverage:total>0?1:0,
      reliability:complete?1:-1
    },
    detail:`battery=${passed}/${total}; failed=${failed}; learning=final-only`
  });
  const report={
    schema:'laliga-assimilation/v1',
    version:ASSIMILATION_VERSION,
    at:new Date().toISOString(),
    source:{battery:batteryPath},
    decision:complete?'accepted':'hold',
    learningPolicy:'final-only',
    writesToBrain:false,
    feedback,
    recommendations:complete?[]:['No promover aprendizaje: la batería no está completamente verde.']
  };
  fs.writeFileSync(REPORT,JSON.stringify(report,null,2),'utf8');
  return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.url.replace('file://',''))){
  const report=assimilate();
  console.log(`ASSIMILATION v1: ${report.decision} · battery=${report.feedback.cycles} cultivation cycles`);
  process.exitCode=report.decision==='accepted'?0:1;
}
