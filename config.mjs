export const VERSION = '2.5.0';

export const DEFAULTS = {
  laligaApiBaseUrl: 'https://fantasy-api.llt-services.com',
  laligaCompetitionId: '1',
  sessionCookieName: 'fm_session',
  allowOrigin: '',
  iosSuccessRedirect: 'laligafantasy://auth-complete',
  footballDataBase: 'https://api.football-data.org/v4',
  footballDataCompetition: 'PD',
  footballDataDays: 30,
  laligaSigninPolicy: 'B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN',
  laligaTokenUrl: 'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token'
};

/* Compatibilidad con las variables antiguas que usamos durante el montaje.
   Se convierten a los nombres canónicos antes de arrancar server.mjs. */
const aliases = {
  LALIGA_COMPETITION_ID: 'LALIGA_CONCOMPETENCIA_ID',
  SESSION_COOKIE_NAME: 'SESIÓN_NOMBRE_DE LA_COOKIE',
  FOOTBALL_DATA_COMPETITION: 'COMPETENCIA_DE_DATOS_DE_FÚTBOL',
  FOOTBALL_DATA_DAYS: 'DÍAS_DE_DATOS_DE_FÚTBOL'
};

for (const [canonical, legacy] of Object.entries(aliases)) {
  if (!process.env[canonical] && process.env[legacy]) {
    process.env[canonical] = process.env[legacy];
  }
}

function nonEmpty(value, fallback){
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function readConfig(env = process.env){
  const rawDays = Number(env.FOOTBALL_DATA_DAYS ?? DEFAULTS.footballDataDays);
  const footballDataDays = Math.min(
    Math.max(Number.isFinite(rawDays) ? rawDays : DEFAULTS.footballDataDays, 1),
    90
  );

  return {
    port: Number(env.PORT || 3005),
    host: nonEmpty(env.HOST, '0.0.0.0'),
    laligaApiBaseUrl: nonEmpty(env.LALIGA_API_BASE_URL, DEFAULTS.laligaApiBaseUrl).replace(/\/+$/, ''),
    laligaCompetitionId: nonEmpty(env.LALIGA_COMPETITION_ID, DEFAULTS.laligaCompetitionId),
    sessionCookieName: nonEmpty(env.SESSION_COOKIE_NAME, DEFAULTS.sessionCookieName),
    allowOrigin: String(env.ALLOW_ORIGIN ?? DEFAULTS.allowOrigin).trim(),
    iosSuccessRedirect: nonEmpty(env.IOS_SUCCESS_REDIRECT, DEFAULTS.iosSuccessRedirect),
    footballDataToken: String(env.FOOTBALL_DATA_TOKEN ?? ''),
    footballDataBase: DEFAULTS.footballDataBase,
    footballDataCompetition: nonEmpty(env.FOOTBALL_DATA_COMPETITION, DEFAULTS.footballDataCompetition),
    footballDataDays,
    laligaAuthorizeUrl: String(env.LALIGA_AUTHORIZE_URL ?? '').trim(),
    laligaOAuthClientId: String(env.LALIGA_OAUTH_CLIENT_ID ?? '').trim(),
    laligaRedirectUri: String(env.LALIGA_REDIRECT_URI ?? '').trim(),
    laligaSigninPolicy: nonEmpty(env.LALIGA_SIGNIN_POLICY, DEFAULTS.laligaSigninPolicy),
    laligaTokenUrl: nonEmpty(env.LALIGA_TOKEN_URL, DEFAULTS.laligaTokenUrl),
    secureCookie: env.SECURE_COOKIE !== 'false',
    frontendUrl: nonEmpty(env.FRONTEND_URL, '/')
  };
}

export function oidcConfigured(config){
  return Boolean(
    config.laligaAuthorizeUrl &&
    config.laligaOAuthClientId &&
    config.laligaRedirectUri
  );
}

export function publicStaticPath(pathname){
  return new Set([
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js'
  ]).has(pathname);
}
