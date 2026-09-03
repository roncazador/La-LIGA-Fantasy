import assert from 'node:assert/strict';
import fs from 'node:fs';

const core=fs.readFileSync('./calendar-focus-v1.js','utf8');
const seed=JSON.parse(fs.readFileSync('./official-standings-seed-2026-27.json','utf8'));
const names=new Set(seed.standings.map(x=>x.team));

assert.equal(seed.season,'2026-27','standings seed season mismatch');
assert.equal(seed.source,'LALIGA oficial','standings seed source mismatch');
assert.equal(seed.standings.length,20,'standings seed must contain 20 clubs');
assert.equal(names.size,20,'duplicate clubs in standings seed');
for(const row of seed.standings){
  assert.ok(Number.isInteger(row.rank)&&row.rank>=1&&row.rank<=20,`invalid rank for ${row.team}`);
  for(const key of ['points','played','wins','draws','losses','goalsFor','goalsAgainst','goalDiff']) assert.ok(Number.isFinite(Number(row[key])),`missing ${key} for ${row.team}`);
  assert.equal(row.goalDiff,row.goalsFor-row.goalsAgainst,`goal difference mismatch for ${row.team}`);
  assert.equal(row.played,row.wins+row.draws+row.losses,`match result totals mismatch for ${row.team}`);
}
assert.ok(core.includes("'/official-standings-seed-2026-27.json'"),'core standings fallback missing');
assert.ok(core.includes('No se muestran datos inventados.'),'no-fabrication disclaimer missing');
console.log('CALENDAR DATA INTEGRITY v1: 20-club standings seed and fallback contracts OK');
