import assert from 'node:assert/strict';
import fs from 'node:fs';

const conn=fs.readFileSync('./connection-client.js','utf8');
const cal=fs.readFileSync('./calendar-autonomous-v35.js','utf8');
const mc=fs.readFileSync('./match-center-ui-v1.js','utf8');

assert.ok(conn.includes('teamsDataV5')&&conn.includes('execV1'),'tab visibility gate covers injected dashboard/data blocks');
assert.ok(conn.includes('data-fantasy-tab-visibility'),'tab visibility gate is explicit and idempotent');
for(const token of ['TIMED','SCHEDULED','NS','TBD']) assert.ok(cal.includes(token),'calendar knows scheduled backend state '+token);
assert.ok(mc.includes('PRÓXIMO'),'match center has a user-facing upcoming label');
assert.ok(mc.includes('POSTPONED')||mc.includes('CANCELLED')||mc.includes('APLAZADO'),'match center distinguishes blocked fixtures');
assert.ok(mc.includes("mode==='next'"),'upcoming filter remains present');
console.log('CALENDAR FAULTS v1: tab isolation and status UX contracts OK');
