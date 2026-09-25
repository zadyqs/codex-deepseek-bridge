# Promotion handoff / 独立推广窗口交接

状态：`FEATURE_FROZEN / MAINTENANCE_ONLY`。本文件供独立窗口进行只读研究和有帮助的答疑；本仓库不负责登录、自动评论或批量推广。

## 已核验入口

- 公开仓库：https://github.com/zadyqs/codex-deepseek-bridge （公开、未归档）。
- 不可变版本：`v0.1.0`，提交 `442baccc5e2a92fa521e97f7a0eddac0b416bcb1`，标签页：https://github.com/zadyqs/codex-deepseek-bridge/releases/tag/v0.1.0 。此 URL 指向 tag；截至本次收口核查，**独立 GitHub Release 公告未建立**。
- 安装入口：[README Install](README.md#install)；本地 Marketplace 插件 `codex-deepseek-bridge@zadyqs`。需要 Node.js ≥20、Codex CLI、用户自己的 DeepSeek profile/API Key。
- 维护分支的精确提交请以仓库 `main` 页面为准；本文件不能在同一提交内写入自己的 Git SHA。
- MIT 源码许可证：[LICENSE](LICENSE)。DeepSeek API 由使用者另行付费；Codex 顶层使用也可能消耗额度。没有付费插件订阅或收益承诺。

## 定位和受众

一句话：让 Codex 顶层模型拆任务并验收，让 DeepSeek worker 承接有边界的工程任务；短任务同步并行，长任务后台提交、查询和回收。

适合：已经使用 Codex、维护真实代码项目、愿意审查 worker 结果且愿意承担外部 API 成本的开发者。不适合：要求 DeepSeek 出现在原生模型下拉菜单、零额外 API 成本、无人审查自动合并、断电必然恢复或支持任意模型的用户。

## 可说与不可说

| 可说事实 | 证据/边界 |
| --- | --- |
| OpenAI 顶层曾通过桥接让两个 DeepSeek worker 真正并行 | [脱敏调用记录](docs/VERIFIED_LIVE_PROOF.md)：`peakConcurrency=2`、重叠时间>0；非第三方独立审计。 |
| SnakeBattle 现场 12 项真实任务中 10 项超过 300 秒，最长约 25 分 53 秒，结果可回收 | [案例摘要](docs/SNAKEBATTLE_CASE_STUDY.md)；同一真实项目的维护者报告，非总体可靠性统计。 |
| 现场 `list_jobs` 在独立调用中找回同一 Job | 现场报告摘要；**不是**真实客户端重连。 |
| 已记录 `deepseek / deepseek-flash / high`、`attestation.verified=true` | Bridge 对 Codex 子任务记录的核验；非厂商签发的密码学证明，也非未来产品命名承诺。 |
| Windows/Ubuntu CI 与干净克隆离线检查通过 | [CI](https://github.com/zadyqs/codex-deepseek-bridge/actions/workflows/ci.yml)与[最终收口](FINAL_CLOSEOUT_2026-09-25.md)；CI 不替代所有现场系统。 |

禁止宣称：首创/唯一/全网最稳、节省固定百分比或把五小时变十小时、无需额外 API 费、自动处理所有代码冲突、所有 provider 已验证、强杀/断电自动恢复、原生模型菜单已支持、SnakeBattle 游戏已经通过全部质量门槛。游戏 `216/216` 不是 Bridge 测试数。

作者身份披露：**“我是这个自用开源项目的维护者，分享一条我在真实项目里验证过的做法；如果你的场景相近，可以看文档和证据，再自行判断是否适用。”** 不冒充无关联路人。

## 针对问题的答复骨架（不是评论区批量文案）

1. **Codex 如何派工？** 先问对方是否要保留顶层模型做规划和复核；若是，说明插件通过可见的 MCP 工具提交有边界任务，并给出 README 安装/最小示例链接。
2. **DeepSeek 能做什么？** 说明已验证的 `deepseek-flash` 工程 worker 与运行时记录；提醒自备 API Key、额外计费、代码可能发送至外部服务，产物由父任务复测。
3. **长任务如何回收？** 说明 `submit_jobs → get_job_status/list_jobs → collect_results`；引用单项目 >300 秒记录，同时明确现场没有做真实客户端重连或断电恢复。

反馈请走 [Issues](https://github.com/zadyqs/codex-deepseek-bridge/issues)，只附版本、系统、复现步骤和脱敏错误；安全问题按 [SECURITY.md](SECURITY.md) 私下报告。不要索取他人的密钥、完整私有代码或原始 rollout。

`PROMOTION_READY` 以本轮收口主分支、CI、公开 About 和入口最终核验为准；在最终状态确认前为 **NO**。GitHub Traffic 若无授权只记“未取到”，不推断浏览/转化数字。仅建议在 Bilibili **相关问题的评论里作有帮助的人工答复**，不做自动投放。
