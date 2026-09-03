import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge=fs.readFileSync('calendar-focus-fix-v1.js','utf8');
assert.match(bridge,/originalOpenTeam/);
assert.match(bridge,/cfteamextra/);
assert.match(bridge,/Siguiente partido/);
assert.match(bridge,/Jugadores recibidos/);
assert.match(bridge,/Lesiones recibidas/);
assert.match(bridge,/No hay datos de fuente/);
assert.match(bridge,/Date\\.parse\\(x\\.date\\)>=Date\\.now\\(\\)/,'next fixture must be future-only');
console.log('calendar-focus-team-detail-v1: ok');
