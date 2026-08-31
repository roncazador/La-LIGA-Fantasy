import crypto from 'node:crypto';

export const FUTBOLFANTASY_PUBLIC_SOURCES = Object.freeze([
  { key: 'home', path: '/laliga/home' },
  { key: 'lineups', path: '/laliga/posibles-alineaciones' },
  { key: 'injuries', path: '/laliga/lesionados' },
  { key: 'stats', path: '/laliga/estadisticas' },
  { key: 'points', path: '/analytics/laliga-fantasy/puntos' }
]);

const TEAM_ALIASES = new Map([
  ['alaves','Alavés'],['athletic','Athletic'],['atletico','Atlético'],['barcelona','Barcelona'],['betis','Betis'],
  ['celta','Celta'],['elche','Elche'],['espanyol','Espanyol'],['getafe','Getafe'],['girona','Girona'],['levante','Levante'],
  ['mallorca','Mallorca'],['osasuna','Osasuna'],['rayo','Rayo'],['real madrid','Real Madrid'],['real oviedo','Real Oviedo'],
  ['real sociedad','Real Sociedad'],['sevilla','Sevilla'],['valencia','Valencia'],['villarreal','Villarreal']
]);
const TEAM_SET = new Set(TEAM_ALIASES.values());
const STATUS_WORDS = new Set(['baja','duda','tocado','disponible','alta','sancionado','molestias','lesionado','lesion','sancion','parte medico']);
const GENERIC_LABELS = new Set(['image','más info','jugador','pts','rachas','pj','med','v/p','siguiente','anterior','ver todos']);

export function normalizeText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi,'á').replace(/&eacute;/gi,'é').replace(/&iacute;/gi,'í').replace(/&oacute;/gi,'ó').replace(/&uacute;/gi,'ú')
    .replace(/&#x([0-9a-f]+);/gi, (_,h) => String.fromCodePoint(parseInt(h,16)))
    .replace(/\s+/g, ' ').trim();
}

function plainCell(value='') {
  const text=normalizeText(value).replace(/^Image:\s*/i,'').trim();
  return GENERIC_LABELS.has(text.toLowerCase())?'':text;
}

export function canonicalTeam(value) {
  const key = String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  return TEAM_ALIASES.get(key) || null;
}

export function canonicalPlayer(value) {
  return String(value ?? '').replace(/\s+/g,' ').trim().replace(/^[-·•]+\s*/, '').replace(/\s+[-·•]+\s*$/,'');
}

export function parsePercent(value) {
  const match = String(value ?? '').match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 0 && n <= 100 ? n : null;
}

export function parseNumber(value) {
  const match = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function attrs(tag = '') {
  const out = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) out[match[1].toLowerCase()] = match[2];
  return out;
}

function dedupePlayers(players) {
  const map = new Map();
  for (const p of players) {
    if (!p?.name) continue;
    const key = `${p.team || ''}|${p.name.toLowerCase()}`;
    const prev = map.get(key);
    map.set(key, prev ? {
      ...prev, ...Object.fromEntries(Object.entries(p).filter(([,v]) => v != null && v !== '')),
      probability: p.probability ?? prev.probability,
      status: p.status ?? prev.status
    } : p);
  }
  return [...map.values()];
}

function dedupeInjuries(injuries) {
  const map = new Map();
  for (const item of injuries) {
    if (!item?.player) continue;
    const key=`${item.team||''}|${item.player.toLowerCase()}`;
    const prev=map.get(key);
    map.set(key,prev?{
      ...prev,
      ...Object.fromEntries(Object.entries(item).filter(([,v])=>v!=null&&v!=='')),
      probability:item.probability??prev.probability,
      status:item.status??prev.status
    }:item);
  }
  return [...map.values()];
}

