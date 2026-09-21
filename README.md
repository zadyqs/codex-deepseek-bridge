# Codex DeepSeek Bridge

[![CI](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![Verified live delegation: OpenAI parent to two parallel DeepSeek V4.1 Flash workers](assets/verified-parallel-delegation.svg)](docs/VERIFIED_LIVE_PROOF.md)

> [!NOTE]
> **Codex 自定义 Provider 的官方追踪 / Official tracking for Codex custom providers**
>
> - [OpenAI Codex 官方仓库 #29156](https://github.com/openai/codex/issues/29156)：Codex Desktop 尚无安全、完整的第三方 provider 模型选择器；
> - [OpenAI Codex 官方仓库 #35487](https://github.com/openai/codex/issues/35487)：模型菜单可能把 OpenAI 模型错误写入第三方 provider profile；
> - [OpenAI Codex 官方仓库 #45839](https://github.com/openai/codex/issues/45839)：社区请求官方提供 provider 管理、GUI 选择与故障切换能力。
>
> 本项目围绕这些公开讨论，提供一条可实践、可验证、可卸载的多 provider 并行路径，帮助探索 Codex 的跨模型协作体验。随着原生能力逐步完善，也可以平滑回归官方方案。
>
> 注：这些 issue 位于 OpenAI 官方仓库，其中可包含社区提交的问题报告或功能请求；它们证明问题已经在上游公开记录，但不代表 OpenAI 已承诺具体修复时间。

## 中文介绍

**让顶层模型负责判断，让高性价比模型并行干活。**

Codex DeepSeek Bridge 是一个可移除的 Codex 插件。它让 OpenAI 顶层模型担任“总指挥”，把边界清楚、可以独立完成的开发任务，并行交给 DeepSeek V4.1 Flash 等高性价比“雇佣兵模型”，再由顶层模型收回结果、整合代码和最终复核。

它不把 DeepSeek 伪装成 OpenAI 模型，也不修改 Codex 数据库、认证或内置模型目录。第三方模型目前仍通过独立 profile 与桥接调用协作；可见的 MCP 工具调用、真实并发时间和逐 worker 运行时验真，会记录任务实际由哪个模型完成。相关体验与讨论见 Codex 官方仓库 [#29156](https://github.com/openai/codex/issues/29156)、[#35487](https://github.com/openai/codex/issues/35487) 和 [#45839](https://github.com/openai/codex/issues/45839)。

**一次规划，多路执行；强模型把关，低成本扩编；调用可见，结果可证。**

## English

**Let the strongest model decide. Let cost-effective models execute in parallel.**

Codex DeepSeek Bridge is a removable Codex plugin that turns an OpenAI parent into the lead engineer: it decomposes bounded work, dispatches independent tasks to DeepSeek V4.1 Flash or other configured “mercenary models,” then integrates and reviews their output. It works alongside Codex through visible MCP calls, real overlap, and per-worker runtime attestation. Related custom-provider workflows are being discussed in the official Codex repository: [#29156](https://github.com/openai/codex/issues/29156), [#35487](https://github.com/openai/codex/issues/35487), and [#45839](https://github.com/openai/codex/issues/45839).

**Plan once. Execute in parallel. Scale with value. Verify every result.**

## 它到底是什么？ / What exactly is it?

它不只是一个孤立的 MCP 配置，而是一套完整的 **Codex 插件**：

| 组成 | 作用 |
| --- | --- |
| Codex Plugin | 提供可安装、可升级、可卸载的产品外壳 |
| Local MCP Server | 暴露 `codex_provider_workers.run_parallel`，创建并控制并行 worker |
| Routing Skill | 告诉顶层模型何时拆任务、如何限制并发、如何回收结果 |
| Runtime Attestation | 从每个子任务的实际运行记录核验 provider、模型、推理强度和 CLI 版本 |
| Tests and Docs | 提供离线测试、真实 API 验收、回滚、故障排查和发布规范 |

所以最准确的说法是：**它是一个由本地 MCP bridge 驱动的 Codex 多模型并行插件。**

## 工作方式 / How it works

```text
OpenAI 顶层模型（规划、拆分、最终 Review）
                    │
                    ▼
     Codex DeepSeek Bridge / run_parallel
          ┌─────────┼─────────┐
          ▼         ▼         ▼
     DeepSeek A  DeepSeek B  其他 profile
       编码         测试        文档/分析
          └─────────┼─────────┘
                    ▼
       运行时验真 → 结果回收 → 顶层模型整合
```

顶层模型始终保留架构决策、冲突处理和最终质量责任；worker 只处理明确、独立、受沙箱与超时约束的任务。这样既保留高能力模型的判断力，也能用更低成本扩大并行吞吐。

## 为什么值得用？ / Why it matters

- **成本分层：** 不必让昂贵的顶层模型亲自完成每一项机械工作。
- **真正并行：** 不是轮流模拟；返回峰值并发和任务重叠时间。
- **结果可证：** 不相信 profile 名称，直接核验运行时 provider、模型与推理强度。
- **失败关闭：** 实际模型不匹配时明确失败，不静默降级或偷换模型。
- **安全可逆：** 不接管 OpenAI 流量、不改数据库、不保存 API Key，随时可卸载。
- **不锁死 DeepSeek：** 每个任务可以指定不同 profile，为混合模型编队预留空间。

适合希望“强模型做架构和验收、性价比模型做批量实现”的个人开发者、小团队、长上下文代码库和批量工程任务。

## 能连接哪些模型？ / Provider compatibility

| 状态 | Provider / model | 说明 |
| --- | --- | --- |
| ✅ 已真实验证 | DeepSeek direct / `deepseek-flash` | DeepSeek V4.1 Flash；双 worker 端到端并行验收已通过 |
| 🟡 已预留接入 | OpenRouter profiles | 安装包已转发 `OPENROUTER_API_KEY`；具体模型必须逐个实测并验真 |
| 🟡 架构兼容 | 其他 Codex custom profiles | 需要可用的 Codex profile、Responses 兼容运行方式及对应密钥变量 |
| ✅ 支持编队 | 同批混合 profiles | 每个任务可覆盖 profile 和推理强度；每个 provider 都应单独设置预期值 |
| ❌ 不宣称 | “所有模型天然可用” | 配置存在不等于可用；只有真实调用和 attestation 通过才算支持 |

项目名称突出 DeepSeek，是因为它是当前的参考配置和已验证主力；执行核心本身是 provider-neutral。接入新 provider 时，只增加它所需的明确环境变量，不把密钥写入仓库，并先做最小真实调用。

## What works

- One parent can launch 1-8 jobs, with a configurable maximum of 1-4 concurrent workers.
- The default `deepseek` profile can be overridden per batch or per task.
- Each task can choose its own profile and reasoning effort, enabling mixed-provider batches.
- Worker execution is bounded by a timeout, output limit, cancellation signal, and `read-only` or `workspace-write` sandbox.
- Results include child thread IDs, provider/model/reasoning attestation, timing, concurrency, truncation state, and errors.
- Optional expected provider/model/reasoning fields fail the batch closed when runtime attestation differs.
- Credentials stay in environment variables and are screened from prompts and returned output.

In Codex, the parent task shows a visible `codex_provider_workers.run_parallel` tool call. That tool call is the auditable delegation record.

## 与 Codex 原生体验协作 / Working alongside native Codex

The bridge keeps external-provider workers in explicit Codex profiles and routes them through visible MCP calls instead of changing the native picker. OpenAI's official Codex repository contains active discussions about provider-aware Desktop selection in [#29156](https://github.com/openai/codex/issues/29156), provider/model pairing in [#35487](https://github.com/openai/codex/issues/35487), and broader provider management in [#45839](https://github.com/openai/codex/issues/45839).

This project complements that work with an immediately usable, reversible path. It avoids database edits, traffic interception, fake authentication, and catalog replacement, and can be removed cleanly as native provider support expands.

## 看不到下拉菜单，怎么证明它真的工作？ / Proof without the picker

不要相信配置文件里写了什么，也不要把模型名称出现在界面上当成证明。一次有效验收必须同时看到：

1. 顶层 Codex 任务中出现可见的 `codex_provider_workers.run_parallel` 调用；
2. `peakConcurrency` 大于 1 且 `overlapMs` 大于 0，证明 worker 的确并行；
3. 每个结果的 `attestation.verified` 为 `true`，并由运行时报告 `provider=deepseek`、`model=deepseek-flash`、`reasoningEffort=max`；
4. `expectationsMet=true`；provider、模型或推理强度只要有一项不符，桥接就失败关闭，而不是悄悄换模型。

The native picker is not the proof. The visible MCP call, real overlap, per-worker runtime attestation, and fail-closed expectations are the proof. See the [sanitized live acceptance record](docs/VERIFIED_LIVE_PROOF.md), including the exact results, independent child task IDs, reproduction prompt, and evidence boundaries.

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

## Adding another provider

Create a separate Codex profile containing the exact provider/model pair, validate that profile directly, then pass its profile name to `run_parallel`. The same Codex Desktop picker limitation generally applies to other custom providers.

The packaged MCP manifest forwards only `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY`. If a provider uses a different credential variable, add only that variable name to `.mcp.json`, rebuild, and reinstall. Never claim compatibility from configuration alone: set `expected_provider`, `expected_model`, and `expected_reasoning_effort`, then require a successful live attestation.

## 让更多开发者看到 / Help the project grow

如果这个项目帮你把“高能力总指挥 + 高性价比并行 worker”真正跑通：

- 给仓库一个 Star，让更多遇到相同 Codex provider 限制的人更容易找到它；
- 分享真实的 provider、模型和验真结果，但不要公开 API Key 或原始 rollout；
- 通过 Issues 提交可复现的问题、provider 兼容报告或改进建议；
- 欢迎贡献新的 provider 配置示例、测试与文档，所有“支持”声明都必须有真实调用证据。

**把昂贵推理留给关键判断，把批量执行交给可验证的高性价比模型。**

If the bridge helps, star the repository, share sanitized attestation evidence, and contribute reproducible provider reports. Every compatibility claim should be backed by a real call—not a configuration screenshot.

## Removal

```powershell
codex plugin remove codex-deepseek-bridge
codex plugin marketplace remove codex-deepseek-bridge
```

Removal does not delete provider profiles, environment variables, or Codex history.

## License

MIT
