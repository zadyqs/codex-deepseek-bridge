import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pluginRoot, "..", "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), "utf8"));

const packageJson = readJson("plugins/codex-deepseek-bridge/package.json");
const pluginJson = readJson("plugins/codex-deepseek-bridge/.codex-plugin/plugin.json");
const mcpJson = readJson("plugins/codex-deepseek-bridge/.mcp.json");
const marketplace = readJson(".agents/plugins/marketplace.json");

assert.equal(packageJson.version, pluginJson.version, "package and plugin versions must match");
assert.equal(pluginJson.name, "codex-deepseek-bridge");
assert.equal(marketplace.name, "zadyqs");
assert.equal(marketplace.plugins[0]?.name, pluginJson.name);
assert.equal(marketplace.plugins[0]?.source?.path, "./plugins/codex-deepseek-bridge");

const server = mcpJson.mcpServers?.codex_provider_workers;
assert(server, "codex_provider_workers MCP server is required");
assert.equal(server.command, "node");
assert.deepEqual(server.args, ["./dist/index.mjs"]);
assert(server.env_vars.every((name) => /^[A-Z][A-Z0-9_]*$/.test(name)), "invalid environment variable name");

for (const required of [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "plugins/codex-deepseek-bridge/dist/index.mjs",
  "plugins/codex-deepseek-bridge/skills/codex-deepseek-bridge/SKILL.md",
]) {
  assert(fs.existsSync(path.join(repoRoot, required)), `missing required file: ${required}`);
}

const trackedText = [
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "plugins/codex-deepseek-bridge/.mcp.json",
  "plugins/codex-deepseek-bridge/mcp/core.mjs",
  "plugins/codex-deepseek-bridge/mcp/server.mjs",
].map((relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8")).join("\n");
assert(!/[A-Za-z]:\\Users\\[^\\\s]+/i.test(trackedText), "repository contains a user-specific Windows path");
assert(!/\bsk-[A-Za-z0-9_-]{8,}\b/.test(trackedText), "repository contains a key-like value");

process.stdout.write(`Validated ${pluginJson.name} v${pluginJson.version}.\n`);
