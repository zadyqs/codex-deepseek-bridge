# Releasing

1. Update `CHANGELOG.md` and use the same semantic version in `package.json` and `.codex-plugin/plugin.json`.
2. Run `npm ci`, `npm run verify`, and `npm audit --omit=dev`.
3. Run both `npm run test:e2e` and `npm run test:e2e-job`, plus the signed-in OpenAI-parent acceptance test from [TESTING.md](TESTING.md).
4. Inspect the staged diff and confirm no credentials, personal paths, temporary rollouts, or generated caches are included.
5. Push the release commit, verify the GitHub Actions Windows and Ubuntu matrix is green, then create and push an annotated `vX.Y.Z` tag.
6. Publish a GitHub release with the matching changelog section, supported Codex/Node versions, verification evidence, and known UI limitations.

Do not release based only on successful installation or a provider configuration file. A release candidate must complete real provider calls and return runtime attestation.
