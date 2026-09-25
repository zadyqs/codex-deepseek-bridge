---
name: codex-deepseek-bridge
description: Delegate independent Codex engineering tasks in parallel to DeepSeek or another configured provider profile, and report runtime-attested provider/model evidence. Use when the user asks for DeepSeek workers, cross-provider delegation, cheaper parallel workers, or visible external-model task execution.
---

# Codex DeepSeek Bridge

Use `codex_provider_workers.run_parallel` for bounded short tasks. For feature-sized work likely to exceed the outer MCP/tool-call window, use `submit_jobs`, then `get_job_status` and `collect_results`; `list_jobs` recovers an ID after an interrupted parent call, and `cancel_job` explicitly stops a job. Do not keep one synchronous call open for a long feature or assume that increasing `timeout_seconds` changes the parent tool limit.

- Default to profile `deepseek` unless the user names another configured profile.
- For DeepSeek V4.1 Flash, default ordinary parallel workers to `high` reasoning effort. Reserve `max` for clearly hard debugging, architecture, or final critical-review tasks, and always attest the requested effort.
- Pass an absolute existing path inside the target workspace as `cwd`. For Git projects, the bridge resolves this to the repository root so workers can edit files across the project rather than being confined to a nested folder. For non-Git directories, the selected directory remains the write root.
- Keep tasks independent and identify each with a short unique ID.
- Never place credentials in prompts or tool arguments.
- Queue at most eight tasks, use no more than four concurrent workers, and keep the parent responsible for integration and final verification.
- Default to the `workspace-write` sandbox for coding work and `read-only` for analysis-only tasks. Never request danger-full-access through this bridge.
- Workers can edit and test project files, but Codex sandboxes may deny them writes to `.git`. Let workers return their changes, then have the parent agent stage, commit, and report the commit result from the parent task.
- Use per-task `profile` overrides only when tasks are independent and each profile has already been configured by the user.
- Treat `results[].attestation` as the model/provider evidence. Do not claim a worker used the requested provider merely because a profile name was supplied.
- For acceptance tests or provider-specific requests, set `expected_provider`, `expected_model`, and `expected_reasoning_effort` so mismatches fail closed.
- Tell the user when any worker failed, timed out, or could not be attested.
- The expected DeepSeek model may be the canonical `deepseek-flash` or the recognized display alias `DeepSeek V4.1 Flash`. Never invent other aliases; unknown names fail closed.
- Long jobs have bounded `short` (600s), `feature` (3600s), and explicit `extended` (up to 7200s) policies. Poll without blocking the parent for the full duration. Distinguish `timed_out`, `cancelled`, provider failure, process failure, and partial workspace changes.
- Never treat a background job's `running` status as success. Collect the final result, inspect runtime attestation, independently rerun relevant checks, and only then let the parent stage/commit.
- Do not use this bridge to bypass provider terms, account access, model entitlements, or Codex safety controls.

The tool call itself is the visible record inside the Codex task. It does not add third-party models to the desktop model picker.
