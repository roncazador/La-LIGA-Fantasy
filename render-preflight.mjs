import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const required = [
  'package.json','config.mjs','server.mjs','brain-host-v27.mjs','brain-core-v27.mjs',
  'brain-history-v28.mjs','brain-history-hook-v28.mjs','brain-calibration-v28.mjs',
  'brain-reliability-v29.mjs','brain-reliability-hook-v29.mjs',
  'calendar-service-v29.mjs','calendar-autonomous-v35.js','futbolfantasy-data-v30.mjs',
  'index.html','connection-client.js','sw.js','render.yaml','visual-compact-v1.css',
  'teams-data-v5.js','decision-learning-v1.js','calendar-focus-v1.js','calendar-focus-fix-v1.js','match-center-ui-v1.js'
];
for (const file of required) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`RENDER_PREFLIGHT_MISSING:${file}`);
}
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const render = fs.readFileSync('render.yaml','utf8');
const config = fs.readFileSync('config.mjs','utf8');
const connection = fs.readFileSync('connection-client.js','utf8');
const sw = fs.readFileSync('sw.js','utf8');
const major = Number(process.versions.node.split('.')[0]);
if (major < 24) throw new Error(`RENDER_PREFLIGHT_NODE_TOO_OLD:${process.versions.node}`);
const start = String(pkg.scripts?.start || '');
if (!start.includes('--import ./brain-history-hook-v28.mjs') || !start.includes('--import ./brain-reliability-hook-v29.mjs') || !start.includes('brain-host-v27.mjs')) {
  throw new Error('RENDER_PREFLIGHT_START_COMMAND_MISMATCH');
}
if (!render.includes('healthCheckPath: /api/health')) throw new Error('RENDER_PREFLIGHT_HEALTH_PATH_MISMATCH');
if (!render.includes('buildCommand: npm install --no-audit --no-fund && npm run render:verify && npm run test:render-runtime')) throw new Error('RENDER_PREFLIGHT_BUILD_COMMAND_MISMATCH');
for (const asset of ['/teams-data-v5.js','/decision-learning-v1.js','/calendar-focus-v1.js','/calendar-focus-fix-v1.js','/match-center-ui-v1.js']) {
  if (!config.includes(`'${asset}'`)) throw new Error(`RENDER_PREFLIGHT_ASSET_NOT_PUBLIC:${asset}`);
}
for (const asset of ['./teams-data-v5.js','./decision-learning-v1.js','./calendar-autonomous-v35.js','./calendar-focus-v1.js','./calendar-focus-fix-v1.js','./match-center-ui-v1.js','./visual-compact-v1.css']) {
  if (!sw.includes(`'${asset}'`)) throw new Error(`RENDER_PREFLIGHT_ASSET_NOT_CACHED:${asset}`);
}
for (const asset of ["loadCss('/visual-compact-v1.css','1')","loadInline('/teams-data-v5.js','5')","loadInline('/decision-learning-v1.js','2')","loadInline('/calendar-autonomous-v35.js','35')","loadInline('/calendar-focus-v1.js','1')","loadInline('/calendar-focus-fix-v1.js','1')","loadInline('/match-center-ui-v1.js','1')"]) {
  if (!connection.includes(asset)) throw new Error(`RENDER_PREFLIGHT_LOADER_MISMATCH:${asset}`);
}
if (fs.statSync('visual-compact-v1.css').size > 4096) throw new Error('RENDER_PREFLIGHT_VISUAL_CSS_TOO_LARGE');
if (String(process.env.RENDER ?? '').toLowerCase() === 'true') {
  const port = Number(process.env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('RENDER_PREFLIGHT_INVALID_PORT');
}
const syntax = required.filter(file=>/\.(mjs|js)$/.test(file));
for (const file of syntax) {
  execFileSync(process.execPath,['--check',file],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
}
console.log(`RENDER_PREFLIGHT_OK node=${process.versions.node} port=${process.env.PORT || '10000'} files=${required.length}`);