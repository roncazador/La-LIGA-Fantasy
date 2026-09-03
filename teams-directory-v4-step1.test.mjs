import fs from 'node:fs';
import assert from 'node:assert/strict';

const directory=fs.readFileSync('teams-directory-completeness-v1.js','utf8');
const expected=['Athletic Club','Atlético de Madrid','CA Osasuna','Celta','Deportivo Alavés','Elche CF','FC Barcelona','Getafe CF','Levante UD','Málaga CF','R. Racing Club','Rayo Vallecano','RC Deportivo','RCD Espanyol de Barcelona','Real Betis','Real Madrid','Real Sociedad','Sevilla FC','Valencia CF','Villarreal CF'];

assert.match(directory,/const CLUBS=\[/);
assert.equal((directory.match(/'[^']+'/g)||[]).filter(x=>expected.includes(x.slice(1,-1))).length,20);
for(const club of expected)assert.ok(directory.includes(`'${club}'`),`missing club: ${club}`);
assert.match(directory,/return CLUBS\.map/);
assert.match(directory,/if\(ts\.length===20\)patch\(ts\)/);
assert.match(directory,/x\.rank\?\?'—'/);
assert.match(directory,/x\.points\?\?'—'/);
console.log('teams-directory-v4-step1: 20-team identity/data fallback contract OK');
