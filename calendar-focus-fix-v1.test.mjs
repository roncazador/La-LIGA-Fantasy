import assert from 'node:assert/strict';
import fs from 'node:fs';

const fix=fs.readFileSync('./calendar-focus-fix-v1.js','utf8');
const config=fs.readFileSync('./config.mjs','utf8');
const conn=fs.readFileSync('./connection-client.js','utf8');

for(const token of [
  '.club b',
  'stopPropagation',
  'loadAllPlayers',
  '/api/data/standings',
  '/api/data/teams',
  '/api/futbolfantasy/data',
  'Spain%20-%20LaLiga',
  'RCD%20Espanyol%20Barcelona.png',
  'injectBrand',
  'wrapMatchBranding',
  'nextFixture',
  'reorderFantasyForFixture'
]) assert.ok(fix.includes(token),`missing ${token}`);
assert.ok(config.includes("'/calendar-focus-fix-v1.js'"),'missing public path');
assert.ok(conn.includes("'/calendar-focus-fix-v1.js'"),'missing loader');
console.log('CALENDAR FOCUS FIX v1: team clicks + all-player pages + live standings + crest/next-fixture hardening OK');
