import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { VERSION, readConfig, oidcConfigured, publicStaticPath } from './config.mjs';
import { providerStatus, fetchApiFootballFixtures, fetchSportmonksFixtures, fetchMultiProviderFixtures } from './providers.mjs';
import { fetchTeams, fetchPlayers, fetchStandings, fetchInjuries } from './realdata.mjs';
import { fetchFutbolFantasyData } from './futbolfantasy-data-v30.mjs';

const config = readConfig();
const sessions = new Map();
const loginAttempts = new Map();
const STATIC_DIR = path.resolve(process.env.FRONTEND_DIR || process.cwd());
const READ_ROUTES = new Set(['profile','leagues','league','squad','budget','market','fixtures','players','stats','rivals','standings','week']);
const SESSION_PENDING_TTL = 15 * 60 * 1000;
const SESSION_ACTIVE_TTL = 30 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

function sendJson(res, status, body, extra = {}) {
  const headers = {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Pragma':'no-cache',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY',
    ...extra
  };
  if (config.allowOrigin) {
    headers['Access-Control-Allow-Origin'] = config.allowOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function cookieHeader(id, maxAge) {
  const secure = config.secureCookie ? ' Secure;' : '';
  return `${config.sessionCookieName}=${encodeURIComponent(id)}; HttpOnly; SameSite=Lax;${secure} Path=/; Max-Age=${maxAge}`;
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  }
  return out;
}

function getSession(req) {
  const id = parseCookies(req)[config.sessionCookieName];
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  const ttl = session.accessToken ? SESSION_ACTIVE_TTL : SESSION_PENDING_TTL;
  if (Date.now() - session.createdAt > ttl) {
    sessions.delete(id);
    return null;
  }
  return session;
}

function cleanSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    const ttl = session.accessToken ? SESSION_ACTIVE_TTL : SESSION_PENDING_TTL;
    if (now - session.createdAt > ttl) sessions.delete(id);
  }
  for (const [ip, attempt] of loginAttempts) {
    if (now - attempt.startedAt > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  }
}
setInterval(cleanSessions, 5 * 60 * 1000).unref();

function staticContentType(file) {
  return {
    'index.html':'text/html; charset=utf-8',
    'manifest.json':'application/manifest+json; charset=utf-8',
    'sw.js':'text/javascript; charset=utf-8',
    'dashboard-client.js':'text/javascript; charset=utf-8',
    'calendar-client.js':'text/javascript; charset=utf-8',
    'data-client.js':'text/javascript; charset=utf-8',
    'connection-client.js':'text/javascript; charset=utf-8',
    'auth-client.js':'text/javascript; charset=utf-8',
    'official-fixtures-seed-2026-27.json':'application/json; charset=utf-8',
    'recording-data-2026-08-27.json':'application/json; charset=utf-8',
    'video-reference-snapshot-2026-08-27.json':'application/json; charset=utf-8'
  }[file] || 'application/octet-stream';
}

function serveStatic(res, pathname) {
  if (!publicStaticPath(pathname)) return false;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  const full = path.resolve(STATIC_DIR, file);
  if (!full.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return false;

  let content = fs.readFileSync(full, 'utf8');
  if (file === 'index.html' && !content.includes('connection-client.js')) {
    const loader = '\n<script src="/connection-client.js" defer></script>\n';
    content = content.includes('</body>') ? content.replace('</body>', `${loader}</body>`) : `${content}${loader}`;
  }

  res.writeHead(200, {
    'Content-Type': staticContentType(file),
    'Cache-Control': file === 'index.html' ? 'no-store, max-age=0, must-revalidate' : 'public, max-age=3600',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY'
  });
  res.end(content);
  return true;
}

function arrayData(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.content)) return value.content;
  return [];
}

function objectData(value) {
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return null;
}

function jwtPayload(token) {
  try {
    const part = String(token).split('.')[1];
    return part ? JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) : null;
  } catch { return null; }
}

function validAccessToken(token) {
  const payload = jwtPayload(token);
  if (!payload) return false;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const acceptedAudiences = new Set([config.laligaPasswordClientId, config.laligaOAuthClientId].filter(Boolean));
  return aud.some(value => acceptedAudiences.has(value)) && payload.iss === config.laligaExpectedIssuer && Number(payload.exp) > now + 30;
}

