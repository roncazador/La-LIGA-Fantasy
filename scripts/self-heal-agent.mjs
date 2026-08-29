import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = process.env.GITHUB_REPOSITORY || 'roncazador/La-LIGA-Fantasy';
const token = process.env.GITHUB_TOKEN || '';
const eventPath = process.env.GITHUB_EVENT_PATH || '';
const maxAttempts = Number(process.env.SELF_HEAL_MAX_ATTEMPTS || 2);
const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const memoryPath = path.resolve('.github/self-healing/memory.json');
const policyPath = path.resolve('.github/self-healing/policy.json');

const sh = (cmd, args = [], options = {}) => execFileSync(cmd, args, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...options
});
const git = (...args) => sh('git', args).trim();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readText = file => fs.readFileSync(file, 'utf8');
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
};

function signature(logs) {
  const lines = String(logs).split(/\r?\n/).filter(Boolean)
    .filter(x => !/run_id|traceback|runner version|secret/i.test(x));
  return lines.slice(-12).join('\n').slice(0, 2400);
}

async function gh(pathname, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${repo}${pathname}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {})
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

async function failedJobs(runId) {
  const data = await gh(`/actions/runs/${runId}/jobs?per_page=100`);
  return (data.jobs || []).filter(j => j.conclusion === 'failure');
}

async function jobLog(jobId) {
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${jobId}/logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  const text = await r.text();
  if (!r.ok) return `Unable to read job log ${jobId}: HTTP ${r.status}`;
  return text.slice(-30000);
}

function loadMemory() {
  try { return readJson(memoryPath); }
  catch { return { version: 1, repairs: [], failures: [] }; }
}
function loadPolicy() {
  try { return readJson(policyPath); }
  catch {
    return {
      allowedPaths: ['src/**', 'scripts/**', '*.mjs', '*.js', '*.json', '.github/workflows/*.yml'],
      maxChangedFiles: 8,
      maxPatchLines: 500
    };
  }
}

