import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader=fs.readFileSync('./connection-client.js','utf8');
const config=fs.readFileSync('./config.mjs','utf8');

const activeCalendar=[...loader.matchAll(/loadInline\('\/calendar-[^']+\.js'/g)].map(m=>m[0]);
assert.deepEqual(activeCalendar,["loadInline('/calendar-autonomous-v35.js'","loadInline('/calendar-focus-v1.js'","loadInline('/calendar-focus-fix-v1.js'"]);
assert.ok(loader.includes("loadInline('/calendar-autonomous-v35.js'"),'calendar shell must remain active');
assert.ok(loader.includes("loadInline('/calendar-focus-v1.js'"),'calendar interaction core must remain active');
assert.ok(loader.includes("loadInline('/calendar-focus-fix-v1.js'"),'team-name boundary bridge must remain active');
assert.ok(loader.includes("loadInline('/match-center-ui-v1.js'"),'match center presentation must remain active');
assert.ok(!loader.includes("loadInline('/match-detail-ui-v31.js'"),'legacy match-detail loader must stay inactive');
assert.ok(!loader.includes("loadInline('/teams-detail-v1.js'"),'legacy team-detail loader must stay inactive');
assert.ok(config.includes("'/match-detail-ui-v31.js'"),'legacy asset remains available for compatibility/tests');
assert.ok(config.includes("'/teams-detail-v1.js'"),'legacy asset remains available for compatibility/tests');
console.log('CALENDAR STACK INTEGRITY v1: one calendar shell, one interaction core, one identity bridge, legacy detail loaders disabled');
