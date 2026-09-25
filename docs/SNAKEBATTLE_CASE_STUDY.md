# SnakeBattle: bounded external workers in a real project

This case study separates evidence recorded in the project's 2026-09-23 experiment report from maintainer interpretation. The game project's source and raw Codex rollouts are not copied here; they may contain private workspace context.

## 2026-09-25 field acceptance update

The maintainer's later SnakeBattle field report records an OpenAI/Codex parent using `submit_jobs` → `get_job_status` → `collect_results` on actual TypeScript engineering work, not artificial sleep. Of 12 listed jobs, 10 worker durations exceed 300 seconds; the longest is `1,553,082 ms` (about 25 minutes 53 seconds). A separate `list_jobs` invocation recovered a running job ID, which was then queried and collected. The reported runtime checks for these jobs read `deepseek / deepseek-flash / high` with `attestation.verified=true`. This is a Bridge check against Codex child records, not a vendor-issued cryptographic attestation.

The field report also shows why the parent remains responsible: it found and corrected world-unit versus fixed-point-unit handling, a same-wave obstacle blockage risk, and an incorrect explanation of a Boss warning duration. The final `216/216` count belongs to SnakeBattle's own tests, **not** to this bridge. A worker-reported 672 randomized checks were not independently rerun by the parent. No measured API-cost or premium-usage comparison was made.

Two concrete parent-to-worker chains in that report make the boundary visible:

| Field job (prefix) | Parent-observed lifecycle | Parent-owned acceptance |
| --- | --- | --- |
| `f819e1b1` | The top-level Codex submitted the temporary-obstacle safety task, got a queued job ID immediately, saw it still running after roughly 428 seconds, then separately collected `succeeded`, `expectationsMet=true`, and an untruncated result after `431,116 ms`. The recorded attestation was `deepseek / deepseek-flash / high`. | The parent reran 147/147 game tests and typecheck but held integration after finding a world-unit versus fixed-point-unit mismatch. A separate `14af7abf` correction ran `320,285 ms`; the parent reran the focused 25/25 tests before committing. |
| `6204979d` | A separate long-snake route simulation was still running at `305,826 ms` and was later collected as succeeded after `1,553,082 ms`, with the same attested worker identity. | The parent reran its eight focused game tests and committed the reviewed result. |

The 12-job table in the private field report includes both read-only audits and code-producing tasks. Ten worker durations exceed 300 seconds; the two shorter entries are not counted as long-task evidence. Results that left valid, uncommitted workspace changes were not classified as bridge failures. The parent, not the worker, owned review, corrective dispatches, tests, and Git commits.

One worker's sandboxed `npm test` failed with Node child-process `spawn EPERM`. A single-process fallback returned 195/195 there, but the parent did **not** treat that fallback as the standard test gate: it ran normal `npm test` in its own environment, strengthened the review boundary, and obtained 196/196 before committing. This is an environment-permission distinction, not evidence that the bridge or production code failed. Later game tests reached 216/216 after additional parent review and fixes.

**Evidence boundary:** This single-project field run proves that real background jobs survived beyond 300 seconds and their results were retrievable. It did **not** exercise a real MCP/client reconnect, Windows shutdown, power loss, or worker-process kill/recovery. `list_jobs` across independent tool calls is not a reconnect test. The configured one- and two-hour limits were not both exercised. The field run made no bridge source changes; the exact installed-binary-to-source-commit mapping was not captured as immutable build provenance. The earlier packaged test did reconnect an MCP client for a short job, but it is a different, narrower test.

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
