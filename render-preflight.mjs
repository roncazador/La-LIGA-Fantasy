import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const required = [
  'package.json','config.mjs','server.mjs','brain-host-v27.mjs','brain-core-v27.mjs',
  'brain-history-v28.mjs','brain-history-hook-v28.mjs','brain-calibration-v28.mjs',
  'brain-reliability-v29.mjs','brain-reliability-hook-v29.mjs',
  'calendar-service-v29.mjs','calendar-autonomous-v30.js','futbolfantasy-data-v30.mjs',
  'index.html','connection-client.js','sw.js'
];
for (const file of required) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`RENDER_PREFLIGHT_MISSING:${file}`);
}
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const major = Number(process.versions.node.split('.')[0]);
if (major < 24) throw new Error(`RENDER_PREFLIGHT_NODE_TOO_OLD:${process.versions.node}`);
const start = String(pkg.scripts?.start || '');
if (!start.includes('--import ./brain-history-hook-v28.mjs') || !start.includes('--import ./brain-reliability-hook-v29.mjs') || !start.includes('brain-host-v27.mjs')) {
  throw new Error('RENDER_PREFLIGHT_START_COMMAND_MISMATCH');
}
if (String(process.env.RENDER ?? '').toLowerCase() === 'true') {
  const port = Number(process.env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('RENDER_PREFLIGHT_INVALID_PORT');
}
const syntax = required.filter(file=>/\.(mjs|js)$/.test(file));
for (const file of syntax) {
  execFileSync(process.execPath,['--check',file],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
}
console.log(`RENDER_PREFLIGHT_OK node=${process.versions.node} port=${process.env.PORT || '10000'} files=${required.length}`);
