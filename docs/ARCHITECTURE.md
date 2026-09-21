# Architecture

## Execution flow

1. An OpenAI parent task loads the plugin Skill.
2. The parent calls `codex_provider_workers.run_parallel` with bounded, independent tasks.
3. The local MCP server validates inputs and launches `codex exec --profile <profile>` child processes without a shell.
4. Child MCP servers are disabled to prevent recursive delegation.
5. A bounded worker pool limits active children to four.
6. Each child result is matched with its Codex rollout and attested from recorded provider, model, reasoning effort, and CLI version.
7. Optional provider/model/reasoning expectations are compared with runtime attestation and fail closed on mismatch.
8. Redacted structured results return to the parent for integration and final verification.

## Trust boundaries

- The plugin receives only environment variables explicitly named in `.mcp.json`.
- The API key remains in the process environment and is not placed in arguments, prompts, or configuration committed to Git.
- Prompt text matching a known credential value is rejected.
- Returned text and errors are scrubbed against sensitive environment values.
- Workers run with either `read-only` or `workspace-write`; the bridge never exposes a danger-full-access option.
- Output capture, returned result length, worker count, concurrency, and runtime are bounded.
- Cancellation terminates the child process tree.

## Non-goals

- Modifying Codex Desktop or its state database
- Adding fake items to the native model picker
- Redirecting native OpenAI traffic through a third-party proxy
- Managing API keys or provider billing
- Automatically merging concurrent code changes

Those boundaries keep the plugin removable, auditable, and compatible with future native provider support.
