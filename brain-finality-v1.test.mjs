import assert from 'node:assert/strict';
import fs from 'node:fs';

const host=fs.readFileSync('./brain-host-v27.mjs','utf8');
let n=0;const check=(ok,msg)=>{n++;assert.ok(ok,`FINALITY-${String(n).padStart(2,'0')}: ${msg}`)};
check(host.includes('function markerTrue(value)'), 'finality marker helper exists');
check(host.includes("['complete','completed','closed','final','finished'].includes(normalized)"), 'accepted final status strings are explicit');
check(host.includes('week.completed,week.isCompleted,week.closed,week.final,week.finished,week.status,week.state'), 'dashboard checks boolean and status/state markers');
check(host.includes('const weekComplete=weekIsFinal(payload?.week)'), 'dashboard uses hardened finality gate');

const markerTrue=value=>value===true||['complete','completed','closed','final','finished'].includes(String(value??'').trim().toLowerCase());
const weekIsFinal=week=>Boolean(week&&[week.completed,week.isCompleted,week.closed,week.final,week.finished,week.status,week.state].some(markerTrue));
check(markerTrue(true), 'boolean true is final');
check(markerTrue('completed'), 'completed status is final');
check(markerTrue('CLOSED'), 'case-insensitive closed status is final');
check(markerTrue(' final '), 'whitespace around final status is tolerated');
check(weekIsFinal({status:'finished'}), 'finished week status closes the outcome');
check(weekIsFinal({state:'complete'}), 'complete week state closes the outcome');
check(!markerTrue(false), 'boolean false is not final');
check(!markerTrue('false'), 'false string is not final');
check(!markerTrue('pending'), 'pending is not final');
check(!weekIsFinal({status:'pending'}), 'pending week cannot train the final path');
console.log(`brain-finality-v1: ${n}/${n} checks OK`);
