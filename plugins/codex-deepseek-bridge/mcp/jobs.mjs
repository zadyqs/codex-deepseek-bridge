import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { rejectCredentialMaterial, resolveWorkspaceCwd, validateProfileName, validateTasks } from "./core.mjs";

export const JOB_SCHEMA_VERSION = 1;
export const JOB_TIMEOUTS = { short: 600, feature: 3600, extended: 7200 };
export const MAX_JOB_RESULT_CHARS = 100000;
export const MAX_BACKGROUND_WORKERS = 4;
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL = new Set(["succeeded", "failed", "cancelled", "timed_out"]);

export function jobsRoot() {
  return path.resolve(process.env.CODEX_BRIDGE_JOBS_DIR || path.join(os.homedir(), ".codex-worker-bridge", "jobs"));
}

function ensureJobsRoot() {
  const root = jobsRoot();
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error("jobs directory cannot be a symlink");
  return root;
}

export function jobDirectory(jobId) {
  if (typeof jobId !== "string" || !JOB_ID.test(jobId)) throw new Error("invalid job_id");
  return path.join(jobsRoot(), jobId);
}

export function readJob(jobId) {
  const dir = jobDirectory(jobId);
  if (!fs.existsSync(dir) || fs.lstatSync(dir).isSymbolicLink()) throw new Error("job not found");
  const file = path.join(dir, "job.json");
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error("job metadata cannot be a symlink");
  if (fs.statSync(file).size > 2_000_000) throw new Error("job metadata exceeds size limit");
  const job = JSON.parse(fs.readFileSync(file, "utf8"));
  if (job.schemaVersion !== JOB_SCHEMA_VERSION || job.jobId !== jobId) throw new Error("invalid job metadata");
  return job;
}

export function writeJob(job) {
  const dir = jobDirectory(job.jobId);
  const temp = path.join(dir, `job-${randomUUID()}.tmp`);
  fs.writeFileSync(temp, JSON.stringify(job), { mode: 0o600, flag: "wx" });
  fs.renameSync(temp, path.join(dir, "job.json"));
}

export function isTerminal(status) { return TERMINAL.has(status); }

function processExists(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function getJobStatus(jobId) {
  const job = readJob(jobId);
  const pidFile = path.join(jobDirectory(jobId), "supervisor.pid");
  const supervisorPid = job.supervisorPid ?? (fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, "utf8")) : null);
  if (!isTerminal(job.status) && supervisorPid && !processExists(supervisorPid)) {
    job.status = "failed";
    job.failureCause = "supervisor_lost";
    job.error = "Background supervisor exited before recording a final result; inspect the workspace for partial changes.";
    job.endedAt = new Date().toISOString();
    writeJob(job);
  }
  const { results, ...summary } = job;
  return {
    ...summary,
    elapsedMs: Date.now() - Date.parse(job.startedAt ?? job.createdAt),
    cancellationRequested: fs.existsSync(path.join(jobDirectory(jobId), "cancel.request")),
  };
}

export function listJobs(limit = 20) {
  const root = ensureJobsRoot();
  const jobs = [];
  for (const name of fs.readdirSync(root)) {
    if (!JOB_ID.test(name)) continue;
    try {
      const job = getJobStatus(name);
      jobs.push({ jobId: job.jobId, status: job.status, createdAt: job.createdAt, workspace: job.workspace, taskIds: job.tasks.map((task) => task.id) });
    } catch { /* An unreadable record is not listed as a valid job. */ }
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, Math.min(20, Math.max(1, limit)));
}

