import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOST || '0.0.0.0';

const API_BASE = (
  process.env.LALIGA_API_BASE_URL ||
  'https://fantasy-api.llt-services.com'
).replace(/\/+$/, '');

const COMP = (
  process.env.LALIGA_COMPETITION_ID ||
  '1'
);

const COOKIE = (
  process.env.SESSION_COOKIE_NAME ||
  'fm_session'
);

const ORIGIN = (
  process.env.ALLOW_ORIGIN ||
  '*'
);

const VERSION = '2.4.0';

const IOS_SUCCESS_REDIRECT =
  process.env.IOS_SUCCESS_REDIRECT ||
  'laligafantasy://auth-complete';

/*
  Proveedor externo opcional.

  Nunca se guarda el token en index.html,
  GitHub, README ni código fuente.

  El token se introduce únicamente como:
  FOOTBALL_DATA_TOKEN
  en Render > Environment.
*/
const FOOTBALL_DATA_BASE =
  'https://api.football-data.org/v4';

const FOOTBALL_DATA_TOKEN =
  process.env.FOOTBALL_DATA_TOKEN || '';

const FOOTBALL_DATA_COMPETITION =
  process.env.FOOTBALL_DATA_COMPETITION || 'PD';

const FOOTBALL_DATA_DAYS =
  Math.min(
    Math.max(
      Number(process.env.FOOTBALL_DATA_DAYS || 30),
      1
    ),
    90
  );

const sessions = new Map();

const STATIC_DIR = path.resolve(
  process.env.FRONTEND_DIR ||
  process.cwd()
);


/* =========================================
   STATIC
========================================= */

function serveStatic(res, pathname){

  const file =
    pathname === '/'
      ? 'index.html'
      : pathname.replace(/^\/+/, '');

  const full =
    path.resolve(
      STATIC_DIR,
      file
    );

  if(
    !full.startsWith(
      STATIC_DIR + path.sep
    ) ||
    !fs.existsSync(full) ||
    !fs.statSync(full).isFile()
  ){

    return false;

  }

  const types = {
    '.html':
      'text/html; charset=utf-8',

    '.js':
      'text/javascript; charset=utf-8',

    '.json':
      'application/json; charset=utf-8',

    '.css':
      'text/css; charset=utf-8',

    '.webmanifest':
      'application/manifest+json'
  };

  res.writeHead(
    200,
    {
      'Content-Type':
        types[
          path.extname(full)
        ] ||
        'application/octet-stream',

      'Cache-Control':
        file === 'index.html'
          ? 'no-cache'
          : 'public, max-age=3600',

      'X-Content-Type-Options':
        'nosniff'
    }
  );

  res.end(
    fs.readFileSync(full)
  );

  return true;

}


/* =========================================
   API
========================================= */

const allow = new Set([
  'profile',
  'leagues',
  'league',
  'squad',
  'budget',
  'market',
  'fixtures',
  'players',
  'stats',
  'rivals',
  'standings',
  'week'
]);


function reply(
  res,
  status,
  body
){

  res.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Cache-Control':
        'no-store',

      'Access-Control-Allow-Origin':
        ORIGIN,

      'Access-Control-Allow-Credentials':
        'true',

      'X-Content-Type-Options':
        'nosniff',

      'Referrer-Policy':
        'no-referrer',

      'X-Frame-Options':
        'DENY'
    }
  );

  res.end(
    JSON.stringify(body)
  );

}


function cookies(req){

  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map(
        s => s.trim()
      )
      .filter(Boolean)
      .map(
        s => {

          const i =
            s.indexOf('=');

          return [
            s.slice(0, i),
            decodeURIComponent(
              s.slice(i + 1)
            )
          ];

        }
      )
  );

}


function session(req){

  const id =
    cookies(req)[COOKIE];

  return id
    ? sessions.get(id)
    : null;

}


function arr(x){

  if(Array.isArray(x)){
    return x;
  }

  if(
    Array.isArray(x?.data)
  ){
    return x.data;
  }

  if(
    Array.isArray(x?.items)
  ){
    return x.items;
  }

  if(
    Array.isArray(x?.content)
  ){
    return x.content;
  }

  return [];

}


