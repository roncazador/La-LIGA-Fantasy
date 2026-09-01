import assert from 'node:assert/strict';
import fs from 'node:fs';
const meta=JSON.parse(fs.readFileSync('./recording-video-2026-09-01.json','utf8'));
const checks=[
  ['source',meta.source==='grabación de pantalla aportada por el usuario'],
  ['sha256',/^[a-f0-9]{64}$/.test(meta.sha256)],
  ['size',meta.sizeBytes>0],
  ['container',meta.container==='mp4'],
  ['duration',meta.durationSeconds>0],
  ['video duration',meta.videoDurationSeconds>0],
  ['fps/frame count',meta.frameCount>0&&meta.fps>0],
  ['resolution',meta.width===512&&meta.height===1112],
  ['orientation',meta.orientation==='vertical'],
  ['codec',meta.videoCodec==='h264'&&meta.audioCodec==='aac'],
  ['sampled evidence',Array.isArray(meta.observations?.sampledSeconds)&&meta.observations.sampledSeconds.length>=5],
  ['isolated from live learning',meta.isolation?.feedsFantasyLearningDirectly===false&&meta.isolation?.requiresHumanConfirmationBeforeTraining===true],
  ['observed state note',meta.status==='evidence_reference_observed_no_live']
];
for(const[name,ok]of checks)assert.ok(ok,`VIDEO-V1: ${name}`);
console.log(`RECORDING VIDEO v1: ${checks.length}/${checks.length} checks passed`);