export function extractDataPlayers(html) {
  const players = [];
  for (const match of String(html ?? '').matchAll(/<[^>]*\b(?:data-player|data-player-name|data-name)\s*=\s*["'][^"']+["'][^>]*>/gi)) {
    const a = attrs(match[0]);
    const name = canonicalPlayer(a['data-player-name'] || a['data-player'] || a['data-name']);
    if (!name) continue;
    players.push({
      name,
      team: canonicalTeam(a['data-team'] || a['data-club'] || a['data-team-name']),
      position: a['data-position'] || null,
      probability: parsePercent(a['data-probability'] || a['data-starter-probability']),
      status: a['data-status'] || null,
      probable: a['data-probable'] === 'true' || a['data-starter'] === 'true'
    });
  }
  return dedupePlayers(players);
}

function extractTableRows(html) {
  const rows=[];
  for(const rowMatch of String(html??'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>plainCell(m[1])).filter(Boolean);
    if(cells.length<2) continue;
    const nums=cells.slice(1).flatMap(value=>[...value.matchAll(/-?\d+(?:[.,]\d+)?/g)].map(m=>Number(m[0].replace(',','.'))));
    if(!nums.length) continue;
    rows.push({cells,values:nums});
  }
  return rows;
}

export function extractPlayerPoints(html) {
  return extractTableRows(html).map(row=>{
    const player=canonicalPlayer(row.cells[0]);
    const team=row.cells.map(c=>canonicalTeam(c)).find(Boolean) || null;
    return {name:player,team,points:row.values[0] ?? null,values:row.values.slice(0,8)};
  }).filter(x=>x.name&&x.name.length>2&&x.name.toLowerCase()!=='jugador').slice(0,500);
}

export function extractMatchups(html) {
  const text = normalizeText(html);
  const out = [];
  const teamPattern = [...TEAM_SET].map(x => x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const re = new RegExp(`\\b(${teamPattern})\\s*[-–—]\\s*(${teamPattern})\\b`, 'gi');
  for (const m of text.matchAll(re)) {
    const home = canonicalTeam(m[1]), away = canonicalTeam(m[2]);
    if (!home || !away || home === away) continue;
    const key = `${home}|${away}`;
    if (!out.some(x => `${x.home}|${x.away}` === key)) out.push({home, away});
  }
  return out;
}

function cleanInjuryPlayer(value='') {
  return canonicalPlayer(String(value)
    .replace(/^(?:image|icon|foto)\s+/i,'')
    .replace(/\b(?:lesionado|lesion|molestias|sancion|sanción|parte médico|duda|baja|tocado|disponible)\b.*$/i,'')
    .replace(/\b(?:para la jornada|para el partido).*/i,'')
    .trim());
}

export function extractInjuries(html) {
  const text = normalizeText(html);
  const out = [];
  const segments = text
    .split(/(?=(?:0|[1-9]\d?|100)\s*%)/)
    .map(x => x.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const probability = parsePercent(segment);
    if (probability == null) continue;
    const team = [...TEAM_SET].find(t => segment.toLowerCase().includes(t.toLowerCase())) || null;
    const withoutPercent = segment.replace(/(?:0|[1-9]\d?|100)\s*%/,' ');
    const withoutTeam = team ? withoutPercent.replace(new RegExp(`\\b${team.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i'),' ') : withoutPercent;
    const statusMatch = withoutTeam.match(/\b(Baja|Duda|Tocado|Disponible|Alta|Sancionado|Molestias|Lesionado|Lesión|Sanción|Parte médico)\b/i);
    const status = statusMatch ? statusMatch[1].toLowerCase() : null;
    const player = cleanInjuryPlayer(withoutTeam);
    if (!player || player.length < 3 || GENERIC_LABELS.has(player.toLowerCase())) continue;
    out.push({player,team,probability,status,raw:segment.slice(0,300)});
  }

  for (const row of extractTableRows(html)) {
    const joined=row.cells.join(' ');
    const probability=parsePercent(joined);
    if(probability==null) continue;
    const team=row.cells.map(c=>canonicalTeam(c)).find(Boolean)||null;
    const player=cleanInjuryPlayer(row.cells.find(c=>!canonicalTeam(c)&&!/%/.test(c))||'');
    if(player&&player.length>=3&&!GENERIC_LABELS.has(player.toLowerCase())) out.push({player,team,probability,status:null,raw:joined.slice(0,300)});
  }
  return dedupeInjuries(out).slice(0,300);
}

export function extractStats(html) {
  return extractTableRows(html).map(row=>({
    team:row.cells.map(c=>canonicalTeam(c)).find(Boolean)||null,
    values:row.values.slice(0,24),
    cells:row.cells.slice(0,25)
  })).filter(x=>x.team);
}

export function parsePublicPage(html, kind) {
  const checksum = sha256(html);
  const base = {kind,checksum,bytes:Buffer.byteLength(String(html),'utf8')};
  if (kind === 'lineups' || kind === 'home') {
    return {...base,matches:extractMatchups(html),players:extractDataPlayers(html)};
  }
  if (kind === 'injuries') return {...base,injuries:extractInjuries(html)};
  if (kind === 'stats') return {...base,stats:extractStats(html)};
  if (kind === 'points') return {...base,points:extractPlayerPoints(html),players:extractPlayerPoints(html)};
  return base;
}

function mergePlayers(left,right){ return dedupePlayers([...(left||[]),...(right||[])]); }

export function mergeMatchContrast(parts) {
  const map = new Map();
  for (const part of Array.isArray(parts) ? parts : []) {
    for (const match of part?.matches || []) {
      const key = `${match.home}|${match.away}`;
      const existing = map.get(key) || {home:match.home,away:match.away,players:[],lineups:{home:[],away:[]},evidence:[]};
      existing.evidence.push({kind:part.kind,checksum:part.checksum});
      const players=Array.isArray(part.players)?part.players.filter(p=>!p.team||p.team===match.home||p.team===match.away):[];
      existing.players=mergePlayers(existing.players,players);
      existing.lineups.home=dedupePlayers(existing.players.filter(p=>p.team===match.home));
      existing.lineups.away=dedupePlayers(existing.players.filter(p=>p.team===match.away));
      map.set(key,existing);
    }
  }
  return [...map.values()];
}

export function normalizeBundle(pages, {now = new Date()} = {}) {
  const normalizedPages = [];
  const parsed = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page?.url || typeof page.html !== 'string') continue;
    const item = parsePublicPage(page.html,page.kind);
    normalizedPages.push({kind:page.kind,url:page.url,status:Number(page.status || 0),bytes:item.bytes,checksum:item.checksum,ok:Boolean(page.status >= 200 && page.status < 300),matches:item.matches?.length||0,players:item.players?.length||0,injuries:item.injuries?.length||0,points:item.points?.length||0});
    parsed.push(item);
  }
  const lineups = mergeMatchContrast(parsed);
  const injuries = parsed.flatMap(x => x.injuries || []);
  const stats = parsed.flatMap(x => x.stats || []);
  const points = parsed.flatMap(x => x.points || []);
  const players=[...new Map([...lineups.flatMap(x=>x.players||[]),...points].map(p=>[`${p.team||''}|${p.name}`,p])).values()];
  return {
    version:'3.3.1',retrievedAt:now.toISOString(),pages:normalizedPages,
    references:lineups.map(({home,away,evidence,lineups})=>({home,away,evidence,lineups})),
    matches:lineups,players,injuries,stats,points,sourcePolicy:'public-contrast-only',ok:normalizedPages.some(x => x.ok)
  };
}

export async function fetchPublicSources({signal,baseUrl='https://www.futbolfantasy.com'} = {}) {
  const base=String(baseUrl||'https://www.futbolfantasy.com').replace(/\/$/,'');
  const pages = await Promise.all(FUTBOLFANTASY_PUBLIC_SOURCES.map(async source => {
    const url=`${base}${source.path}`;
    try {
      const response = await fetch(url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'LALIGA-Fantasy-Manager/3.3.1 read-only'},cache:'no-store',signal:signal || AbortSignal.timeout(12000)});
      const html = await response.text();
      return {kind:source.key,url,status:response.status,html};
    } catch (error) { return {kind:source.key,url,status:0,html:'',error:error?.message || 'FETCH_FAILED'}; }
  }));
  const bundle=normalizeBundle(pages);
  return {...bundle,pages:bundle.pages.map((page,index)=>({...page,error:pages[index]?.error||null}))};
}
