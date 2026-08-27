import assert from 'node:assert/strict';
import fs from 'node:fs';

const ref = JSON.parse(fs.readFileSync('./recording-data-2026-08-27.json','utf8'));
const calendar = fs.readFileSync('./calendar-client.js','utf8');
const recordingClient = fs.readFileSync('./recording-client.js','utf8');
const dataClient = fs.readFileSync('./data-client.js','utf8');
const config = fs.readFileSync('./config.mjs','utf8');
const index = fs.readFileSync('./index.html','utf8');

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

/* 1-20: snapshot/metadata */
check('capturedAt presente', ref.capturedAt === '2026-08-27T11:32:00+02:00');
check('snapshot no LIVE', ref.status === 'referencia_observada_no_live');
check('competición presente', ref.competition === 'La Liga');
check('jornada presente', ref.matchday === 3);
check('recompensa correcta', ref.reward === 100000);
check('saldo mercado correcto', ref.marketBalance === 40542121);
check('valor equipo correcto', ref.teamValue === 269039595);
check('plantilla 20/24', ref.teamCount === '20/24 fichas');
check('ranking array', Array.isArray(ref.standings));
check('ranking no vacío', ref.standings.length > 0);
check('roncazador existe', ref.standings.some(x => x.manager === 'roncazador'));
check('roncazador #1', ref.standings.find(x => x.manager === 'roncazador')?.rank === 1);
check('roncazador 109 PFSY', ref.standings.find(x => x.manager === 'roncazador')?.pfsy === 109);
check('FarlaAcademy 105', ref.standings.find(x => x.manager === 'FarlaAcademy')?.pfsy === 105);
check('Jonymessi 78', ref.standings.find(x => x.manager === 'Jonymessi')?.pfsy === 78);
check('SURIKT097 75', ref.standings.find(x => x.manager === 'SURIKT097')?.pfsy === 75);
check('saugarr 69', ref.standings.find(x => x.manager === 'saugarr')?.pfsy === 69);
check('AlvaroNP96 52', ref.standings.find(x => x.manager === 'AlvaroNP96')?.pfsy === 52);
check('kubakar 27', ref.standings.find(x => x.manager === 'kubakar')?.pfsy === 27);
check('Akm90 27', ref.standings.find(x => x.manager === 'Akm90')?.pfsy === 27);

/* 21-35: mi equipo */
const me = ref.rostersVisible?.roncazador || [];
check('mi roster es array', Array.isArray(me));
check('mi roster tiene 7 visibles', me.length === 7);
for (const name of ['Germán','Noubi','Zubeldia','Aramburu','Fermín','Óscar Valentín','Cala']) check(`roncazador ${name}`, me.some(x => x.name === name));
check('Fermín 19', me.find(x => x.name === 'Fermín')?.pfsy === 19);
check('Óscar 7', me.find(x => x.name === 'Óscar Valentín')?.pfsy === 7);
check('Cala 11', me.find(x => x.name === 'Cala')?.pfsy === 11);
check('Germán POR', me.find(x => x.name === 'Germán')?.position === 'POR');
check('Fermín MED', me.find(x => x.name === 'Fermín')?.position === 'CEN');
check('todos tienen disponibilidad', me.every(x => typeof x.availability === 'string' && x.availability));
check('todos tienen precio válido', me.every(x => Number.isFinite(x.price)));

/* 36-55: rivales */
const rivalGroups = ['Jonymessi','SURIKT097','saugarr','AlvaroNP96','kubakar'];
for (const manager of rivalGroups) check(`roster ${manager} array`, Array.isArray(ref.rostersVisible?.[manager]));
check('Aubameyang 20', ref.rostersVisible.Jonymessi?.find(x => x.name === 'Aubameyang')?.pfsy === 20);
check('Mikautadze 23', ref.rostersVisible.Jonymessi?.find(x => x.name === 'Mikautadze')?.pfsy === 23);
check('Valverde 15', ref.rostersVisible.SURIKT097?.find(x => x.name === 'Valverde')?.pfsy === 15);
check('Álvaro García 10', ref.rostersVisible.SURIKT097?.find(x => x.name === 'Álvaro García')?.pfsy === 10);
check('Dela 9', ref.rostersVisible.saugarr?.find(x => x.name === 'Dela')?.pfsy === 9);
check('C. Puga 8', ref.rostersVisible.saugarr?.find(x => x.name === 'C. Puga')?.pfsy === 8);
check('Le Normand suspendido', ref.rostersVisible.kubakar?.find(x => x.name === 'Le Normand')?.availability === 'Suspendido');
check('Dituro 4', ref.rostersVisible.kubakar?.find(x => x.name === 'M. Dituro')?.pfsy === 4);
check('jugadores rivales con posición', Object.values(ref.rostersVisible).flat().every(x => typeof x.position === 'string' && x.position));
check('jugadores rivales con PFSY numérico', Object.values(ref.rostersVisible).flat().every(x => Number.isFinite(x.pfsy)));
check('sin roster fantasma vacío no-array', Object.values(ref.rostersVisible).every(Array.isArray));