function obj(x){

  return (
    x?.data &&
    typeof x.data === 'object' &&
    !Array.isArray(x.data)
  )
    ? x.data
    : (
      x &&
      typeof x === 'object' &&
      !Array.isArray(x)
    )
      ? x
      : null;

}


/* =========================================
   LALIGA OIDC
========================================= */

function oidcStatus(){

  const required = [
    'LALIGA_AUTHORIZE_URL',
    'LALIGA_OAUTH_CLIENT_ID',
    'LALIGA_REDIRECT_URI'
  ];

  const missing =
    required.filter(
      key => !process.env[key]
    );

  return {
    configured:
      missing.length === 0,

    missing,

    hasAuthorizeUrl:
      !!process.env.LALIGA_AUTHORIZE_URL,

    hasClientId:
      !!process.env.LALIGA_OAUTH_CLIENT_ID,

    hasRedirectUri:
      !!process.env.LALIGA_REDIRECT_URI,

    policy:
      process.env.LALIGA_SIGNIN_POLICY ||
      'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN'
  };

}


async function refresh(s){

  if(
    !s?.refreshToken ||
    !process.env.LALIGA_OAUTH_CLIENT_ID
  ){

    return false;

  }


  const url =
    (
      process.env.LALIGA_TOKEN_URL ||
      'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token'
    ) +
    '?p=' +
    (
      process.env.LALIGA_SIGNIN_POLICY ||
      'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN'
    );


  const body =
    new URLSearchParams({
      grant_type:
        'refresh_token',

      refresh_token:
        s.refreshToken,

      client_id:
        process.env.LALIGA_OAUTH_CLIENT_ID,

      scope:
        'openid offline_access'
    });


  const r =
    await fetch(
      url,
      {
        method:'POST',

        headers:{
          'Content-Type':
            'application/x-www-form-urlencoded'
        },

        body
      }
    );


  const j =
    await r
      .json()
      .catch(
        () => ({})
      );


  if(!r.ok){

    return false;

  }


  s.accessToken =
    j.access_token ||
    j.id_token ||
    s.accessToken;

  s.refreshToken =
    j.refresh_token ||
    s.refreshToken;

  s.expiresAt =
    Date.now() +
    Number(
      j.expires_in ||
      j.id_token_expires_in ||
      86400
    ) *
    1000;

  return true;

}


/* =========================================
   LALIGA UPSTREAM
========================================= */

async function upstream(
  endpoint,
  s,
  attempt = 0
){

  if(!s?.accessToken){

    throw Error(
      'NO_SESSION'
    );

  }


  if(
    s.expiresAt &&
    Date.now() >
      s.expiresAt - 120000
  ){

    await refresh(s)
      .catch(
        () => false
      );

  }


  const r =
    await fetch(
      API_BASE + endpoint,
      {
        headers:{
          Accept:
            'application/json',

          'x-lang':
            'es',

          Authorization:
            'Bearer ' +
            s.accessToken,

          'User-Agent':
            'LALIGA-Fantasy-Manager/2.4.0-read-only'
        }
      }
    );


  const text =
    await r.text();


  if(
    r.status === 401 &&
    attempt === 0 &&
    s.refreshToken &&
    await refresh(s)
  ){

    return upstream(
      endpoint,
      s,
      1
    );

  }


  if(!r.ok){

    const error =
      Error(
        'UPSTREAM_' +
        r.status
      );

    error.status =
      r.status;

    throw error;

  }


  try{

    return JSON.parse(text);

  }catch{

    return {
      raw:
        text.slice(
          0,
          2000
        )
    };

  }

}


/* =========================================
   LALIGA PATHS
========================================= */

