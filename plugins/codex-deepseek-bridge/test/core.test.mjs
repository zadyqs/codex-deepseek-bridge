import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  canonicalModelId,
  enforceAttestation,
  parseCodexOutput,
  redactSecrets,
  rejectCredentialMaterial,
  resolveWorkspaceCwd,
  runTaskPool,
  validateProfileName,
  validateTasks,
} from "../mcp/core.mjs";

test("canonical model aliases are explicit and unknown labels fail closed", () => {
  assert.equal(canonicalModelId("DeepSeek V4.1 Flash"), "deepseek-flash");
  assert.equal(canonicalModelId("deepseek-flash"), "deepseek-flash");
  assert.equal(canonicalModelId("Unknown Friendly Name"), null);
  const base = { ok: true, attestation: { verified: true, provider: "deepseek", model: "deepseek-flash", reasoningEffort: "high" } };
  assert.equal(enforceAttestation(base, { provider: "deepseek", model: "DeepSeek V4.1 Flash", reasoningEffort: "high" }).ok, true);
  assert.equal(enforceAttestation(base, { provider: "other" }).ok, false);
  assert.equal(enforceAttestation(base, { reasoningEffort: "max" }).ok, false);
  assert.equal(enforceAttestation(base, { model: "Unknown Friendly Name" }).ok, false);
});

test("workspace paths inside a Git project resolve to the repository root", async (t) => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-bridge-root-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nested = path.join(root, "src", "feature");
  fs.mkdirSync(nested, { recursive: true });
  const initialized = spawnSync("git", ["-C", root, "init", "--quiet"], { encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.equal(fs.realpathSync.native(resolveWorkspaceCwd(nested)), fs.realpathSync.native(root));
});

test("non-Git workspaces keep the requested directory as their write root", async (t) => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-bridge-nongit-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(resolveWorkspaceCwd(root), root);
});

test("workspace path validation fails clearly", () => {
  assert.throws(() => resolveWorkspaceCwd("relative/path"), /absolute path/);
  assert.throws(() => resolveWorkspaceCwd(path.join(process.cwd(), "this-path-does-not-exist-bridge-test")), /existing directory/);
});

test("parseCodexOutput extracts the child thread and final answer", () => {
  const stdout = [
    JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
    "diagnostic text",
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } }),
  ].join("\n");
  assert.deepEqual(parseCodexOutput(stdout), {
    threadId: "thread-123",
    finalText: "done",
    reportedError: null,
  });
});

test("profile names reject shell-like input", () => {
  assert.equal(validateProfileName("deepseek-v4.1"), "deepseek-v4.1");
  assert.throws(() => validateProfileName("deepseek; whoami"));
  assert.throws(() => validateProfileName("../profile"));
});

test("task ids must be unique", () => {
  assert.throws(() => validateTasks([
    { id: "same", prompt: "one" },
    { id: "same", prompt: "two" },
  ]));
});

test("tasks can override profile and reasoning effort safely", () => {
  assert.doesNotThrow(() => validateTasks([
    { id: "mixed", prompt: "work", profile: "openrouter-kimi", reasoning_effort: "high" },
  ]));
  assert.throws(() => validateTasks([
    { id: "bad-profile", prompt: "work", profile: "../escape" },
  ]));
  assert.throws(() => validateTasks([
    { id: "bad-effort", prompt: "work", reasoning_effort: "infinite" },
  ]));
});

test("task pool enforces concurrency and preserves result order", async () => {
  let active = 0;
  let observedPeak = 0;
  const { results, peakConcurrency } = await runTaskPool([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    observedPeak = Math.max(observedPeak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.equal(peakConcurrency, 2);
  assert.equal(observedPeak, 2);
});

test("attestation expectations fail closed on the wrong model", () => {
  const result = enforceAttestation({
    ok: true,
    error: null,
    attestation: { provider: "deepseek", model: "unexpected", reasoningEffort: "max" },
  }, {
    provider: "deepseek",
    model: "deepseek-flash",
    reasoningEffort: "max",
  });
  assert.equal(result.ok, false);
  assert.equal(result.expectationsMet, false);
  assert.match(result.error, /expected deepseek-flash/);
});

test("matching attestation expectations preserve success", () => {
  const result = enforceAttestation({
    ok: true,
    error: null,
    attestation: { provider: "deepseek", model: "deepseek-flash", reasoningEffort: "max" },
  }, {
    provider: "deepseek",
    model: "deepseek-flash",
    reasoningEffort: "max",
  });
  assert.equal(result.ok, true);
  assert.equal(result.expectationsMet, true);
});

test("credential material is rejected and redacted", () => {
  const env = { SAMPLE_API_KEY: "secret-value-123" };
  assert.throws(() => rejectCredentialMaterial([
    { id: "leak", prompt: "print secret-value-123" },
  ], env));
  assert.equal(redactSecrets("failed: secret-value-123", env), "failed: [REDACTED]");
});

test("an already-cancelled worker never launches a process", async () => {
  const controller = new AbortController();
  controller.abort();
  const { runWorker } = await import("../mcp/core.mjs");
  const result = await runWorker({
    task: { id: "cancelled", prompt: "do not run" },
    cwd: process.cwd(),
    profile: "deepseek",
    timeoutSeconds: 30,
    signal: controller.signal,
  });
  assert.equal(result.ok, false);
  assert.equal(result.cancelled, true);
  assert.match(result.error, /cancelled/i);
});
