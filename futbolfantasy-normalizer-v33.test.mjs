import assert from 'node:assert/strict';
import { canonicalTeam, parsePercent, extractDataPlayers, extractMatchups, extractInjuries, extractPlayerPoints, normalizeBundle } from './futbolfantasy-normalizer-v33.mjs';

assert.equal(canonicalTeam('Real Madrid'),'Real Madrid');
assert.equal(canonicalTeam('  Atlético  '),'Atlético');
for (const [input,expected] of [
  ['Málaga CF','Málaga'],['Racing Santander','R. Racing Club'],['RC Deportivo','RC Deportivo'],
  ['FC Barcelona','Barcelona'],['RCD Espanyol de Barcelona','Espanyol']
]) assert.equal(canonicalTeam(input),expected,input);
assert.equal(canonicalTeam('Girona'),null);
assert.equal(canonicalTeam('Mallorca'),null);
assert.equal(canonicalTeam('Real Oviedo'),null);
assert.equal(parsePercent('Titularidad 70%'),70);
assert.equal(parsePercent('101%'),null);

const lineupHtml=`<div data-player-name="Jugador Uno" data-team="Barcelona" data-position="MC" data-probability="90%" data-starter="true"></div>
<div data-player-name="Jugador Dos" data-team="Celta" data-position="DL" data-probability="40%"></div>
<div data-player-name="Jugador Dos" data-team="Barcelona" data-position="DL" data-probability="40%"></div>
<div data-player-name="Jugador Sin Equipo" data-position="DL" data-probability="99%"></div>
<h2>Barcelona - Celta</h2>`;
const players=extractDataPlayers(lineupHtml);
assert.equal(players.length,4);
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
assert.equal(bundle.matches[0].lineups.home.length,2);
assert.equal(bundle.matches[0].lineups.away.length,1);
assert.ok(bundle.players.length>=3);
assert.equal(bundle.points.length,1);

const degraded=normalizeBundle([
  {kind:'lineups',url:'https://example.test/lineups',status:200,html:lineupHtml},
  {kind:'injuries',url:'https://example.test/injuries',status:502,html:''}
]);
assert.equal(degraded.ok,false);
assert.equal(degraded.pages.filter(x=>x.ok).length,1);
assert.equal(degraded.pages.filter(x=>!x.ok).length,1);
assert.equal(degraded.matches[0].lineups.home.length,2);
assert.equal(degraded.matches[0].lineups.away.length,1);
assert.ok(!degraded.matches[0].lineups.home.some(x=>!x.team));
assert.ok(!degraded.matches[0].lineups.away.some(x=>!x.team));

console.log('FUTBOLFANTASY NORMALIZER v33: current-team aliases, parser, duplicate isolation and source-health assertions passed');
