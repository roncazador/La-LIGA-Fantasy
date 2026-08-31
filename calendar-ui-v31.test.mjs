import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar=fs.readFileSync(new URL('./calendar-autonomous-v30.js',import.meta.url),'utf8');
const calendarNext=fs.readFileSync(new URL('./calendar-autonomous-v35.js',import.meta.url),'utf8');
const connection=fs.readFileSync(new URL('./connection-client.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');

const check=(condition,message)=>assert.ok(condition,message);
check(calendar.includes("const API='/api/calendar/autonomous'"),'Debe conservarse el contrato autónomo anterior.');
check(calendar.includes('EN DIRECTO'),'Debe conservarse el estado LIVE anterior.');
check(calendarNext.includes("const API='/api/calendar/autonomous'"),'La versión nueva usa el endpoint autónomo.');
check(calendarNext.includes("const REFRESH_MS=15000"),'Debe existir refresco automático.');
check(calendarNext.includes('new MutationObserver'),'Debe existir montaje persistente ante cambios del DOM.');
check(calendarNext.includes("document.getElementById('loadFixtures')?.remove()"),'Debe eliminar el botón manual de proveedor.');
check(calendarNext.includes("document.getElementById('loadSeed')?.remove()"),'Debe eliminar el botón manual de semilla.');
check(!calendarNext.includes("host.innerHTML='';"),'No debe vaciar #partidos ni destruir su DOM padre.');
check(!calendarNext.includes('setTimeout(run,250)'),'No debe existir el timeout de montaje abandonable de la versión anterior.');
check(calendarNext.includes("box.setAttribute('aria-live','polite')"),'El calendario debe anunciar actualizaciones accesibles.');
check(calendarNext.includes('homeScore')&&calendarNext.includes('awayScore'),'Debe renderizar marcadores cuando existen.');
check(calendarNext.includes('EN DIRECTO'),'Debe representar explícitamente estados LIVE.');
check(/loadInline\('\/calendar-autonomous-v35\.js','35'\)/.test(connection),'El loader debe cargar la versión actual del calendario.');
check(connection.includes('data-fantasy-layer'),'El loader debe impedir scripts duplicados.');
check(/load(?:Inline)?\('\/match-detail-ui-v31\.js'/.test(connection),'El loader debe incluir el detalle interactivo del partido.');
check(index.includes('id="partidos"'),'La pantalla Partidos debe existir.');
check(index.includes('id="loadFixtures"')&&index.includes('id="loadSeed"'),'Los controles heredados siguen presentes en HTML y el calendario debe retirarlos en runtime.');
console.log('CALENDAR UI v35: 16/16 structural assertions passed');
