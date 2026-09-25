# Verified live proof / 真实调用证明

This is a sanitized record of the release acceptance run performed on 2026-09-21. It contains no API key, account data, or machine-specific workspace path.

这是 2026-09-21 发布验收的脱敏记录，不包含 API Key、账号数据或本机工作目录。

## What was proved / 证明了什么

An OpenAI parent running `gpt-5.6-sol` with `xhigh` reasoning called `codex_provider_workers.run_parallel` once. The bridge launched two independent DeepSeek workers at the same time and required each worker to attest the requested provider, model, and reasoning effort.

一个使用 `gpt-5.6-sol / xhigh` 的 OpenAI 顶层任务调用了一次 `codex_provider_workers.run_parallel`。桥接同时启动两个独立 DeepSeek worker，并强制每个 worker 对实际 provider、模型和推理强度进行运行时验真。

| Evidence | Verified value |
| --- | --- |
| Parent | `gpt-5.6-sol / xhigh` |
| Bridge tool | `codex_provider_workers.run_parallel` |
| Requested profile | `deepseek` |
| Runtime provider | `deepseek` |
| Runtime model | `deepseek-flash` (DeepSeek V4.1 Flash) |
| Worker reasoning | `max` |
| Result | `2/2 succeeded`, `0 failed` |
| Parallelism | `peakConcurrency=2`, `overlapMs=16082` |
| Fail-closed checks | `expectationsMet=true` for both workers |
| Codex CLI reported by workers | `0.155.1` |

Independent child task IDs:

- `01a0c61d-d465-7e23-9b2c-c00250cda2b6`
- `01a0c61d-d478-7961-8d45-f7750640545f`

Exact parent acceptance result:

```text
RELEASE_PARENT_BRIDGE_OK — successCount 2, failureCount 0,
peakConcurrency 2, overlapMs 16082 (>0).
release-a=RELEASE_DEEPSEEK_A_OK;
release-b=RELEASE_DEEPSEEK_B_OK.
Both expectationsMet=true; both attestations verified
provider=deepseek, model=deepseek-flash, reasoningEffort=max.
```

This historical release run used `max` to establish the upper-bound acceptance record. The current recommended default for ordinary parallel workers is `high`; use `max` only when the parent identifies a genuinely hard task.

## Why this is stronger than a model-picker label

A dropdown label proves only what the interface displays. This acceptance verifies what each child process actually used at runtime. The bridge rejects the batch when the reported provider, model, or reasoning effort differs from the expected value.

模型下拉框只能证明界面显示了什么；这次验收证明的是每个子任务运行时实际用了什么。如果 provider、模型或推理强度与预期不符，桥接会直接把该批任务判为失败。

## Reproduce it / 复现方法

After installing the plugin and configuring the `deepseek` profile, ask the parent:

> Use Codex DeepSeek Bridge to give DeepSeek two independent read-only tasks in parallel. Require provider `deepseek`, model `deepseek-flash`, reasoning `max`, and show every runtime attestation, child task ID, peak concurrency, overlap, and expectation result.

For a release-grade check, require two exact output markers and reject the run unless `successCount=2`, `failureCount=0`, `peakConcurrency=2`, `overlapMs>0`, both `attestation.verified=true`, and both `expectationsMet=true`.

## Evidence boundary / 证据边界

- This proves the bridge performed a real, concurrent DeepSeek V4.1 Flash delegation through the configured Codex provider profile.
- It does not claim that DeepSeek appears in Codex Desktop's native model picker. That upstream UI gap is tracked by OpenAI in [#29156](https://github.com/openai/codex/issues/29156), [#35487](https://github.com/openai/codex/issues/35487), and [#45839](https://github.com/openai/codex/issues/45839).
- The public evidence is intentionally sanitized. Maintainers should keep raw local rollout logs private because they may contain workspace or account context.

## Durable-job acceptance / 持久化任务验收

On 2026-09-24 local time (2026-09-25 UTC), a separate live check used the packaged `submit_jobs` tool with a real `deepseek` profile, closed the original MCP client, opened a new MCP client, polled status, and collected the final result. The job finished `succeeded` in about 16 seconds. Its child rollout attested `provider=deepseek`, `model=deepseek-flash`, `reasoningEffort=high`, and Codex CLI `0.155.1`; `expectationsMet=true`. The returned marker was `BRIDGE_LIVE_JOB_OK`. A separate synchronous acceptance on the same code returned 2/2 successful DeepSeek workers, `peakConcurrency=2`, and `overlapMs=12967`.

This verifies live background-job lifecycle and real provider usage across an MCP reconnect. It does **not** constitute a 300-second endurance measurement. The [SnakeBattle case study](SNAKEBATTLE_CASE_STUDY.md) records why longer-running work is needed and what happened in the real project.

## Later field evidence / 后续现场证据

A separate 2026-09-25 SnakeBattle field report documents 12 real engineering jobs, 10 over 300 seconds, with the longest worker duration `1,553,082 ms` and results recovered by the Codex parent. That is the evidence for **>300-second field endurance**. It does not supersede the distinction above: the field report did not test a real MCP/client reconnect, power-loss recovery, or a one-/two-hour continuous run. The short packaged reconnect test and the long field endurance test are separate evidence, not one combined scenario. See the [case study](SNAKEBATTLE_CASE_STUDY.md) and [final closeout](../FINAL_CLOSEOUT_2026-09-25.md).
