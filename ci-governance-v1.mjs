import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workflowDir = '.github/workflows';
const files = fs.readdirSync(workflowDir).filter(file => /\.ya?ml$/i.test(file)).sort();
assert.ok(files.length > 0, 'CI-GOV: no workflow files found');

const findings = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(workflowDir, file), 'utf8');
  const nodeVersions = [...text.matchAll(/node-version:\s*([^#\n]+)/g)]
    .map(match => match[1].trim().replace(/^['\"]|['\"]$/g, ''));
  if (nodeVersions.length && nodeVersions.some(version => version !== '24.14.1')) {
    findings.push(`${file}: Node versions must be pinned to 24.14.1; found ${nodeVersions.join(', ')}`);
  }
}

const maintenance = fs.readFileSync(path.join(workflowDir, 'maintenance-automation.yml'), 'utf8');
assert.ok(maintenance.includes('pull_request:'), 'CI-GOV: maintenance automation must run on pull requests');
assert.ok(maintenance.includes('workflow_dispatch:'), 'CI-GOV: maintenance automation must remain manually dispatchable');
assert.ok(maintenance.includes('schedule:'), 'CI-GOV: maintenance automation must keep scheduled housekeeping');
const permissionsBlock = maintenance.match(/(?:^|\n)permissions:\s*\n((?:\s{2,}[^\n]+\n?)+)/)?.[1] || '';
assert.match(permissionsBlock, /(?:^|\n)\s{2}contents:\s*read(?:\s*(?:#.*)?\n|\s*$)/, 'CI-GOV: maintenance automation must grant contents read');
assert.match(permissionsBlock, /(?:^|\n)\s{2}actions:\s*read(?:\s*(?:#.*)?\n|\s*$)/, 'CI-GOV: maintenance automation must grant actions read');
assert.doesNotMatch(permissionsBlock, /\bcontents:\s*(?:write|write-all)\b/i, 'CI-GOV: maintenance automation must remain read-only');
assert.doesNotMatch(permissionsBlock, /\bactions:\s*(?:write|write-all)\b/i, 'CI-GOV: maintenance automation must not write Actions state');

assert.deepEqual(findings, [], findings.join('\n'));
console.log(`CI GOVERNANCE v2: ${files.length} workflows audited · 0 findings`);
