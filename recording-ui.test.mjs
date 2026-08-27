import assert from 'node:assert/strict';
import fs from 'node:fs';

const ref = JSON.parse(fs.readFileSync('./video-reference-snapshot-2026-08-27.json', 'utf8'));
const calendar = fs.readFileSync('./calendar-client.js', 'utf8');
const dataClient = fs.readFileSync('./data-client.js', 'utf8');
const config = fs.readFileSync('./config.mjs', 'utf8');
const sw = fs.readFileSync('./sw.js', 'utf8');

const checks = [];
const check = (condition, label) => checks.push([label, Boolean(condition)]);

/* 1-25: snapshot contract */
check(typeof ref === 'object' && !Array.isArray(ref), 'snapshot objeto');
check(ref.source.includes('grabación'), 'snapshot identifica fuente');
check(ref.status === 'referencia_observada_no_live', 'snapshot no se declara LIVE');
check(ref.league === 'La Liga', 'liga correcta');
check(ref.competitionContext === 'LALIGA EA SPORTS', 'competición correcta');
check(ref.snapshot && typeof ref.snapshot === 'object', 'metadatos snapshot');
check(ref.snapshot.matchdayAtStart === 3, 'jornada inicial 3');
check(ref.snapshot.teamCount === '20/24 fichas', '20/24 fichas');
check(ref.snapshot.teamValue === 269039595, 'valor de plantilla');
check(ref.snapshot.dailyReward === 100000, 'recompensa');
check(ref.snapshot.marketBalance === 40542121, 'saldo mercado');
check(Array.isArray(ref.standingsVisible), 'clasificación array');
check(ref.standingsVisible.length === 9, '9 managers visibles');
check(ref.standingsVisible.every(x => Number.isInteger(x.rank)), 'ranks enteros');
check(new Set(ref.standingsVisible.map(x => x.rank)).size === ref.standingsVisible.length, 'ranks únicos');
check(ref.standingsVisible.every(x => typeof x.manager === 'string' && x.manager.length > 0), 'managers con nombre');
check(ref.standingsVisible.every(x => Number.isFinite(x.pfsy)), 'PFSY numérico');
check(ref.standingsVisible.find(x => x.manager === 'roncazador')?.rank === 1, 'roncazador primero');
check(ref.standingsVisible.find(x => x.manager === 'roncazador')?.pfsy === 109, 'roncazador 109 PFSY');
check(ref.standingsVisible.find(x => x.manager === 'FarlaAcademy')?.pfsy === 105, 'FarlaAcademy 105');
check(ref.standingsVisible.find(x => x.manager === 'Jonymessi')?.pfsy === 78, 'Jonymessi 78');
check(ref.standingsVisible.find(x => x.manager === 'SURIKT097')?.pfsy === 75, 'SURIKT097 75');
check(ref.standingsVisible.find(x => x.manager === 'saugarr')?.pfsy === 69, 'saugarr 69');
check(ref.standingsVisible.find(x => x.manager === 'AlvaroNP96')?.pfsy === 52, 'AlvaroNP96 52');
check(ref.standingsVisible.find(x => x.manager === 'kubakar')?.pfsy === 27, 'kubakar 27');

/* 26-55: rosters */
check(ref.rostersVisible && typeof ref.rostersVisible === 'object', 'rosters objeto');
check(Array.isArray(ref.rostersVisible.roncazador), 'roster propio array');
check(ref.rostersVisible.roncazador.length === 7, '7 jugadores legibles propios');
check(Array.isArray(ref.rostersVisible.Jonymessi), 'roster Jonymessi');
check(Array.isArray(ref.rostersVisible.SURIKT097), 'roster SURIKT097');
check(Array.isArray(ref.rostersVisible.saugarr), 'roster saugarr');
check(Array.isArray(ref.rostersVisible.AlvaroNP96), 'roster AlvaroNP96');
check(Array.isArray(ref.rostersVisible.kubakar), 'roster kubakar');
check(Object.values(ref.rostersVisible).every(Array.isArray), 'todos los rosters son arrays');
const allPlayers = Object.values(ref.rostersVisible).flat();
check(allPlayers.length > 20, 'más de 20 jugadores visibles');
check(allPlayers.every(x => typeof x.name === 'string' && x.name), 'todos tienen nombre');
check(allPlayers.every(x => typeof x.position === 'string' && x.position), 'todos tienen posición');
check(allPlayers.every(x => ['POR','DEF','CEN','DEL'].includes(x.position)), 'posiciones válidas');
check(allPlayers.every(x => Number.isFinite(x.pfsy)), 'PFSY jugadores numérico');
check(allPlayers.every(x => Number.isFinite(x.media)), 'media jugadores numérica');
check(allPlayers.every(x => x.price == null || Number.isFinite(x.price)), 'precios jugadores válidos');
check(allPlayers.every(x => ['Alineable','Suspendido'].includes(x.availability)), 'estados válidos');
check(allPlayers.some(x => x.name === 'Germán' && x.position === 'POR'), 'Germán visible');
check(allPlayers.some(x => x.name === 'Noubi' && x.position === 'DEF'), 'Noubi visible');
check(allPlayers.some(x => x.name === 'Zubeldia'), 'Zubeldia visible');
check(allPlayers.some(x => x.name === 'Aramburu'), 'Aramburu visible');
check(allPlayers.some(x => x.name === 'Fermín' && x.pfsy === 19), 'Fermín 19');
check(allPlayers.some(x => x.name === 'Óscar Valentín' && x.pfsy === 7), 'Óscar 7');
check(allPlayers.some(x => x.name === 'Cala' && x.pfsy === 11), 'Cala 11');
check(allPlayers.some(x => x.name === 'Mikautadze' && x.pfsy === 23), 'Mikautadze 23');
check(allPlayers.some(x => x.name === 'Aubameyang' && x.pfsy === 20), 'Aubameyang 20');
check(allPlayers.some(x => x.name === 'Valverde' && x.pfsy === 15), 'Valverde 15');
check(allPlayers.some(x => x.name === 'Le Normand' && x.availability === 'Suspendido'), 'Le Normand suspendido');
check(allPlayers.some(x => x.name === 'M. Dituro' && x.pfsy === 4), 'M. Dituro 4');
check(allPlayers.some(x => x.lockDays === 13), 'existe bloqueo 13 días');
check(allPlayers.some(x => x.lockDays === 14), 'existe bloqueo 14 días');
check(allPlayers.some(x => x.star === true), 'existen jugadores destacados');

