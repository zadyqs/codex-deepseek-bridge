import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MAX_TASKS = 8;
export const MAX_CONCURRENCY = 4;
export const MAX_CAPTURED_CHARS = 8 * 1024 * 1024;
export const DEFAULT_RESULT_MAX_CHARS = 40000;
export const REASONING_EFFORTS = new Set(["profile", "low", "medium", "high", "xhigh", "max"]);

const MODEL_ALIASES = new Map([
  ["deepseek-flash", "deepseek-flash"],
  ["deepseek v4.1 flash", "deepseek-flash"],
]);

export function canonicalModelId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (MODEL_ALIASES.has(normalized)) return MODEL_ALIASES.get(normalized);
  return /^[a-z0-9][a-z0-9._:/-]*$/i.test(value) ? value : null;
}

export function validateProfileName(profile) {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(profile)) {
    throw new Error("profile must contain only letters, digits, dots, underscores, or hyphens.");
  }
  return profile;
}

export function resolveWorkspaceCwd(cwd) {
  if (typeof cwd !== "string" || !path.isAbsolute(cwd)) {
    throw new Error("cwd must be an absolute path.");
  }
  const requested = path.resolve(cwd);
  if (!fs.existsSync(requested) || !fs.statSync(requested).isDirectory()) {
    throw new Error("cwd must identify an existing directory.");
  }

  // If the caller starts in a nested project folder, use the repository root so
  // workspace-write covers the complete project without widening beyond it.
  try {
    const gitRoot = spawnSync("git", ["-C", requested, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (gitRoot.status === 0 && gitRoot.stdout.trim()) {
      const resolvedGitRoot = path.resolve(gitRoot.stdout.trim());
      if (fs.existsSync(resolvedGitRoot) && fs.statSync(resolvedGitRoot).isDirectory()) {
        return resolvedGitRoot;
      }
    }
  } catch {
    // Git may not be installed or the directory may not be in a Git repository.
  }
  return requested;
}

export function validateTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > MAX_TASKS) {
    throw new Error(`tasks must contain between 1 and ${MAX_TASKS} items.`);
  }
  const ids = new Set();
  for (const task of tasks) {
    if (!task || typeof task.id !== "string" || task.id.length < 1 || task.id.length > 80) {
      throw new Error("each task id must contain 1-80 characters.");
    }
    if (ids.has(task.id)) throw new Error(`duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (typeof task.prompt !== "string" || task.prompt.length < 1 || task.prompt.length > 30000) {
      throw new Error(`task ${task.id} prompt must contain 1-30000 characters.`);
    }
    if (task.profile !== undefined) validateProfileName(task.profile);
    if (task.reasoning_effort !== undefined && !REASONING_EFFORTS.has(task.reasoning_effort)) {
      throw new Error(`task ${task.id} has an invalid reasoning_effort.`);
    }
  }
  return tasks;
}

export async function runTaskPool(tasks, maxConcurrency, runner) {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > MAX_CONCURRENCY) {
    throw new Error(`max_concurrency must be between 1 and ${MAX_CONCURRENCY}.`);
  }
  const results = new Array(tasks.length);
  let cursor = 0;
  let active = 0;
  let peakConcurrency = 0;

  async function consume() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      active += 1;
      peakConcurrency = Math.max(peakConcurrency, active);
      try {
        results[index] = await runner(tasks[index], index);
      } finally {
        active -= 1;
      }
    }
  }

  const consumers = Math.min(maxConcurrency, tasks.length);
  await Promise.all(Array.from({ length: consumers }, () => consume()));
  return { results, peakConcurrency };
}

export function enforceAttestation(result, expected = {}) {
  const attestation = result.attestation?.verified
    ? { ...result.attestation, canonicalModel: canonicalModelId(result.attestation.model) }
    : result.attestation;
  result = { ...result, attestation };
  const checks = [
    ["provider", expected.provider, result.attestation?.provider],
    ["model", expected.model, result.attestation?.model],
    ["reasoning effort", expected.reasoningEffort, result.attestation?.reasoningEffort],
  ].filter(([, wanted]) => wanted !== undefined);
  if (checks.length === 0) return { ...result, expectationsMet: null };

  const mismatches = checks
    .filter(([label, wanted, actual]) => label === "model"
      ? !canonicalModelId(wanted) || canonicalModelId(wanted) !== canonicalModelId(actual)
      : wanted !== actual)
    .map(([label, wanted, actual]) => `${label}: expected ${wanted}, got ${actual ?? "unverified"}`);
  if (mismatches.length === 0) return { ...result, expectationsMet: true };

  return {
    ...result,
    ok: false,
    expectationsMet: false,
    error: [result.error, `Attestation mismatch (${mismatches.join("; ")}).`].filter(Boolean).join(" "),
  };
}

function sensitiveEnvironmentValues(env = process.env) {
  return Object.entries(env)
    .filter(([name, value]) =>
      /(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name)
      && typeof value === "string"
      && value.length >= 8)
    .map(([, value]) => value);
}

export function rejectCredentialMaterial(tasks, env = process.env) {
  const secrets = sensitiveEnvironmentValues(env);
  for (const task of tasks) {
    if (/\bsk-[A-Za-z0-9_-]{8,}\b/.test(task.prompt) || secrets.some((secret) => task.prompt.includes(secret))) {
      throw new Error(`task ${task.id} prompt contains credential material from the environment.`);
    }
  }
}

export function redactSecrets(value, env = process.env) {
  if (typeof value !== "string") return value;
  let redacted = value.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
  for (const secret of sensitiveEnvironmentValues(env)) {
    redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}

export function parseCodexOutput(stdout) {
  let threadId = null;
  let finalText = null;
  let reportedError = null;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started") threadId = event.thread_id ?? threadId;
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        finalText = event.item.text ?? finalText;
      }
      if (event.type === "item.completed" && event.item?.type === "error") {
        reportedError = event.item.message ?? reportedError;
      }
      if (event.type === "error") reportedError = event.message ?? reportedError;
    } catch {
      // Ignore non-JSON diagnostics emitted alongside JSONL events.
    }
  }
  return { threadId, finalText, reportedError };
}

function resolveCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function normalizeCustomCli(customPath) {
  if (!customPath || !fs.existsSync(customPath)) return null;
  if (customPath.endsWith(".js") || customPath.endsWith(".mjs")) {
    return { command: process.execPath, prefixArgs: [customPath] };
  }
  return { command: customPath, prefixArgs: [] };
}

export function resolveCodexLaunch() {
  const custom = normalizeCustomCli(process.env.CODEX_CLI_PATH);
  if (custom) return custom;

  const candidates = [];
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex", "bin", "codex.js"));
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const npmRoot = spawnSync(npmCommand, ["root", "-g"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (npmRoot.status === 0 && npmRoot.stdout.trim()) {
    candidates.push(path.join(npmRoot.stdout.trim(), "@openai", "codex", "bin", "codex.js"));
  }

  const entry = candidates.find((candidate) => fs.existsSync(candidate));
  if (entry) return { command: process.execPath, prefixArgs: [entry] };

  return { command: process.platform === "win32" ? "codex.cmd" : "codex", prefixArgs: [] };
}

function dateParts(date) {
  return [
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ];
}

function candidateSessionDirs(startedAt) {
  const root = path.join(resolveCodexHome(), "sessions");
  const dates = [
    new Date(startedAt.getTime() - 24 * 60 * 60 * 1000),
    startedAt,
    new Date(startedAt.getTime() + 24 * 60 * 60 * 1000),
  ];
  return [...new Set(dates.map((date) => path.join(root, ...dateParts(date))))];
}

function findRolloutFile(threadId, startedAt) {
  for (const directory of candidateSessionDirs(startedAt)) {
    if (!fs.existsSync(directory)) continue;
    const match = fs.readdirSync(directory).find((name) => name.endsWith(`-${threadId}.jsonl`));
    if (match) return path.join(directory, match);
  }
  return null;
}

function readRolloutAttestation(file) {
  const result = {
    verified: false,
    provider: null,
    model: null,
    reasoningEffort: null,
    cliVersion: null,
    rolloutFileName: path.basename(file),
  };
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines.slice(0, 80)) {
    if (!line.startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "session_meta") {
        result.provider = event.payload?.model_provider ?? result.provider;
        result.model = event.payload?.base_instructions?.provenance?.model ?? result.model;
        result.cliVersion = event.payload?.cli_version ?? result.cliVersion;
      }
      if (event.type === "turn_context") {
        result.model = event.payload?.model ?? result.model;
        result.reasoningEffort = event.payload?.effort ?? result.reasoningEffort;
      }
    } catch {
      // Ignore malformed or unrelated lines.
    }
    if (result.provider && result.model && result.reasoningEffort) break;
  }
  result.verified = Boolean(result.provider && result.model && result.reasoningEffort && result.cliVersion);
  return result;
}

export async function attestWorker(threadId, startedAt) {
  if (!threadId) return { verified: false, reason: "worker did not report a thread id" };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const file = findRolloutFile(threadId, startedAt);
      if (file) return readRolloutAttestation(file);
    } catch {
      return { verified: false, reason: "child rollout could not be read" };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return { verified: false, reason: "child rollout was not found" };
}

function stopProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
}

export function runWorker({
  task,
  cwd,
  profile,
  timeoutSeconds,
  reasoningEffort = "profile",
  sandbox = "workspace-write",
  resultMaxChars = DEFAULT_RESULT_MAX_CHARS,
  signal,
  onStarted,
  onProgress,
}) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    if (signal?.aborted) {
      resolve({
        id: task.id,
        ok: false,
        requestedProfile: profile,
        startedAt: startedAt.toISOString(),
        endedAt: startedAt.toISOString(),
        durationMs: 0,
        error: "Worker cancelled before launch.",
        cancelled: true,
        failureCause: "cancelled",
        retries: 0,
        attestation: { verified: false, reason: "worker was cancelled" },
      });
      return;
    }
    const workerPrompt = [
      "You are an engineering worker delegated by a parent Codex task.",
      "Complete only the bounded task below. Preserve unrelated work, do not spawn subagents, and return a concise result with verification evidence.",
      "Never expose credentials. If the task requests an exact literal reply and forbids file changes, return only that literal without using tools.",
      "",
      `Task ID: ${task.id}`,
      task.prompt,
    ].join("\n");

    const launch = resolveCodexLaunch();
    const args = [
      ...launch.prefixArgs,
      "exec",
      "--profile",
      profile,
      "-C",
      cwd,
      "--skip-git-repo-check",
      "--json",
      "--sandbox",
      sandbox,
      "-c",
      "mcp_servers={}",
    ];
    if (reasoningEffort !== "profile") {
      args.push("-c", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
    }
    args.push(workerPrompt);

    const child = spawn(launch.command, args, {
      cwd,
      env: process.env,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    try { onStarted?.(child.pid ?? null); } catch { /* A status write must not abandon an untracked child. */ }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let oversized = false;
    let cancelled = false;
    let settled = false;
    let pendingLine = "";

    const noteProgress = (chunk) => {
      pendingLine += chunk.toString("utf8");
      if (pendingLine.length > 65536) pendingLine = pendingLine.slice(-65536);
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("{")) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "thread.started") {
            try { onProgress?.({ type: "thread.started", threadId: event.thread_id ?? null }); } catch { /* Keep the worker supervised. */ }
          }
          else if (["item.started", "item.completed", "turn.completed", "error"].includes(event.type)) {
            const itemType = ["agent_message", "command_execution", "error"].includes(event.item?.type) ? event.item.type : null;
            try { onProgress?.({ type: event.type, itemType }); } catch { /* Keep the worker supervised. */ }
          }
        } catch { /* Only structured event types are persisted, never raw output. */ }
      }
    };

    const append = (current, chunk) => {
      const next = current + chunk.toString("utf8");
      if (next.length <= MAX_CAPTURED_CHARS) return next;
      oversized = true;
      stopProcessTree(child);
      return next.slice(-MAX_CAPTURED_CHARS);
    };
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); noteProgress(chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });

    const timer = setTimeout(() => {
      timedOut = true;
      stopProcessTree(child);
    }, timeoutSeconds * 1000);
    const abort = () => {
      cancelled = true;
      stopProcessTree(child);
    };
    signal?.addEventListener("abort", abort, { once: true });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({
        id: task.id,
        ok: false,
        requestedProfile: profile,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        error: error.message,
        failureCause: "process_failure",
        retries: 0,
        attestation: { verified: false, reason: "worker process failed to start" },
      });
    });

    child.on("close", async (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      const endedAt = new Date();
      const parsed = parseCodexOutput(stdout);
      const attestation = await attestWorker(parsed.threadId, startedAt);
      const redactedResult = redactSecrets(parsed.finalText);
      const resultTruncated = typeof redactedResult === "string" && redactedResult.length > resultMaxChars;
      const result = resultTruncated ? redactedResult.slice(0, resultMaxChars) : redactedResult;
      const ok = exitCode === 0 && Boolean(parsed.finalText) && !parsed.reportedError && !timedOut && !oversized && !cancelled && attestation.verified;
      resolve({
        id: task.id,
        ok,
        requestedProfile: profile,
        threadId: parsed.threadId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        result,
        resultTruncated,
        cancelled,
        workerPid: child.pid ?? null,
        retries: 0,
        outputSizeChars: stdout.length + stderr.length,
        failureCause: cancelled ? "cancelled" : timedOut ? "worker_timeout" : oversized ? "output_limit" : parsed.reportedError ? "provider_failure" : exitCode !== 0 ? "process_failure" : !attestation.verified ? "attestation_failure" : !parsed.finalText ? "missing_result" : null,
        error: cancelled
          ? "Worker was cancelled by the caller."
          : timedOut
          ? `Worker timed out after ${timeoutSeconds} seconds.`
          : oversized
            ? "Worker output exceeded the capture limit."
            : redactSecrets(parsed.reportedError ?? (exitCode === 0 ? null : stderr.slice(-4000))),
        exitCode,
        attestation,
      });
    });
  });
}
