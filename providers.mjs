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
        'User-Agent': 'LALIGA-Fantasy-Manager/2.8.0',
        ...headers
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    throw providerError(
      name,
      502,
      error?.name === 'TimeoutError' ? `${name}_TIMEOUT` : `${name}_NETWORK_ERROR`
    );
  }

  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); }
  catch { throw providerError(name, response.status || 502, `${name}_INVALID_JSON`); }

  if (!response.ok) {
    const upstreamMessage = data?.message || data?.errors?.join?.(', ') || '';
    throw providerError(
      name,
      response.status,
      `${name}_${response.status}${upstreamMessage ? `: ${upstreamMessage}` : ''}`
    );
  }

  return data;
}

export function daysWindow(days){
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 90);
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + safeDays * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

export function normalizeFootballData(data){
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
    homeTeamId: match?.homeTeam?.id ?? null,
    awayTeamId: match?.awayTeam?.id ?? null,
    raw: match
  }));
}

export function normalizeApiFootball(data){
  const matches = Array.isArray(data?.response) ? data.response : [];
  return matches.map(match => ({
    provider: 'api-football',
    id: String(match?.fixture?.id ?? ''),
    competitionId: String(match?.league?.id ?? ''),
    utcDate: match?.fixture?.date || null,
    home: match?.teams?.home?.name || null,
    away: match?.teams?.away?.name || null,
    status: match?.fixture?.status?.short || null,
    matchday: null,
    round: match?.league?.round || null,
    homeTeamId: match?.teams?.home?.id ?? null,
    awayTeamId: match?.teams?.away?.id ?? null,
    raw: match
  }));
}

export function normalizeSportmonks(data){
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
      round: match?.round?.name || null,
      homeTeamId: home?.id ?? null,
      awayTeamId: away?.id ?? null,
      raw: match
    };
  });
}

function cleanTeamName(name){
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sd|ud|real|club|de|del|la|cd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function fixtureKey(match){
  const dateKey = match?.utcDate ? new Date(match.utcDate).toISOString().slice(0, 16) : '';
  return [dateKey, cleanTeamName(match?.home), cleanTeamName(match?.away)].join('|');
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
      note: 'El plan gratuito actual de Sportmonks incluye dos competiciones; LaLiga requiere cobertura compatible con tu plan o prueba.'
    },
    apiFootball: {
      configured: Boolean(config.apiFootballKey),
      leagueId: config.apiFootballLeagueId,
      season: config.apiFootballSeason,
      note: 'API-Football está habilitada para el proveedor principal cuando existe API key.'
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

  const data = await getJson('OPTA', url.toString(), {
    Authorization: `Bearer ${config.optaToken}`,
    'X-API-Key': config.optaToken
  });

  const response = Array.isArray(data?.response)
    ? data.response
    : Array.isArray(data?.data)
      ? data.data
      : [];

  return response.map(match => ({
    provider: 'opta',
    id: String(match?.id ?? match?.matchId ?? ''),
    competitionId: String(match?.competitionId ?? config.optaCompetitionId ?? ''),
    utcDate: match?.utcDate || match?.date || match?.startDate || null,
    home: match?.home || match?.homeTeam?.name || match?.homeTeam || null,
    away: match?.away || match?.awayTeam?.name || match?.awayTeam || null,
    status: match?.status || null,
    matchday: Number.isFinite(Number(match?.matchday)) ? Number(match.matchday) : null,
    round: match?.round || null,
    raw: match
  }));
}

export async function fetchMultiProviderFixtures(config){
  const { from, to } = daysWindow(config.footballDataDays);
  const jobs = {
    'api-football': () => config.apiFootballKey
      ? fetchApiFootballFixtures(config, from, to)
      : Promise.reject(providerError('API_FOOTBALL', 503, 'API_FOOTBALL_NOT_CONFIGURED')),
    'football-data.org': () => config.footballDataToken
      ? getJson(
        'FOOTBALL_DATA',
        `${config.footballDataBase}/competitions/${encodeURIComponent(config.footballDataCompetition)}/matches?dateFrom=${from}&dateTo=${to}`,
        { 'X-Auth-Token': config.footballDataToken }
      ).then(normalizeFootballData)
      : Promise.reject(providerError('FOOTBALL_DATA', 503, 'FOOTBALL_DATA_NOT_CONFIGURED')),
    sportmonks: () => fetchSportmonksFixtures(config, from, to),
    opta: () => fetchOptaFixtures(config)
  };

  const entries = await Promise.all(Object.entries(jobs).map(async ([name, job]) => {
    try {
      const matches = await job();
      return [name, { ok: true, matches }];
    } catch (error) {
      return [name, { ok: false, error: error.message, status: error.status || 502 }];
    }
  }));

  const providers = Object.fromEntries(entries);
  const priority = ['api-football', 'football-data.org', 'sportmonks', 'opta'];
  const primaryProvider = priority.find(name => providers[name]?.ok) || null;
  const mergedMap = new Map();

  for (const name of priority) {
    const result = providers[name];
    if (!result?.ok) continue;

    for (const match of result.matches) {
      const key = fixtureKey(match);
      if (!mergedMap.has(key)) {
        const homeTeam = match.home
          ? { id: match.homeTeamId ?? null, name: match.home }
          : null;
        const awayTeam = match.away
          ? { id: match.awayTeamId ?? null, name: match.away }
          : null;

        mergedMap.set(key, {
          id: match.id,
          utcDate: match.utcDate,
          home: match.home,
          away: match.away,
          homeTeam,
          awayTeam,
          status: match.status,
          matchday: match.matchday,
          officialMatchday: match.matchday,
          round: match.round || null,
          homeTeamId: match.homeTeamId ?? null,
          awayTeamId: match.awayTeamId ?? null,
          source: name,
          sources: [name]
        });
      } else {
        const existing = mergedMap.get(key);
        if (!existing.sources.includes(name)) existing.sources.push(name);
        if (existing.matchday == null && match.matchday != null) {
          existing.matchday = match.matchday;
          existing.officialMatchday = match.matchday;
        }
        if (!existing.round && match.round) existing.round = match.round;
        if (!existing.homeTeamId && match.homeTeamId) {
          existing.homeTeamId = match.homeTeamId;
          existing.homeTeam = { id: match.homeTeamId, name: existing.home };
        }
        if (!existing.awayTeamId && match.awayTeamId) {
          existing.awayTeamId = match.awayTeamId;
          existing.awayTeam = { id: match.awayTeamId, name: existing.away };
        }
      }
    }
  }

  const merged = [...mergedMap.values()].sort(
    (a, b) => new Date(a?.utcDate || 0).getTime() - new Date(b?.utcDate || 0).getTime()
  );

  return {
    from,
    to,
    primaryProvider,
    providers,
    counts: Object.fromEntries(
      Object.entries(providers).map(([name, result]) => [name, result.ok ? result.matches.length : 0])
    ),
    merged
  };
}
