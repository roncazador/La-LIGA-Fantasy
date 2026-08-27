import { normalizeApiFootball } from './providers.mjs';

function dataError(message, status = 502){
  return Object.assign(new Error(message), { status });
}

async function getJson(name, url, headers = {}){
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'LALIGA-Fantasy-Manager/3.0.0', ...headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw dataError(`${name}_NETWORK_ERROR`, 502);
  }
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { throw dataError(`${name}_INVALID_JSON`, response.status || 502); }
  if (!response.ok) {
    const detail = data?.message || data?.errors?.join?.(', ') || '';
    throw dataError(`${name}_${response.status}${detail ? `: ${detail}` : ''}`, response.status || 502);
  }
  if (Array.isArray(data?.errors) && data.errors.length) {
    throw dataError(`${name}_UPSTREAM: ${data.errors.join(', ')}`, 502);
  }
  return data;
}

export function normalizeTeams(data){
  const rows = Array.isArray(data?.response) ? data.response : [];
  return rows.map(row => ({
    id: row?.team?.id ?? null,
    name: row?.team?.name ?? null,
    code: row?.team?.code ?? null,
    country: row?.team?.country ?? null,
    logo: row?.team?.logo ?? null,
    venue: row?.venue?.name ?? null,
    city: row?.venue?.city ?? null,
    capacity: row?.venue?.capacity ?? null
  })).filter(x => x.id != null && x.name);
}

export function normalizeStandings(data){
  const groups = Array.isArray(data?.response) ? data.response : [];
  const rows = [];
  for (const group of groups) {
    const tables = Array.isArray(group?.league?.standings) ? group.league.standings : [];
    for (const table of tables) {
      for (const row of Array.isArray(table) ? table : []) {
        rows.push({
          rank: row?.rank ?? null,
          teamId: row?.team?.id ?? null,
          team: row?.team?.name ?? null,
          logo: row?.team?.logo ?? null,
          points: row?.points ?? null,
          played: row?.all?.played ?? null,
          wins: row?.all?.win ?? null,
          draws: row?.all?.draw ?? null,
          losses: row?.all?.lose ?? null,
          goalsFor: row?.all?.goals?.for ?? null,
          goalsAgainst: row?.all?.goals?.against ?? null,
          goalDiff: row?.goalsDiff ?? null,
          form: row?.form ?? null
        });
      }
    }
  }
  return rows;
}

export function normalizePlayers(data){
  const rows = Array.isArray(data?.response) ? data.response : [];
  return rows.map(row => {
    const player = row?.player || {};
    const stat = Array.isArray(row?.statistics) ? row.statistics[0] || {} : row?.statistics || {};
    return {
      id: player?.id ?? null,
      name: player?.name ?? null,
      age: player?.age ?? null,
      nationality: player?.nationality ?? null,
      photo: player?.photo ?? null,
      position: stat?.games?.position ?? null,
      teamId: stat?.team?.id ?? null,
      team: stat?.team?.name ?? null,
      appearances: stat?.games?.appearences ?? null,
      starts: stat?.games?.lineups ?? null,
      minutes: stat?.games?.minutes ?? null,
      rating: stat?.games?.rating ? Number(stat.games.rating) : null,
      goals: stat?.goals?.total ?? null,
      assists: stat?.goals?.assists ?? null,
      shots: stat?.shots?.total ?? null,
      shotsOn: stat?.shots?.on ?? null,
      passes: stat?.passes?.total ?? null,
      keyPasses: stat?.passes?.key ?? null,
      duels: stat?.duels?.total ?? null,
      duelsWon: stat?.duels?.won ?? null,
      tackles: stat?.tackles?.total ?? null,
      interceptions: stat?.tackles?.interceptions ?? null,
      yellow: stat?.cards?.yellow ?? null,
      red: stat?.cards?.red ?? null
    };
  }).filter(x => x.id != null && x.name);
}

export function normalizeInjuries(data){
  const rows = Array.isArray(data?.response) ? data.response : [];
  return rows.map(row => ({
    playerId: row?.player?.id ?? null,
    player: row?.player?.name ?? null,
    type: row?.player?.type ?? null,
    reason: row?.player?.reason ?? null,
    teamId: row?.team?.id ?? null,
    team: row?.team?.name ?? null,
    fixtureId: row?.fixture?.id ?? null,
    date: row?.fixture?.date ?? null
  })).filter(x => x.playerId != null && x.player);
}

async function apiFootball(config, path, params = {}){
  if (!config.apiFootballKey) throw dataError('API_FOOTBALL_NOT_CONFIGURED', 503);
  const query = new URLSearchParams(params);
  return getJson('API_FOOTBALL', `${config.apiFootballBase}${path}?${query.toString()}`, {
    'x-apisports-key': config.apiFootballKey
  });
}

export async function fetchTeams(config){
  return normalizeTeams(await apiFootball(config, '/teams', { league: config.apiFootballLeagueId, season: config.apiFootballSeason }));
}

export async function fetchStandings(config){
  return normalizeStandings(await apiFootball(config, '/standings', { league: config.apiFootballLeagueId, season: config.apiFootballSeason }));
}

export async function fetchPlayers(config, page = 1){
  const data = await apiFootball(config, '/players', {
    league: config.apiFootballLeagueId,
    season: config.apiFootballSeason,
    page: String(Math.max(1, Number(page) || 1))
  });
  return {
    players: normalizePlayers(data),
    page: Number(data?.paging?.current || page || 1),
    totalPages: Number(data?.paging?.total || 1),
    results: Number(data?.results || 0)
  };
}

export async function fetchInjuries(config){
  return normalizeInjuries(await apiFootball(config, '/injuries', {
    league: config.apiFootballLeagueId,
    season: config.apiFootballSeason
  }));
}

export async function fetchRealDataBundle(config, options = {}){
  const include = new Set(options.include || ['teams', 'standings']);
  const output = {
    provider: 'api-football',
    competition: config.apiFootballLeagueId,
    season: config.apiFootballSeason,
    data: {},
    errors: []
  };
  const jobs = {};
  if (include.has('teams')) jobs.teams = () => fetchTeams(config);
  if (include.has('standings')) jobs.standings = () => fetchStandings(config);
  if (include.has('players')) jobs.players = () => fetchPlayers(config, options.page || 1);
  if (include.has('injuries')) jobs.injuries = () => fetchInjuries(config);

  const entries = await Promise.all(Object.entries(jobs).map(async ([name, job]) => {
    try { return [name, { ok: true, value: await job() }]; }
    catch (error) { return [name, { ok: false, error: error.message, status: error.status || 502 }]; }
  }));

  for (const [name, result] of entries) {
    if (result.ok) output.data[name] = result.value;
    else output.errors.push({ section: name, error: result.error });
  }
  output.ok = Object.keys(output.data).length > 0;
  output.meta = { requested: [...include], returned: Object.keys(output.data), errors: output.errors.length };
  return output;
}
