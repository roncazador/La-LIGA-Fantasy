import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar=fs.readFileSync(new URL('./calendar-autonomous-v30.js',import.meta.url),'utf8');
const calendarNext=fs.readFileSync(new URL('./calendar-autonomous-v35.js',import.meta.url),'utf8');
const connection=fs.readFileSync(new URL('./connection-client.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');

const check=(condition,message)=>assert.ok(condition,message);
check(calendar.includes("const API='/api/calendar/autonomous'"),'Debe conservarse el contrato autónomo anterior.');
check(calendar.includes('EN DIRECTO'),'Debe conservarse el estado LIVE anterior.');
check(calendarNext.includes("API='/api/calendar/autonomous'"),'La versión nueva usa el endpoint autónomo.');
check(calendarNext.includes('REFRESH_MS=3000'),'Debe existir refresco automático cada 3 segundos.');
check(calendarNext.includes('setInterval(()=>void refresh(),REFRESH_MS)'),'El refresco debe ser periódico y automático.');
check(calendarNext.includes('new MutationObserver'),'Debe existir montaje persistente ante cambios del DOM.');
check(calendarNext.includes('removeLegacy')&&calendarNext.includes("'loadFixtures'")&&calendarNext.includes("'loadSeed'"),'Debe eliminar los controles manuales heredados.');
check(!calendarNext.includes("host.innerHTML='';"),'No debe vaciar #partidos ni destruir su DOM padre.');
check(!calendarNext.includes('setTimeout(run,250)'),'No debe existir el timeout de montaje abandonable de la versión anterior.');
check(calendarNext.includes("box.setAttribute('aria-live','polite')"),'El calendario debe anunciar actualizaciones accesibles.');
check(calendarNext.includes('homeScore')&&calendarNext.includes('awayScore'),'Debe renderizar marcadores cuando existen.');
check(calendarNext.includes('EN DIRECTO'),'Debe representar explícitamente estados LIVE.');
check(/loadInline\('\/calendar-autonomous-v35\.js','35'\)/.test(connection),'El loader debe cargar la versión actual del calendario.');
check(connection.includes('data-fantasy-layer'),'El loader debe impedir scripts duplicados.');
check(connection.includes('calendar-focus-v1.js')&&connection.includes('calendar-focus-fix-v1.js'),'El loader debe incluir el detalle interactivo del partido.');
check(index.includes('id="partidos"'),'La pantalla Partidos debe existir.');
check(index.includes('id="loadFixtures"')&&index.includes('id="loadSeed"'),'Los controles heredados siguen presentes en HTML y el calendario debe retirarlos en runtime.');
console.log('CALENDAR UI v35: 17/17 structural assertions passed');
