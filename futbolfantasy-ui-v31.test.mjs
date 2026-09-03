import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('futbolfantasy-ui-v30.js','utf8');

assert.match(source,/Estado de la fuente/);
assert.match(source,/Fuente OK/);
assert.match(source,/Datos degradados/);
assert.match(source,/Datos de respaldo/);
assert.match(source,/staleSections/);
assert.match(source,/sourceOkCount/);
assert.match(source,/partialSources/);
assert.match(source,/No se presentan estos registros como datos oficiales de LALIGA/);

console.log('futbolfantasy-ui-v31: trust-state contract ok');
