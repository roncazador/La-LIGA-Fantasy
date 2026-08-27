import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  VERSION,
  readConfig,
  oidcConfigured,
  publicStaticPath
} from './config.mjs';

import {
  providerStatus,
  fetchApiFootballFixtures,
  fetchSportmonksFixtures,
  fetchMultiProviderFixtures
} from './providers.mjs';

const config = readConfig();
const sessions = new Map();
const STATIC_DIR = path.resolve(process.env.FRONTEND_DIR || process.cwd());

const READ_ROUTES = new Set([
  'profile', 'leagues', 'league', 'squad', 'budget', 'market', 'fixtures',
  'players', 'stats', 'rivals', 'standings', 'week'
]);

const SESSION_PENDING_TTL = 15 * 60 * 1000;
const SESSION_ACTIVE_TTL = 30 * 24 * 60 * 60 * 1000;

function sendJson(res, status, body){
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY'
  };
  if (config.allowOrigin) {
    headers['Access-Control-Allow-Origin'] = config.allowOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function parseCookies(req){
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); }
    catch { out[key] = value; }
  }
  return out;
}

function getSession(req){
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

function cleanSessions(){
  const now = Date.now();
  for (const [id, session] of sessions) {
    const ttl = session.accessToken ? SESSION_ACTIVE_TTL : SESSION_PENDING_TTL;
    if (now - session.createdAt > ttl) sessions.delete(id);
  }
}
setInterval(cleanSessions, 5 * 60 * 1000).unref();

function staticContentType(file){
  return {
    'index.html': 'text/html; charset=utf-8',
    'manifest.json': 'application/manifest+json; charset=utf-8',
    'sw.js': 'text/javascript; charset=utf-8',
    'dashboard-client.js': 'text/javascript; charset=utf-8'
  }[file] || 'application/octet-stream';
}

function serveStatic(res, pathname){
  if (!publicStaticPath(pathname)) return false;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  const full = path.resolve(STATIC_DIR, file);
  if (!full.startsWith(STATIC_DIR + path.sep)) return false;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;

  let content = fs.readFileSync(full, 'utf8');
  if (file === 'index.html' && content.includes('</body>') && !content.includes('/dashboard-client.js')) {
    content = content.replace(
      '</body>',
      '  <script src="/dashboard-client.js" defer></script>\n</body>'
    );
  }

  res.writeHead(200, {
    'Content-Type': staticContentType(file),
    'Cache-Control': file === 'index.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY'
  });
  res.end(content);
  return true;
}

function arrayData(value){
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.content)) return value.content;
  return [];
}

function objectData(value){
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return null;
}

function oidcStatus(){
  const required = ['LALIGA_AUTHORIZE_URL', 'LALIGA_OAUTH_CLIENT_ID', 'LALIGA_REDIRECT_URI'];
  return {
    configured: oidcConfigured(config),
    missing: required.filter(key => !process.env[key]),
    hasAuthorizeUrl: Boolean(config.laligaAuthorizeUrl),
    hasClientId: Boolean(config.laligaOAuthClientId),
    hasRedirectUri: Boolean(config.laligaRedirectUri),
    policy: config.laligaSigninPolicy
  };
}

async function refresh(session){
  if (!session?.refreshToken || !config.laligaOAuthClientId) return false;
  const tokenUrl = `${config.laligaTokenUrl}?p=${encodeURIComponent(config.laligaSigninPolicy)}`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: config.laligaOAuthClientId,
    scope: 'openid offline_access'
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (!data.access_token && !data.id_token)) return false;
  session.accessToken = data.access_token || data.id_token;
  session.refreshToken = data.refresh_token || session.refreshToken;
  session.expiresAt = Date.now() + Number(data.expires_in || 86400) * 1000;
  session.createdAt = Date.now();
  return true;
}

async function upstream(endpoint, session, attempt = 0){
  if (!session?.accessToken) throw Object.assign(new Error('NO_SESSION'), { status: 401 });
  if (session.expiresAt && Date.now() > session.expiresAt - 120000) await refresh(session).catch(() => false);

  const response = await fetch(config.laligaApiBaseUrl + endpoint, {
    headers: {
      Accept: 'application/json',
      'x-lang': 'es',
      Authorization: `Bearer ${session.accessToken}`,
      'User-Agent': `LALIGA-Fantasy-Manager/${VERSION}-read-only`
    }
  });
  const text = await response.text();
  if (response.status === 401 && attempt === 0 && session.refreshToken && await refresh(session)) {
    return upstream(endpoint, session, 1);
  }
  if (!response.ok) throw Object.assign(new Error(`UPSTREAM_${response.status}`), { status: response.status });
  try { return JSON.parse(text); }
  catch { return { raw: text.slice(0, 2000) }; }
}

