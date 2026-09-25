# Codex DeepSeek Bridge — 2026-09-25 最终工程收口

本文件是 `v0.1.0` 之后的维护/公开交付收口记录；[v0.1.0 原发布报告](FINAL_RELEASE_REPORT.md)仍保留当时的历史证据。**本文件的现场证据更新 supersedes 原报告“尚无 >300 秒真实项目实测”的时间点结论，但不改变旧报告所述短任务脚本重连测试的范围。**

## 1. 状态与版本

| 独立状态 | 本轮结论 |
| --- | --- |
| `ENGINEERING_CLOSEOUT` | **YES**：限定在现有能力、安装和证据表述；没有改 Bridge 执行源码或 SnakeBattle 工程。 |
| `RELEASE_READY` | **YES（现有 v0.1.0 代码）**：CI/干净克隆/真实小调用均有证据；后续文档提交的 CI 须以其最终 SHA 单独核验。 |
| `PUBLISHED` | **部分**：公开仓库与不可变 `v0.1.0` 标签已存在；独立 GitHub Release 公告尚未建立。文档收口只有推送并核验远端后才算公开。 |
| `PROMOTION_READY` | 以 [推广交接](PROMOTION_HANDOFF.md) 的最终入口和线上状态为准；若文档/About/CI 尚未全部公开则为 **NO**。 |

起点：`main=442baccc5e2a92fa521e97f7a0eddac0b416bcb1`，起点工作区干净；远端 `https://github.com/zadyqs/codex-deepseek-bridge.git`，公开、未归档。`v0.1.0` 标签指向该提交，不覆盖、移动或重打。源码许可仍为 MIT。当前安装的插件与仓库包版本字符串均为 `0.1.0+codex.20260925014924`；现场 12 个 Job 的安装版本与不可变源码提交之间缺少独立构建溯源，不能把现场结果逐字等同于某一个 Git SHA。本文件不能在同一提交中嵌入自己的 SHA；最终收口提交以 `git rev-parse HEAD` 或 GitHub `main` 记录为准。

## 2. Claim / evidence 分级

| 对外结论 | 等级 | 证据与精确边界 |
| --- | --- | --- |
| 顶层 Codex 直接完成后台 `submit_jobs → get_job_status → collect_results` | 现场实测 | 2026-09-25 SnakeBattle 现场报告；单一真实项目。 |
| 12 项真实工程 Job 中 10 项 worker 超过 300 秒，最长 `1,553,082 ms`（约 25 分 53 秒） | 现场实测 | 生产任务，非人工 sleep；说明 >300 秒存活和回收，不代表总体零失败。 |
| `list_jobs` 在独立工具调用中找回同一任务 | 现场实测 | 不是客户端重连。 |
| `deepseek / deepseek-flash / high`，`attestation.verified=true` | 现场实测记录 | Bridge 根据 Codex 子任务记录核验；不是模型厂商或密码学独立证明，也不保证未来模型命名。 |
| 父任务发现单位、同波合堵与解释错误并修正；游戏最终 `216/216` | 现场实测报告 | `216/216` 是 SnakeBattle 游戏测试，不是 Bridge 的测试数；worker 自报 672 组随机检查未经父任务独立复跑。 |
| 短任务脚本跨 MCP 客户端重新连接收回结果 | 本仓库真实 API 测试 | `test:e2e-job` 的受控短任务；不能与上述现场长任务合并成一次“长任务重连”实验。 |
| 21 项离线测试；同步 2 worker 并行 | 本仓库测试 | 覆盖源码/打包基础能力；CI Windows/Ubuntu，API 调用需另跑。 |
| `feature=3600s`、`extended≤7200s`、取消/失败分类与持久化 | 代码/配置支持 | 是上限与设计，不等于真实连续运行 1–2 小时或断电恢复。 |
| 真正客户端重连时的现场长任务表现、Windows 关机/断电/强杀恢复、全平台可靠率、同任务成本节省 | 未知/未验证 | 不宣传为通过；后续仅在真实需求和安全条件具备时专项核验。 |

## 3. 本轮 diff 与文件

