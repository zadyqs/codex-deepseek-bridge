import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { cancelJob, collectResults, getJobStatus, jobDirectory, readJob, submitJobs } from "../mcp/jobs.mjs";
import { runWorker } from "../mcp/core.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(pluginRoot, "test", "fixtures", "mock-codex.mjs");

function setup(t) {
  const root = fs.mkdtempSync(path.join(pluginRoot, ".test-jobs-"));
  const previous = Object.fromEntries(["CODEX_BRIDGE_JOBS_DIR", "CODEX_HOME", "CODEX_CLI_PATH", "MOCK_CONTROL_DIR", "MOCK_SECRET_VALUE"].map((name) => [name, process.env[name]]));
  process.env.CODEX_BRIDGE_JOBS_DIR = path.join(root, "jobs");
  process.env.CODEX_HOME = path.join(root, "codex-home");
  process.env.CODEX_CLI_PATH = fixture;
  process.env.MOCK_CONTROL_DIR = root;
  process.env.MOCK_SECRET_VALUE = "fixture-secret-value-123";
  t.after(async () => {
    const jobsPath = path.join(root, "jobs");
    if (fs.existsSync(jobsPath)) {
      for (const name of fs.readdirSync(jobsPath)) {
        try {
          const pid = readJob(name).supervisorPid;
          for (let i = 0; pid && i < 50; i += 1) {
            try { process.kill(pid, 0); } catch { break; }
            await new Promise((resolve) => setTimeout(resolve, 40));
          }
        } catch { /* A non-job directory cannot hold this test's workspace open. */ }
      }
    }
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  return root;
}

function input(root, tasks) {
  return {
    cwd: root, tasks, profile: "deepseek", reasoning_effort: "high",
    expected_provider: "deepseek", expected_model: "DeepSeek V4.1 Flash",
    expected_reasoning_effort: "high", max_concurrency: 2,
    sandbox: "read-only", result_max_chars: 40000,
    timeout_policy: "short", timeout_seconds: 30,
  };
}

async function until(jobId, predicate, maxMs = 10000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const job = getJobStatus(jobId);
    if (predicate(job)) return job;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`job did not reach expected state: ${JSON.stringify(getJobStatus(jobId))}`);
}

test("submit is immediate, workers overlap, status persists after MCP restart, and collect is repeatable", async (t) => {
  const root = setup(t);
  const openClient = async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(pluginRoot, "mcp", "server.mjs")], cwd: pluginRoot, env: process.env });
    const client = new Client({ name: "job-restart-test", version: "0.1.0" });
    await client.connect(transport);
    return client;
  };
  const firstClient = await openClient();
  const tools = await firstClient.listTools();
  for (const name of ["run_parallel", "submit_jobs", "get_job_status", "list_jobs", "collect_results", "cancel_job"]) assert(tools.tools.some((tool) => tool.name === name));
  const started = Date.now();
  const submittedResponse = await firstClient.callTool({ name: "submit_jobs", arguments: input(root, [{ id: "a", prompt: "WAIT task A" }, { id: "b", prompt: "WAIT task B" }]) });
  const submitted = submittedResponse.structuredContent;
  assert(Date.now() - started < 2000);
  assert.match(submitted.jobId, /^[0-9a-f-]{36}$/);
  assert(["queued", "running"].includes(submitted.status));
  await until(submitted.jobId, (job) => job.tasks.every((task) => task.status === "running" && task.threadId));
  assert.throws(() => submitJobs({ ...input(root, [{ id: "overflow", prompt: "WAIT" }]), max_concurrency: 3 }), /capacity exceeded/);
  assert.equal(fs.existsSync(path.join(jobDirectory(submitted.jobId), "launch.json")), false);
  await firstClient.close();
  const client = await openClient();
  try {
    const status = await client.callTool({ name: "get_job_status", arguments: { job_id: submitted.jobId } });
    assert.equal(status.structuredContent.status, "running");
    const listed = await client.callTool({ name: "list_jobs", arguments: { limit: 5 } });
    assert(listed.structuredContent.jobs.some((job) => job.jobId === submitted.jobId));
  } finally { await client.close(); }
  fs.writeFileSync(path.join(root, "release"), "ok");
  const finished = await until(submitted.jobId, (job) => job.status === "succeeded");
  assert.equal(finished.peakConcurrency, 2);
  assert(finished.tasks.every((task) => task.attestation?.canonicalModel === "deepseek-flash"));
  assert.deepEqual(collectResults(submitted.jobId), collectResults(submitted.jobId));
  assert.deepEqual(collectResults(submitted.jobId).results.map((r) => r.result), ["MOCK_a_OK", "MOCK_b_OK"]);
  assert(!fs.readFileSync(path.join(jobDirectory(submitted.jobId), "job.json"), "utf8").includes("WAIT task"));
});

