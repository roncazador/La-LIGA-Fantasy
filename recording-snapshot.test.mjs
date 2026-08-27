import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('./data-client.js', 'utf8');

assert.equal(source.includes('RECORDING_SNAPSHOT'), true);
assert.equal(source.includes("file: 'ScreenRecording_08-27-2026 11-32-03_1.mp4'"), true);
assert.equal(source.includes("username: 'roncazador'"), true);
assert.equal(source.includes('pfsY: 109'), true);
assert.equal(source.includes('teamValue: 269039595'), true);
assert.equal(source.includes("manager: 'FarlaAcademy', pfsY: 105"), true);
assert.equal(source.includes("manager: 'Jonymessi', pfsY: 78"), true);
assert.equal(source.includes("manager: 'SURIKTO97', pfsY: 75"), true);
assert.equal(source.includes("manager: '⚽saugarrr 😈', pfsY: 69"), true);
assert.equal(source.includes("name: 'Mikautadze', pos: 'DEL', pfsY: 23"), true);
assert.equal(source.includes("name: 'Le Normand', pos: 'DEF', pfsY: 8"), true);
assert.equal(source.includes('marketBalance: 40542121'), true);
assert.equal(source.includes("player: 'Álex Balde'"), true);
assert.equal(source.includes('amount: 25001999'), true);
assert.equal(source.includes("player: 'Vlachodimos'"), true);
assert.equal(source.includes('amount: 25947108'), true);
assert.equal(source.includes("type: 'no-score'"), true);
assert.equal(source.includes('Piotrekatletico'), true);
assert.equal(source.includes("date: '2026-07-29'"), true);

const recordingRows = (source.match(/type: 'market'/g) || []).length;
assert.ok(recordingRows >= 35, `Se esperan al menos 35 operaciones visibles, hay ${recordingRows}`);

console.log(`OK: snapshot de grabacion validado (${recordingRows} operaciones visibles)`.trim());
