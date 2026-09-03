import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('teams-directory-separation-v1.js','utf8');
assert.match(js,/active==='equipos'/);assert.match(js,/b\.textContent='Clasificación'/);assert.match(js,/b\.textContent='Calendario'/);assert.match(js,/td-ranking-view/);assert.match(js,/td-calendar-view/);assert.match(js,/Partidos y jornadas · sin datos de clasificación/);assert.match(js,/c\.remove\(\)/);assert.match(js,/Calendario separado en la pestaña/);assert.match(js,/Ver equipo/);console.log('teams-directory-separation-v1: 9 checks OK');
