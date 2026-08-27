function providerError(name, status, message){
  return Object.assign(new Error(message || `${name}_FAILED`), {
    provider: name,
    status: status || 502
  });
}

async function getJson(name, url, headers = {}){
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LALIGA-Fantasy-Manager/2.7.0',
        ...headers
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    throw providerError(name, 502, error?.name === 'TimeoutError' ? `${name}_TIMEOUT` : `${name}_NETWORK_ERROR`);
  }

  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); }
  catch { throw providerError(name, response.status || 502, `${name}_INVALID_JSON`); }

  if (!response.ok) {
    const upstreamMessage = data?.message || data?.errors?.join?.(', ') || '';
    throw providerError(name, response.status, `${name}_${response.status}${upstreamMessage ? `: ${upstreamMessage}` : ''}`);
  }
  return data;
}

function daysWindow(days){
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 90);
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + safeDays * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

function normalizeFootballData(data){
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  return matches.map(match => ({
    provider: 'football-data.org',
    id: String(match?.id ?? ''),
    competitionId: String(match?.competition?.code ?? ''),
    utcDate: match?.utcDate || null,
    home: match?.homeTeam?.name || null,
    away: match?.awayTeam?.name || null,
    status: match?.status || null,
    matchday: Number.isFinite(Number(match?.matchday)) ? Number(match.matchday) : null,
    raw: match
  }));
}

function normalizeApiFootball(data){
  const matches = Array.isArray(data?.response) ? data.response : [];
  return matches.map(match => ({
    provider: 'api-football',
    id: String(match?.fixture?.id ?? ''),
    competitionId: String(match?.league?.id ?? ''),
    utcDate: match?.fixture?.date || null,
    home: match?.teams?.home?.name || null,
    away: match?.teams?.away?.name || null,
    status: match?.fixture?.status?.short || null,
    matchday: Number.isFinite(Number(match?.league?.round)) ? Number(match.league.round) : null,
    raw: match
  }));
}

function normalizeSportmonks(data){
  const matches = Array.isArray(data?.data) ? data.data : [];
  return matches.map(match => {
    const participants = Array.isArray(match?.participants) ? match.participants : [];
    const home = participants.find(item => item?.meta?.location === 'home') || participants[0];
    const away = participants.find(item => item?.meta?.location === 'away') || participants[1];
    return {
      provider: 'sportmonks',
      id: String(match?.id ?? ''),
      competitionId: String(match?.league_id ?? ''),
      utcDate: match?.starting_at || null,
      home: home?.name || null,
      away: away?.name || null,
      status: match?.state?.short_name || match?.state?.name || null,
      matchday: null,
      raw: match
    };
  });
}

export function providerStatus(config){
  return {
    footballData: {
      configured: Boolean(config.footballDataToken),
      competition: config.footballDataCompetition,
      freeForCurrentCompetition: Boolean(config.footballDataToken)
    },
    sportmonks: {
      configured: Boolean(config.sportmonksToken && config.sportmonksLeagueId),
      leagueConfigured: Boolean(config.sportmonksLeagueId),
      seasonConfigured: Boolean(config.sportmonksSeasonId),
      note: 'El plan gratuito actual de Sportmonks incluye dos competiciones (Dinamarca y Escocia); LaLiga requiere cobertura compatible con tu plan/trial.'
    },
    apiFootball: {
      configured: Boolean(config.apiFootballKey),
      leagueId: config.apiFootballLeagueId,
      season: config.apiFootballSeason,
      note: 'El plan gratuito actual permite 100 solicitudes/día.'
    },
    opta: {
      configured: Boolean(config.optaToken && config.optaBaseUrl && config.optaFixturesPath),
      contractReady: Boolean(config.optaBaseUrl && config.optaFixturesPath),
      note: 'Opta/Stats Perform requiere credenciales y un endpoint/contrato habilitado por el proveedor.'
    }
  };
}