export function submitJobs(input) {
  validateTasks(input.tasks);
  validateProfileName(input.profile);
  rejectCredentialMaterial(input.tasks);
  rejectCredentialMaterial([{ id: "arguments", prompt: JSON.stringify(input) }]);
  const workspace = resolveWorkspaceCwd(input.cwd);
  const policy = input.timeout_policy ?? "feature";
  if (!(policy in JOB_TIMEOUTS)) throw new Error("invalid timeout_policy");
  const timeoutSeconds = input.timeout_seconds ?? JOB_TIMEOUTS[policy];
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > JOB_TIMEOUTS[policy]) throw new Error(`timeout_seconds must be 30..${JOB_TIMEOUTS[policy]} for ${policy}`);
  if (policy === "extended" && input.timeout_seconds === undefined) throw new Error("extended jobs require explicit timeout_seconds");
  if (!Number.isInteger(input.max_concurrency) || input.max_concurrency < 1 || input.max_concurrency > 4) throw new Error("max_concurrency must be 1..4");
  if (!["read-only", "workspace-write"].includes(input.sandbox)) throw new Error("invalid sandbox");
  const root = ensureJobsRoot();
  const lockPath = path.join(root, "submit.lock");
  if (fs.existsSync(lockPath)) {
    try {
      const owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (Date.now() - owner.createdAt > 30000 && !processExists(owner.pid)) fs.rmSync(lockPath);
    } catch { /* An in-progress submission retains the lock. */ }
  }
  let lock;
  try { lock = fs.openSync(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new Error("another job submission is in progress; retry shortly"); throw error; }
  try {
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
  let reservedWorkers = 0;
  for (const name of fs.readdirSync(root)) {
    if (!JOB_ID.test(name)) continue;
    try {
      const existing = getJobStatus(name);
      if (!isTerminal(existing.status)) reservedWorkers += existing.maxConcurrency;
    } catch { /* Invalid records are not execution slots. */ }
  }
  if (reservedWorkers + input.max_concurrency > MAX_BACKGROUND_WORKERS) {
    throw new Error(`background capacity exceeded: ${reservedWorkers}/${MAX_BACKGROUND_WORKERS} worker slots reserved`);
  }
  const jobId = randomUUID();
  const dir = path.join(root, jobId);
  fs.mkdirSync(dir, { mode: 0o700 });
  const createdAt = new Date().toISOString();
  const job = {
    schemaVersion: JOB_SCHEMA_VERSION, jobId, status: "queued", createdAt,
    startedAt: null, endedAt: null, workspace, requestedProfile: input.profile,
    requestedReasoningEffort: input.reasoning_effort, sandbox: input.sandbox,
    timeoutPolicy: policy, timeoutSeconds, maxConcurrency: input.max_concurrency,
    resultMaxChars: input.result_max_chars, supervisorPid: null,
    failureCause: null, error: null, peakConcurrency: 0,
    tasks: input.tasks.map((task) => ({
      id: task.id, status: "queued", requestedProfile: task.profile ?? input.profile,
      requestedReasoningEffort: task.reasoning_effort ?? input.reasoning_effort,
      workerPid: null, threadId: null, startedAt: null, endedAt: null,
      attestation: null, failureCause: null, retries: 0, outputSizeChars: 0, progress: [],
    })),
    results: null,
  };
  writeJob(job);
  // Prompts are transient and private. The supervisor removes this launch file as soon as it starts.
  const launch = path.join(dir, "launch.json");
  fs.writeFileSync(launch, JSON.stringify({ ...input, cwd: workspace, timeout_seconds: timeoutSeconds }), { mode: 0o600, flag: "wx" });
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const compiledRunner = path.join(moduleDir, "runner", "index.mjs");
  const runner = fs.existsSync(compiledRunner) ? compiledRunner : path.join(moduleDir, "job-runner.mjs");
  try {
    const child = spawn(process.execPath, [runner, jobId], {
      cwd: workspace, env: process.env, detached: true, windowsHide: true,
      stdio: "ignore",
    });
    if (!child.pid) throw new Error("background supervisor did not start");
    fs.writeFileSync(path.join(dir, "supervisor.pid"), String(child.pid), { mode: 0o600, flag: "wx" });
    child.unref();
  } catch (error) {
    fs.rmSync(launch, { force: true });
    job.status = "failed";
    job.endedAt = new Date().toISOString();
    job.failureCause = "supervisor_start_failure";
    job.error = error.message;
    writeJob(job);
    throw error;
  }
  return getJobStatus(jobId);
  } finally {
    fs.closeSync(lock);
    fs.rmSync(lockPath, { force: true });
  }
}

export function collectResults(jobId) {
  const job = readJob(jobId);
  if (!isTerminal(job.status)) return { jobId, status: job.status, ready: false };
  let remaining = MAX_JOB_RESULT_CHARS;
  const results = (job.results ?? []).map((result) => {
    const output = typeof result.result === "string" ? result.result : null;
    const bounded = output?.slice(0, remaining) ?? null;
    remaining -= bounded?.length ?? 0;
    return { ...result, result: bounded, resultTruncated: result.resultTruncated || (output?.length ?? 0) > (bounded?.length ?? 0) };
  });
  return { jobId, status: job.status, ready: true, failureCause: job.failureCause, results };
}

export async function cancelJob(jobId) {
  const job = readJob(jobId);
  if (isTerminal(job.status)) return getJobStatus(jobId);
  const request = path.join(jobDirectory(jobId), "cancel.request");
  try { fs.writeFileSync(request, new Date().toISOString(), { mode: 0o600, flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const status = getJobStatus(jobId);
    if (isTerminal(status.status)) return status;
  }
  return getJobStatus(jobId);
}