function fantasyPath(key, url){
  const competition = encodeURIComponent(config.laligaCompetitionId);
  const week = encodeURIComponent(url.searchParams.get('week') || '1');
  switch (key) {
    case 'profile': return '/v4/user/me?x-lang=es';
    case 'leagues': return `/v1/competition/${competition}/leagues?x-lang=es`;
    case 'week': return `/v1/competition/${competition}/week/current?x-lang=es`;
    case 'players': return `/v1/competition/${competition}/players?x-lang=es`;
    case 'fixtures': return `/v1/competition/${competition}/calendar?weekNumber=${week}&x-lang=es`;
    case 'league': return `/v1/competition/${competition}/leagues/${encodeURIComponent(url.searchParams.get('id') || '')}/standing?x-lang=es`;
    case 'standings': return `/v1/competition/${competition}/leagues/${encodeURIComponent(url.searchParams.get('id') || '')}/standing/${week}?x-lang=es`;
    case 'market': return `/v1/competition/${competition}/league/${encodeURIComponent(url.searchParams.get('id') || '')}/market?x-lang=es`;
    case 'squad': return `/v1/competition/${competition}/teams/${encodeURIComponent(url.searchParams.get('teamId') || '')}?x-lang=es`;
    case 'budget': return `/v1/competition/${competition}/teams/${encodeURIComponent(url.searchParams.get('teamId') || '')}/money?x-lang=es`;
    case 'stats': return `/stats/v1/competition/${competition}/stats/week/${week}?x-lang=es`;
    case 'rivals': return `/v1/competition/${competition}/leagues/${encodeURIComponent(url.searchParams.get('id') || '')}/standing?x-lang=es`;
    default: return null;
  }
}

