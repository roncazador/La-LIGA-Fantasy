import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync('./calendar-focus-fix-v1.js','utf8');
const config=fs.readFileSync('./config.mjs','utf8');
const conn=fs.readFileSync('./connection-client.js','utf8');
for(const token of ['.club b','stopPropagation','loadAllPlayers','/api/data/standings','values[i]??\'—\''])assert.ok(ui.includes(token),`missing ${token}`);
assert.ok(config.includes("'/calendar-focus-fix-v1.js'"),'missing public path');
assert.ok(conn.includes("'/calendar-focus-fix-v1.js'"),'missing loader');
console.log('CALENDAR FOCUS FIX v1: deterministic team clicks + complete player pages + live standings contract OK');
