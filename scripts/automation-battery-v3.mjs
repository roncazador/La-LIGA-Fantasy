import { spawnSync } from 'node:child_process';
import { writeBatteryFeedback } from './brain-battery-feedback-v1.mjs';
const run=spawnSync(process.execPath,['scripts/automation-battery-v2.mjs'],{stdio:'inherit',encoding:'utf8'});
let feedbackError=null;
try{const feedback=writeBatteryFeedback();console.log(`BRAIN BATTERY FEEDBACK: learned=${feedback.learned} cultivationScore=${feedback.cultivation.score}`)}catch(error){feedbackError=error;console.error(`[brain-battery-feedback] ${error.message}`)}
if(feedbackError)process.exitCode=run.status===0?1:run.status||1;else process.exitCode=run.status??1;
