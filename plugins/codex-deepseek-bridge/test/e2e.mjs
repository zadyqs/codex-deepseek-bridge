import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(pluginRoot, "..", "..");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(pluginRoot, "dist", "index.mjs")],
  cwd: pluginRoot,
  env: process.env,
});
const client = new Client({ name: "codex-deepseek-bridge-e2e", version: "0.1.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert(tools.tools.some((tool) => tool.name === "run_parallel"));
  const response = await client.callTool({
    name: "run_parallel",
    arguments: {
      profile: "deepseek",
      reasoning_effort: "max",
      expected_provider: "deepseek",
      expected_model: "deepseek-flash",
      expected_reasoning_effort: "max",
      max_concurrency: 2,
      sandbox: "read-only",
      cwd: workspace,
      timeout_seconds: 180,
      tasks: [
        { id: "e2e-a", prompt: "Do not use tools or change files. Reply with exactly BRIDGE_E2E_A_OK" },
        { id: "e2e-b", prompt: "Do not use tools or change files. Reply with exactly BRIDGE_E2E_B_OK" },
      ],
    },
  });
  const payload = response.structuredContent;
  assert.equal(payload.ok, true);
  assert.equal(payload.workerCount, 2);
  assert.equal(payload.successCount, 2);
  assert.equal(payload.failureCount, 0);
  assert.equal(payload.peakConcurrency, 2);
  assert(payload.overlapMs > 0);
  assert.deepEqual(payload.verifiedProviders, ["deepseek"]);
  assert.deepEqual(payload.verifiedModels, ["deepseek-flash"]);
  assert.equal(payload.results[0].result, "BRIDGE_E2E_A_OK");
  assert.equal(payload.results[1].result, "BRIDGE_E2E_B_OK");
  assert(payload.results.every((item) => item.attestation?.verified));
  assert(payload.results.every((item) => item.expectationsMet === true));
  assert(payload.results.every((item) => item.attestation?.reasoningEffort === "max"));
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} finally {
  await client.close();
}
