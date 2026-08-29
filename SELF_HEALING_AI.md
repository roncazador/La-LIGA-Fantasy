# Self-healing AI

La-LIGA-Fantasy now includes a bounded self-healing agent driven by GitHub Actions.

## How it works

1. A monitored GitHub Actions workflow finishes with `failure`.
2. `self-healing-ai.yml` reads the failed run and its failed job logs.
3. `scripts/self-heal-agent.mjs` builds a failure signature and loads previous successful repairs from `.github/self-healing/memory.json`.
4. When `OPENAI_API_KEY` is available, the agent asks the configured model for a minimal unified diff.
5. The patch is rejected when it contains secret-like material, touches disallowed paths, exceeds file/line limits, or cannot pass `git apply --check`.
6. The complete `npm test` suite must pass before the agent commits a repair.
7. Successful repairs are recorded in `.github/self-healing/memory.json` so future repair prompts can reuse the learned signature and outcome.
8. The workflow pushes a `self-heal/<run-id>` branch and opens or updates a pull request. A failed repair does not modify `main`.

## Safety boundaries

The agent is read-only with respect to fantasy actions. It cannot buy, sell, bid, change lineups, or write to LALIGA/Fantasy services.

It never stores API credentials in source. The only expected AI credential is the GitHub Actions secret `OPENAI_API_KEY`.

The agent is intentionally bounded: at most two model repair attempts per failing run, at most eight changed files and 500 changed lines per generated patch, followed by the full repository test suite.

## Enabling the model

Add an Actions repository secret named `OPENAI_API_KEY`. The workflow defaults to `gpt-5.6-luna`, and can be changed through the `OPENAI_MODEL` environment value in the workflow.

Without the secret, the workflow remains in safe diagnosis mode: it records the failure and does not generate or push a speculative patch.