function validTokenPair(accessToken, idToken) {
  return validAccessToken(accessToken) || validAccessToken(idToken);
}

function loginAllowed(ip) {
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, {startedAt:now, count:1});
    return true;
  }
  if (current.count >= LOGIN_MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

function authStatus() {
  const required = ['LALIGA_AUTHORIZE_URL','LALIGA_OAUTH_CLIENT_ID','LALIGA_REDIRECT_URI'];
  return {
    configured: oidcConfigured(config),
    passwordLogin: true,
    missing: required.filter(key => !process.env[key]),
    hasAuthorizeUrl: Boolean(config.laligaAuthorizeUrl),
    hasClientId: Boolean(config.laligaOAuthClientId),
    hasRedirectUri: Boolean(config.laligaRedirectUri),
    policy: config.laligaSigninPolicy,
    passwordClientIdConfigured: Boolean(config.laligaPasswordClientId),
    passwordRedirectUriConfigured: Boolean(config.laligaPasswordRedirectUri)
  };
}

async function refresh(session) {
  if (!session?.refreshToken) return false;
  try {
    const clientId = session.clientId || config.laligaOAuthClientId || config.laligaPasswordClientId;
    const tokenUrl = `${config.laligaTokenUrl}?p=${encodeURIComponent(session.policy || config.laligaSigninPolicy)}`;
    const body = new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refreshToken,client_id:clientId,scope:`openid ${clientId} offline_access`});
    const response = await fetch(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store',signal:AbortSignal.timeout(12000)});
    const data = await response.json().catch(() => ({}));
    const nextToken = data.access_token || data.id_token;
    if (!response.ok || !nextToken) return false;
    session.accessToken = nextToken;
    session.refreshToken = data.refresh_token || session.refreshToken;
    session.expiresAt = Date.now() + Number(data.expires_in || data.id_token_expires_in || 86400) * 1000;
    session.createdAt = Date.now();
    session.clientId = clientId;
    return true;
  } catch { return false; }
}

async function upstream(endpoint, session, attempt = 0) {
  if (!session?.accessToken) throw Object.assign(new Error('NO_SESSION'), {status:401});
  if (session.expiresAt && Date.now() > session.expiresAt - 120000) await refresh(session);
  const response = await fetch(config.laligaApiBaseUrl + endpoint, {
    method:'GET',
    headers:{Accept:'application/json','x-lang':'es',Authorization:`Bearer ${session.accessToken}`,'User-Agent':`LALIGA-Fantasy-Manager/${VERSION}-read-only`},
    cache:'no-store',
    signal:AbortSignal.timeout(12000)
  });
  const text = await response.text();
  if (response.status === 401 && attempt === 0 && session.refreshToken && await refresh(session)) return upstream(endpoint, session, 1);
  if (!response.ok) throw Object.assign(new Error(`UPSTREAM_${response.status}`), {status:response.status});
  try { return JSON.parse(text); } catch { return {raw:text.slice(0,2000)}; }
}

function fantasyPath(key, url) {
  const competition = encodeURIComponent(config.laligaCompetitionId);
  const week = encodeURIComponent(url.searchParams.get('week') || '1');
  const league = encodeURIComponent(url.searchParams.get('id') || '');
  const team = encodeURIComponent(url.searchParams.get('teamId') || '');
  switch (key) {
    case 'profile': return '/v4/user/me?x-lang=es';
    case 'leagues': return `/v1/competition/${competition}/leagues?x-lang=es`;
    case 'week': return `/v1/competition/${competition}/week/current?x-lang=es`;
    case 'players': return `/v1/competition/${competition}/players?x-lang=es`;
    case 'fixtures': return `/v1/competition/${competition}/calendar?weekNumber=${week}&x-lang=es`;
    case 'league': return `/v1/competition/${competition}/leagues/${league}/standing?x-lang=es`;
    case 'standings': return `/v1/competition/${competition}/leagues/${league}/standing/${week}?x-lang=es`;
    case 'market': return `/v1/competition/${competition}/league/${league}/market?x-lang=es`;
    case 'squad': return `/v1/competition/${competition}/teams/${team}?x-lang=es`;
    case 'budget': return `/v1/competition/${competition}/teams/${team}/money?x-lang=es`;
    case 'stats': return `/stats/v1/competition/${competition}/stats/week/${week}?x-lang=es`;
    case 'rivals': return `/v1/competition/${competition}/leagues/${league}/standing?x-lang=es`;
    default: return null;
  }
}

