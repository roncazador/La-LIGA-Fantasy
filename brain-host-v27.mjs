import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createBrain, BRAIN_VERSION } from './brain-core-v27.mjs';

const publicPort=Number(process.env.PORT||10000);
const internalPort=Math.max(1024, publicPort-1);
const host=process.env.HOST||'0.0.0.0';
const internalHost='127.0.0.1';
const brain=createBrain({dir:process.env.BRAIN_STATE_DIR||'./.brain-data'});
let child;
let shuttingDown=false;

function startChild(){
  const env={...process.env,PORT:String(internalPort),HOST:internalHost,FRONTEND_URL:process.env.FRONTEND_URL||'/'};
  child=spawn(process.execPath,['--import','./config.mjs','server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>process.stdout.write(`[backend] ${d}`));
  child.stderr.on('data',d=>process.stderr.write(`[backend] ${d}`));
  child.on('exit',(code,signal)=>{
    if(!shuttingDown) setTimeout(startChild,1000);
    console.error(`[brain-host] backend exited code=${code} signal=${signal}`);
  });
}

function json(res,status,body){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body));
}

function brainClient(){ return fs.readFileSync(path.resolve('brain-client-v27.js'),'utf8'); }

function proxy(req,res,bodyOverride=null){
  const headers={...req.headers,host:`${internalHost}:${internalPort}`};
  const options={hostname:internalHost,port:internalPort,path:req.url,method:req.method,headers};
  const upstream=http.request(options,up=>{
    const chunks=[];
    up.on('data',c=>chunks.push(c));
    up.on('end',()=>{
      let body=Buffer.concat(chunks);
      const type=String(up.headers['content-type']||'');
      if(req.method==='GET' && req.url==='/' && type.includes('text/html')){
        let html=body.toString('utf8');
        if(!html.includes('/brain-client-v27.js')){
          const tag='\n<script src="/brain-client-v27.js" defer></script>\n';
          html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;
          body=Buffer.from(html,'utf8');
        }
      }
      const outHeaders={...up.headers,'content-length':String(body.length),'cache-control':req.url==='/'?'no-store':'no-store'};
      res.writeHead(up.statusCode||502,outHeaders); res.end(body);
      try{
        if(req.method==='GET' && req.url?.startsWith('/api/fantasy/dashboard') && (up.statusCode||0)===200 && type.includes('application/json')){
          const dashboard=JSON.parse(body.toString('utf8'));
          brain.ingestDashboard(dashboard,{source:'official'});
        }
      }catch(error){ console.error('[brain-host] ingest dashboard failed',error.message); }
      try{
        if(req.method==='GET' && req.url?.startsWith('/api/data/') && (up.statusCode||0)===200 && type.includes('application/json')){
          const data=JSON.parse(body.toString('utf8'));
          const key=req.url.split('/')[3]?.split('?')[0];
          if(key==='players') brain.ingestAuxiliary({players:Array.isArray(data?.players)?data.players:Array.isArray(data?.data)?data.data:[]});
          else if(key==='injuries') brain.ingestAuxiliary({injuries:Array.isArray(data?.injuries)?data.injuries:Array.isArray(data?.data)?data.data:[]});
          else if(key==='standings') brain.ingestAuxiliary({standings:Array.isArray(data?.standings)?data.standings:Array.isArray(data?.data)?data.data:[]});
        }
      }catch(error){ console.error('[brain-host] ingest auxiliary failed',error.message); }
    });
  });
  upstream.on('error',error=>json(res,502,{error:'BACKEND_UNAVAILABLE',detail:error.message}));
  if(bodyOverride!=null) upstream.write(bodyOverride);
  else req.pipe(upstream);
}

const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/brain-client-v27.js' && req.method==='GET'){
      const body=Buffer.from(brainClient(),'utf8');
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); return res.end(body);
    }
    if(url.pathname==='/api/brain/status' && req.method==='GET') return json(res,200,brain.status());
    if(url.pathname==='/api/brain/model' && req.method==='GET') return json(res,200,{version:BRAIN_VERSION,weights:brain.state.weights,positionBias:brain.state.positionBias,drift:brain.state.drift});
    if(url.pathname==='/api/brain/predict' && req.method==='POST'){
      const chunks=[]; req.on('data',c=>chunks.push(c)); req.on('end',()=>{try{const p=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'); return json(res,200,brain.predict(p.player||p,{fixture:p.fixture||{}}));}catch(error){return json(res,400,{error:'INVALID_JSON',detail:error.message});}}); return;
    }
    proxy(req,res);
  }catch(error){ json(res,500,{error:'BRAIN_HOST_ERROR',detail:error.message}); }
});

startChild();
server.listen(publicPort,host,()=>console.log(`[brain-host] public ${host}:${publicPort} · backend ${internalHost}:${internalPort} · brain ${BRAIN_VERSION}`));

const shutdown=signal=>{shuttingDown=true;try{child?.kill(signal);}catch{} try{server.close(()=>process.exit(0));}catch{process.exit(0)}};
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
