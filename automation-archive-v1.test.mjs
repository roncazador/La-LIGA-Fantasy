import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/maintenance-automation.yml','utf8');
assert.ok(workflow.includes('git archive --format=zip'),'source archive command wired');
assert.ok(workflow.includes('La-LIGA-Fantasy-${GITHUB_SHA}.zip'),'archive is commit-addressed');
assert.ok(workflow.includes('actions/upload-artifact@v4'),'archive uses artifact storage');
assert.ok(workflow.includes('La-LIGA-Fantasy-${{ github.sha }}.zip'),'archive is uploaded with reports');
assert.ok(workflow.includes('if: always()'),'archive/report collection survives test failure');
console.log('AUTOMATION ARCHIVE v1: 5/5 checks passed');
