import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('./visual-compact-v1.css','utf8');
const html = fs.readFileSync('./index.html','utf8');
let n = 0;
const check = (ok,msg) => { n++; assert.ok(ok, `VISUAL-POLISH-${String(n).padStart(3,'0')}: ${msg}`); };

check(css.includes('.nav button.active'), 'main navigation has an explicit active visual state');
check(css.includes('overscroll-behavior-x:contain'), 'horizontal navigation contains gesture spill');
check(css.includes('padding-left:2px'), 'mobile navigation keeps a safe touch inset');
check(css.includes('env(safe-area-inset-top)'), 'mobile sticky navigation respects safe area');
check(css.includes('.table-wrap,.table-responsive'), 'wide tables have a mobile containment strategy');
check(css.includes('min-width:560px'), 'wide tables remain readable through horizontal scrolling');
check(css.includes('prefers-reduced-motion:reduce'), 'motion reduction is supported');
check(!css.includes('data-tab="equipos"]::before'), 'stale teams selector removed from main navigation');
check(!css.includes('data-tab="jugadores"]::before'), 'stale players selector removed from main navigation');
check(!css.includes('data-tab="calendario"]::before'), 'stale calendar selector removed from main navigation');
check(!css.includes('data-tab="cerebro"]::before'), 'stale brain selector removed from main navigation');
for(const tab of ['inicio','brain','plantilla','xi','partidos','mercado','aciertos','radar','rivales','fuentes','datos','estado']){
  check(html.includes(`data-tab="${tab}"`), `DOM contains ${tab} tab`);
  check(css.includes(`data-tab="${tab}"]::before`), `CSS maps ${tab} icon`);
}
console.log(`visual-polish-v1: ${n}/${n} checks OK`);
