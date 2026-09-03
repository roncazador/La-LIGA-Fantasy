import assert from 'node:assert/strict';
import fs from 'node:fs';

const host=fs.readFileSync('./brain-host-v27.mjs','utf8');
const history=fs.readFileSync('./brain-history-v28.mjs','utf8');
const brain=fs.readFileSync('./brain-core-v27.mjs','utf8');
let n=0;const check=(ok,msg)=>{n++;assert.ok(ok,`FINAL-BRIDGE-${String(n).padStart(2,'0')}: ${msg}`)};
check(host.includes("const historyResult=history.observe(players,{source:'official',week,weekComplete,matchdayComplete:weekComplete,final:weekComplete})"),'official dashboard feeds player history');
check(host.includes('brain.ingestDashboard(payload,{source:\'official\',week,weekComplete,matchdayComplete:weekComplete})'),'official dashboard feeds Brain');
check(host.includes('brainLearned=${brainResult.learned}'),'bridge reports Brain learning count');
check(host.includes('historyRecorded=${historyResult.players}'),'bridge reports history recording count');
check(host.includes('final=${weekComplete}'),'bridge records finality state');
check(history.includes('s.final===true'),'history profiles only use final samples');
check(brain.includes('if(sample.final!==true)return{learned:false,reason:\'non-final-label\'}'),'Brain rejects non-final learning');
check(brain.includes('if(final&&weeklyPoints!=null&&prior)'),'Brain only closes pending prediction on final outcome');
check(brain.includes("source:'official'"),'Brain official ingestion path is preserved');
console.log(`brain-final-bridge-v1: ${n}/${n} checks OK`);
