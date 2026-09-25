import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("packaged MCP server launches a detached packaged runner and persists its result", async (t) => {
  const root = fs.mkdtempSync(path.join(pluginRoot, ".test-jobs-"));
  const env = {
    ...process.env,
    CODEX_BRIDGE_JOBS_DIR: path.join(root, "jobs"),
    CODEX_HOME: path.join(root, "codex-home"),
    CODEX_CLI_PATH: path.join(pluginRoot, "test", "fixtures", "mock-codex.mjs"),
    MOCK_CONTROL_DIR: root,
  };
  const client = new Client({ name: "built-job-test", version: "0.1.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(pluginRoot, "dist", "index.mjs")], cwd: pluginRoot, env });
  try {
    await client.connect(transport);
    const submitted = await client.callTool({ name: "submit_jobs", arguments: {
      cwd: root, profile: "deepseek", reasoning_effort: "high",
      expected_provider: "deepseek", expected_model: "deepseek-flash", expected_reasoning_effort: "high",
      sandbox: "read-only", max_concurrency: 1, tasks: [{ id: "built", prompt: "Return the fixture marker." }],
    } });
    const jobId = submitted.structuredContent.jobId;
    assert(jobId);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const status = (await client.callTool({ name: "get_job_status", arguments: { job_id: jobId } })).structuredContent;
      if (status.status === "succeeded") break;
      assert(["queued", "running"].includes(status.status), JSON.stringify(status));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const result = (await client.callTool({ name: "collect_results", arguments: { job_id: jobId } })).structuredContent;
    assert.equal(result.ready, true);
    assert.equal(result.results[0].result, "MOCK_built_OK");
    assert.equal(result.results[0].attestation.canonicalModel, "deepseek-flash");
  } finally {
    await client.close();
    t.after(async () => {
      const jobs = path.join(root, "jobs");
      if (fs.existsSync(jobs)) {
        for (const name of fs.readdirSync(jobs)) {
          const file = path.join(jobs, name, "job.json");
          if (!fs.existsSync(file)) continue;
          const pid = JSON.parse(fs.readFileSync(file, "utf8")).supervisorPid;
          for (let i = 0; pid && i < 50; i += 1) {
            try { process.kill(pid, 0); } catch { break; }
            await new Promise((resolve) => setTimeout(resolve, 40));
          }
        }
      }
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    });
  }
});
