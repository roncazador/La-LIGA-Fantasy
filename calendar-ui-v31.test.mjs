import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar=fs.readFileSync(new URL('./calendar-autonomous-v30.js',import.meta.url),'utf8');
const connection=fs.readFileSync(new URL('./connection-client.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');

const check=(condition,message)=>assert.ok(condition,message);

check(calendar.includes("const API='/api/calendar/autonomous'"),'Debe usar únicamente el endpoint autónomo del calendario.');
check(calendar.includes("const REFRESH_MS=15000"),'Debe existir refresco automático.');
check(calendar.includes('new MutationObserver'),'Debe existir montaje persistente ante cambios del DOM.');
check(calendar.includes("document.getElementById('loadFixtures')?.remove()"),'Debe eliminar el botón manual de proveedor.');
check(calendar.includes("document.getElementById('loadSeed')?.remove()"),'Debe eliminar el botón manual de semilla.');
check(!calendar.includes("host.innerHTML='';"),'No debe vaciar #partidos ni destruir su DOM padre.');
check(!calendar.includes('setTimeout(run,250)'),'No debe existir el timeout de montaje abandonable de la versión anterior.');
check(calendar.includes("box.setAttribute('aria-live','polite')"),'El calendario debe anunciar actualizaciones accesibles.');
check(calendar.includes('homeScore')&&calendar.includes('awayScore'),'Debe renderizar marcadores cuando existen.');
check(calendar.includes('EN DIRECTO'),'Debe representar explícitamente estados LIVE.');
check(connection.includes("load('/calendar-autonomous-v30.js','31')"),'El loader debe cache-bustear la versión del calendario.');
check(connection.includes('data-fantasy-layer'),'El loader debe impedir scripts duplicados.');
check(index.includes('id="partidos"'),'La pantalla Partidos debe existir.');
check(index.includes('id="loadFixtures"')&&index.includes('id="loadSeed"'),'Los controles heredados siguen presentes en HTML y el calendario debe retirarlos en runtime.');
console.log('CALENDAR UI v31: 14/14 structural assertions passed');