test("cancel preserves partial output and stops the worker process tree", async (t) => {
  const root = setup(t);
  const submitted = submitJobs(input(root, [{ id: "cancel", prompt: "WAIT PARTIAL SPAWN_CHILD" }]));
  const running = await until(submitted.jobId, (job) => job.tasks[0].threadId && fs.existsSync(path.join(root, "heartbeat")));
  const workerPid = running.tasks[0].workerPid;
  const grandchildPid = Number(fs.readFileSync(path.join(root, "grandchild.pid"), "utf8"));
  const unrelated = submitJobs(input(root, [{ id: "unrelated", prompt: "WAIT independent" }]));
  await until(unrelated.jobId, (job) => job.tasks[0].status === "running" && job.tasks[0].threadId);
  const stopped = await cancelJob(submitted.jobId);
  assert.equal(stopped.status, "cancelled");
  assert.equal(stopped.tasks[0].failureCause, "cancelled");
  const result = collectResults(submitted.jobId).results[0];
  assert.equal(result.result, "partial-work-done");
  assert.equal(result.cancelled, true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.throws(() => process.kill(workerPid, 0));
  if (process.platform === "win32") assert.throws(() => process.kill(grandchildPid, 0));
  const heartbeat = fs.readFileSync(path.join(root, "heartbeat"), "utf8");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(fs.readFileSync(path.join(root, "heartbeat"), "utf8"), heartbeat);
  assert.equal(getJobStatus(unrelated.jobId).status, "running");
  fs.writeFileSync(path.join(root, "release"), "ok");
  await until(unrelated.jobId, (job) => job.status === "succeeded");
});

test("provider failure, result bounds, credential redaction, and job isolation", async (t) => {
  const root = setup(t);
  const failed = submitJobs(input(root, [{ id: "fail", prompt: "FAIL provider" }]));
  await until(failed.jobId, (job) => job.status === "failed");
  assert.equal(collectResults(failed.jobId).results[0].failureCause, "provider_failure");
  const secret = submitJobs(input(root, [{ id: "secret", prompt: "SECRET_OUTPUT" }]));
  await until(secret.jobId, (job) => job.status === "succeeded");
  assert.equal(collectResults(secret.jobId).results[0].result, "[REDACTED]");
  assert.equal(readJob(failed.jobId).tasks[0].status, "failed");
  assert.throws(() => getJobStatus("../other"), /invalid job_id/);
  assert.throws(() => submitJobs(input(root, [{ id: "leak", prompt: process.env.MOCK_SECRET_VALUE }])), /credential material/);
});

test("worker timeout is distinct from cancellation and retains partial output", async (t) => {
  const root = setup(t);
  const result = await runWorker({ task: { id: "timeout", prompt: "WAIT PARTIAL" }, cwd: root, profile: "deepseek", reasoningEffort: "high", timeoutSeconds: 1, sandbox: "read-only" });
  assert.equal(result.ok, false);
  assert.equal(result.cancelled, false);
  assert.equal(result.failureCause, "worker_timeout");
  assert.equal(result.result, "partial-work-done");
});

test("collect results enforces an aggregate output bound", async (t) => {
  const root = setup(t);
  const submitted = submitJobs({ ...input(root, [{ id: "large-a", prompt: "BIG_OUTPUT" }, { id: "large-b", prompt: "BIG_OUTPUT" }]), result_max_chars: 100000 });
  await until(submitted.jobId, (job) => job.status === "succeeded");
  const collected = collectResults(submitted.jobId);
  assert.equal(collected.results.reduce((sum, item) => sum + item.result.length, 0), 100000);
  assert.equal(collected.results[1].resultTruncated, true);
});

test("timeout policies have explicit per-mode upper bounds", (t) => {
  const root = setup(t);
  assert.throws(() => submitJobs({ ...input(root, [{ id: "short", prompt: "no launch" }]), timeout_seconds: 601 }), /30\.\.600/);
  assert.throws(() => submitJobs({ ...input(root, [{ id: "feature", prompt: "no launch" }]), timeout_policy: "feature", timeout_seconds: 3601 }), /30\.\.3600/);
  const extended = { ...input(root, [{ id: "extended", prompt: "no launch" }]), timeout_policy: "extended" };
  delete extended.timeout_seconds;
  assert.throws(() => submitJobs(extended), /require explicit/);
  assert.throws(() => submitJobs({ ...extended, timeout_seconds: 7201 }), /30\.\.7200/);
});
