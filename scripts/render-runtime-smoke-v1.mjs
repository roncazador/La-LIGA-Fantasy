import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const port=18000+Math.floor(Math.random()*500);
const stateDir=fs.mkdtempSync(path.join(os.tmpdir(),'laliga-render-smoke-'));
const child=spawn(process.execPath,['brain-host-v27.mjs'],{
  cwd:root,
  env:{...process.env,NODE_ENV:'test',PORT:String(port),HOST:'127.0.0.1',BRAIN_STATE_DIR:stateDir,SECURE_COOKIE:'false'},
  stdio:['ignore','pipe','pipe']
});
let output='';
child.stdout.on('data',d=>{output+=d.toString()});
child.stderr.on('data',d=>{output+=d.toString()});
const deadline=Date.now()+15000;
try{
  let last='';
  let brainReady=false;
  while(Date.now()<deadline){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/api/health`,{cache:'no-store',signal:AbortSignal.timeout(1000)});
      last=`HEALTH_HTTP_${response.status}`;
      if(response.ok){
        const body=await response.json();
        assert.equal(body.ok,true,'direct health endpoint is live');
        assert.equal(body.readOnly,true,'health endpoint remains read-only');
        assert.equal(body.competition,'1','competition is configured');
        if(body.backendReady)brainReady=true;
      }
      if(brainReady){
        const brainResponse=await fetch(`http://127.0.0.1:${port}/api/brain/status`,{cache:'no-store',signal:AbortSignal.timeout(1000)});
        last=`BRAIN_HTTP_${brainResponse.status}`;
        assert.equal(brainResponse.ok,true,'brain status is reachable');
        const brainBody=await brainResponse.json();
        assert.equal(brainBody.readOnly,true,'brain status remains read-only');
        assert.equal(brainBody.cultivosVersion,'1.4.0','canonical Cultivos remains active');
        console.log(`RENDER RUNTIME SMOKE v2: OK · port=${port} · backendReady=${brainReady} · cultivos=${brainBody.cultivosVersion}`);
        break;
      }
    }catch(error){last=String(error?.message||error)}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!brainReady || Date.now()>=deadline)throw new Error(`RENDER_RUNTIME_TIMEOUT:${last}`);
}finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{const timer=setTimeout(()=>resolve(),2000);child.once('exit',()=>{clearTimeout(timer);resolve()})});
  fs.rmSync(stateDir,{recursive:true,force:true});
}
if(/SERVER_LISTEN_ERROR|EADDRINUSE|BRAIN_HOST_ERROR/.test(output))throw new Error(`RENDER_RUNTIME_START_ERROR:${output.slice(-3000)}`);