/* 56-68: market/activity */
check(Array.isArray(ref.marketListings), 'mercado array');
check(ref.marketListings.length === 3, '3 anuncios visibles');
check(ref.marketListings.every(x => typeof x.owner === 'string' && x.owner), 'anuncios con dueño');
check(ref.marketListings.every(x => Number.isFinite(x.value)), 'anuncios con valor');
check(ref.marketListings.every(x => Number.isFinite(x.price)), 'anuncios con precio');
check(ref.marketListings.every(x => typeof x.status === 'string' && x.status), 'anuncios con estado');
check(ref.marketListings.some(x => x.player === 'Isaac' && x.pfsy === 13), 'Isaac 13 PFSY');
check(ref.marketListings.some(x => x.player === 'Isaac' && x.price === 6460286), 'Isaac 6.460.286');
check(ref.marketListings.some(x => x.player === 'Juan Iglesias' && x.status === 'Dudoso'), 'Juan Iglesias dudoso');
check(ref.marketListings.some(x => x.player === 'Juan Iglesias' && x.price === 18000000), 'Juan Iglesias 18M');
check(Array.isArray(ref.recentActivity) && ref.recentActivity.length > 15, 'histórico de actividad');
check(ref.recentActivity.every(x => typeof x.date === 'string' && x.date), 'actividad con fecha');
check(ref.recentActivity.every(x => typeof x.type === 'string' && x.type), 'actividad con tipo');
check(ref.recentActivity.some(x => x.player === 'Álex Balde' && x.amount === 25001999), 'Balde 25.001.999');

/* 69-85: visual/UI contract */
check(calendar.includes('/video-reference-snapshot-2026-08-27.json'), 'calendario carga snapshot');
check(calendar.includes('👤 Mi equipo'), 'UI mi equipo');
check(calendar.includes('👥 Rivales'), 'UI rivales');
check(calendar.includes('💰 Mercado'), 'UI mercado');
check(calendar.includes('📰 Actividad'), 'UI actividad');
check(calendar.includes('renderReferenceView'), 'render de referencia');
check(calendar.includes('marketBalance'), 'métrica saldo');
check(calendar.includes('dailyReward'), 'métrica recompensa');
check(calendar.includes('teamValue'), 'métrica valor');
check(calendar.includes('teamCount'), 'métrica 20/24');
check(calendar.includes("timeZone: 'Europe/Madrid'"), 'horario Madrid');
check(calendar.includes("cache: 'no-store'"), 'snapshot sin caché');
check(calendar.includes('La referencia visual nunca bloquea el calendario'), 'referencia no bloquea calendario');
check(dataClient.includes('/video-reference-snapshot-2026-08-27.json'), 'data client usa JSON único');
check(dataClient.includes('Mi equipo'), 'data client equipo');
check(dataClient.includes('Rivales'), 'data client rivales');

/* 86-100: hygiene/security */
check(dataClient.includes('Mercado'), 'data client mercado');
check(dataClient.includes('Actividad'), 'data client actividad');
check(dataClient.includes('Clasificación'), 'data client clasificación');
check(config.includes("'/video-reference-snapshot-2026-08-27.json'"), 'snapshot permitido por backend');
check(sw.includes('video-reference-snapshot-2026-08-27.json'), 'PWA incluye snapshot');
check(sw.includes('fm-v252'), 'cache PWA versionado');
check(!JSON.stringify(ref).match(/api[_-]?key|password|bearer\s+[A-Za-z0-9._-]{20,}/i), 'snapshot sin credenciales');
check(!calendar.match(/x-apisports-key|api[_-]?key|bearer\s+[A-Za-z0-9._-]{20,}/i), 'calendar sin credenciales');
check(!dataClient.match(/x-apisports-key|api[_-]?key|bearer\s+[A-Za-z0-9._-]{20,}/i), 'data client sin credenciales');
check(!config.match(/YOUR_API_KEY|token_en_claro/i), 'config sin placeholders inseguros');
check(typeof ref.snapshot.marketBalance === 'number', 'saldo no es texto');
check(typeof ref.snapshot.teamValue === 'number', 'valor no es texto');
check(typeof ref.snapshot.dailyReward === 'number', 'recompensa no es texto');
check(Array.isArray(ref.eventsVisible) && ref.eventsVisible.includes('Operación de mercado'), 'evento mercado');
check(ref.eventsVisible.includes('Recompensa') && ref.eventsVisible.includes('No puntuación'), 'eventos de recompensa y no puntuación');
check(ref.eventsVisible.includes('Blindaje') && ref.eventsVisible.includes('Nuevo miembro'), 'eventos de blindaje y miembro');

assert.equal(checks.length, 100, `Se esperaban 100 comprobaciones y hay ${checks.length}`);
for (const [index, [label, ok]] of checks.entries()) assert.ok(ok, `UI-${String(index + 1).padStart(3, '0')}: ${label}`);
console.log('✅ Recording/UI contract tests: 100/100 passed');