async function readBody(req, maxBytes = 8192) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw Object.assign(new Error('REQUEST_TOO_LARGE'), {status:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      const headers = config.allowOrigin ? {'Access-Control-Allow-Origin':config.allowOrigin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'} : {};
      res.writeHead(204, headers);
      return res.end();
    }

    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {ok:true,readOnly:true,competition:config.laligaCompetitionId,version:VERSION,providers:{laligaOAuth:oidcConfigured(config),laligaPasswordLogin:true,footballData:Boolean(config.footballDataToken),...providerStatus(config)}});
    }
    if (url.pathname === '/api/session' && req.method === 'GET') return sendJson(res,200,{authenticated:Boolean(getSession(req)),readOnly:true});
    if (url.pathname === '/api/auth/status' && req.method === 'GET') return sendJson(res,200,authStatus());
    if (url.pathname === '/api/providers/status' && req.method === 'GET') return sendJson(res,200,providerStatus(config));
    if (url.pathname === '/api/auth/google/start' && req.method === 'GET') {
      const state = crypto.randomBytes(32).toString('base64url');
      const verifier = crypto.randomBytes(64).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId,{createdAt:Date.now(),state,verifier,platform:'web'});
      const query = new URLSearchParams({p:config.laligaSigninPolicy,client_id:config.laligaOAuthClientId,response_type:'code',redirect_uri:config.laligaRedirectUri,scope:'openid offline_access',code_challenge:challenge,code_challenge_method:'S256',state,nonce:state});
      return sendJson(res,200,{authorizeUrl:`${config.laligaAuthorizeUrl}?${query.toString()}`,redirectUri:config.laligaRedirectUri},{'Set-Cookie':cookieHeader(sessionId,900)});
    }
    if (url.pathname === '/api/auth/google/finish' && req.method === 'POST') {
      const session = getSession(req);
      if (!session?.state || !session?.verifier) return sendJson(res,400,{error:'GOOGLE_LOGIN_NOT_STARTED'});
      let body;
      try { body = JSON.parse(await readBody(req,12000)); } catch { return sendJson(res,400,{error:'INVALID_JSON'}); }
      const redirectUrl = typeof body?.redirectUrl === 'string' ? body.redirectUrl.trim() : '';
      if (!redirectUrl || !redirectUrl.startsWith('authredirect://com.lfp.laligafantasy')) return sendJson(res,400,{error:'INVALID_REDIRECT_URL'});
      let parsed;
      try { parsed = new URL(redirectUrl); } catch { return sendJson(res,400,{error:'INVALID_REDIRECT_URL'}); }
      const code = parsed.searchParams.get('code');
      const returnedState = parsed.searchParams.get('state');
      const providerError = parsed.searchParams.get('error');
      if (providerError) return sendJson(res,401,{error:'GOOGLE_AUTH_FAILED',detail:providerError});
      if (!code || returnedState !== session.state) return sendJson(res,400,{error:'INVALID_OIDC_CALLBACK'});
      try {
        const tokenUrl = `${config.laligaTokenUrl}?p=${encodeURIComponent(config.laligaSigninPolicy)}`;
        const tokenResponse = await fetch(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.laligaOAuthClientId,code,redirect_uri:config.laligaRedirectUri,code_verifier:session.verifier,scope:'openid offline_access'}),cache:'no-store',signal:AbortSignal.timeout(12000)});
        const token = await tokenResponse.json().catch(() => ({}));
        if (!tokenResponse.ok || (!token.access_token && !token.id_token)) return sendJson(res,502,{error:'OIDC_TOKEN_EXCHANGE_FAILED'});
        session.accessToken=token.access_token || token.id_token;
        session.refreshToken=token.refresh_token || null;
        session.expiresAt=Date.now()+Number(token.expires_in || token.id_token_expires_in || 86400)*1000;
        session.createdAt=Date.now();
        session.authMethod='oidc-google';
        session.clientId=config.laligaOAuthClientId;
        session.policy=config.laligaSigninPolicy;
        delete session.state;
        delete session.verifier;
        return sendJson(res,200,{authenticated:true,authMethod:'oidc-google',expiresAt:session.expiresAt},{'Set-Cookie':cookieHeader(parseCookies(req)[config.sessionCookieName],2592000)});
      } catch { return sendJson(res,502,{error:'AUTHENTICATION_PROVIDER_UNAVAILABLE'}); }
    }

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      if (!loginAllowed(ip)) return sendJson(res,429,{error:'LOGIN_RATE_LIMITED'});
      let body;
      try { body = JSON.parse(await readBody(req)); } catch (error) { return sendJson(res,error.status || 400,{error:error.message === 'REQUEST_TOO_LARGE' ? error.message : 'INVALID_JSON'}); }
      const email = typeof body?.email === 'string' ? body.email.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!email || email.length > 320 || !password || password.length > 1024) return sendJson(res,400,{error:'INVALID_CREDENTIALS'});
      try {
        const clientId = config.laligaPasswordClientId;
        const tokenUrl = `${config.laligaTokenUrl}?p=${encodeURIComponent('B2C_1A_ResourceOwnerv2')}`;
        const tokenResponse = await fetch(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',client_id:clientId,scope:`openid ${clientId} offline_access`,redirect_uri:config.laligaPasswordRedirectUri,username:email,password,response_type:'id_token'}),cache:'no-store',signal:AbortSignal.timeout(12000)});
        const token = await tokenResponse.json().catch(() => ({}));
        if (!tokenResponse.ok) return sendJson(res,tokenResponse.status === 429 ? 429 : 401,{error:'AUTHENTICATION_FAILED'});
        const accessToken = typeof token.access_token === 'string' ? token.access_token : '';
        const idToken = typeof token.id_token === 'string' ? token.id_token : '';
        if (!validTokenPair(accessToken,idToken)) return sendJson(res,502,{error:'INVALID_PROVIDER_TOKEN'});
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId,{createdAt:Date.now(),accessToken:accessToken || idToken,refreshToken:typeof token.refresh_token === 'string' ? token.refresh_token : null,expiresAt:Date.now()+Number(token.expires_in || token.id_token_expires_in || 86400)*1000,authMethod:'laliga-password',clientId,policy:'B2C_1A_ResourceOwnerv2'});
        return sendJson(res,200,{authenticated:true,authMethod:'laliga-password',expiresAt:sessions.get(sessionId).expiresAt},{'Set-Cookie':cookieHeader(sessionId,2592000)});
      } catch { return sendJson(res,502,{error:'AUTHENTICATION_PROVIDER_UNAVAILABLE'}); }
    }

    if (url.pathname === '/auth/start' && req.method === 'GET') {
      if (!oidcConfigured(config)) return sendJson(res,501,{error:'OIDC_NOT_CONFIGURED',message:'Faltan parámetros OIDC oficiales.'});
      const state = crypto.randomBytes(32).toString('base64url');
      const verifier = crypto.randomBytes(32).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId,{createdAt:Date.now(),state,verifier,platform:url.searchParams.get('platform') === 'ios' ? 'ios' : 'web'});
      const query = new URLSearchParams({p:config.laligaSigninPolicy,client_id:config.laligaOAuthClientId,response_type:'code',redirect_uri:config.laligaRedirectUri,scope:`openid ${config.laligaOAuthClientId} offline_access`,code_challenge:challenge,code_challenge_method:'S256',state,nonce:state});
      res.writeHead(302,{Location:`${config.laligaAuthorizeUrl}?${query.toString()}`,'Set-Cookie':cookieHeader(sessionId,900),'Cache-Control':'no-store'});
      return res.end();
    }

    if (url.pathname === '/auth/callback' && req.method === 'GET') {
      const sessionId = parseCookies(req)[config.sessionCookieName];
      const pending = sessionId ? sessions.get(sessionId) : null;
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      if (!pending || !code || returnedState !== pending.state) return sendJson(res,400,{error:'INVALID_OIDC_CALLBACK'});
      const tokenUrl = `${config.laligaTokenUrl}?p=${encodeURIComponent(config.laligaSigninPolicy)}`;
      const body = new URLSearchParams({grant_type:'authorization_code',client_id:config.laligaOAuthClientId,code,redirect_uri:config.laligaRedirectUri,code_verifier:pending.verifier,scope:`openid ${config.laligaOAuthClientId} offline_access`});
      const tokenResponse = await fetch(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store',signal:AbortSignal.timeout(12000)});
      const token = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || (!token.access_token && !token.id_token)) return sendJson(res,502,{error:'OIDC_TOKEN_EXCHANGE_FAILED'});
      sessions.set(sessionId,{createdAt:Date.now(),accessToken:token.access_token || token.id_token,refreshToken:token.refresh_token || null,expiresAt:Date.now()+Number(token.expires_in || token.id_token_expires_in || 86400)*1000,authMethod:'oidc',clientId:config.laligaOAuthClientId,policy:config.laligaSigninPolicy});
      const location = pending.platform === 'ios' ? config.iosSuccessRedirect : config.frontendUrl;
      res.writeHead(302,{Location:location,'Set-Cookie':cookieHeader(sessionId,2592000),'Cache-Control':'no-store'});
      return res.end();
    }

    if (url.pathname === '/auth/logout' && req.method === 'GET') {
      const sessionId = parseCookies(req)[config.sessionCookieName];
      if (sessionId) sessions.delete(sessionId);
      res.writeHead(302,{Location:config.frontendUrl,'Set-Cookie':cookieHeader('',0),'Cache-Control':'no-store'});
      return res.end();
    }

    if (url.pathname === '/api/fantasy/dashboard' && req.method === 'GET') {
      const session = getSession(req);
      if (!session) return sendJson(res,401,{error:'AUTH_REQUIRED'});
      const output = {version:VERSION,readOnly:true,competition:config.laligaCompetitionId,errors:[]};
      const results = await Promise.allSettled([
        upstream('/v4/user/me?x-lang=es',session),
        upstream(`/v1/competition/${encodeURIComponent(config.laligaCompetitionId)}/leagues?x-lang=es`,session),
        upstream(`/v1/competition/${encodeURIComponent(config.laligaCompetitionId)}/week/current?x-lang=es`,session)
      ]);
      output.profile = results[0].status === 'fulfilled' ? objectData(results[0].value) || {} : {};
      output.leagues = results[1].status === 'fulfilled' ? arrayData(results[1].value) : [];
      output.week = results[2].status === 'fulfilled' ? objectData(results[2].value) || results[2].value : {};
      if (results[0].status === 'rejected') output.errors.push('profile');
      if (results[1].status === 'rejected') output.errors.push('leagues');
      if (results[2].status === 'rejected') output.errors.push('week');
      const league = output.leagues[0];
      const leagueId = league?.id || league?.leagueId;
      if (leagueId) {
        const competition = encodeURIComponent(config.laligaCompetitionId);
        const encodedLeague = encodeURIComponent(leagueId);
        const [standingResult,marketResult] = await Promise.allSettled([
          upstream(`/v1/competition/${competition}/leagues/${encodedLeague}/standing?x-lang=es`,session),
          upstream(`/v1/competition/${competition}/league/${encodedLeague}/market?x-lang=es`,session)
        ]);
        output.leagueId = leagueId;
        output.standing = standingResult.status === 'fulfilled' ? standingResult.value : null;
        output.market = marketResult.status === 'fulfilled' ? marketResult.value : null;
        if (standingResult.status === 'rejected') output.errors.push('standing');
        if (marketResult.status === 'rejected') output.errors.push('market');
        const rows = arrayData(output.standing);
        const profile = objectData(output.profile) || {};
        const user = profile.username || profile.email || profile.name;
        const mine = rows.find(item => item?.username === user || item?.managerName === user || item?.manager?.username === user || item?.userId === profile?.id);
        const teamId = mine?.teamId || mine?.team?.id || profile?.teamId || profile?.managerId;
        if (teamId) {
          const encodedTeam = encodeURIComponent(teamId);
          const [teamResult,budgetResult] = await Promise.allSettled([
            upstream(`/v1/competition/${competition}/teams/${encodedTeam}?x-lang=es`,session),
            upstream(`/v1/competition/${competition}/teams/${encodedTeam}/money?x-lang=es`,session)
          ]);
          output.team = teamResult.status === 'fulfilled' ? teamResult.value : null;
          output.budget = budgetResult.status === 'fulfilled' ? budgetResult.value : null;
          output.teamId = teamId;
          if (teamResult.status === 'rejected') output.errors.push('team');
          if (budgetResult.status === 'rejected') output.errors.push('budget');
        }
      }
      return sendJson(res,200,output);
    }

    if (url.pathname === '/api/futbolfantasy/data' && req.method === 'GET') {
      try {
        const data = await fetchFutbolFantasyData({futbolFantasyUrl:process.env.FUTBOLFANTASY_URL});
        return sendJson(res,200,data);
      } catch {
        return sendJson(res,502,{error:'FUTBOLFANTASY_UNAVAILABLE',readOnly:true,sourcePolicy:'public-contrast-only'});
      }
    }

    if (url.pathname.startsWith('/api/fantasy/') && req.method === 'GET') {
      const session = getSession(req);
      if (!session) return sendJson(res,401,{error:'AUTH_REQUIRED'});
      const key = url.pathname.split('/').filter(Boolean)[2] || '';
      if (!READ_ROUTES.has(key)) return sendJson(res,404,{error:'ROUTE_NOT_ALLOWLISTED'});
      const endpoint = fantasyPath(key,url);
      if (!endpoint || (['league','standings','market','rivals'].includes(key) && !url.searchParams.get('id')) || (['squad','budget'].includes(key) && !url.searchParams.get('teamId'))) return sendJson(res,400,{error:'MISSING_PARAMETER'});
      try { return sendJson(res,200,await upstream(endpoint,session)); }
      catch (error) { return sendJson(res,error.status === 401 ? 401 : 502,{error:'UPSTREAM_READ_FAILED',status:error.status || 502}); }
    }

    if (url.pathname === '/api/data/teams' && req.method === 'GET') return sendJson(res,200,await fetchTeams(config));
    if (url.pathname === '/api/data/players' && req.method === 'GET') return sendJson(res,200,await fetchPlayers(config,Number(url.searchParams.get('page') || 1)));
    if (url.pathname === '/api/data/standings' && req.method === 'GET') return sendJson(res,200,await fetchStandings(config));
    if (url.pathname === '/api/data/injuries' && req.method === 'GET') return sendJson(res,200,await fetchInjuries(config));

    if (url.pathname === '/api/fixtures' && req.method === 'GET') return sendJson(res,200,await fetchMultiProviderFixtures(config));
    if (url.pathname === '/api/fixtures/api-football' && req.method === 'GET') {
      const days = Math.min(Math.max(Number(url.searchParams.get('days') || config.footballDataDays),1),90);
      const from = new Date().toISOString().slice(0,10);
      const to = new Date(Date.now()+days*86400000).toISOString().slice(0,10);
      return sendJson(res,200,{provider:'api-football',matches:await fetchApiFootballFixtures(config,from,to)});
    }
    if (url.pathname === '/api/fixtures/sportmonks' && req.method === 'GET') {
      const days = Math.min(Math.max(Number(url.searchParams.get('days') || config.footballDataDays),1),90);
      const from = new Date().toISOString().slice(0,10);
      const to = new Date(Date.now()+days*86400000).toISOString().slice(0,10);
      return sendJson(res,200,{provider:'sportmonks',matches:await fetchSportmonksFixtures(config,from,to)});
    }

    if (req.method === 'GET' && serveStatic(res,url.pathname)) return;
    return sendJson(res,404,{error:'NOT_FOUND'});
  } catch (error) {
    console.error('SERVER_ERROR', error?.message || error);
    return sendJson(res,error?.status || 500,{error:error?.message || 'INTERNAL_SERVER_ERROR'});
  }
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
server.requestTimeout = 120000;
server.on('error', error => console.error('SERVER_LISTEN_ERROR', error));
server.listen(config.port, config.host, () => console.log(`Fantasy Manager backend on ${config.host}:${config.port} · ${VERSION}`));

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
