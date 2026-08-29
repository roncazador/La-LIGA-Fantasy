import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent=fs.readFileSync('./scripts/self-heal-agent.mjs','utf8');
const policy=JSON.parse(fs.readFileSync('./.github/self-healing/policy.json','utf8'));
const workflow=fs.readFileSync('./.github/workflows/self-healing-ai.yml','utf8');
const memory=JSON.parse(fs.readFileSync('./.github/self-healing/memory.json','utf8'));
const checks=[
 ['Responses API',agent.includes('/v1/responses')],['model configured',agent.includes('gpt-5.6-luna')],['apply check execution',agent.includes("['apply', '--check'")],['apply execution',agent.includes("['apply', file]")],['full npm test',agent.includes("sh('npm', ['test'")],['git commit execution',agent.includes("sh('git', ['commit'")],['GitHub token',agent.includes('process.env.GITHUB_TOKEN')],['repair memory',agent.includes('memory.repairs')],['failure memory',agent.includes('memory.failures')],['attempt limit',agent.includes('SELF_HEAL_MAX_ATTEMPTS')],['secret rejection',agent.includes('PATCH_SECRET_PATTERN')],['path rejection',agent.includes('PATCH_PATH_NOT_ALLOWED')],['size rejection',agent.includes('PATCH_TOO_LARGE')],['success marker',agent.includes('SELF_HEAL_SUCCESS')],['unrepaired marker',agent.includes('SELF_HEAL_UNREPAIRED')],['safe policy',policy.mode==='safe-autonomous'&&policy.requireTests&&policy.requireNoSecrets&&policy.readOnlyFantasyPolicy&&policy.autoMerge===false],['workflow failure trigger',workflow.includes('workflow_run:')&&workflow.includes('types: [completed]')],['workflow permissions',workflow.includes('contents: write')&&workflow.includes('pull-requests: write')],['secret wiring',workflow.includes('OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}')],['agent launch',workflow.includes('node scripts/self-heal-agent.mjs')],['force-with-lease',workflow.includes('git push --force-with-lease')],['PR creation',workflow.includes('gh pr create')],['memory schema',memory.version===1&&Array.isArray(memory.repairs)&&Array.isArray(memory.failures)],['read-only prompt',/read-only/i.test(agent)],['no automatic self-merge',policy.autoMerge===false]
];
for(const[name,ok]of checks)assert.ok(ok,`SELF-HEAL-${name}`);
assert.equal(checks.length,25);
console.log('SELF-HEALING AI CONTRACT v2: 25/25 checks passed');
