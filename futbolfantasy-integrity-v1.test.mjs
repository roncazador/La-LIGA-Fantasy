import assert from 'node:assert/strict';
import { canonicalTeamName, sanitizeFutbolFantasyBundle } from './futbolfantasy-integrity-v1.mjs';

const expectedTeams = [
  'Alavés','Athletic','Atlético','Barcelona','Betis','Celta','Elche','Espanyol','Getafe',
  'Levante','Málaga','Osasuna','Rayo','R. Racing Club','RC Deportivo','Real Madrid',
  'Real Sociedad','Sevilla','Valencia','Villarreal'
];

assert.deepEqual(expectedTeams, [...new Set(expectedTeams)]);
assert.equal(expectedTeams.length,20);
for (const [input,expected] of [
  ['FC Barcelona','Barcelona'],['Atlético de Madrid','Atlético'],['CA Osasuna','Osasuna'],
  ['RCD Espanyol de Barcelona','Espanyol'],['Real Betis','Betis'],['Málaga CF','Málaga'],
  ['R. Racing Club','R. Racing Club'],['Racing Santander','R. Racing Club'],
  ['RC Deportivo','RC Deportivo'],['Deportivo de La Coruña','RC Deportivo'],
  ['Real Madrid','Real Madrid']
]) assert.equal(canonicalTeamName(input),expected,input);
assert.equal(canonicalTeamName('Girona'),null);
assert.equal(canonicalTeamName('Mallorca'),null);
assert.equal(canonicalTeamName('Real Oviedo'),null);

const raw = {
  pages:[
    {kind:'lineups',status:200,ok:true},
    {kind:'injuries',status:502,ok:false},
    {kind:'points',status:200,ok:true}
  ],
  matches:[
    {
      home:'FC Barcelona',away:'Real Madrid',
      players:[
        {name:'Jugador Uno',team:'Barcelona',probability:80},
        {name:'Jugador Uno',team:'FC Barcelona',probability:75},
        {name:'Jugador Dos',team:null,probability:70}
      ],
      lineups:{
        home:[{name:'Jugador Uno',team:'Barcelona'},{name:'Jugador Dos'}],
        away:[{name:'Jugador Uno',team:'FC Barcelona'},{name:'Jugador Dos'}]
      }
    },
    {home:'Barcelona',away:'Real Madrid',players:[] ,lineups:{home:[],away:[]}}
  ],
  references:[],
  players:[
    {name:'Jugador Uno',team:'Barcelona',rating:7.2},
    {name:'Jugador Uno',team:'FC Barcelona',rating:7.5},
    {name:'Jugador Sin Equipo',team:null}
  ],
  injuries:[{player:'Jugador Uno',team:'FC Barcelona',status:'duda'}],
  points:[{name:'Jugador Uno',team:'FC Barcelona',points:4}],
  stats:[{team:'FC Barcelona',values:[1,2]}]
};

const out = sanitizeFutbolFantasyBundle(raw);
assert.equal(out.matches.length,1);
assert.equal(out.matches[0].home,'Barcelona');
assert.equal(out.matches[0].away,'Real Madrid');
assert.equal(out.matches[0].players.length,1);
assert.equal(out.matches[0].lineups.home.length,1);
assert.equal(out.matches[0].lineups.away.length,0);
assert.equal(out.players.length,1);
assert.equal(out.integrity.sourceOkCount,2);
assert.equal(out.integrity.sourceFailedCount,1);
assert.equal(out.integrity.partialSources,true);
assert.equal(out.integrity.noSuccessfulSources,false);
assert.ok(out.integrity.droppedPlayers >= 1);
assert.ok(out.integrity.dedupedPlayers >= 1);
assert.ok(out.integrity.droppedMatches >= 1);
console.log('FUTBOLFANTASY INTEGRITY v1: 20-team identity, dedupe, lineup isolation and source-health assertions passed');