/* 56-65: mercado */
check('mercado array', Array.isArray(ref.marketListings));
check('3 anuncios observados', ref.marketListings.length === 3);
check('anuncio 1 sin nombre inventado', ref.marketListings[0]?.player == null);
check('Isaac precio', ref.marketListings.find(x => x.player === 'Isaac')?.price === 6460286);
check('Isaac valor', ref.marketListings.find(x => x.player === 'Isaac')?.value === 6665244);
check('Isaac 13 PFSY', ref.marketListings.find(x => x.player === 'Isaac')?.pfsy === 13);
check('Juan Iglesias precio', ref.marketListings.find(x => x.player === 'Juan Iglesias')?.price === 18000000);
check('Juan Iglesias dudoso', ref.marketListings.find(x => x.player === 'Juan Iglesias')?.status === 'Dudoso');
check('anuncios con dueño', ref.marketListings.every(x => typeof x.owner === 'string' && x.owner));
check('anuncios con precio', ref.marketListings.every(x => Number.isFinite(x.price)));

/* 66-72: actividad */
check('actividad array', Array.isArray(ref.recentActivity));
check('actividad 21 entradas', ref.recentActivity.length === 21);
check('actividad con fechas', ref.recentActivity.every(x => typeof x.date === 'string' && x.date));
check('actividad con tipo', ref.recentActivity.every(x => typeof x.type === 'string' && x.type));
check('Balde 25.001.999', ref.recentActivity.some(x => x.player === 'Álex Balde' && x.amount === 25001999));
check('Balliu 999.309', ref.recentActivity.some(x => x.player === 'Balliu' && x.amount === 999309));
check('Bartra 28.111.111', ref.recentActivity.some(x => x.player === 'Bartra' && x.amount === 28111111));

/* 73-84: frontend */
check('recording client carga JSON', recordingClient.includes("/recording-data-2026-08-27.json"));
check('recording client normaliza snapshot', recordingClient.includes('normalizeSnapshot'));
check('recording client dibuja mi equipo', recordingClient.includes('teamView'));
check('recording client dibuja rivales', recordingClient.includes('rivalsView'));
check('recording client dibuja mercado', recordingClient.includes('marketView'));
check('recording client dibuja actividad', recordingClient.includes('activityView'));
check('recording client hidrata KPIs', recordingClient.includes('topStats'));
check('recording client intenta LIVE', recordingClient.includes('/api/fantasy/dashboard'));
check('recording client etiqueta referencia', recordingClient.includes('REFERENCIA'));
check('calendar usa endpoint unificado', calendar.includes('/api/fixtures/next'));
check('calendar no-cache', calendar.includes("cache: 'no-store'"));
check('data client mantiene dashboard LIVE', dataClient.includes('api/fantasy/dashboard'));

/* 85-92: seguridad/compatibilidad */
const secret = /(?:x-apisports-key|YOUR_API_KEY|token_en_claro|Bearer\s+[A-Za-z0-9._-]{20,}|apiFootballKey\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"])/i;
check('recording client sin secretos', !secret.test(recordingClient));
check('calendar sin secretos', !secret.test(calendar));
check('data client sin secretos', !secret.test(dataClient));
check('config sin .env público', !config.includes("'/.env'"));
check('config permite recording client', config.includes("'/recording-client.js'"));
check('config permite recording JSON', config.includes("'/recording-data-2026-08-27.json'"));
check('index móvil', index.includes('@media(max-width:560px)'));
check('index navegación táctil', index.includes('overflow:auto'));

/* 93-100: invariantes finales */
check('todos los managers tienen rank', ref.standings.every(x => Number.isInteger(x.rank)));
check('todos los managers tienen nombre', ref.standings.every(x => typeof x.manager === 'string' && x.manager));
check('todos PFSY ranking numéricos', ref.standings.every(x => Number.isFinite(x.pfsy)));
check('snapshot tiene eventos visibles', Array.isArray(ref.eventsVisible) && ref.eventsVisible.includes('Operación de mercado'));
check('snapshot tiene recompensa visible', ref.eventsVisible.includes('Recompensa'));
check('snapshot tiene no puntuación', ref.eventsVisible.includes('No puntuación'));
check('snapshot tiene blindaje', ref.eventsVisible.includes('Blindaje'));
check('snapshot tiene nuevos miembros', ref.eventsVisible.includes('Nuevo miembro'));

assert.equal(checks.length, 100, `Se esperaban 100 comprobaciones y hay ${checks.length}`);
for (const [index, [label, ok]] of checks.entries()) assert.ok(ok, `UI-${String(index + 1).padStart(3,'0')}: ${label}`);
console.log('✅ Recording/UI contract tests: 100/100 passed');
