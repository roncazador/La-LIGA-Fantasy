import crypto from 'node:crypto';

export const FUTBOLFANTASY_PUBLIC_SOURCES = Object.freeze([
  { key: 'home', url: 'https://www.futbolfantasy.com/laliga/home' },
  { key: 'lineups', url: 'https://www.futbolfantasy.com/laliga/posibles-alineaciones' },
  { key: 'injuries', url: 'https://www.futbolfantasy.com/laliga/lesionados' },
  { key: 'stats', url: 'https://www.futbolfantasy.com/laliga/estadisticas-puntos' }
]);

const TEAM_ALIASES = new Map([
  ['alaves','Alavés'],['athletic','Athletic'],['atletico','Atlético'],['barcelona','Barcelona'],['betis','Betis'],
  ['celta','Celta'],['elche','Elche'],['espanyol','Espanyol'],['getafe','Getafe'],['girona','Girona'],['levante','Levante'],
  ['mallorca','Mallorca'],['osasuna','Osasuna'],['rayo','Rayo'],['real madrid','Real Madrid'],['real oviedo','Real Oviedo'],
  ['real sociedad','Real Sociedad'],['sevilla','Sevilla'],['valencia','Valencia'],['villarreal','Villarreal']
]);
const TEAM_SET = new Set(TEAM_ALIASES.values());
const STATUS_WORDS = new Set(['baja','duda','tocado','disponible','alta','sancionado']);

export function normalizeText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;|á/gi,'á').replace(/&eacute;|é/gi,'é').replace(/&iacute;|í/gi,'í').replace(/&oacute;|ó/gi,'ó').replace(/&uacute;|ú/gi,'ú')
    .replace(/&#x([0-9a-f]+);/gi, (_,h) => String.fromCodePoint(parseInt(h,16)))
    .replace(/\s+/g, ' ').trim();
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

function dedupePlayers(players) {
  const map = new Map();
  for (const p of players) {
    const key = `${p.team || ''}|${p.name.toLowerCase()}`;
    const prev = map.get(key);
    map.set(key, prev ? {
      ...prev, ...Object.fromEntries(Object.entries(p).filter(([,v]) => v != null && v !== '')),
      probability: p.probability ?? prev.probability
    } : p);
  }
  return [...map.values()];
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

export function extractInjuries(html) {
  const text = normalizeText(html);
  const lines = text.split(/(?=(?:0|[1-9]\d?|100)\s*%)/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const probability = parsePercent(line);
    if (probability == null) continue;
    const team = [...TEAM_SET].find(t => line.toLowerCase().includes(t.toLowerCase())) || null;
    const cleaned = line.replace(/(?:0|[1-9]\d?|100)\s*%/,' ').replace(team || '',' ').trim();
    const match = cleaned.match(/^([^\d]{2,80}?)(?:\s+(Lesión|Molestias|Sanción|Parte médico|Disponible|Duda|Baja|Tocado)\b)?/i);
    const player = canonicalPlayer(match?.[1] || '');
    if (!player || player.length < 3) continue;
    const status = STATUS_WORDS.has(String(match?.[2] || '').toLowerCase()) ? String(match[2]).toLowerCase() : null;
    out.push({player,team,probability,status,raw:line.slice(0,300)});
  }
  return dedupePlayers(out).slice(0,300);
}

export function extractStats(html) {
  const text = normalizeText(html);
  const rows = [];
  for (const line of text.split(/\n+/)) {
    const clean = line.trim();
    const team = canonicalTeam(clean.split(/\s{2,}|\|/)[0]);
    if (!team) continue;
    const nums = [...clean.matchAll(/\d+(?:[.,]\d+)?/g)].map(m => Number(m[0].replace(',','.')));
    if (!nums.length) continue;
    rows.push({team,values:nums.slice(0,24)});
  }
  return rows;
}

export function parsePublicPage(html, kind) {
  const checksum = sha256(html);
  const base = {kind,checksum,bytes:Buffer.byteLength(String(html),'utf8')};
  if (kind === 'lineups' || kind === 'home') {
    return {...base,matches:extractMatchups(html),players:extractDataPlayers(html)};
  }
  if (kind === 'injuries') return {...base,injuries:extractInjuries(html)};
  if (kind === 'stats') return {...base,stats:extractStats(html)};
  return base;
}

export function mergeMatchContrast(parts) {
  const map = new Map();
  for (const part of Array.isArray(parts) ? parts : []) {
    for (const match of part?.matches || []) {
      const key = `${match.home}|${match.away}`;
      const existing = map.get(key) || {home:match.home,away:match.away,players:[],evidence:[]};
      existing.evidence.push({kind:part.kind,checksum:part.checksum});
      if (Array.isArray(part.players)) existing.players.push(...part.players.filter(p => !p.team || p.team === match.home || p.team === match.away));
      map.set(key, {...existing,players:dedupePlayers(existing.players)});
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
    normalizedPages.push({kind:page.kind,url:page.url,status:Number(page.status || 0),bytes:item.bytes,checksum:item.checksum,ok:Boolean(page.status >= 200 && page.status < 300)});
    parsed.push(item);
  }
  const lineups = mergeMatchContrast(parsed);
  const injuries = parsed.flatMap(x => x.injuries || []);
  const stats = parsed.flatMap(x => x.stats || []);
  return {
    version:'3.3.0',
    retrievedAt:now.toISOString(),
    pages:normalizedPages,
    matches:lineups,
    players:[...new Map(lineups.flatMap(x => x.players || []).map(p => [`${p.team || ''}|${p.name}`,p])).values()],
    injuries,
    stats,
    sourcePolicy:'public-contrast-only',
    ok:normalizedPages.some(x => x.ok)
  };
}

export async function fetchPublicSources({signal} = {}) {
  const pages = await Promise.all(FUTBOLFANTASY_PUBLIC_SOURCES.map(async source => {
    try {
      const response = await fetch(source.url, {
        headers: {Accept:'text/html,application/xhtml+xml', 'User-Agent':'LALIGA-Fantasy-Manager/3.3.0'},
        cache:'no-store',
        signal: signal || AbortSignal.timeout(12000)
      });
      const html = await response.text();
      return {kind:source.key,url:source.url,status:response.status,html};
    } catch (error) {
      return {kind:source.key,url:source.url,status:0,html:'',error:error?.message || 'FETCH_FAILED'};
    }
  }));
  const bundle = normalizeBundle(pages);
  return {...bundle, pages:bundle.pages.map((page,index) => ({...page,error:pages[index]?.error || null}))};
}
