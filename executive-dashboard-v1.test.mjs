import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('./executive-dashboard-v1.js','utf8');

assert.ok(ui.includes('const TECH_SCHEDULED=new Set'), 'scheduled status normalization missing');
assert.ok(ui.includes("return'PRÓXIMO'"), 'scheduled statuses must render as PRÓXIMO');
assert.ok(ui.includes("return'FINALIZADO'"), 'final statuses must render as FINALIZADO');
assert.ok(ui.includes("return'EN DIRECTO'"), 'live statuses must render as EN DIRECTO');
assert.ok(ui.includes('TECH_BLOCKED'), 'blocked status normalization missing');
assert.ok(ui.includes("'APLAZADO'"), 'postponed status must render as APLAZADO');
assert.ok(ui.includes("'CANCELADO'"), 'cancelled status must render as CANCELADO');
assert.ok(ui.includes('function fixtureDate'), 'calendar date formatter missing');
assert.ok(ui.includes("timeZone:'Europe/Madrid'"), 'calendar dates must be rendered in Spain timezone');
assert.ok(ui.includes("fixtureDate(m)} · ${esc(fixtureStatus(m.status))}"), 'calendar cards must use safe date/status formatters');
assert.ok(!ui.includes("first(m.date,m.utcDate,m.kickoff,'Sin fecha')"), 'raw calendar date rendering leaked back into dashboard');

console.log('EXECUTIVE DASHBOARD v1: calendar date/status presentation contract OK');
