import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('./teams-data-v5.js','utf8');

for(const token of ['TECH_SCHEDULED','TECH_FINAL','TECH_LIVE','TECH_BLOCKED'])assert.ok(ui.includes(token),`missing ${token}`);
assert.ok(ui.includes("return'PRÓXIMO'"),'scheduled statuses must render as PRÓXIMO');
assert.ok(ui.includes("return'FINALIZADO'"),'final statuses must render as FINALIZADO');
assert.ok(ui.includes("return'EN DIRECTO'"),'live statuses must render as EN DIRECTO');
assert.ok(ui.includes("'APLAZADO'"),'postponed status must render as APLAZADO');
assert.ok(ui.includes("'CANCELADO'"),'cancelled status must render as CANCELADO');
assert.ok(ui.includes("timeZone:'Europe/Madrid'"),'calendar dates must use Spain timezone');
assert.ok(ui.includes('function fixtureDate'),'fixture date formatter missing');
assert.ok(ui.includes('fixtureDate(x)'),'match cards must use safe date formatting');
assert.ok(ui.includes('fixtureStatus(x.status)'),'match cards must use safe status formatting');
assert.ok(ui.includes("st!=='FINALIZADO'"),'future filter must exclude completed matches');
assert.ok(ui.includes("!['APLAZADO','CANCELADO'].includes(st)"),'future filter must exclude blocked matches');
assert.ok(ui.includes("st==='FINALIZADO'||st==='EN DIRECTO"),'recent filter must keep completed/live matches only');
assert.ok(!ui.includes(':x.status;'),'raw fixture status must not leak into match score/status');
assert.ok(!ui.includes('.format(new Date(d))'),'legacy timezone-free formatter must not return');
console.log('TEAM CALENDAR PRESENTATION v1: technical statuses/date leakage guarded');
