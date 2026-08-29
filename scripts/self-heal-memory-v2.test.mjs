import assert from 'node:assert/strict';
import { failureFingerprint, canAttempt, learnFailure, learnRepair, recall } from './self-heal-memory-v2.mjs';

const base={version:1,updatedAt:null,repairs:[],failures:[]};
const logsA='AssertionError: calendar failed at 2026-08-29T16:00:00Z run_id 123';
const logsB='AssertionError: calendar failed at 2026-08-29T17:00:00Z run_id 999';
const fpA=failureFingerprint('Project tests',logsA),fpB=failureFingerprint('Project tests',logsB);
assert.equal(fpA,fpB);
let memory=learnFailure(base,{workflow:'Project tests',signature:logsA,outcome:'unrepaired',at:new Date().toISOString()});
assert.equal(memory.version,'2.0.0');
assert.equal(canAttempt(memory,fpA,{maxAttempts24h:2}).ok,true);
memory=learnFailure(memory,{workflow:'Project tests',signature:logsA,outcome:'unrepaired',at:new Date().toISOString()});
assert.equal(canAttempt(memory,fpA,{maxAttempts24h:2}).reason,'COOLDOWN');
memory=learnRepair(memory,{workflow:'Project tests',signature:logsA,outcome:'tests-passed',fixedAt:new Date().toISOString()});
assert.equal(canAttempt(memory,fpA,{maxAttempts24h:9}).reason,'ALREADY_FIXED');
const r=recall(memory,'Project tests',logsB);
assert.equal(r.fingerprint,fpA);assert.equal(r.successful.outcome,'tests-passed');
console.log('SELF-HEAL MEMORY v2: 5/5 assertions passed');
