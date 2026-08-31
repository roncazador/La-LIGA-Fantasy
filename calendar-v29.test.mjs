import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mergeCalendarSources } from './calendar-service-v29.mjs';
import { readConfig } from './config.mjs';
import { fixtureKey } from './providers.mjs';

const service=fs.readFileSync('./calendar-service-v29.mjs','utf8');
const host=fs.readFileSync('./brain-host-v27.mjs','utf8');
const client=fs.readFileSync('./calendar-autonomous-v30.js','utf8');
assert.ok(service.includes('fetchLaligaOfficialSeed'));
assert.ok(service.includes('https://www.laliga.com/calendar-2026-2027/laliga-easports'));
assert.ok(service.includes('apim.laliga.com/public-service/api/v1/matches'));
assert.ok(service.includes('laliga-easports-2026'));
assert.ok(host.includes('fetchLaligaOfficialSeed'));
assert.ok(host.includes("officialMode:sessionRaw.length?'authenticated':'auto-refreshed-seed'"));
assert.ok(client.includes('/api/calendar/autonomous'));
assert.ok(client.includes('15000'));
assert.ok(client.includes('MutationObserver'));
assert.ok(!client.includes("host.innerHTML=''"));

const official={source:'LALIGA oficial',matches:[{id:'1',utcDate:'2026-09-01T19:00:00Z',home:'Real Madrid',away:'Barcelona',status:'TIMED',matchday:4}]};
const ff={source:'futbolfantasy.com',matches:[{id:'ff1',utcDate:'2026-09-01T19:00:00Z',home:'Real Madrid',away:'Barcelona',status:'LIVE',matchday:4,homeScore:2,awayScore:1}]};
const merged=mergeCalendarSources([official,ff]);
assert.equal(merged.length,1);
assert.deepEqual(merged[0].sources,['LALIGA oficial','futbolfantasy.com']);
assert.equal(fixtureKey(merged[0]),fixtureKey(official.matches[0]));
assert.equal(merged[0].source,'LALIGA oficial');
assert.equal(merged[0].status,'LIVE');
assert.equal(merged[0].homeScore,2);
assert.equal(merged[0].awayScore,1);

const finalOfficial=mergeCalendarSources([{source:'LALIGA oficial',matches:[{utcDate:'2026-09-02T19:00:00Z',home:'A',away:'B',status:'FT',homeScore:3,awayScore:0}]},{source:'futbolfantasy.com',matches:[{utcDate:'2026-09-02T19:00:00Z',home:'A',away:'B',status:'LIVE',homeScore:2,awayScore:0}]}]);
assert.equal(finalOfficial[0].status,'FT');
assert.equal(finalOfficial[0].homeScore,3);
assert.equal(finalOfficial[0].awayScore,0);

const invalidScores=mergeCalendarSources([{source:'futbolfantasy.com',matches:[{utcDate:'2026-09-03T19:00:00Z',home:'A',away:'B',status:'LIVE',homeScore:-1,awayScore:200}]}]);
assert.equal(invalidScores[0].homeScore,null);
assert.equal(invalidScores[0].awayScore,null);

const cfg=readConfig({});
assert.equal(cfg.futbolFantasyUrl,'https://www.futbolfantasy.com');
assert.equal(cfg.laligaCompetitionId,'1');
console.log('Calendar v29 automatic official refresh regression: 100% passed');
