import assert from 'node:assert/strict';
import fs from 'node:fs';

const teams=fs.readFileSync('./teams-data-v5.js','utf8');
const detail=fs.readFileSync('./teams-detail-v1.js','utf8');
let n=0;const check=(ok,msg)=>{n++;assert.ok(ok,`REAL-DATA-${String(n).padStart(2,'0')}: ${msg}`)};

check(teams.includes("const num=v=>Number.isFinite(Number(v))?Number(v):null"),'team data numeric normalizer returns null for missing/invalid values');
check(teams.includes("${t.points??'—'}"),'classification renders unknown points with an em dash');
check(teams.includes("${t.played??'—'}"),'classification renders unknown played matches with an em dash');
check(teams.includes("${x.rating??'—'}"),'player rating keeps unknown data explicit');
check(teams.includes("${x.goals??'—'}")&&teams.includes("${x.assists??'—'}"),'player goal/assist unknown values stay explicit');

check(detail.includes("const teamsReady=out[0].status==='fulfilled',standReady=out[1].status==='fulfilled',playersReady=out[2].status==='fulfilled',fixtureReady=out[3].status==='fulfilled'"),'detail view tracks endpoint readiness independently');
check(detail.includes("${playersReady?ps.length:'—'}"),'team roster count is unknown when the players endpoint failed');
check(detail.includes("${fixtureReady?fs.length:'—'}"),'fixture count is unknown when the fixtures endpoint failed');
check(detail.includes("f(x.status,'Estado no disponible')"),'missing fixture status does not fall back to a date or fabricated state');
check(!detail.includes("f(x.status,x.date,'—')"),'fixture status never displays the raw date as a status');
check(!detail.includes("${ps.length||'—'}"),'team roster count does not convert a known zero into an ambiguous fallback');
check(!detail.includes("${fs.length}</div>"),'fixture count is gated by endpoint readiness');

check(teams.includes("status:f(x.status,'Estado no disponible')"),'team calendar renders an explicit unknown status when the API omits status');
check(!teams.includes("status:f(x.status,'PROGRAMADO')"),'team calendar never fabricates PROGRAMADO when status is absent');
check(teams.includes("const a=[...(raw?.merged||[]),...(raw?.matches||[]),...(raw?.fixtures||[])]"),'calendar preserves supported API response shapes');

console.log(`real-data-integrity-v1: ${n}/${n} checks OK`);