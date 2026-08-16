import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const PORT=Number(process.env.PORT||3005);
const HOST=process.env.HOST||'0.0.0.0';
const API_BASE=(process.env.LALIGA_API_BASE_URL||'https://fantasy-api.llt-services.com').replace(/\/+$/,'');
const COMP=(process.env.LALIGA_COMPETITION_ID||'1');
const COOKIE=process.env.SESSION_COOKIE_NAME||'fm_session';
const ORIGIN=process.env.ALLOW_ORIGIN||'*';
const sessions=new Map();
const STATIC_DIR=path.resolve(process.env.FRONTEND_DIR||process.cwd());
function serveStatic(res,pathname){const file=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');const full=path.resolve(STATIC_DIR,file);if(!full.startsWith(STATIC_DIR+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile())return false;const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json'};res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':file==='index.html'?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(full));return true;}
const allow=new Set(['profile','leagues','league','squad','budget','market','fixtures','players','stats','rivals','standings','week']);
function reply(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Credentials':'true','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),decodeURIComponent(s.slice(i+1))]}))}
function session(req){const id=cookies(req)[COOKIE];return id?sessions.get(id):null}
function arr(x){if(Array.isArray(x))return x;if(Array.isArray(x?.data))return x.data;if(Array.isArray(x?.items))return x.items;if(Array.isArray(x?.content))return x.content;return []}
function obj(x){return x?.data&&typeof x.data==='object'&&!Array.isArray(x.data)?x.data:(x&&typeof x==='object'&&!Array.isArray(x)?x:null)}
async function refresh(s){if(!s?.refreshToken||!process.env.LALIGA_OAUTH_CLIENT_ID)return false;const url=(process.env.LALIGA_TOKEN_URL||'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token')+'?p='+(process.env.LALIGA_SIGNIN_POLICY||'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN');const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:s.refreshToken,client_id:process.env.LALIGA_OAUTH_CLIENT_ID,scope:'openid offline_access'});const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const j=await r.json().catch(()=>({}));if(!r.ok)return false;s.accessToken=j.access_token||j.id_token||s.accessToken;s.refreshToken=j.refresh_token||s.refreshToken;s.expiresAt=Date.now()+Number(j.expires_in||j.id_token_expires_in||86400)*1000;return true}
async function upstream(path,s,attempt=0){if(!s?.accessToken)throw Error('NO_SESSION');if(s.expiresAt&&Date.now()>s.expiresAt-120000)await refresh(s).catch(()=>false);const r=await fetch(API_BASE+path,{headers:{Accept:'application/json','x-lang':'es',Authorization:'Bearer '+s.accessToken,'User-Agent':'LALIGA-Fantasy-Manager/2.0.1-read-only'}});const t=await r.text();if(r.status===401&&attempt===0&&s.refreshToken&&await refresh(s))return upstream(path,s,1);if(!r.ok){const e=Error('UPSTREAM_'+r.status);e.status=r.status;throw e}try{return JSON.parse(t)}catch{return {raw:t.slice(0,2000)}}}

