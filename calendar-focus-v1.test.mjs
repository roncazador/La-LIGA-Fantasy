import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('./calendar-focus-v1.js','utf8');
const conn=fs.readFileSync('./connection-client.js','utf8');
const config=fs.readFileSync('./config.mjs','utf8');

for(const token of [
  "'/api/futbolfantasy/data'",
  "'/api/data/standings'",
  "'/api/fixtures'",
  "'/api/data/players'",
  'Titulares probables',
  'Suplentes candidatos',
  'media Fantasy estimada',
  'Estado de jugadores',
  'Posible XI',
  'Bajas/dudas',
  'cfteamtable',
  'refreshStandings'
]) assert.ok(ui.includes(token),`missing ${token}`);
assert.ok(conn.includes("'/calendar-focus-v1.js'"),'focus layer not loaded');
assert.ok(config.includes("'/calendar-focus-v1.js'"),'focus layer not public');
assert.ok(ui.includes('No se muestran datos inventados'),'missing no-fabrication guard');
assert.ok(ui.includes('Las posibles puntuaciones'),'missing estimate disclaimer');

console.log('CALENDAR FOCUS v1: calendar match detail + live standings + team profile contracts OK');