从固定发布基线查看完整差异：[v0.1.0...main](https://github.com/zadyqs/codex-deepseek-bridge/compare/v0.1.0...main)；本地执行 `git diff --stat v0.1.0..HEAD` 和 `git diff v0.1.0..HEAD -- <path>` 可复核。此 compare 的右端是移动分支，最终提交 SHA 以完成时的 GitHub/最终交付消息为准。

- `README.md`：中文首屏、适用人群、安装/首次调用、数据与计费边界、真实场景证据、并行写入治理、FAQ、卸载与 Feature Freeze。
- `docs/SNAKEBATTLE_CASE_STUDY.md`、`docs/VERIFIED_LIVE_PROOF.md`、`docs/TESTING.md`：把 >300 秒现场耐久、脚本短任务重连和未测的真实客户端重连分开。
- `docs/PROVIDER_SETUP.md`：把 `deepseek-flash` 作为验收所用 ID，而非未来 API 命名承诺。
- `SECURITY.md`：准确说明进程环境继承及委派代码可能传给外部模型服务。
- `CHANGELOG.md`：记录本轮文档/证据收口，不冒充新执行能力。
- `PROMOTION_HANDOFF.md`：提供可独立使用的作者披露、允许/禁止说法与反馈入口。
- 本文件：状态、证据、diff、发布/维护决定与剩余边界。未修改 Bridge 执行源码、版本号、旧 tag、游戏工程或 Job 日志。

## 4. 验证、安装与安全

本轮从公开 `v0.1.0` 新克隆到独立临时目录，而非依赖开发仓库已有 `node_modules`：`npm ci`、`npm run verify`（21/21 离线测试、构建与 manifest 校验）、`npm audit --omit=dev --audit-level=high`（0 个漏洞）均通过。打包 MCP server/runner 的离线测试覆盖后台提交、状态、取消与结果回收；真实小调用 `npm run test:e2e-job` 成功回收 `BRIDGE_LIVE_JOB_OK`，运行记录 `deepseek/deepseek-flash/high`；`npm run test:e2e` 两个 worker 2/2 成功、`peakConcurrency=2`、重叠 `15,050 ms`。这两次真实调用使用用户已配置的现有 provider，没有创建付费账户或密钥，也没有触碰 SnakeBattle 正在运行的任务。

当前 CLI `codex-cli 0.155.1`、本机 Node.js `25.9.0`；CI 使用 Node.js 20，Windows/Ubuntu 双系统。干净克隆验证了 GitHub tag、必需打包文件、依赖安装、构建、manifest 与真实 MCP/API 入口。又在**独立的临时 Codex home** 从该干净克隆执行公开的 `codex plugin marketplace add <clone>` 与 `codex plugin add codex-deepseek-bridge@zadyqs`，均退出 0，独立 `plugin list` 显示插件 enabled、版本一致；未修改正在使用的全局插件注册。现有本机插件亦为 enabled。此检查覆盖全新 CLI 注册路径，未声称另一个真实用户的桌面 UI 已经过验收。

已核对 Git 跟踪文件不含 `.env`、原始 rollout、任务日志或 Job 目录；本轮凭据模式扫描未发现典型长密钥，安全/发布文档未包含真实密钥。直接依赖 `@modelcontextprotocol/sdk`、`zod` 与构建依赖 `@vercel/ncc` 的包元数据均为 MIT；未完成所有传递依赖的人工法律审查。MCP manifest 请求传递 `DEEPSEEK_API_KEY`/`OPENROUTER_API_KEY`，子进程继承 MCP 进程环境；相关任务/代码上下文可能送往已配置的外部模型服务。使用者应选最窄沙箱、工作区和任务边界，禁止在 prompt/Issue 中放密钥。GitHub Traffic 页面可读，但汇总图表在核查时仍处于加载状态；没有可靠完整基线，不填写总访问量或转化率，也不把仅维护者可见的数据公开进仓库。

## 5. GitHub、Release 与维护

GitHub 仓库已公开、未归档；固定 [v0.1.0 标签](https://github.com/zadyqs/codex-deepseek-bridge/releases/tag/v0.1.0)存在，但 `releases/tags/v0.1.0` API 查询未找到独立 Release 对象。About、topics 和本轮文档应分别以发布后实际 GitHub 状态为准，不把本地草稿写成已公开。没有主页网站，不为宣传创建新网站或追踪器。

拟用精简 About：**“让 Codex 顶层模型拆任务与验收，让 DeepSeek worker 并行执行；支持后台任务、状态查询、结果回收与运行时核验。Codex plugin + local MCP bridge.”** 拟用少量 topics：`codex`、`deepseek`、`mcp`、`ai-agents`、`agentic-coding`、`parallel-processing`、`runtime-attestation`。

正式 GitHub Release 公告若尚无明确发布确认，保持未发布，并使用以下草稿：**v0.1.0 — Verified DeepSeek worker delegation and durable local jobs.** 新增同步并行及后台提交/查询/回收/取消；Windows/Ubuntu CI 与真实 DeepSeek 调用通过；SnakeBattle 单项目报告记录 10 个 >300 秒任务、最长约 25 分 53 秒。自备 DeepSeek API Key，外部 API 单独计费；不进入 Codex 原生模型下拉菜单；真实长任务的客户端重连、断电/强杀恢复和成本节省比例未验证。安装请按 README 的固定 tag 步骤。

后续状态：`FEATURE_FROZEN / MAINTENANCE_ONLY`。继续自用、修复可复现缺陷/安全问题与必要安装兼容；不自动扩建 provider 阵容、Router、GUI 或营销系统。反馈使用已有 [Issues 模板](.github/ISSUE_TEMPLATE/bug_report.yml)，不索取完整私有代码或密钥。独立推广窗口只读取 [PROMOTION_HANDOFF.md](PROMOTION_HANDOFF.md)；本轮不写入外部记忆数据库，也不改变其他项目的工程或档案。无须在工程收口后自动启动新功能。
