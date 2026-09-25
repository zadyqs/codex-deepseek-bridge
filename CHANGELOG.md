# Changelog

All notable changes are documented here. This project follows semantic versioning after the first public release.

## [Unreleased]

## [0.1.0] - 2026-09-24

### Added

- Git workspace-root detection: when `cwd` points into a nested project folder, workers now receive the Git repository root as their bounded `workspace-write` root; non-Git workspaces retain the requested directory.
- Parent-owned Git integration guidance for sandboxes where worker processes can edit/test files but `.git` is read-only.
- Bounded 1-8 task batches with a maximum of four concurrent workers.
- Per-task profile and reasoning-effort overrides.
- Worker cancellation, result truncation, sandbox selection, and concurrency evidence.
- Offline CI, manifest validation, security checks, contributor documentation, and opt-in live API testing.
- A root portable `plugin.json` and portable `mcp.json` alongside the existing Codex compatibility files, so current plugin loaders can discover the bridge without losing existing local-marketplace support.
- Durable local job lifecycle: immediate submit, status, bounded collect, explicit cancel, and recent-job recovery after an interrupted parent call.
- Detached background supervisor and persisted metadata/results; bounded short/feature/extended timeout policies and four reserved background worker slots.
- Explicit `DeepSeek V4.1 Flash` → `deepseek-flash` alias normalization without weakening fail-closed attestation for unknown names.
- Cross-platform CI path tests, Windows process-tree cancellation checks, packaged-runner smoke test, and real DeepSeek background-job acceptance.
- A sanitized SnakeBattle case study separating recorded evidence from maintainer attribution.
- Initial Codex plugin, routing Skill, and `run_parallel` MCP tool.
- Runtime provider/model/reasoning attestation from child rollouts.
- DeepSeek V4.1 Flash reference configuration using `deepseek-flash`.
