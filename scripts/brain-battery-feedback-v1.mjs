import fs from 'node:fs';
import path from 'node:path';
import { createBrain } from '../brain-core-v27.mjs';
import { createCultivos } from '../cultivos-v1.mjs';

export const FEEDBACK_VERSION='1.0.0';
export function writeBatteryFeedback({reportPath='automation-battery-report.json',brainDir=process.env.BRAIN_STATE_DIR||'./.brain-data'}={}){
  const report=JSON.parse(fs.readFileSync(path.resolve(reportPath),'utf8'));
  const summary=report.summary||{};
  const feedback={schema:'laliga-brain-automation-feedback/v1',at:new Date().toISOString(),battery:{total:Number(summary.total)||0,passed:Number(summary.passed)||0,failed:Number(summary.failed)||0,successRate:Number(summary.successRate)||0},learningPolicy:'final-only',learned:false,writeTarget:'brain-learning-v27.jsonl'};
  const brain=createBrain({dir:brainDir});
  brain.log({type:'automation-battery-feedback',...feedback});
  const cultivos=createCultivos({dir:brainDir});
  const cultivation=cultivos.observe({source:'automation-battery',outcome:feedback.failed===0&&feedback.total>0?'success':'failure',dimensions:{automation:feedback.failed===0?2:-2,reliability:feedback.failed===0?1:-1,coverage:feedback.total>0?1:0},detail:`battery=${feedback.passed}/${feedback.total}; failed=${feedback.failed}; learned=false`});
  return {...feedback,cultivation};
}