function relevantFiles(logs, max = 12) {
  const paths = new Set();
  const pattern = /(?:^|[\s`'(])((?:\.github\/workflows\/|scripts\/|src\/)?[A-Za-z0-9_.-]+\.(?:mjs|js|json|yml|yaml|html|css))(?:[:)`'\s]|$)/g;
  for (const m of String(logs).matchAll(pattern)) {
    const p = m[1];
    if (fs.existsSync(p) && fs.statSync(p).isFile()) paths.add(p);
    if (paths.size >= max) break;
  }
  return [...paths];
}

function buildPrompt({ workflow, runId, logs, memory, policy, attempt }) {
  const files = relevantFiles(logs);
  const snapshots = files.map(f => `\n--- ${f} ---\n${readText(f).slice(0, 16000)}`).join('');
  const recentMemory = (memory.repairs || []).slice(-8).map(r => JSON.stringify(r)).join('\n');
  return [
    'You are the self-healing engineering agent for the La-LIGA-Fantasy repository.',
    'Produce the smallest safe code patch that fixes the observed CI failure.',
    'Preserve the read-only fantasy policy, iPhone/mobile requirements, autonomous calendar, persistent brain history and existing architecture.',
    'Never invent data. Never add secrets, credentials, cookies, tokens, passwords or write actions against external fantasy services.',
    `Only modify paths allowed by this policy: ${JSON.stringify(policy.allowedPaths)}.`,
    `Maximum changed files: ${policy.maxChangedFiles}; maximum patch lines: ${policy.maxPatchLines}.`,
    'Do not rewrite unrelated code. Fix implementation when it is wrong; fix a test/contract only when the failure proves the test is stale.',
    'Return ONLY a unified git diff accepted by `git apply`. No Markdown fences and no explanation.',
    `Workflow: ${workflow}; run: ${runId}; repair attempt: ${attempt}/${maxAttempts}.`,
    `Failure signature:\n${signature(logs)}`,
    `Recent learned repairs:\n${recentMemory || '(none)'}`,
    snapshots
  ].join('\n');
}

async function askModel(prompt) {
  if (!process.env.OPENAI_API_KEY) return null;
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 12000 })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${text.slice(0, 1200)}`);
  const data = JSON.parse(text);
  if (typeof data.output_text === 'string') return data.output_text.trim();
  return (data.output || []).flatMap(x => x.content || []).map(x => x.text || '').join('\n').trim() || null;
}

function validatePatchText(patch, policy) {
  if (!patch || !patch.includes('diff --git ')) throw new Error('MODEL_NO_PATCH');
  if (/(?:api[_ -]?key|authorization:|bearer\s+[A-Za-z0-9._-]{20,}|password\s*[:=])/im.test(patch)) {
    throw new Error('PATCH_SECRET_PATTERN');
  }
  const files = [...patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map(m => m[1]);
  if (!files.length || files.length > policy.maxChangedFiles) throw new Error('PATCH_TOO_MANY_FILES');
  const allowed = policy.allowedPaths || [];
  const okPath = p => allowed.some(rule => {
    if (rule.endsWith('/**')) return p.startsWith(rule.slice(0, -3));
    if (rule.startsWith('*.')) return p.endsWith(rule.slice(1));
    return p === rule;
  });
  if (files.some(p => !okPath(p))) {
    throw new Error(`PATCH_PATH_NOT_ALLOWED:${files.filter(p => !okPath(p)).join(',')}`);
  }
  const added = patch.split(/\r?\n/).filter(x => x.startsWith('+') && !x.startsWith('+++')).length;
  const removed = patch.split(/\r?\n/).filter(x => x.startsWith('-') && !x.startsWith('---')).length;
  if (added + removed > policy.maxPatchLines) throw new Error('PATCH_TOO_LARGE');
}

function applyPatch(patch) {
  const file = path.resolve('.github/self-healing/last.patch');
  fs.writeFileSync(file, patch, 'utf8');
  try {
    sh('git', ['apply', '--check', file]);
    sh('git', ['apply', file]);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

function runTests() {
  try {
    sh('npm', ['test'], { timeout: 300000, env: { ...process.env, CI: 'true' } });
    return { ok: true, output: 'npm test passed' };
  } catch (e) {
    return { ok: false, output: `${e.stdout || ''}\n${e.stderr || ''}`.slice(-30000) };
  }
}

function saveFailure(memory, entry) {
  memory.failures = Array.isArray(memory.failures) ? memory.failures : [];
  memory.failures.push(entry);
  memory.failures = memory.failures.slice(-100);
  memory.updatedAt = new Date().toISOString();
  writeJson(memoryPath, memory);
}

function saveRepair(memory, entry) {
  memory.repairs = Array.isArray(memory.repairs) ? memory.repairs : [];
  memory.repairs.push(entry);
  memory.repairs = memory.repairs.slice(-100);
  memory.updatedAt = new Date().toISOString();
  writeJson(memoryPath, memory);
}

async function main() {
  const event = eventPath && fs.existsSync(eventPath) ? readJson(eventPath) : {};
  const run = event.workflow_run;
  if (!run || run.conclusion !== 'failure') {
    console.log('Self-heal: no failed workflow to repair.');
    return 0;
  }
  if (String(run.name).toLowerCase().includes('self-heal')) {
    console.log('Self-heal: ignoring its own workflow.');
    return 0;
  }
  if (!token) throw new Error('GITHUB_TOKEN missing');

  const jobs = await failedJobs(run.id);
  const logs = (await Promise.all(jobs.map(async j => `JOB ${j.name} (${j.id})\n${await jobLog(j.id)}`))).join('\n');
  const workflow = String(run.name);
  const memory = loadMemory();
  const policy = loadPolicy();
  const originalSha = git('rev-parse', 'HEAD');
  console.log(`Self-heal: analysing ${workflow} run ${run.id} on ${originalSha}`);
  console.log(`Failed jobs: ${jobs.map(j => j.name).join(', ') || 'unknown'}`);

  if (!process.env.OPENAI_API_KEY) {
    saveFailure(memory, { workflow, runId: run.id, signature: signature(logs), at: new Date().toISOString(), model: 'disabled' });
    console.log('Self-heal: OPENAI_API_KEY missing; safe no-patch mode.');
    return 2;
  }

  let lastFailure = logs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    sh('git', ['reset', '--hard', originalSha]);
    const prompt = buildPrompt({ workflow, runId: run.id, logs: lastFailure, memory, policy, attempt });
    const patch = await askModel(prompt);
    try {
      validatePatchText(patch, policy);
      applyPatch(patch);
    } catch (e) {
      lastFailure = `Patch validation failed: ${e.message}\nOriginal failure:\n${lastFailure}`;
      console.log(`Self-heal attempt ${attempt}: rejected model patch: ${e.message}`);
      continue;
    }

    const test = runTests();
    if (test.ok) {
      const files = git('diff', '--name-only').split(/\r?\n/).filter(Boolean);
      const stat = git('diff', '--stat');
      saveRepair(memory, {
        workflow,
        runId: run.id,
        sourceSha: originalSha,
        fixedAt: new Date().toISOString(),
        attempt,
        signature: signature(lastFailure),
        changedFiles: files,
        diffStat: stat,
        model,
        outcome: 'tests-passed'
      });
      sh('git', ['add', ...files, memoryPath]);
      sh('git', ['commit', '-m', `fix(self-heal): repair ${workflow}`]);
      console.log(`SELF_HEAL_SUCCESS files=${files.length} attempt=${attempt}`);
      return 0;
    }
    lastFailure = `${test.output}\n\nPrevious failure:\n${lastFailure}`;
    console.log(`Self-heal attempt ${attempt}: patch failed npm test.`);
  }

  sh('git', ['reset', '--hard', originalSha]);
  saveFailure(memory, {
    workflow,
    runId: run.id,
    failedAt: new Date().toISOString(),
    signature: signature(lastFailure),
    model,
    outcome: 'unrepaired'
  });
  console.log('SELF_HEAL_UNREPAIRED');
  return 3;
}

try {
  const code = await main();
  process.exitCode = code;
} catch (error) {
  console.error(`SELF_HEAL_FATAL ${error.stack || error.message}`);
  process.exitCode = 4;
}