async function footballData(endpoint){
  if (!config.footballDataToken) throw Object.assign(new Error('FOOTBALL_DATA_NOT_CONFIGURED'), { status: 503 });
  const response = await fetch(config.footballDataBase + endpoint, {
    headers: {
      Accept: 'application/json',
      'X-Auth-Token': config.footballDataToken,
      'User-Agent': `LALIGA-Fantasy-Manager/${VERSION}`
    }
  });
  const text = await response.text();
  if (!response.ok) throw Object.assign(new Error(`FOOTBALL_DATA_${response.status}`), { status: response.status });
  try { return JSON.parse(text); }
  catch { return { raw: text.slice(0, 2000) }; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      const headers = {};
      if (config.allowOrigin) {
        headers['Access-Control-Allow-Origin'] = config.allowOrigin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
      }
      res.writeHead(204, headers);
      return res.end();
    }

    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        readOnly: true,
        competition: config.laligaCompetitionId,
        version: VERSION,
        providers: {
          laligaOAuth: oidcConfigured(config),
          footballData: Boolean(config.footballDataToken),
          ...providerStatus(config)
        }
      });
    }

    if (url.pathname === '/api/session' && req.method === 'GET') {
      return sendJson(res, 200, { authenticated: Boolean(getSession(req)), readOnly: true });
    }

    if (url.pathname === '/api/auth/status' && req.method === 'GET') {
      return sendJson(res, 200, oidcStatus());
    }

    if (url.pathname === '/api/providers/status' && req.method === 'GET') {
      return sendJson(res, 200, providerStatus(config));
    }

    /* --------------------------------
       UNIFIED NEXT FIXTURES
       API-Football is primary. Other
       configured providers are used as
       fallback and cross-check sources.
    -------------------------------- */
    if (url.pathname === '/api/fixtures/next') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET_ONLY' });
      try {
        const data = await fetchMultiProviderFixtures(config);
        const hasMatches = data.merged.length > 0;
        const hasProvider = Boolean(data.primaryProvider);
        return sendJson(res, hasMatches || hasProvider ? 200 : 503, {
          ok: hasMatches || hasProvider,
          readOnly: true,
          source: data.primaryProvider || 'none',
          competition: data.primaryProvider === 'api-football' ? config.apiFootballLeagueId : config.footballDataCompetition,
          from: data.from,
          to: data.to,
          primaryProvider: data.primaryProvider,
          providers: Object.fromEntries(
            Object.entries(data.providers).map(([name, result]) => [name, {
              ok: result.ok,
              count: result.ok ? result.matches.length : 0,
              error: result.ok ? null : result.error
            }])
          ),
          matches: data.merged
        });
      } catch (error) {
        return sendJson(res, error.status || 502, {
          error: error.message || 'FIXTURES_PROVIDER_FAILED',
          provider: error.provider || null
        });
      }
    }

    if (url.pathname === '/api/providers/fixtures/next' && req.method === 'GET') {
      try {
        const data = await fetchMultiProviderFixtures(config);
        return sendJson(res, 200, { ok: true, readOnly: true, ...data });
      } catch (error) {
        return sendJson(res, error.status || 502, {
          error: error.message || 'MULTI_PROVIDER_FAILED',
          provider: error.provider || null
        });
      }
    }

    if (url.pathname === '/api/providers/api-football/fixtures' && req.method === 'GET') {
      try {
        const now = new Date();
        const from = url.searchParams.get('from') || now.toISOString().slice(0, 10);
        const to = url.searchParams.get('to') || new Date(now.getTime() + config.footballDataDays * 86400000).toISOString().slice(0, 10);
        const matches = await fetchApiFootballFixtures(config, from, to);
        return sendJson(res, 200, { ok: true, provider: 'api-football', from, to, matches });
      } catch (error) {
        return sendJson(res, error.status || 502, { error: error.message || 'API_FOOTBALL_FAILED' });
      }
    }

    if (url.pathname === '/api/providers/sportmonks/fixtures' && req.method === 'GET') {
      try {
        const now = new Date();
        const from = url.searchParams.get('from') || now.toISOString().slice(0, 10);
        const to = url.searchParams.get('to') || new Date(now.getTime() + config.footballDataDays * 86400000).toISOString().slice(0, 10);
        const matches = await fetchSportmonksFixtures(config, from, to);
        return sendJson(res, 200, { ok: true, provider: 'sportmonks', from, to, matches });
      } catch (error) {
        return sendJson(res, error.status || 502, { error: error.message || 'SPORTMONKS_FAILED' });
      }
    }

    if (url.pathname === '/api/providers/opta/status' && req.method === 'GET') {
      const status = providerStatus(config).opta;
      return sendJson(res, 200, { provider: 'opta', ...status });
    }

    /* -------------------------
       AUTH START
    ------------------------- */

    if (url.pathname === '/auth/start') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET_ONLY' });
      if (!oidcConfigured(config)) return sendJson(res, 501, { error: 'OIDC_NOT_CONFIGURED', message: 'Faltan parámetros OIDC oficiales.' });

      const state = crypto.randomBytes(32).toString('base64url');
      const verifier = crypto.randomBytes(32).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      const sessionId = crypto.randomUUID();

      sessions.set(sessionId, {
        createdAt: Date.now(),
        state,
        verifier,
        platform: url.searchParams.get('platform') === 'ios' ? 'ios' : 'web'
      });

      const query = new URLSearchParams({
        p: config.laligaSigninPolicy,
        client_id: config.laligaOAuthClientId,
        response_type: 'code',
        redirect_uri: config.laligaRedirectUri,
        scope: `openid ${config.laligaOAuthClientId} offline_access`,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        nonce: state
      });

      res.writeHead(302, { Location: `${config.laligaAuthorizeUrl}?${query.toString()}`, 'Set-Cookie': cookieHeader(sessionId, 900) });
      return res.end();
    }

    /* -------------------------
       AUTH CALLBACK
    ------------------------- */

    if (url.pathname === '/auth/callback') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET_ONLY' });
      const sessionId = parseCookies(req)[config.sessionCookieName];
      const pending = sessionId ? sessions.get(sessionId) : null;
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      if (!pending || !code || returnedState !== pending.state) return sendJson(res, 400, { error: 'INVALID_OIDC_CALLBACK' });

      const tokenUrl = `${config.laligaTokenUrl}?p=${encodeURIComponent(config.laligaSigninPolicy)}`;
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.laligaOAuthClientId,
        code,
        redirect_uri: config.laligaRedirectUri,
        code_verifier: pending.verifier,
        scope: `openid ${config.laligaOAuthClientId} offline_access`
      });
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      const token = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || (!token.access_token && !token.id_token)) {
        return sendJson(res, 502, { error: 'OIDC_TOKEN_EXCHANGE_FAILED', status: tokenResponse.status });
      }

      sessions.set(sessionId, {
        createdAt: Date.now(),
        accessToken: token.access_token || token.id_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Number(token.expires_in || 86400) * 1000
      });

      const location = pending.platform === 'ios' ? config.iosSuccessRedirect : config.frontendUrl;
      res.writeHead(302, { Location: location, 'Set-Cookie': cookieHeader(sessionId, 2592000) });
      return res.end();
    }

    /* -------------------------
       LOGOUT
    ------------------------- */

    if (url.pathname === '/auth/logout') {
      const sessionId = parseCookies(req)[config.sessionCookieName];
      if (sessionId) sessions.delete(sessionId);
      res.writeHead(302, { Location: config.frontendUrl, 'Set-Cookie': cookieHeader('', 0) });
      return res.end();
    }

    /* -------------------------
       FANTASY DASHBOARD
    ------------------------- */

    if (url.pathname === '/api/fantasy/dashboard') {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET_ONLY' });
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: 'AUTH_REQUIRED' });

      const output = { version: VERSION, readOnly: true, competition: config.laligaCompetitionId, errors: [] };
      const [profileResult, leaguesResult, weekResult] = await Promise.allSettled([
        upstream('/v4/user/me?x-lang=es', session),
        upstream(`/v1/competition/${encodeURIComponent(config.laligaCompetitionId)}/leagues?x-lang=es`, session),
        upstream(`/v1/competition/${encodeURIComponent(config.laligaCompetitionId)}/week/current?x-lang=es`, session)
      ]);
      output.profile = profileResult.status === 'fulfilled' ? objectData(profileResult.value) || {} : {};
      output.leagues = leaguesResult.status === 'fulfilled' ? arrayData(leaguesResult.value) : [];
      output.week = weekResult.status === 'fulfilled' ? objectData(weekResult.value) || weekResult.value : {};
      if (profileResult.status === 'rejected') output.errors.push('profile');
      if (leaguesResult.status === 'rejected') output.errors.push('leagues');
      if (weekResult.status === 'rejected') output.errors.push('week');

      const league = output.leagues[0];
      const leagueId = league?.id || league?.leagueId;
      if (leagueId) {
        const competition = encodeURIComponent(config.laligaCompetitionId);
        const encodedLeague = encodeURIComponent(leagueId);
        const [standingResult, marketResult] = await Promise.allSettled([
          upstream(`/v1/competition/${competition}/leagues/${encodedLeague}/standing?x-lang=es`, session),
          upstream(`/v1/competition/${competition}/league/${encodedLeague}/market?x-lang=es`, session)
        ]);
        output.leagueId = leagueId;
        output.standing = standingResult.status === 'fulfilled' ? standingResult.value : null;
        output.market = marketResult.status === 'fulfilled' ? marketResult.value : null;
        if (standingResult.status === 'rejected') output.errors.push('standing');
        if (marketResult.status === 'rejected') output.errors.push('market');

        const rows = arrayData(output.standing);
        const profile = objectData(output.profile) || {};
        const user = profile.username || profile.email || profile.name;
        const mine = rows.find(item =>
          item?.username === user ||
          item?.managerName === user ||
          item?.manager?.username === user ||
          item?.userId === profile?.id
        );
        const teamId = mine?.teamId || mine?.team?.id || profile?.teamId || profile?.managerId;
        if (teamId) {
          const encodedTeam = encodeURIComponent(teamId);
          const [teamResult, budgetResult] = await Promise.allSettled([
            upstream(`/v1/competition/${competition}/teams/${encodedTeam}?x-lang=es`, session),
            upstream(`/v1/competition/${competition}/teams/${encodedTeam}/money?x-lang=es`, session)
          ]);
          output.team = teamResult.status === 'fulfilled' ? teamResult.value : null;
          output.budget = budgetResult.status === 'fulfilled' ? budgetResult.value : null;
          output.teamId = teamId;
          if (teamResult.status === 'rejected') output.errors.push('team');
          if (budgetResult.status === 'rejected') output.errors.push('budget');
        }
      }

      return sendJson(res, 200, output);
    }

    /* -------------------------
       GENERIC FANTASY READ API
    ------------------------- */

    if (url.pathname.startsWith('/api/fantasy/')) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'READ_ONLY' });
      const session = getSession(req);
      if (!session) return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
      const key = url.pathname.split('/').filter(Boolean)[2] || '';
      if (!READ_ROUTES.has(key)) return sendJson(res, 404, { error: 'ROUTE_NOT_ALLOWLISTED' });
      const endpoint = fantasyPath(key, url);
      if (!endpoint) return sendJson(res, 400, { error: 'MISSING_PARAMETER' });
      try {
        return sendJson(res, 200, await upstream(endpoint, session));
      } catch (error) {
        return sendJson(res, error.status === 401 ? 401 : 502, { error: 'UPSTREAM_READ_FAILED', status: error.status || 502 });
      }
    }

    if (req.method === 'GET' && serveStatic(res, url.pathname)) return;
    return sendJson(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    console.error('SERVER_ERROR', error);
    return sendJson(res, 500, { error: 'INTERNAL_SERVER_ERROR' });
  }
});

function cookieHeader(id, maxAge){
  const secure = config.secureCookie ? 'Secure; ' : '';
  return `${config.sessionCookieName}=${encodeURIComponent(id)}; HttpOnly; SameSite=Lax; ${secure}Path=/; Max-Age=${maxAge}`;
}

server.listen(config.port, config.host, () => {
  console.log(`Fantasy Manager backend on ${config.host}:${config.port}`);
});
