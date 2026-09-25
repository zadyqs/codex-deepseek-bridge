# Codex DeepSeek Bridge

[![CI](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![Verified live delegation: OpenAI parent to two parallel DeepSeek V4.1 Flash workers](assets/verified-parallel-delegation.svg)](docs/VERIFIED_LIVE_PROOF.md)

> **强模型做难判断，外部 worker 做有界执行。** 本项目让顶层 Codex 通过可见的 MCP 调用，将合适的工程任务交给单独计费的 DeepSeek worker；结果由顶层独立审查、复测和提交。它旨在减少高能力模型承担的重复性工作，让有限的 Codex 使用额度更多留给架构、疑难问题与最终验收；**不保证任何固定的额度节省倍数，也不会改变账户的五小时窗口规则。**

适合已经使用 Codex、有真实代码项目，希望由顶层模型拆任务和验收、让 DeepSeek 承接部分工程工作的个人开发者。已真实验证：`deepseek/deepseek-flash/high` 的双 worker 同步并行，以及 SnakeBattle 项目中超过 300 秒的后台任务存活与结果回收。测试脚本另验证了短任务的 MCP 客户端重新连接；**SnakeBattle 现场没有进行真正的客户端重连或断电恢复测试**。其他 provider/profile 只是架构兼容，未经各自端到端验真不宣称已支持。DeepSeek API 由用户自己的账户单独计费。

不做的事：不把 DeepSeek 加进 Codex 原生模型下拉菜单，不自动合并代码，不绕过 worker 沙箱，也不做万能路由器。相关 Codex 原生 provider 讨论见 [OpenAI 官方仓库 #29156](https://github.com/openai/codex/issues/29156)、[#35487](https://github.com/openai/codex/issues/35487)、[#40858](https://github.com/openai/codex/issues/40858)。

## 中文介绍

**让顶层模型负责判断，让高性价比模型并行干活。**

Codex DeepSeek Bridge 是一个可移除的 Codex 插件。它让 OpenAI 顶层模型负责拆解和把关，把边界清楚的工程任务交给 DeepSeek V4.1 Flash worker；短任务可同步并行，长任务可独立后台运行并持久化结果，再由顶层模型收回、复核与集成。

它不把 DeepSeek 伪装成 OpenAI 模型，也不修改 Codex 数据库、认证或内置模型目录。第三方模型目前仍通过独立 profile 与桥接调用协作；可见的 MCP 工具调用、真实并发时间和逐 worker 运行时验真，会记录任务实际由哪个模型完成。相关体验与讨论见 Codex 官方仓库 [#29156](https://github.com/openai/codex/issues/29156)、[#35487](https://github.com/openai/codex/issues/35487) 和 [#45839](https://github.com/openai/codex/issues/45839)。

**一次规划，多路执行；强模型把关，调用可见，结果可证。**

项目状态：`FEATURE_FROZEN / MAINTENANCE_ONLY`。维护真实使用中的缺陷、安全问题与安装兼容性；不承诺持续增加模型或开发大型路由平台。

## English

**Let the strongest model decide. Let cost-effective models execute in parallel.**

Codex DeepSeek Bridge is a removable Codex plugin. Keep premium Codex models focused on high-value reasoning while independently billed DeepSeek workers handle bounded implementation tasks. Short tasks use synchronous parallel calls; longer tasks use durable background jobs. Every worker is checked against runtime provider/model/reasoning evidence. This can make limited premium usage go further, but it does not change plan limits or promise measured savings.

**Plan once. Execute in parallel. Verify every result.** Field evidence from one SnakeBattle project includes production jobs over 300 seconds; it does not establish universal reliability, client reconnection, power-loss recovery, or measured savings.

## 它到底是什么？ / What exactly is it?

它不只是一个孤立的 MCP 配置，而是一套完整的 **Codex 插件**：

| 组成 | 作用 |
| --- | --- |
| Codex Plugin | 提供可安装、可升级、可卸载的产品外壳 |
| Local MCP Server | 提供同步 `run_parallel` 与持久化 `submit_jobs` / `get_job_status` / `collect_results` / `cancel_job`；`list_jobs` 可找回 job ID |
| Routing Skill | 告诉顶层模型何时拆任务、如何限制并发、如何回收结果 |
| Runtime Attestation | 从每个子任务的实际运行记录核验 provider、模型、推理强度和 CLI 版本 |
| Tests and Docs | 提供离线测试、真实 API 验收、回滚、故障排查和发布规范 |

所以最准确的说法是：**它是一个由本地 MCP bridge 驱动的 Codex 多模型并行插件。**

## 工作方式 / How it works

```text
OpenAI 顶层模型（规划、拆分、最终 Review）
                    │
                    ▼
     Codex DeepSeek Bridge / run_parallel 或 submit_jobs
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
| 🟡 接口支持、未实测组合 | 同批混合 profiles | 每个任务可覆盖 profile 和推理强度；每个 provider 都应单独端到端验真 |
| ❌ 不宣称 | “所有模型天然可用” | 配置存在不等于可用；只有真实调用和 attestation 通过才算支持 |

项目名称突出 DeepSeek，是因为它是当前的参考配置和已验证主力；执行核心本身是 provider-neutral。接入新 provider 时，只增加它所需的明确环境变量，不把密钥写入仓库，并先做最小真实调用。

## What works

- One call can launch 1-8 tasks, with 1-4 concurrent workers per call. Background jobs reserve at most four worker slots across active jobs.
- The default `deepseek` profile can be overridden per batch or per task.
- Each task can choose its own profile and reasoning effort, enabling mixed-provider batches.
- Worker execution is bounded by a timeout, output limit, cancellation signal, and `read-only` or `workspace-write` sandbox.
- For Git workspaces, a path inside the repository is promoted to the Git root, allowing workers to edit across the project tree while keeping the workspace-write boundary at that repository.
- Workers can edit and test files, while `.git` may remain read-only inside their sandbox. The parent agent should review the returned work and perform Git staging/commit from the parent task.
- Results include child thread IDs, provider/model/reasoning attestation, timing, concurrency, truncation state, and errors.
- Optional expected provider/model/reasoning fields fail the batch closed when runtime attestation differs.
- The known display alias `DeepSeek V4.1 Flash` canonicalizes to `deepseek-flash`; unknown friendly-name aliases fail closed. Other providers require exact model IDs.
- Credentials stay in environment variables and are screened from prompts and returned output.

In Codex, the parent task shows visible `codex_provider_workers.run_parallel` or `submit_jobs` tool calls. Those calls, followed by status/result collection, are the auditable delegation record.

## 两种执行模式 / Two execution modes

| Mode | Use it for | Lifecycle |
| --- | --- | --- |
| `run_parallel` | Short reviews, small edits, focused tests | One blocking call. The parent/tool call may end before a large task finishes; increasing worker timeout alone cannot prevent that. |
| `submit_jobs` | Feature-sized work that may outlive one MCP call | Returns a `job_id` promptly. A detached local supervisor continues after the MCP server/parent window closes. Query with `get_job_status`, recover IDs with `list_jobs`, read with `collect_results`, or stop with `cancel_job`. |

Job metadata and bounded results live in the current user's `~/.codex-worker-bridge/jobs/<job_id>/` (Windows: `%USERPROFILE%\.codex-worker-bridge\jobs\<job_id>\`). Prompts are held only in a private transient launch file, removed when the supervisor starts. Provider environment variables are not serialized, and known credential values in arguments are rejected; still, never put secrets in prompts. The delegated prompt and relevant code/context may be sent by the configured Codex provider to DeepSeek or another external model service. Protect the local job directory like other development logs. This is a local single-user facility, not a cloud queue or a power-loss guarantee.

Timeout policies: `short=600s`, `feature=3600s` (default), `extended` requires explicit `timeout_seconds`; every job is capped at `7200s`. `run_parallel` retains its 30–1200s per-worker timeout. A worker timeout is `timed_out`; explicit cancellation is `cancelled`; provider/process/attestation failure is `failed`. An outer MCP/tool timeout is outside the background worker: retrieve the job ID through `list_jobs` and inspect it instead of assuming the worker stopped. A failed or cancelled `workspace-write` task may have left partial file edits; inspect the workspace before retrying.

For longer work, ask the parent to submit bounded tasks, then poll status and collect results. Do not block one tool call for the whole feature. The parent should review and rerun tests before committing.

并行写代码时优先让每个 worker 使用独立 worktree，或至少分配互不重叠的文件范围；不要让多个 worker 同时改同一批文件。父任务负责检查完整 diff、解决冲突、独立复测并提交。`attestation.verified=true` 代表 Bridge 从 Codex 子任务记录核对了运行身份，并非模型厂商签发的密码学证明。

## 与 Codex 原生体验协作 / Working alongside native Codex

The bridge keeps external-provider workers in explicit Codex profiles and routes them through visible MCP calls instead of changing the native picker. OpenAI's official Codex repository contains discussions about provider-aware Desktop selection in [#29156](https://github.com/openai/codex/issues/29156), provider/model pairing in [#35487](https://github.com/openai/codex/issues/35487), native subagent provider override in [#40858](https://github.com/openai/codex/issues/40858), and broader provider management in [#45839](https://github.com/openai/codex/issues/45839). These are upstream repository reports/discussions, not a promised fix schedule.

This project complements that work with an immediately usable, reversible path. It avoids database edits, traffic interception, fake authentication, and catalog replacement, and can be removed cleanly as native provider support expands.

## 看不到下拉菜单，怎么证明它真的工作？ / Proof without the picker

不要相信配置文件里写了什么，也不要把模型名称出现在界面上当成证明。一次有效验收必须同时看到：

1. 顶层 Codex 任务中出现可见的 `codex_provider_workers.run_parallel` 调用；
2. `peakConcurrency` 大于 1 且 `overlapMs` 大于 0，证明 worker 的确并行；
3. 每个结果的 `attestation.verified` 为 `true`，并由运行时报告 `provider=deepseek`、`model=deepseek-flash`、以及与请求相符的 `reasoningEffort`；
4. `expectationsMet=true`；provider、模型或推理强度只要有一项不符，桥接就失败关闭，而不是悄悄换模型。

The native picker is not the proof. The visible MCP call, real overlap, per-worker runtime attestation, and fail-closed expectations are the proof. See the [sanitized live acceptance record](docs/VERIFIED_LIVE_PROOF.md), including the exact results, independent child task IDs, reproduction prompt, and evidence boundaries.

## Requirements

- Windows PowerShell 或 Linux；项目 CI 在 Windows、Ubuntu 上运行，真实现场案例来自 Windows，其他系统未作同等现场验收
- Codex CLI available on `PATH`（本次核验使用 `codex-cli 0.155.1`；不是最低兼容版本承诺）
- Node.js 20 or newer（CI 使用 Node.js 20）
- A working Codex profile for each external provider
- Provider credentials stored in environment variables; DeepSeek 账户和 API 调用费用由使用者承担

本项目验收记录中的 DeepSeek profile 使用模型 ID `deepseek-flash`；这是**该次运行记录**，不是对未来 API 型号或价格的承诺。首次安装前请核对 [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)及 [Responses API 文档](https://api-docs.deepseek.com/api/create-response/)。

## Install

```powershell
git clone --branch v0.1.0 https://github.com/zadyqs/codex-deepseek-bridge.git
cd codex-deepseek-bridge\plugins\codex-deepseek-bridge
npm ci
npm run verify
cd ..\..
codex plugin marketplace add .
codex plugin add codex-deepseek-bridge@zadyqs
```

以上固定安装已发布的 `v0.1.0`；需要最新维护修订时再明确切换到相应提交或新版本。重启 Codex 并新建任务，让插件 Skill 和 MCP 工具加载。按 [provider 设置](docs/PROVIDER_SETUP.md)在用户环境中配置 `DEEPSEEK_API_KEY` 与 `deepseek` profile，先进行最小只读调用；不要把密钥粘进任务、仓库或 Issue。Linux 用户使用同样命令，并将 `cd` 路径分隔符改为 `/`。

## Example request

> Use Codex DeepSeek Bridge to give DeepSeek two independent tasks in parallel. Wait for both and show the runtime provider/model evidence.

The parent normally supplies:

```json
{
  "cwd": "C:\\absolute\\workspace",
  "profile": "deepseek",
  "reasoning_effort": "high",
  "expected_provider": "deepseek",
  "expected_model": "deepseek-flash",
  "expected_reasoning_effort": "high",
  "max_concurrency": 2,
  "sandbox": "workspace-write",
  "tasks": [
    { "id": "tests", "prompt": "Add focused tests for the parser." },
    { "id": "docs", "prompt": "Update the parser documentation." }
  ]
}
```

For DeepSeek V4.1 Flash, `high` is the recommended default for ordinary parallel workers; reserve `max` for clearly hard debugging, architecture, or final critical review. For mixed providers, put `profile` and optionally `reasoning_effort` on each task. The parent remains responsible for conflict-free task boundaries, integration, and final verification.

For a feature-sized task, ask: “Use `submit_jobs` with `timeout_policy=feature`, `reasoning_effort=high`, and expected `deepseek/deepseek-flash/high`; return the job ID, check status later, collect the result, then independently review and test before committing.” The default feature budget is one hour; use `extended` only with an explicit bounded timeout.

最小后台示例使用当前 MCP schema；把 `cwd` 换成你自己的绝对项目路径，不要在公开 Issue 中贴出它：

```json
{
  "cwd": "C:\\path\\to\\your-project",
  "profile": "deepseek",
  "reasoning_effort": "high",
  "expected_provider": "deepseek",
  "expected_model": "deepseek-flash",
  "expected_reasoning_effort": "high",
  "timeout_policy": "short",
  "sandbox": "read-only",
  "tasks": [{ "id": "audit", "prompt": "Read one small module and return three concrete findings; do not edit files." }]
}
```

顶层调用 `submit_jobs` 得到 `job_id`，再以该 ID 调用 `get_job_status` 和 `collect_results`；若首次回复丢失，可用 `list_jobs` 找回。功能性写入任务改为 `workspace-write`，并先划定文件边界。下游模型输出只是待审核工作，不是自动验收结论。

## Testing and review

```powershell
cd plugins\codex-deepseek-bridge
npm ci
npm run verify
npm run test:e2e
```

`npm run verify` is offline and safe for normal CI. `npm run test:e2e` makes real DeepSeek API calls and requires a configured `deepseek` profile, so it is intentionally opt-in. A manually triggered GitHub Actions workflow is provided for maintainers who add a `DEEPSEEK_API_KEY` repository secret. See [docs/TESTING.md](docs/TESTING.md).

## 真实项目证据与边界 / Field evidence

在**一个** SnakeBattle 项目的 2026-09-25 现场报告中，顶层 Codex 完成了后台提交、状态查询和结果回收。报告列出 12 项真实工程任务，其中 10 项 worker 实际运行超过 300 秒；最长 `1,553,082 ms`（约 25 分 53 秒），不是人为等待。现场还用 `list_jobs` 在独立工具调用中找回同一任务。父任务发现过单位、同波合堵和解释错误，修改并独立复测后才提交。游戏工程最终 `216/216` 是**游戏测试**，不是 Bridge 的测试数。详见[脱敏案例](docs/SNAKEBATTLE_CASE_STUDY.md)与[证据分级](FINAL_CLOSEOUT_2026-09-25.md)。

现场未做真正的 MCP 客户端重连、断电恢复或强杀 worker 后恢复。`feature=3600s` 与 `extended≤7200s` 是**配置上限**，不是已实测连续运行一或两小时。12 项记录也不能推出总体零失败率或所有系统都可靠。

## Documentation

- [v0.1.0 final release report](FINAL_RELEASE_REPORT.md)
- [2026-09-25 final closeout and field-evidence update](FINAL_CLOSEOUT_2026-09-25.md)
- [Real SnakeBattle case study and evidence boundary](docs/SNAKEBATTLE_CASE_STUDY.md)
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

## 常见问题与反馈 / FAQ

- **为什么不直接把主模型改成 DeepSeek？** 本项目保留 Codex 顶层模型负责拆分、复核和整合，只把有边界的任务交给 DeepSeek；它不改变原生模型选择菜单。
- **需要密钥或额外付费吗？** 需要自己的 DeepSeek API Key；外部 API 按提供方规则单独计费。Codex 顶层规划、工具调用和验收仍可能消耗 Codex 额度，不承诺节省比例。
- **长任务依赖什么存活？** 依赖本机、后台 supervisor/worker 进程和供应商服务继续可用。数据落盘支持状态与结果查询，但不保证断电、强杀或所有客户端重连场景自动恢复。
- **谁验收代码？** 顶层/使用者必须审查完整 diff 并在正常工程环境独立复测，再决定是否提交；多个 worker 写同一文件集合不是安全默认值。
- **出问题如何反馈？** 在 [Issues](https://github.com/zadyqs/codex-deepseek-bridge/issues) 提供插件/CLI/Node 版本、操作系统、复现步骤、预期/实际结果和脱敏后的任务状态、错误；不要上传 API Key、完整 rollout、私有代码或用户目录路径。安全问题按 [SECURITY.md](SECURITY.md) 私下报告。

本项目进入 `FEATURE_FROZEN / MAINTENANCE_ONLY`：维护自用与可复现问题，不承诺持续扩展功能。欢迎基于真实调用证据提交反馈或改进；仓库采用 [MIT 许可证](LICENSE)，但许可证不支付或免除外部 API 成本。

## Removal

```powershell
codex plugin remove codex-deepseek-bridge
codex plugin marketplace remove zadyqs
```

Removal does not delete provider profiles, environment variables, or Codex history.
如需回退，请先备份自己的 Codex 配置与需要保留的 Job 结果，确认没有仍在运行的任务，再卸载插件；不要删除其他 MCP/provider 配置或整个 Job 目录。

## License

MIT
