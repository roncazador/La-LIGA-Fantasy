import assert from 'node:assert/strict';
import { canonicalTeam, parsePercent, extractDataPlayers, extractMatchups, extractInjuries, extractPlayerPoints, normalizeBundle } from './futbolfantasy-normalizer-v33.mjs';

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

const pointsHtml=`<table><tr><th>Jugador</th><th>Pts</th><th>PJ</th><th>Med</th></tr><tr><td>Jugador Uno</td><td>12</td><td>3</td><td>4</td></tr></table>`;
const pointRows=extractPlayerPoints(pointsHtml);
assert.equal(pointRows.length,1);
assert.equal(pointRows[0].points,12);

const injuryHtml='Image Barcelona 20% Jugador Uno Molestias en el tobillo Duda para la jornada';
const injuries=extractInjuries(injuryHtml);
assert.ok(injuries.length>=1);
assert.equal(injuries[0].probability,20);

const bundle=normalizeBundle([
  {kind:'lineups',url:'https://example.test/lineups',status:200,html:lineupHtml},
  {kind:'injuries',url:'https://example.test/injuries',status:200,html:injuryHtml},
  {kind:'points',url:'https://example.test/points',status:200,html:pointsHtml}
],{now:new Date('2026-08-31T18:00:00Z')});
assert.equal(bundle.version,'3.3.1');
assert.equal(bundle.ok,true);
assert.equal(bundle.pages.length,3);
assert.equal(bundle.matches.length,1);
assert.ok(bundle.matches[0].evidence.length>=1);
assert.equal(bundle.matches[0].lineups.home.length,1);
assert.equal(bundle.matches[0].lineups.away.length,1);
assert.ok(bundle.players.length>=2);
assert.equal(bundle.points.length,1);
console.log('FUTBOLFANTASY NORMALIZER v33: 16/16 assertions passed');
