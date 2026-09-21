# Changelog

All notable changes are documented here. This project follows semantic versioning after the first public release.

## [Unreleased]

### Added

- Bounded 1-8 task batches with a maximum of four concurrent workers.
- Per-task profile and reasoning-effort overrides.
- Worker cancellation, result truncation, sandbox selection, and concurrency evidence.
- Offline CI, manifest validation, security checks, contributor documentation, and opt-in live API testing.

## [0.1.0] - 2026-09-21

### Added

- Initial Codex plugin, routing Skill, and `run_parallel` MCP tool.
- Runtime provider/model/reasoning attestation from child rollouts.
- DeepSeek V4.1 Flash reference configuration using `deepseek-flash`.
