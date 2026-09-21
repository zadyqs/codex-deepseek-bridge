# Codex DeepSeek Bridge

[![CI](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Let an OpenAI parent task in Codex visibly delegate independent engineering work to DeepSeek V4.1 Flash or another configured provider profile. The bridge is a removable local Codex plugin containing one MCP tool and one routing Skill.

It does not replace Codex, patch the desktop application, alter its database, proxy OpenAI traffic, or store API keys. It launches normal `codex exec --profile <name>` workers and reports runtime evidence from each child rollout.

## What works

- One parent can launch 1-8 jobs, with a configurable maximum of 1-4 concurrent workers.
- The default `deepseek` profile can be overridden per batch or per task.
- Each task can choose its own profile and reasoning effort, enabling mixed-provider batches.
- Worker execution is bounded by a timeout, output limit, cancellation signal, and `read-only` or `workspace-write` sandbox.
- Results include child thread IDs, provider/model/reasoning attestation, timing, concurrency, truncation state, and errors.
- Optional expected provider/model/reasoning fields fail the batch closed when runtime attestation differs.
- Credentials stay in environment variables and are screened from prompts and returned output.

In Codex, the parent task shows a visible `codex_provider_workers.run_parallel` tool call. That tool call is the auditable delegation record.

## Current UI limitation

The bridge does not add DeepSeek to the model picker at the bottom of the Codex composer. Codex Desktop does not yet provide a safe provider-aware picker that can mix built-in OpenAI models and custom provider models. The upstream gap is tracked in [openai/codex#29156](https://github.com/openai/codex/issues/29156), [openai/codex#35487](https://github.com/openai/codex/issues/35487), and [openai/codex#45839](https://github.com/openai/codex/issues/45839).

This project deliberately avoids database edits, traffic interception, fake authentication, and catalog replacement. Those approaches can break provider/model pairing or hide normal models and chats. The bridge is designed to be removed when Codex gains native provider-aware selection.

## Requirements

- Codex CLI available on `PATH`
- Node.js 20 or newer
- A working Codex profile for each external provider
- Provider credentials stored in environment variables

DeepSeek's current official API model ID for DeepSeek-V4.1-Flash is `deepseek-flash`. See [DeepSeek's model and pricing page](https://api-docs.deepseek.com/quick_start/pricing/) and [Responses API reference](https://api-docs.deepseek.com/api/create-response/).

## Install

```powershell
git clone https://github.com/zadyqs/codex-deepseek-bridge.git
cd codex-deepseek-bridge\plugins\codex-deepseek-bridge
npm ci
npm run verify
cd ..\..
codex plugin marketplace add .
codex plugin add codex-deepseek-bridge@codex-deepseek-bridge
```

Restart Codex and start a new task so the plugin Skill and MCP tool are loaded. Provider setup is documented in [docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md).

## Example request

> Use Codex DeepSeek Bridge to give DeepSeek two independent tasks in parallel. Wait for both and show the runtime provider/model evidence.

The parent normally supplies:

```json
{
  "cwd": "C:\\absolute\\workspace",
  "profile": "deepseek",
  "reasoning_effort": "max",
  "expected_provider": "deepseek",
  "expected_model": "deepseek-flash",
  "expected_reasoning_effort": "max",
  "max_concurrency": 2,
  "sandbox": "workspace-write",
  "tasks": [
    { "id": "tests", "prompt": "Add focused tests for the parser." },
    { "id": "docs", "prompt": "Update the parser documentation." }
  ]
}
```

For mixed providers, put `profile` and optionally `reasoning_effort` on each task. The parent remains responsible for conflict-free task boundaries, integration, and final verification.

## Testing and review

```powershell
cd plugins\codex-deepseek-bridge
npm ci
npm run verify
npm run test:e2e
```

`npm run verify` is offline and safe for normal CI. `npm run test:e2e` makes real DeepSeek API calls and requires a configured `deepseek` profile, so it is intentionally opt-in. A manually triggered GitHub Actions workflow is provided for maintainers who add a `DEEPSEEK_API_KEY` repository secret. See [docs/TESTING.md](docs/TESTING.md).

## Documentation

- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Provider setup](docs/PROVIDER_SETUP.md)
- [Testing and release gates](docs/TESTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Release process](docs/RELEASING.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Other providers

The execution core is provider-neutral. Any provider/model that works through a Codex profile and its Responses-compatible runtime can use the bridge. The same Codex Desktop picker limitation generally applies to other custom providers.

The packaged MCP manifest forwards only `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY`. For a direct provider using another variable, fork or edit `.mcp.json` to add only that specific name, rebuild, and reinstall. Compatibility must be verified with that provider; DeepSeek is the reference configuration tested by this project.

## Removal

```powershell
codex plugin remove codex-deepseek-bridge
codex plugin marketplace remove codex-deepseek-bridge
```

Removal does not delete provider profiles, environment variables, or Codex history.

## License

MIT
