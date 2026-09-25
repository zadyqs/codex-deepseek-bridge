# Security policy

## Reporting

Report suspected vulnerabilities privately through GitHub's security reporting flow or directly to the repository owner before public disclosure. Include a minimal reproduction and sanitized evidence.

Do not include API keys, authentication files, full rollout files, private prompts, screenshots containing secrets, or proprietary source code. Revoke and rotate any credential that is accidentally disclosed.

## Supported versions

Security fixes are provided for the latest released version. Older versions may be asked to reproduce against the current release.

## Runtime model

The bridge runs local Codex child processes with the installed user's permissions, bounded by the selected `read-only` or `workspace-write` sandbox. Review delegated tasks and use the narrowest suitable workspace path and permissions.

The packaged MCP manifest explicitly asks to forward `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY`; actual process inheritance also depends on the user's Codex/host environment. The child process inherits the MCP process environment. Keep unrelated credentials out of that environment when practical. The bridge rejects prompts containing known credential values, redacts returned output, disables child MCP recursion, limits concurrency and output, and terminates workers on timeout or cancellation. Delegated prompts and relevant code/context may leave the machine for the configured external model provider; do not send material you are not allowed to disclose.

The project does not patch Codex, alter its database, intercept OpenAI traffic, or manage provider credentials. Any proposal that changes those boundaries requires an explicit security review.
