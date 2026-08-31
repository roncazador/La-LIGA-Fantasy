import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'laliga-brain-runtime-v27-'));
const port=Number(process.env.TEST_PORT||18727)+(process.pid%1000);
const base=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),HOST:'127.0.0.1',BRAIN_STATE_DIR:dir,BRAIN_ADMIN_TOKEN:'runtime-test-secret',API_FOOTBALL_API_KEY:'runtime-test-placeholder'};
const child=spawn(process.execPath,['brain-host-v27.mjs'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
let stdout='';let stderr='';
child.stdout.on('data',chunk=>{stdout+=chunk.toString()});
child.stderr.on('data',chunk=>{stderr+=chunk.toString()});

async function waitForHealth(){
  for(let i=0;i<300;i++){
    try{
      const response=await fetch(`${base}/api/health`);
      if(response.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error(`backend did not start within 15s: ${stderr || stdout || 'no child output'}`);
}

try{
  await waitForHealth();

  const predict=await fetch(`${base}/api/brain/predict`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({player:{name:'Runtime Demo',position:'MED',team:'Club',points:10,minutes:540,starts:6},fixture:{context:70,homeAway:'home'}})
  });
  assert.equal(predict.status,200);
  const predicted=await predict.json();
  assert.ok(Number.isFinite(predicted.expectedPoints));

  const forbidden=await fetch(`${base}/api/brain/learn`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({expected:5,actual:8,features:{performance:.7,availability:.8,context:.6,market:.5,risk:.9},position:'MED'})
  });
  assert.equal(forbidden.status,403);

  const blockedFinalFlag=await fetch(`${base}/api/brain/learn`,{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer runtime-test-secret'},
    body:JSON.stringify({expected:5,actual:8,features:{performance:.7,availability:.8,context:.6,market:.5,risk:.9},position:'MED',final:false})
  });
  assert.equal(blockedFinalFlag.status,200);
  const blockedResult=await blockedFinalFlag.json();
  assert.equal(blockedResult.learned,false);
  assert.equal(blockedResult.reason,'non-final-label');

  const learn=await fetch(`${base}/api/brain/learn`,{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer runtime-test-secret'},
    body:JSON.stringify({expected:5,actual:8,features:{performance:.7,availability:.8,context:.6,market:.5,risk:.9},position:'MED',final:true})
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
  console.log('BRAIN RUNTIME v2.7: OK · boot · status · predict · protected final-only learn · body limit · persistence');
}finally{
  try{child.kill('SIGTERM')}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
  try{if(child.exitCode===null)child.kill('SIGKILL')}catch{}
  fs.rmSync(dir,{recursive:true,force:true});
}
