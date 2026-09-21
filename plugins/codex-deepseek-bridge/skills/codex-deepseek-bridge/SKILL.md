---
name: codex-deepseek-bridge
description: Delegate independent Codex engineering tasks in parallel to DeepSeek or another configured provider profile, and report runtime-attested provider/model evidence. Use when the user asks for DeepSeek workers, cross-provider delegation, cheaper parallel workers, or visible external-model task execution.
---

# Codex DeepSeek Bridge

Use the `codex_provider_workers.run_parallel` MCP tool when two or more bounded tasks can run independently, or when the user explicitly requests a DeepSeek/custom-provider worker.

- Default to profile `deepseek` unless the user names another configured profile.
- Pass an absolute existing workspace path as `cwd`.
- Keep tasks independent and identify each with a short unique ID.
- Never place credentials in prompts or tool arguments.
- Queue at most eight tasks, use no more than four concurrent workers, and keep the parent responsible for integration and final verification.
- Default to the `workspace-write` sandbox for coding work and `read-only` for analysis-only tasks. Never request danger-full-access through this bridge.
- Use per-task `profile` overrides only when tasks are independent and each profile has already been configured by the user.
- Treat `results[].attestation` as the model/provider evidence. Do not claim a worker used the requested provider merely because a profile name was supplied.
- For acceptance tests or provider-specific requests, set `expected_provider`, `expected_model`, and `expected_reasoning_effort` so mismatches fail closed.
- Tell the user when any worker failed, timed out, or could not be attested.
- Do not use this bridge to bypass provider terms, account access, model entitlements, or Codex safety controls.

The tool call itself is the visible record inside the Codex task. It does not add third-party models to the desktop model picker.
