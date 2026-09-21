# Troubleshooting

## The tool is missing

Restart Codex and create a new task after installing or updating the plugin. Confirm the marketplace and plugin are listed with `codex plugin list`.

## A worker cannot start

Run `codex --version`, confirm Node.js 20+, and test the profile directly with the command in [PROVIDER_SETUP.md](PROVIDER_SETUP.md). The bridge reports process-start errors separately from provider/model attestation failures.

## Provider or model is unverified

Configuration labels are not proof. Inspect the returned child thread ID and attestation. A missing rollout can indicate a mismatched `CODEX_HOME`, an old Codex CLI, or a child process that failed before session creation.

## A batch is slow or receives 429 responses

Lower `max_concurrency`. Provider limits apply at the account level and can change. The bridge caps local concurrency at four even when more tasks are queued.

## Output is truncated

Increase `result_max_chars` up to 100000 or ask workers for shorter summaries. Raw child rollouts remain managed by Codex and are not returned by the bridge.

## DeepSeek is absent from the model picker

That is an upstream Codex Desktop limitation, not an installation failure. Confirm the visible `codex_provider_workers.run_parallel` call and its attestation instead. Do not patch the Codex database or replace the built-in model catalog.