const paths = {

  profile:
    '/v4/user/me?x-lang=es',

  leagues:
    `/v1/competition/${COMP}/leagues?x-lang=es`,

  week:
    `/v1/competition/${COMP}/week/current?x-lang=es`,

  players:
    `/v1/competition/${COMP}/players?x-lang=es`,

  fixtures:
    week =>
      `/v1/competition/${COMP}/calendar?weekNumber=${encodeURIComponent(
        week
      )}&x-lang=es`,

  league:
    id =>
      `/v1/competition/${COMP}/leagues/${encodeURIComponent(
        id
      )}/standing?x-lang=es`,

  standings:
    (id, week) =>
      `/v1/competition/${COMP}/leagues/${encodeURIComponent(
        id
      )}/standing/${encodeURIComponent(
        week
      )}?x-lang=es`,

  market:
    id =>
      `/v1/competition/${COMP}/league/${encodeURIComponent(
        id
      )}/market?x-lang=es`,

  squad:
    id =>
      `/v1/competition/${COMP}/teams/${encodeURIComponent(
        id
      )}?x-lang=es`,

  budget:
    id =>
      `/v1/competition/${COMP}/teams/${encodeURIComponent(
        id
      )}/money?x-lang=es`,

  stats:
    week =>
      `/stats/v1/competition/${COMP}/stats/week/${encodeURIComponent(
        week
      )}?x-lang=es`
};


/* =========================================
   FOOTBALL-DATA.ORG
========================================= */

async function footballData(
  endpoint
){

  if(!FOOTBALL_DATA_TOKEN){

    const error =
      Error(
        'FOOTBALL_DATA_NOT_CONFIGURED'
      );

    error.status =
      503;

    throw error;

  }


  const r =
    await fetch(
      FOOTBALL_DATA_BASE +
      endpoint,
      {
        headers:{
          Accept:
            'application/json',

          'X-Auth-Token':
            FOOTBALL_DATA_TOKEN,

          'User-Agent':
            'LALIGA-Fantasy-Manager/2.4.0'
        }
      }
    );


  const text =
    await r.text();


  if(!r.ok){

    const error =
      Error(
        'FOOTBALL_DATA_' +
        r.status
      );

    error.status =
      r.status;

    error.body =
      text.slice(
        0,
        1000
      );

    throw error;

  }


  try{

    return JSON.parse(text);

  }catch{

    return {
      raw:
        text.slice(
          0,
          2000
        )
    };

  }

}


/* =========================================
   SERVIDOR
========================================= */

