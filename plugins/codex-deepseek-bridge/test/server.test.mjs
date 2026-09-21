import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("MCP server starts and publishes the parallel worker tool", async () => {
  const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(pluginRoot, "mcp", "server.mjs")],
    cwd: pluginRoot,
  });
  const client = new Client({ name: "offline-smoke", version: "0.1.0" });
  try {
    await client.connect(transport);
    const response = await client.listTools();
    const tool = response.tools.find((item) => item.name === "run_parallel");
    assert(tool);
    assert.equal(tool.inputSchema.properties.max_concurrency.maximum, 4);
    assert.equal(tool.inputSchema.properties.tasks.maxItems, 8);
  } finally {
    await client.close();
  }
});
