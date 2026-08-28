import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root=process.cwd();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'laliga-brain-runtime-'));
const port=18080+Math.floor(Math.random()*500);
const child=spawn(process.execPath,['brain-host-v27.mjs'],{
  cwd:root,
  env:{...process.env,PORT:String(port),HOST:'127.0.0.1',BRAIN_STATE_DIR:dir,BRAIN_ADMIN_TOKEN:'runtime-test-secret',LALIGA_API_BASE_URL:'http://127.0.0.1:9/api'},
  stdio:['ignore','pipe','pipe']
});
let stdout=''; let stderr='';
child.stdout.on('data',d=>{stdout+=d.toString();});
child.stderr.on('data',d=>{stderr+=d.toString();});

async function waitFor(url,timeout=15000){
  const end=Date.now()+timeout;
  let last;
  while(Date.now()<end){
    try{return await fetch(url,{cache:'no-store'});}catch(error){last=error;await new Promise(r=>setTimeout(r,150));}
  }
  throw last||new Error('runtime timeout');
}

try{
  const base=`http://127.0.0.1:${port}`;
  const statusResponse=await waitFor(`${base}/api/brain/status`);
  assert.equal(statusResponse.status,200);
  const status=await statusResponse.json();
  assert.equal(status.version,'2.7.0');
  assert.ok(status.weights && Object.keys(status.weights).length===5);

  const predictResponse=await fetch(`${base}/api/brain/predict`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({player:{name:'Runtime Demo',position:'MED',points:12,minutes:540,starts:6,price:100,value:120,availability:'OK'},fixture:{context:80,homeAway:'home'}})
  });
  assert.equal(predictResponse.status,200);
  const prediction=await predictResponse.json();
  assert.equal(prediction.modelVersion,'2.7.0');
  assert.ok(Number.isFinite(prediction.expectedPoints));
  assert.ok(Number.isFinite(prediction.score));

  const forbidden=await fetch(`${base}/api/brain/learn`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({expected:5,actual:8,features:{performance:.7,availability:.8,context:.6,market:.5,risk:.9},position:'MED'})
  });
  assert.equal(forbidden.status,403);

  const learn=await fetch(`${base}/api/brain/learn`,{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer runtime-test-secret'},
    body:JSON.stringify({expected:5,actual:8,features:{performance:.7,availability:.8,context:.6,market:.5,risk:.9},position:'MED'})
  });
  assert.equal(learn.status,200);
  assert.equal((await learn.json()).learned,true);

  const huge=await fetch(`${base}/api/brain/predict`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:'{"player":"'+('x'.repeat(70000))+'"}'
  });
  assert.equal(huge.status,413);

  const model=JSON.parse(fs.readFileSync(path.join(dir,'model-v27.json'),'utf8'));
  assert.equal(model.labeledSamples,1);
  assert.ok(fs.existsSync(path.join(dir,'learning-v27.jsonl')));
  assert.ok(stdout.includes('[brain-host] public'));
  assert.equal(child.exitCode,null);
  console.log('BRAIN RUNTIME v2.7: OK · boot · status · predict · protected learn · body limit · persistence');
}finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>child.once('exit',resolve));
  fs.rmSync(dir,{recursive:true,force:true});
  if(stderr && /uncaught|ERR_MODULE_NOT_FOUND|SyntaxError/i.test(stderr)) throw new Error(stderr);
}
