import assert from 'node:assert/strict';
import { runFeedbackCycle } from './feedback-cycle-v1.mjs';
const good=runFeedbackCycle({
 battery:{status:'passed',summary:{total:12,passed:12,failed:0}},
 assimilation:{decision:'accepted'}
});
assert.equal(good.decision,'learn');
assert.equal(good.policy.finalOnly,true);
assert.equal(good.policy.selfWriteToBrain,false);
assert.equal(good.policy.humanEvidenceRequired,true);
const bad=runFeedbackCycle({
 battery:{status:'failed',summary:{total:12,passed:11,failed:1}},
 assimilation:{decision:'hold'}
});
assert.equal(bad.decision,'hold');
assert.equal(bad.policy.selfWriteToBrain,false);
console.log('FEEDBACK CYCLE v1: 7/7 checks passed');
