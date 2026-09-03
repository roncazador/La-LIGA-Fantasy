import fs from 'node:fs';import assert from 'node:assert/strict';
const ui=fs.readFileSync('teams-directory-filter-v1.js','utf8');
assert.match(ui,/\#teamsDataV5/);assert.match(ui,/tv5s/);assert.match(ui,/addEventListener\('input'/);assert.match(ui,/N\(name\)\.includes\(q\)/);assert.match(ui,/tv5count/);assert.match(ui,/No hay equipos que coincidan/);assert.match(ui,/row\.hidden=!show/);console.log('teams-directory-filter-v1: 7 checks OK');