http.createServer(
  async(req,res)=>{

    try{

      if(
        req.method ===
        'OPTIONS'
      ){

        return reply(
          res,
          204,
          {}
        );

      }


      const u =
        new URL(
          req.url,
          'http://' +
          req.headers.host
        );


      /* -------------------------
         HEALTH
      ------------------------- */

      if(
        u.pathname ===
        '/api/health'
      ){

        return reply(
          res,
          200,
          {
            ok:true,

            readOnly:true,

            competition:COMP,

            version:VERSION,

            providers:{
              laligaOAuth:
                oidcStatus().configured,

              footballData:
                !!FOOTBALL_DATA_TOKEN
            }
          }
        );

      }


      /* -------------------------
         SESSION
      ------------------------- */

      if(
        u.pathname ===
        '/api/session'
      ){

        return reply(
          res,
          200,
          {
            authenticated:
              !!session(req),

            readOnly:true
          }
        );

      }


      /* -------------------------
         AUTH STATUS
      ------------------------- */

      if(
        u.pathname ===
        '/api/auth/status'
      ){

        return reply(
          res,
          200,
          oidcStatus()
        );

      }


      /* -------------------------
         FOOTBALL-DATA STATUS
      ------------------------- */

      if(
        u.pathname ===
        '/api/providers/status'
      ){

        return reply(
          res,
          200,
          {
            footballData:{
              configured:
                !!FOOTBALL_DATA_TOKEN,

              competition:
                FOOTBALL_DATA_COMPETITION
            },

            laliga:{
              configured:
                oidcStatus().configured
            }
          }
        );

      }


      /* -------------------------
         NEXT FIXTURES
      ------------------------- */

      if(
        u.pathname ===
        '/api/fixtures/next'
      ){

        if(
          !FOOTBALL_DATA_TOKEN
        ){

          return reply(
            res,
            503,
            {
              error:
                'FOOTBALL_DATA_NOT_CONFIGURED',

              message:
                'Configura FOOTBALL_DATA_TOKEN en Render.'
            }
          );

        }


        const today =
          new Date();


        const from =
          today
            .toISOString()
            .slice(
              0,
              10
            );


        const future =
          new Date(
            today.getTime() +
            FOOTBALL_DATA_DAYS *
            86400000
          );


        const to =
          future
            .toISOString()
            .slice(
              0,
              10
            );


        const data =
          await footballData(
            `/competitions/${encodeURIComponent(
              FOOTBALL_DATA_COMPETITION
            )}/matches?dateFrom=${from}&dateTo=${to}`
          );


        return reply(
          res,
          200,
          {
            source:
              'football-data.org',

            competition:
              FOOTBALL_DATA_COMPETITION,

            from,

            to,

            matches:
              Array.isArray(
                data.matches
              )
                ? data.matches
                : []
          }
        );

      }


      /* -------------------------
         AUTH START
      ------------------------- */

      if(
        u.pathname ===
        '/auth/start'
      ){

        const authorize =
          process.env.LALIGA_AUTHORIZE_URL;

        const clientId =
          process.env.LALIGA_OAUTH_CLIENT_ID;

        const redirectUri =
          process.env.LALIGA_REDIRECT_URI;

        const policy =
          process.env.LALIGA_SIGNIN_POLICY ||
          'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN';


        if(
          !authorize ||
          !clientId ||
          !redirectUri
        ){

          return reply(
            res,
            501,
            {
              error:
                'OIDC_NOT_CONFIGURED',

              message:
                'Faltan parámetros OIDC oficiales.'
            }
          );

        }


        const bytes =
          crypto.getRandomValues(
            new Uint8Array(32)
          );


        const state =
          Buffer
            .from(bytes)
            .toString(
              'base64url'
            );


        const verifier =
          Buffer
            .from(
              crypto.getRandomValues(
                new Uint8Array(32)
              )
            )
            .toString(
              'base64url'
            );


        const challenge =
          Buffer
            .from(
              await crypto.subtle.digest(
                'SHA-256',
                Buffer.from(
                  verifier
                )
              )
            )
            .toString(
              'base64url'
            );


        const sid =
          crypto.randomUUID();


        sessions.set(
          sid,
          {
            createdAt:
              Date.now(),

            state,

            verifier,

            platform:
              u.searchParams.get(
                'platform'
              ) === 'ios'
                ?'ios'
                :'web'
          }
        );


        const q =
          new URLSearchParams({
            p:
              policy,

            client_id:
              clientId,

            response_type:
              'code',

            redirect_uri:
              redirectUri,

            scope:
              `openid ${clientId} offline_access`,

            code_challenge:
              challenge,

            code_challenge_method:
              'S256',

            state,

            nonce:
              state
          });


        res.writeHead(
          302,
          {
            Location:
              authorize +
              '?' +
              q.toString(),

            'Set-Cookie':
              `${COOKIE}=${encodeURIComponent(
                sid
              )}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=900`
          }
        );


        return res.end();

      }


      /* -------------------------
         AUTH CALLBACK
      ------------------------- */

      if(
        u.pathname ===
        '/auth/callback'
      ){

        const sid =
          cookies(req)[COOKIE];

        const pending =
          sid
            ? sessions.get(sid)
            : null;

        const code =
          u.searchParams.get(
            'code'
          );

        const state =
          u.searchParams.get(
            'state'
          );


        if(
          !pending ||
          !code ||
          state !== pending.state
        ){

          return reply(
            res,
            400,
            {
              error:
                'INVALID_OIDC_CALLBACK'
            }
          );

        }


        const tokenUrl =
          (
            process.env.LALIGA_TOKEN_URL ||
            'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token'
          ) +
          '?p=' +
          (
            process.env.LALIGA_SIGNIN_POLICY ||
            'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN'
          );


        const body =
          new URLSearchParams({
            grant_type:
              'authorization_code',

            client_id:
              process.env.LALIGA_OAUTH_CLIENT_ID,

            code,

            redirect_uri:
              process.env.LALIGA_REDIRECT_URI,

            code_verifier:
              pending.verifier,

            scope:
              `openid ${process.env.LALIGA_OAUTH_CLIENT_ID} offline_access`
          });


        const tr =
          await fetch(
            tokenUrl,
            {
              method:
                'POST',

              headers:{
                'Content-Type':
                  'application/x-www-form-urlencoded'
              },

              body
            }
          );


        const tj =
          await tr
            .json()
            .catch(
              () => ({})
            );


        if(!tr.ok){

          return reply(
            res,
            502,
            {
              error:
                'OIDC_TOKEN_EXCHANGE_FAILED',

              status:
                tr.status
            }
          );

        }


        sessions.set(
          sid,
          {
            createdAt:
              Date.now(),

            accessToken:
              tj.access_token ||
              tj.id_token,

            refreshToken:
              tj.refresh_token,

            expiresAt:
              Date.now() +
              Number(
                tj.expires_in ||
                86400
              ) *
              1000
          }
        );


        const location =
          pending.platform === 'ios'
            ? IOS_SUCCESS_REDIRECT
            : (
              process.env.FRONTEND_URL ||
              '/'
            );


        res.writeHead(
          302,
          {
            Location:
              location,

            'Set-Cookie':
              `${COOKIE}=${encodeURIComponent(
                sid
              )}; HttpOnly; SameSite=Lax; ${
                process.env.SECURE_COOKIE === 'false'
                  ? ''
                  : 'Secure;'
              } Path=/; Max-Age=2592000`
          }
        );


        return res.end();

      }


      /* -------------------------
         LOGOUT
      ------------------------- */

      if(
        u.pathname ===
        '/auth/logout'
      ){

        const sid =
          cookies(req)[COOKIE];


        if(sid){

          sessions.delete(
            sid
          );

        }


        res.writeHead(
          302,
          {
            Location:
              process.env.FRONTEND_URL ||
              '/',

            'Set-Cookie':
              `${COOKIE}=; HttpOnly; SameSite=Lax; ${
                process.env.SECURE_COOKIE === 'false'
                  ? ''
                  : 'Secure;'
              } Path=/; Max-Age=0`
          }
        );


        return res.end();

      }


      /* -------------------------
         FANTASY DASHBOARD
      ------------------------- */

      if(
        u.pathname ===
        '/api/fantasy/dashboard'
      ){

        const s =
          session(req);


        if(!s){

          return reply(
            res,
            401,
            {
              error:
                'AUTH_REQUIRED'
            }
          );

        }


        const out = {
          version:
            VERSION,

          readOnly:
            true,

          competition:
            COMP,

          errors:[]
        };


        const [
          pr,
          ls,
          wk
        ] =
          await Promise.allSettled([
            upstream(
              paths.profile,
              s
            ),

            upstream(
              paths.leagues,
              s
            ),

            upstream(
              paths.week,
              s
            )
          ]);


        out.profile =
          pr.status === 'fulfilled'
            ? obj(pr.value) || {}
            : {};


        out.leagues =
          ls.status === 'fulfilled'
            ? arr(ls.value)
            : [];


        out.week =
          wk.status === 'fulfilled'
            ? obj(wk.value) ||
              wk.value
            : {};


        if(
          pr.status === 'rejected'
        ){

          out.errors.push(
            'profile'
          );

        }


        if(
          ls.status === 'rejected'
        ){

          out.errors.push(
            'leagues'
          );

        }


        if(
          wk.status === 'rejected'
        ){

          out.errors.push(
            'week'
          );

        }


        const league =
          out.leagues[0];


        const leagueId =
          league?.id ||
          league?.leagueId;


        if(leagueId){

          const [
            st,
            m
          ] =
            await Promise.allSettled([
              upstream(
                paths.league(
                  leagueId
                ),
                s
              ),

              upstream(
                paths.market(
                  leagueId
                ),
                s
              )
            ]);


          out.leagueId =
            leagueId;


          out.standing =
            st.status === 'fulfilled'
              ? st.value
              : null;


          out.market =
            m.status === 'fulfilled'
              ? m.value
              : null;


          if(
            st.status ===
            'rejected'
          ){

            out.errors.push(
              'standing'
            );

          }


          if(
            m.status ===
            'rejected'
          ){

            out.errors.push(
              'market'
            );

          }


          const rows =
            arr(
              out.standing
            );


          const user =
            out.profile?.username ||
            out.profile?.email ||
            out.profile?.name;


          const mine =
            rows.find(
              x =>
                x?.username === user ||
                x?.managerName === user ||
                x?.manager?.username === user ||
                x?.userId === out.profile?.id
            );


          const teamId =
            mine?.teamId ||
            mine?.team?.id ||
            out.profile?.teamId ||
            out.profile?.managerId;


          if(teamId){

            const [
              tm,
              bd
            ] =
              await Promise.allSettled([
                upstream(
                  paths.squad(
                    teamId
                  ),
                  s
                ),

                upstream(
                  paths.budget(
                    teamId
                  ),
                  s
                )
              ]);


            out.team =
              tm.status === 'fulfilled'
                ? tm.value
                : null;


            out.budget =
              bd.status === 'fulfilled'
                ? bd.value
                : null;


            out.teamId =
              teamId;

          }

        }


        return reply(
          res,
          200,
          out
        );

      }


      /* -------------------------
         GENERIC FANTASY READ API
      ------------------------- */

      if(
        u.pathname.startsWith(
          '/api/fantasy/'
        )
      ){

        if(
          req.method !==
          'GET'
        ){

          return reply(
            res,
            405,
            {
              error:
                'READ_ONLY'
            }
          );

        }


        const s =
          session(req);


        if(!s){

          return reply(
            res,
            401,
            {
              error:
                'AUTH_REQUIRED'
            }
          );

        }


        const key =
          u.pathname
            .split('/')
            .filter(Boolean)[2] ||
          '';


        if(
          !allow.has(key)
        ){

          return reply(
            res,
            404,
            {
              error:
                'ROUTE_NOT_ALLOWLISTED'
            }
          );

        }


        let endpoint;


        if(
          key ===
          'profile'
        ){

          endpoint =
            paths.profile;

        }


        if(
          key ===
          'leagues'
        ){

          endpoint =
            paths.leagues;

        }


        if(
          key ===
          'week'
        ){

          endpoint =
            paths.week;

        }


        if(
          key ===
          'players'
        ){

          endpoint =
            paths.players;

        }


        if(
          key ===
          'fixtures'
        ){

          endpoint =
            paths.fixtures(
              u.searchParams.get(
                'week'
              ) || 1
            );

        }


        if(
          key ===
          'stats'
        ){

          endpoint =
            paths.stats(
              u.searchParams.get(
                'week'
              ) || 1
            );

        }


        if(
          key ===
          'league'
        ){

          endpoint =
            paths.league(
              u.searchParams.get(
                'id'
              )
            );

        }


        if(
          key ===
          'standings'
        ){

          endpoint =
            paths.standings(
              u.searchParams.get(
                'id'
              ),
              u.searchParams.get(
                'week'
              ) || 1
            );

        }


        if(
          key ===
          'market'
        ){

          endpoint =
            paths.market(
              u.searchParams.get(
                'id'
              )
            );

        }


        if(
          key ===
          'squad'
        ){

          endpoint =
            paths.squad(
              u.searchParams.get(
                'teamId'
              )
            );

        }


        if(
          key ===
          'budget'
        ){

          endpoint =
            paths.budget(
              u.searchParams.get(
                'teamId'
              )
            );

        }


        if(
          key ===
          'rivals'
        ){

          endpoint =
            paths.league(
              u.searchParams.get(
                'id'
              )
            );

        }


        if(!endpoint){

          return reply(
            res,
            400,
            {
              error:
                'MISSING_PARAMETER'
            }
          );

        }


        try{

          return reply(
            res,
            200,
            await upstream(
              endpoint,
              s
            )
          );

        }catch(e){

          return reply(
            res,
            e.status === 401
              ? 401
              : 502,
            {
              error:
                'UPSTREAM_READ_FAILED',

              status:
                e.status || 502
            }
          );

        }

      }


      /* -------------------------
         STATIC
      ------------------------- */

      if(
        req.method ===
        'GET' &&
        serveStatic(
          res,
          u.pathname
        )
      ){

        return;

      }


      return reply(
        res,
        404,
        {
          error:
            'NOT_FOUND'
        }
      );


    }catch(error){

      console.error(
        'SERVER_ERROR',
        error
      );


      return reply(
        res,
        500,
        {
          error:
            'INTERNAL_SERVER_ERROR'
        }
      );

    }

  }

).listen(
  PORT,
  HOST,
  ()=>{
    console.log(
      `Fantasy Manager backend on ${HOST}:${PORT}`
    );
  }
);