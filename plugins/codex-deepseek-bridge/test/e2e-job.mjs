import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(pluginRoot, "..", "..");
const connect = async () => {
  const client = new Client({ name: "bridge-live-job", version: "0.1.0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.join(pluginRoot, "dist", "index.mjs")],
    cwd: pluginRoot, env: process.env,
  }));
  return client;
};

if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is required for live E2E");
let client = await connect();
let jobId;
try {
  const response = await client.callTool({ name: "submit_jobs", arguments: {
    cwd: pluginRoot,
    profile: "deepseek", reasoning_effort: "high",
    expected_provider: "deepseek", expected_model: "DeepSeek V4.1 Flash", expected_reasoning_effort: "high",
    timeout_policy: "short", timeout_seconds: 180,
    max_concurrency: 1, sandbox: "read-only",
    tasks: [{ id: "live-job", prompt: "Read the repository README introduction, then reply in one short sentence ending with exactly BRIDGE_LIVE_JOB_OK. Do not modify files or spawn subagents." }],
  } });
  jobId = response.structuredContent?.jobId;
  assert(jobId, JSON.stringify(response).slice(0, 1000));
} finally { await client.close(); }

client = await connect();
try {
  const deadline = Date.now() + 210000;
  let status;
  while (Date.now() < deadline) {
    status = (await client.callTool({ name: "get_job_status", arguments: { job_id: jobId } })).structuredContent;
    if (["succeeded", "failed", "cancelled", "timed_out"].includes(status.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(status?.status, "succeeded", JSON.stringify({ status: status?.status, failureCause: status?.failureCause, tasks: status?.tasks?.map((t) => ({ status: t.status, error: t.error })) }));
  const collected = (await client.callTool({ name: "collect_results", arguments: { job_id: jobId } })).structuredContent;
  assert.equal(collected.ready, true);
  assert.equal(collected.results.length, 1);
  const result = collected.results[0];
  assert.match(result.result, /BRIDGE_LIVE_JOB_OK\s*$/);
  assert.equal(result.attestation.verified, true);
  assert.equal(result.attestation.provider, "deepseek");
  assert.equal(result.attestation.canonicalModel, "deepseek-flash");
  assert.equal(result.attestation.reasoningEffort, "high");
  assert.equal(result.expectationsMet, true);
  process.stdout.write(JSON.stringify({ jobId, status: status.status, workspaceRootVerified: status.workspace === workspace, threadId: result.threadId, attestation: result.attestation, durationMs: result.durationMs, resultMarker: "BRIDGE_LIVE_JOB_OK" }) + "\n");
} finally { await client.close(); }
