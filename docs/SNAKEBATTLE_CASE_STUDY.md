# SnakeBattle: bounded external workers in a real project

This case study separates evidence recorded in the project's 2026-09-23 experiment report from maintainer interpretation. The game project's source and raw Codex rollouts are not copied here; they may contain private workspace context.

## Confirmed in the experiment report and repository history

- A Codex parent delegated two independent read-only audits to DeepSeek workers. Their executions overlapped by about 92 seconds, and child rollout attestation reported `deepseek / deepseek-flash / high`.
- The audits were incorrectly scored 0/2 because the requested expectation used the display label `DeepSeek V4.1 Flash` while the runtime used canonical ID `deepseek-flash`. This bridge release recognizes only that explicit alias; unrelated or unknown names still fail closed.
- DeepSeek wrote validated session configuration and tests. The parent independently reran 56/56 tests, typecheck, and diff check, then committed the work as `15e5c10` and integrated it as `aa67c78`.
- On an isolated worktree, DeepSeek wrote a fixed-point/session-data policy and tests. A 600-second budget task returned in 164 seconds with `deepseek-flash / high` attestation. The parent independently reran 74/74 tests, typecheck, and diff check, then committed `0643bf5` and integrated as `5d49ba7`.
- The worker sandbox allowed code and test edits but denied writes to shared `.git` metadata. Git staging and commits therefore remained parent-owned.
- Broader synchronous edits repeatedly hit 240/260/300-second request windows and sometimes left partial files. The report separately identifies a request-side 240-second self-limit; it does not prove that every interruption was caused by the MCP host.
- A later game-project commit, `446b9df`, changed the first Boss special warning/escape configuration and added escape-feasibility validation and tests. This confirms that the gameplay issue was addressed in code, not who first noticed it.

## Maintainer-reported findings, not independently attributable from public artifacts

The maintainer reports that a DeepSeek worker flagged a real validation defect and the mathematical unavoidability of the first Boss special. The public experiment report does not include the raw worker transcript for those two findings. We therefore report their attribution as maintainer testimony, while the follow-up code change above is independently visible in project history.

## Engineering interpretation

The useful pattern was not “cheap model replaces the parent.” It was a strong parent defining narrow, testable work, a separately billed worker producing code or audits, and the parent rerunning checks and taking ownership of Git integration. Short synchronous work was viable; larger work exposed the mismatch between worker timeout budgets and the outer tool-call lifecycle. That experience motivated this bridge's durable `submit_jobs` → `get_job_status` → `collect_results` path.

This case does **not** establish a measured premium-usage saving, a production-ready game, physical-phone acceptance, or universal provider support.
