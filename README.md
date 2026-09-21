# Codex DeepSeek Bridge

[![CI](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 中文介绍

Codex DeepSeek Bridge 是可移除的本地插件：由 OpenAI 顶层模型统筹，将独立任务并行交给 DeepSeek V4.1 Flash 或其他已配置模型。它为 Codex Desktop 尚无第三方 provider 选择器的问题而生，以更低成本提供可见、可验证的跨模型协作。支持 1-8 个任务/4 路并发、逐任务 profile 与推理强度、沙箱/超时/取消/密钥保护和运行时校验；适用于 DeepSeek、OpenRouter 及其他 Responses 兼容的 Codex profile，不修改 Codex、数据库或 OpenAI 流量。当前仅受限于第三方模型无法安全显示在原生下拉框；这是 OpenAI Codex 的上游 UI 缺口，见官方仓库 [#29156](https://github.com/openai/codex/issues/29156) 和 [#45839](https://github.com/openai/codex/issues/45839)，不是桥接调用失败。

**强模型指挥，性价比模型并行；调用可见，结果可证。**

## English

Codex DeepSeek Bridge lets an OpenAI parent orchestrate parallel DeepSeek V4.1 Flash or custom-provider workers. It fills Codex Desktop's provider-picker gap with lower-cost, verifiable delegation: 1-8 tasks, four-way concurrency, per-task profiles/reasoning, sandboxing, cancellation, secret safeguards, and attestation. It supports DeepSeek, OpenRouter, and other Responses-compatible profiles without patching Codex. The missing native dropdown is upstream, not a bridge failure: [#29156](https://github.com/openai/codex/issues/29156), [#45839](https://github.com/openai/codex/issues/45839).

**Lead with strength. Scale with value. Verify every result.**

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

The bridge does not add DeepSeek to the model picker at the bottom of the Codex composer. Codex Desktop does not yet provide a safe provider-aware picker that can mix built-in OpenAI models and custom provider models. OpenAI's official Codex repository tracks the missing provider-aware Desktop picker in [#29156](https://github.com/openai/codex/issues/29156), the risk of a picker retaining the wrong provider/model pair in [#35487](https://github.com/openai/codex/issues/35487), and the broader provider-management request in [#45839](https://github.com/openai/codex/issues/45839).

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
