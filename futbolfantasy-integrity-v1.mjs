const TEAMS = Object.freeze([
  'Alavés','Athletic','Atlético','Barcelona','Betis','Celta','Elche','Espanyol','Getafe',
  'Levante','Málaga','Osasuna','Rayo','R. Racing Club','RC Deportivo','Real Madrid',
  'Real Sociedad','Sevilla','Valencia','Villarreal'
]);

// FutbolFantasy uses compact names while LALIGA/providers can use official names.
// Keep this table deterministic; unknown names are rejected instead of guessed.
const ALIASES = new Map([
  ['alaves','Alavés'],['deportivoalaves','Alavés'],
  ['athletic','Athletic'],['athleticclub','Athletic'],['athleticbilbao','Athletic'],
  ['atletico','Atlético'],['atleticodemadrid','Atlético'],
  ['barcelona','Barcelona'],['fcbarcelona','Barcelona'],
  ['betis','Betis'],['realbetis','Betis'],['realbetisbalompie','Betis'],
  ['celta','Celta'],['celtadevigo','Celta'],
  ['elche','Elche'],['elchecf','Elche'],
  ['espanyol','Espanyol'],['rcdespanyoldebarcelona','Espanyol'],
  ['getafe','Getafe'],['getafecf','Getafe'],
  ['levante','Levante'],['levanteud','Levante'],
  ['malaga','Málaga'],['malagacf','Málaga'],
  ['osasuna','Osasuna'],['caosasuna','Osasuna'],
  ['rayo','Rayo'],['rayovallecano','Rayo'],
  ['rracingclub','R. Racing Club'],['racing','R. Racing Club'],['racingsantander','R. Racing Club'],['racingdesantander','R. Racing Club'],['racingclub','R. Racing Club'],
  ['rcdeportivo','RC Deportivo'],['deportivo','RC Deportivo'],['deportivodelacoruna','RC Deportivo'],['deportivoalacoruna','RC Deportivo'],
  ['realmadrid','Real Madrid'],
  ['realsociedad','Real Sociedad'],
  ['sevilla','Sevilla'],['sevillafc','Sevilla'],
  ['valencia','Valencia'],['valenciacf','Valencia'],
  ['villarreal','Villarreal'],['villarrealcf','Villarreal']
]);

function key(value='') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}

export function canonicalTeamName(value) {
  return ALIASES.get(key(value)) || null;
}

function nameOf(player) {
  return String(player?.name ?? player?.playerName ?? player?.fullName ?? '').replace(/\s+/g,' ').trim();
}

function dedupePlayers(players) {
  const input = Array.isArray(players) ? players : [];
  const map = new Map();
  let dropped = 0;
  for (const raw of input) {
    const name = nameOf(raw);
    const team = canonicalTeamName(raw?.team?.name ?? raw?.teamName ?? raw?.team ?? raw?.clubName);
    if (!name || !team) { dropped += 1; continue; }
    const item = {...raw,name,team};
    const id = `${key(team)}|${key(name)}`;
    const previous = map.get(id);
    map.set(id, previous ? {
      ...previous,
      ...Object.fromEntries(Object.entries(item).filter(([,v]) => v != null && v !== ''))
    } : item);
  }
  return {rows:[...map.values()],dropped,deduped:Math.max(0,input.length-dropped-map.size)};
}

function sanitizeLineup(players, matchTeam) {
  const wanted = canonicalTeamName(matchTeam);
  if (!wanted) return [];
  return dedupePlayers((Array.isArray(players) ? players : [])
    .map(p => ({...p,team:canonicalTeamName(p?.team?.name ?? p?.teamName ?? p?.team ?? p?.clubName)}))
    .filter(p => p.team === wanted)).rows;
}

function sanitizeMatches(matches) {
  const out = new Map();
  let dropped = 0;
  for (const raw of Array.isArray(matches) ? matches : []) {
    const home = canonicalTeamName(raw?.home);
    const away = canonicalTeamName(raw?.away);
    if (!home || !away || home === away) { dropped += 1; continue; }
    const item = {
      ...raw,
      home,
      away,
      players:dedupePlayers(raw?.players || []).rows.filter(p => p.team === home || p.team === away),
      lineups:{home:sanitizeLineup(raw?.lineups?.home,home),away:sanitizeLineup(raw?.lineups?.away,away)}
    };
    const id = `${key(home)}|${key(away)}`;
    const previous = out.get(id);
    if (!previous) { out.set(id,item); continue; }
    out.set(id,{
      ...previous,
      ...Object.fromEntries(Object.entries(item).filter(([,v]) => v != null && v !== '')),
      players:dedupePlayers([...(previous.players||[]),...(item.players||[])]).rows,
      lineups:{
        home:dedupePlayers([...(previous.lineups?.home||[]),...(item.lineups?.home||[])]).rows,
        away:dedupePlayers([...(previous.lineups?.away||[]),...(item.lineups?.away||[])]).rows
      },
      evidence:[...(previous.evidence||[]),...(item.evidence||[])]
    });
    dropped += 1;
  }
  return {rows:[...out.values()],dropped};
}

export function sanitizeFutbolFantasyBundle(bundle={}) {
  const matches=sanitizeMatches(bundle.matches);
  const references=sanitizeMatches((bundle.references||[]).map(x => ({...x,players:[],lineups:x.lineups})));
  const players=dedupePlayers(bundle.players||[]);
  const injuries=(Array.isArray(bundle.injuries)?bundle.injuries:[]).map(x => ({...x,team:canonicalTeamName(x?.team?.name ?? x?.teamName ?? x?.team)}));
  const points=(Array.isArray(bundle.points)?bundle.points:[]).map(x => ({...x,team:canonicalTeamName(x?.team?.name ?? x?.teamName ?? x?.team)}));
  const stats=(Array.isArray(bundle.stats)?bundle.stats:[]).map(x => ({...x,team:canonicalTeamName(x?.team?.name ?? x?.teamName ?? x?.team)}));
  const normalizedPages=Array.isArray(bundle.pages)?bundle.pages.map(page => ({...page})):[];
  const sourceOkCount=normalizedPages.filter(page => page.ok===true).length;
  const sourceFailedCount=normalizedPages.filter(page => page.ok===false).length;
  const parserHasData=matches.rows.length>0||players.rows.length>0||injuries.length>0||points.length>0||stats.length>0;
  return {
    ...bundle,matches:matches.rows,references:references.rows,players:players.rows,injuries,points,stats,pages:normalizedPages,
    integrity:{
      schema:'futbolfantasy-integrity/v1',allowedTeams:TEAMS,sourceOkCount,sourceFailedCount,
      partialSources:sourceFailedCount>0&&sourceOkCount>0,noSuccessfulSources:sourceOkCount===0&&normalizedPages.length>0,
      parserEmpty:sourceOkCount>0&&!parserHasData,droppedMatches:matches.dropped,droppedReferences:references.dropped,
      droppedPlayers:players.dropped,dedupedPlayers:players.deduped
    }
  };
}
