import fs from 'node:fs';
import assert from 'node:assert/strict';
import { daysWindow, fixtureKey, normalizeApiFootball, normalizeFootballData, normalizeSportmonks } from './providers.mjs';

const source=fs.readFileSync('providers.mjs','utf8');
assert.match(source,/homeScore/);
assert.match(source,/awayScore/);
assert.match(source,/slice\(0,10\)/);
assert.match(source,/providerRank/);
assert.match(source,/candidate\.homeScore/);
assert.match(source,/candidate\.awayScore/);

const win=daysWindow(30);
const span=new Date(`${win.to}T00:00:00Z`).getTime()-new Date(`${win.from}T00:00:00Z`).getTime();
assert.equal(Math.round(span/86400000),30);
assert.equal(daysWindow(500).to,new Date(`${win.from}T00:00:00Z`.replace('T00:00:00Z','T00:00:00Z')).toISOString().slice(0,10));

const football=normalizeFootballData({matches:[{id:1,utcDate:'2026-09-05T18:00:00Z',homeTeam:{name:'Real Madrid',id:1},awayTeam:{name:'FC Barcelona',id:2},status:'FINISHED',score:{fullTime:{home:2,away:1}},matchday:4}]})[0];
assert.equal(football.homeScore,2);
assert.equal(football.awayScore,1);
const api=normalizeApiFootball({response:[{fixture:{id:2,date:'2026-09-05T18:07:00Z',status:{short:'FT'}},teams:{home:{name:'Real Madrid',id:1},away:{name:'FC Barcelona',id:2}},goals:{home:2,away:1},league:{id:140,round:'Regular Season - 4'}}]})[0];
assert.equal(api.homeScore,2);
assert.equal(api.awayScore,1);
const sport=normalizeSportmonks({data:[{id:3,starting_at:'2026-09-05T20:00:00Z',participants:[{name:'Real Madrid',id:1,meta:{location:'home'}},{name:'FC Barcelona',id:2,meta:{location:'away'}}],state:{short_name:'FT'},scores:{home:{current:3},away:{current:2}}}]})[0];
assert.equal(sport.homeScore,3);
assert.equal(sport.awayScore,2);
assert.equal(fixtureKey(football),fixtureKey(api));
assert.notEqual(fixtureKey(football),fixtureKey({...football,home:'Sevilla FC'}));

console.log('providers-results-integrity-v1: 16 checks OK');