const paths={profile:'/v4/user/me?x-lang=es',leagues:`/v1/competition/${COMP}/leagues?x-lang=es`,week:`/v1/competition/${COMP}/week/current?x-lang=es`,players:`/v1/competition/${COMP}/players?x-lang=es`,fixtures:(w)=>`/v1/competition/${COMP}/calendar?weekNumber=${encodeURIComponent(w)}&x-lang=es`,league:(id)=>`/v1/competition/${COMP}/leagues/${encodeURIComponent(id)}/standing?x-lang=es`,standings:(id,w)=>`/v1/competition/${COMP}/leagues/${encodeURIComponent(id)}/standing/${encodeURIComponent(w)}?x-lang=es`,market:(id)=>`/v1/competition/${COMP}/league/${encodeURIComponent(id)}/market?x-lang=es`,squad:(id)=>`/v1/competition/${COMP}/teams/${encodeURIComponent(id)}?x-lang=es`,budget:(id)=>`/v1/competition/${COMP}/teams/${encodeURIComponent(id)}/money?x-lang=es`,stats:(w)=>`/stats/v1/competition/${COMP}/stats/week/${encodeURIComponent(w)}?x-lang=es`};
http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS')return reply(res,204,{});
 const u=new URL(req.url,'http://'+req.headers.host);
 if(u.pathname==='/api/health')return reply(res,200,{ok:true,readOnly:true,competition:COMP,version:'2.0.1'});
 if(u.pathname==='/api/session')return reply(res,200,{authenticated:!!session(req),readOnly:true});
 if(u.pathname==='/auth/start'){
  const authorize=process.env.LALIGA_AUTHORIZE_URL;
  const clientId=process.env.LALIGA_OAUTH_CLIENT_ID;
  const redirectUri=process.env.LALIGA_REDIRECT_URI;
  const policy=process.env.LALIGA_SIGNIN_POLICY||'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN';
  if(!authorize||!clientId||!redirectUri)return reply(res,501,{error:'OIDC_NOT_CONFIGURED',message:'Faltan parámetros OIDC oficiales.'});
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const state=Buffer.from(bytes).toString('base64url');
  const verifier=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',Buffer.from(verifier))).toString('base64url');
  const sid=crypto.randomUUID();
  sessions.set(sid,{createdAt:Date.now(),state,verifier});
  const q=new URLSearchParams({p:policy,client_id:clientId,response_type:'code',redirect_uri:redirectUri,scope:`openid ${clientId} offline_access`,code_challenge:challenge,code_challenge_method:'S256',state,nonce:state});
  res.writeHead(302,{Location:authorize+'?'+q.toString(),'Set-Cookie':`${COOKIE}=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=900`});return res.end();
}
 if(u.pathname==='/auth/callback'){
  const sid=cookies(req)[COOKIE]; const pending=sid?sessions.get(sid):null;
  const code=u.searchParams.get('code'); const state=u.searchParams.get('state');
  if(!pending||!code||state!==pending.state)return reply(res,400,{error:'INVALID_OIDC_CALLBACK'});
  const tokenUrl=(process.env.LALIGA_TOKEN_URL||'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token')+'?p='+(process.env.LALIGA_SIGNIN_POLICY||'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN');
  const body=new URLSearchParams({grant_type:'authorization_code',client_id:process.env.LALIGA_OAUTH_CLIENT_ID,code,redirect_uri:process.env.LALIGA_REDIRECT_URI,code_verifier:pending.verifier,scope:`openid ${process.env.LALIGA_OAUTH_CLIENT_ID} offline_access`});
  const tr=await fetch(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const tj=await tr.json().catch(()=>({}));
  if(!tr.ok)return reply(res,502,{error:'OIDC_TOKEN_EXCHANGE_FAILED',status:tr.status});
  sessions.set(sid,{createdAt:Date.now(),accessToken:tj.access_token||tj.id_token,refreshToken:tj.refresh_token,expiresAt:Date.now()+Number(tj.expires_in||86400)*1000});
  res.writeHead(302,{Location:process.env.FRONTEND_URL||'/', 'Set-Cookie':`${COOKIE}=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; ${process.env.SECURE_COOKIE==='false'?'':'Secure;'} Path=/; Max-Age=2592000`});return res.end();
}
if(u.pathname==='/api/fantasy/dashboard'){const s=session(req);if(!s)return reply(res,401,{error:'AUTH_REQUIRED'});const out={version:'2.0.1',readOnly:true,competition:COMP,errors:[]};const [pr,ls,wk]=await Promise.allSettled([upstream(paths.profile,s),upstream(paths.leagues,s),upstream(paths.week,s)]);out.profile=pr.status==='fulfilled'?obj(pr.value)||{}:{};out.leagues=ls.status==='fulfilled'?arr(ls.value):[];out.week=wk.status==='fulfilled'?obj(wk.value)||wk.value:{};if(pr.status==='rejected')out.errors.push('profile');if(ls.status==='rejected')out.errors.push('leagues');if(wk.status==='rejected')out.errors.push('week');const league=out.leagues[0];const leagueId=league?.id||league?.leagueId;if(leagueId){const [st,m]=await Promise.allSettled([upstream(paths.league(leagueId),s),upstream(paths.market(leagueId),s)]);out.leagueId=leagueId;out.standing=st.status==='fulfilled'?st.value:null;out.market=m.status==='fulfilled'?m.value:null;if(st.status==='rejected')out.errors.push('standing');if(m.status==='rejected')out.errors.push('market');const rows=arr(out.standing);const user=out.profile?.username||out.profile?.email||out.profile?.name;const mine=rows.find(x=>x?.username===user||x?.managerName===user||x?.manager?.username===user||x?.userId===out.profile?.id);const teamId=mine?.teamId||mine?.team?.id||out.profile?.teamId||out.profile?.managerId;if(teamId){const [tm,bd]=await Promise.allSettled([upstream(paths.squad(teamId),s),upstream(paths.budget(teamId),s)]);out.team=tm.status==='fulfilled'?tm.value:null;out.budget=bd.status==='fulfilled'?bd.value:null;out.teamId=teamId;}}return reply(res,200,out);}
 if(u.pathname.startsWith('/api/fantasy/')){if(req.method!=='GET')return reply(res,405,{error:'READ_ONLY'});const s=session(req);if(!s)return reply(res,401,{error:'AUTH_REQUIRED'});const key=u.pathname.split('/').filter(Boolean)[2]||'';if(!allow.has(key))return reply(res,404,{error:'ROUTE_NOT_ALLOWLISTED'});let path;if(key==='profile')path=paths.profile;if(key==='leagues')path=paths.leagues;if(key==='week')path=paths.week;if(key==='players')path=paths.players;if(key==='fixtures')path=paths.fixtures(u.searchParams.get('week')||1);if(key==='stats')path=paths.stats(u.searchParams.get('week')||1);if(key==='league')path=paths.league(u.searchParams.get('id'));if(key==='standings')path=paths.standings(u.searchParams.get('id'),u.searchParams.get('week')||1);if(key==='market')path=paths.market(u.searchParams.get('id'));if(key==='squad')path=paths.squad(u.searchParams.get('teamId'));if(key==='budget')path=paths.budget(u.searchParams.get('teamId'));if(key==='rivals')path=paths.league(u.searchParams.get('id'));if(!path)return reply(res,400,{error:'MISSING_PARAMETER'});try{return reply(res,200,await upstream(path,s))}catch(e){return reply(res,e.status===401?401:502,{error:'UPSTREAM_READ_FAILED',status:e.status||502})}}
 if(req.method==='GET'&&serveStatic(res,u.pathname))return;
 return reply(res,404,{error:'NOT_FOUND'});
}).listen(PORT,HOST,()=>console.log(`Fantasy Manager backend on ${HOST}:${PORT}`));