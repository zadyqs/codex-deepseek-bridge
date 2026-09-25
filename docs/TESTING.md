# Testing

## Offline quality gate

Run this for every pull request:

```powershell
cd plugins\codex-deepseek-bridge
npm ci
npm run verify
npm audit --omit=dev
```

The gate checks syntax, unit behavior, durable job lifecycle, cancellation/process-tree behavior, MCP startup/schema, the built server and runner, manifests, required files, personal paths, and key-like text. It does not make provider API calls.

## Live API test

`npm run test:e2e` launches two synchronous DeepSeek workers. `npm run test:e2e-job` tests one background DeepSeek job through submit, MCP reconnect, status, collect, and runtime attestation. Both require:

- `DEEPSEEK_API_KEY` in the environment
- a working `deepseek` Codex profile
- a small amount of API credit

The synchronous test passes only when both exact responses return and both rollouts attest provider `deepseek` and model `deepseek-flash`. The background test requires a real result marker and `deepseek/deepseek-flash/high` attestation. A short live background acceptance validates lifecycle separation but is not a measured 300-second endurance run.

Live tests are intentionally excluded from normal pull-request CI because forked pull requests must not receive secrets and routine changes should not create API charges. Maintainers can run the `Live DeepSeek E2E` workflow manually after configuring the repository secret.

## Release review

Before release, perform both:

1. Direct MCP live test with at least two overlapping workers.
2. End-to-end Codex parent test where an OpenAI parent visibly calls `run_parallel`, receives both DeepSeek results, and reports runtime attestation.

Only the first is automated in the public workflow. The second depends on a signed-in Codex parent account and is a maintainer acceptance test; never put ChatGPT/OpenAI credentials in GitHub Actions for it.

Record the Codex CLI version, provider, model, reasoning effort, child thread IDs, start times, overlap, and exact expected responses. Do not upload rollout files because they may contain prompts or workspace data.