export async function fetchApiFootballFixtures(config, from, to){
  if (!config.apiFootballKey) throw providerError('API_FOOTBALL', 503, 'API_FOOTBALL_NOT_CONFIGURED');
  const params = new URLSearchParams({
    league: config.apiFootballLeagueId,
    season: config.apiFootballSeason,
    from,
    to
  });
  const data = await getJson(
    'API_FOOTBALL',
    `${config.apiFootballBase}/fixtures?${params.toString()}`,
    { 'x-apisports-key': config.apiFootballKey }
  );
  if (Array.isArray(data?.errors) && data.errors.length) {
    throw providerError('API_FOOTBALL', 502, `API_FOOTBALL_UPSTREAM: ${data.errors.join(', ')}`);
  }
  return normalizeApiFootball(data);
}

export async function fetchSportmonksFixtures(config, from, to){
  if (!config.sportmonksToken) throw providerError('SPORTMONKS', 503, 'SPORTMONKS_NOT_CONFIGURED');
  if (!config.sportmonksLeagueId) throw providerError('SPORTMONKS', 503, 'SPORTMONKS_LEAGUE_NOT_CONFIGURED');

  const params = new URLSearchParams({
    api_token: config.sportmonksToken,
    include: 'participants;round;league;scores',
    filters: `fixtureLeagues:${config.sportmonksLeagueId}`,
    per_page: '50'
  });
  const data = await getJson(
    'SPORTMONKS',
    `${config.sportmonksBase}/fixtures/between/${encodeURIComponent(from)}/${encodeURIComponent(to)}?${params.toString()}`
  );
  return normalizeSportmonks(data);
}

export async function fetchOptaFixtures(config){
  if (!config.optaToken || !config.optaBaseUrl || !config.optaFixturesPath) {
    throw providerError('OPTA', 503, 'OPTA_NOT_CONFIGURED');
  }

  const url = new URL(config.optaFixturesPath, `${config.optaBaseUrl}/`);
  if (config.optaCompetitionId && !url.searchParams.has('competitionId')) {
    url.searchParams.set('competitionId', config.optaCompetitionId);
  }

  const data = await getJson(
    'OPTA',
    url.toString(),
    {
      Authorization: `Bearer ${config.optaToken}`,
      'X-API-Key': config.optaToken
    }
  );
  return Array.isArray(data?.response)
    ? data.response
    : Array.isArray(data?.data)
      ? data.data
      : [];
}

export async function fetchMultiProviderFixtures(config){
  const { from, to } = daysWindow(config.footballDataDays);
  const jobs = {
    'football-data.org': () => config.footballDataToken
      ? getJson(
        'FOOTBALL_DATA',
        `${config.footballDataBase}/competitions/${encodeURIComponent(config.footballDataCompetition)}/matches?dateFrom=${from}&dateTo=${to}`,
        { 'X-Auth-Token': config.footballDataToken }
      ).then(normalizeFootballData)
      : Promise.reject(providerError('FOOTBALL_DATA', 503, 'FOOTBALL_DATA_NOT_CONFIGURED')),
    'api-football': () => fetchApiFootballFixtures(config, from, to),
    sportmonks: () => fetchSportmonksFixtures(config, from, to),
    opta: () => fetchOptaFixtures(config)
  };

  const entries = await Promise.all(Object.entries(jobs).map(async ([name, job]) => {
    try {
      return [name, { ok: true, matches: await job() }];
    } catch (error) {
      return [name, { ok: false, error: error.message, status: error.status || 502 }];
    }
  }));

  const providers = Object.fromEntries(entries);
  const mergedMap = new Map();
  for (const [name, result] of entries) {
    if (!result.ok) continue;
    for (const match of result.matches) {
      const key = [
        String(match?.utcDate || '').slice(0, 16),
        String(match?.home || '').trim().toLowerCase(),
        String(match?.away || '').trim().toLowerCase()
      ].join('|');
      if (!mergedMap.has(key)) mergedMap.set(key, { ...match, sources: [name] });
      else mergedMap.get(key).sources.push(name);
    }
  }

  const merged = [...mergedMap.values()].sort(
    (a, b) => new Date(a?.utcDate || 0).getTime() - new Date(b?.utcDate || 0).getTime()
  );

  return { from, to, providers, merged };
}
