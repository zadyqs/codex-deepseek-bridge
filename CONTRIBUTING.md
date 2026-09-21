# Contributing

Thanks for improving Codex DeepSeek Bridge.

## Before opening a change

1. Keep the bridge provider-neutral unless a provider-specific behavior is required.
2. Never add credentials, personal paths, rollout contents, or paid API output to the repository.
3. Preserve the safety boundary: no Codex database edits, native traffic interception, fake authentication, or model-catalog replacement.
4. Add or update tests for behavior changes.
5. Run the offline verification suite:

   ```powershell
   cd plugins\codex-deepseek-bridge
   npm ci
   npm run verify
   ```

6. Run `npm run test:e2e` only when you have an isolated test profile, understand the API cost, and can inspect the resulting provider/model attestation.

## Pull requests

Keep pull requests focused. Describe the user-visible change, security impact, tests performed, and any provider/API cost. Do not claim support for a provider that has only passed mocked or offline tests.

## Compatibility

The supported baseline is Node.js 20+ and a current stable Codex CLI. Changes should remain cross-platform unless the limitation is documented. Avoid shell-specific command construction in the MCP server.
