import fs from 'node:fs';
import path from 'node:path';
import { createCultivos } from '../cultivos-v1.mjs';

export const FEEDBACK_CYCLE_VERSION='1.0.0';
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}};
const stateDir=process.env.BRAIN_STATE_DIR||'./.brain-data';
const batteryFile=process.env.AUTOMATION_BATTERY_REPORT||'automation-battery-report.json';
const assimilationFile=process.env.ASSIMILATION_REPORT||'assimilation-report.json';

export function runFeedbackCycle({battery=readJson(batteryFile,null),assimilation=readJson(assimilationFile,null),cultivosDir=stateDir}={}){
  const cultivation=createCultivos({dir:cultivosDir});
  const batterySummary=battery?.summary||{};
  const batteryComplete=Number(batterySummary.total)>0&&Number(batterySummary.failed)===0&&Number(batterySummary.passed)===Number(batterySummary.total);
  const assimilationAccepted=assimilation?.decision==='accepted';
  const accepted=batteryComplete&&assimilationAccepted;
  const feedback=cultivation.observe({
    source:'closed-feedback-cycle',
    outcome:accepted?'success':(battery?.status==='failed'?'failure':'neutral'),
    dimensions:{
      automation:accepted?2:-1,
      reliability:accepted?2:-1,
      coverage:batterySummary.total>0?1:0
    },
    detail:`battery=${batterySummary.passed||0}/${batterySummary.total||0}; assimilation=${assimilation?.decision||'missing'}; final-only=true`
  });
  return {
    schema:'laliga-feedback-cycle/v1',
    version:FEEDBACK_CYCLE_VERSION,
    at:new Date().toISOString(),
    policy:{finalOnly:true,selfWriteToBrain:false,humanEvidenceRequired:true,boundedCultivation:true},
    inputs:{batteryPresent:Boolean(battery),assimilationPresent:Boolean(assimilation)},
    decision:accepted?'learn':'hold',
    feedback,
    nextAction:accepted?'promote only verified observations on the next supervised cycle':'repair/collect evidence before learning'
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const report=runFeedbackCycle();
  fs.writeFileSync('feedback-cycle-report.json',JSON.stringify(report,null,2),'utf8');
  console.log(`FEEDBACK CYCLE v1: ${report.decision} · cultivation=${report.feedback.cycles}`);
  process.exitCode=report.decision==='learn'?0:1;
}
