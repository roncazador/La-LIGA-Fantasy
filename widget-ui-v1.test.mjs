import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('./visual-compact-v1.css','utf8');
const connection = fs.readFileSync('./connection-client.js','utf8');
let n = 0;
const check = (ok,msg) => { n++; assert.ok(ok, `WIDGET-V1-${String(n).padStart(3,'0')}: ${msg}`); };

check(css.includes('.nav button,.tv5tabs button,#decisionLearningToggle,.dlbtn,.dlprimary'), 'main controls use shared widget surface');
check(css.includes('min-height:var(--widget-h)'), 'widget controls have touch-safe minimum height');
check(css.includes('box-shadow:0 2px 0'), 'widgets have layered depth');
check(css.includes('transition:transform .12s ease'), 'widgets have tactile transition');
check(css.includes(':focus-visible'), 'widgets expose keyboard focus');
check(css.includes("data-tab=\"inicio\"]::before"), 'home icon mapping exists');
check(css.includes("data-tab=\"equipos\"]::before"), 'teams icon mapping exists');
check(css.includes("data-tab=\"jugadores\"]::before"), 'players icon mapping exists');
check(css.includes("data-tab=\"calendario\"]::before"), 'calendar icon mapping exists');
check(css.includes("data-tab=\"cerebro\"]::before"), 'brain icon mapping exists');
check(css.includes("#decisionLearningToggle::before"), 'questions icon mapping exists');
check(css.includes('scroll-snap-type:x proximity'), 'mobile tab strip is thumb friendly');
check(!css.includes('animation:'), 'no persistent animation added to the compact UI');
check(Buffer.byteLength(css,'utf8')<=4096, 'compact CSS remains within budget');
check(connection.includes("loadCss('/visual-compact-v1.css','1')"), 'widget visual layer stays on the critical path');
console.log(`widget-ui-v1: ${n}/${n} checks OK`);
