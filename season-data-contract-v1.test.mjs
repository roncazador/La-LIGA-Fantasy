import assert from 'node:assert/strict';
import fs from 'node:fs';

const currentTeams = [
  'Alavés','Athletic','Atlético','Barcelona','Betis','Celta','Elche','Espanyol','Getafe',
  'Levante','Málaga','Osasuna','Rayo','R. Racing Club','RC Deportivo','Real Madrid',
  'Real Sociedad','Sevilla','Valencia','Villarreal'
];
const staleTeams = ['Girona','Mallorca','Real Oviedo'];
const files = [
  'realdata.mjs',
  'futbolfantasy-integrity-v1.mjs',
  'futbolfantasy-normalizer-v33.mjs',
  'teams-data-v5.js',
  'calendar-focus-v1.js',
  'calendar-focus-fix-v1.js',
  'official-standings-seed-2026-27.json'
];

assert.equal(new Set(currentTeams).size,20);
for (const file of files) {
  const text=fs.readFileSync(`./${file}`,'utf8');
  for (const stale of staleTeams) assert.ok(!text.includes(stale),`${file} contains stale club ${stale}`);
}
const seed=JSON.parse(fs.readFileSync('./official-standings-seed-2026-27.json','utf8'));
const seeded=seed.standings.map(x=>x.team);
assert.equal(seeded.length,20);
assert.equal(new Set(seeded).size,20);
for(const team of ['Deportivo Alavés','Athletic Club','Atlético de Madrid','FC Barcelona','Real Betis','Málaga CF','R. Racing Club','RC Deportivo','Real Madrid']) {
  assert.ok(seeded.includes(team),`missing current club in standings seed: ${team}`);
}
for(const stale of staleTeams) assert.ok(!seeded.includes(stale),`stale club in standings seed: ${stale}`);
console.log('SEASON DATA CONTRACT v1: current-season roster consistent across core data layers and fallback seed');
