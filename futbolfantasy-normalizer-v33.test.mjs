import assert from 'node:assert/strict';
import { canonicalTeam, parsePercent, extractDataPlayers, extractMatchups, extractInjuries, normalizeBundle } from './futbolfantasy-normalizer-v33.mjs';

assert.equal(canonicalTeam('Real Madrid'),'Real Madrid');
assert.equal(canonicalTeam('  Atlético  '),'Atlético');
assert.equal(parsePercent('Titularidad 70%'),70);
assert.equal(parsePercent('101%'),null);

const lineupHtml=`<div data-player-name="Jugador Uno" data-team="Barcelona" data-position="MC" data-probability="90%" data-starter="true"></div>
<div data-player-name="Jugador Dos" data-team="Celta" data-position="DL" data-probability="40%"></div>
<h2>Barcelona - Celta</h2>`;
const players=extractDataPlayers(lineupHtml);
assert.equal(players.length,2);
assert.equal(players[0].probability,90);
assert.equal(players[0].probable,true);
assert.deepEqual(extractMatchups(lineupHtml),[{home:'Barcelona',away:'Celta'}]);

const injuryHtml='Image Barcelona 20% Jugador Uno Molestias en el tobillo Duda para la jornada';
const injuries=extractInjuries(injuryHtml);
assert.ok(injuries.length>=1);
assert.equal(injuries[0].probability,20);

const bundle=normalizeBundle([
  {kind:'lineups',url:'https://example.test/lineups',status:200,html:lineupHtml},
  {kind:'injuries',url:'https://example.test/injuries',status:200,html:injuryHtml}
],{now:new Date('2026-08-31T18:00:00Z')});
assert.equal(bundle.version,'3.3.0');
assert.equal(bundle.ok,true);
assert.equal(bundle.pages.length,2);
assert.equal(bundle.matches.length,1);
assert.ok(bundle.matches[0].evidence.length>=1);
assert.ok(bundle.players.length>=1);
console.log('FUTBOLFANTASY NORMALIZER v33: 12/12 assertions passed');
