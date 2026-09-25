import fs from "node:fs";
import path from "node:path";
import { enforceAttestation, redactSecrets, runTaskPool, runWorker } from "./core.mjs";
import { jobDirectory, readJob, writeJob } from "./jobs.mjs";

const jobId = process.argv[2];
const dir = jobDirectory(jobId);
const launchPath = path.join(dir, "launch.json");
let launch;
try { launch = JSON.parse(fs.readFileSync(launchPath, "utf8")); }
finally { fs.rmSync(launchPath, { force: true }); }
const controller = new AbortController();
let job = readJob(jobId);
job.supervisorPid = process.pid;
job.status = "running";
job.startedAt = new Date().toISOString();
writeJob(job);

const cancelPath = path.join(dir, "cancel.request");
const poll = setInterval(() => {
  if (fs.existsSync(cancelPath)) controller.abort();
}, 100);
if (fs.existsSync(cancelPath)) controller.abort();

function updateTask(id, fields) {
  const task = job.tasks.find((item) => item.id === id);
  Object.assign(task, fields);
  writeJob(job);
}

try {
  const { results, peakConcurrency } = await runTaskPool(launch.tasks, launch.max_concurrency, async (task) => {
    let lastProgressFlush = 0;
    updateTask(task.id, { status: controller.signal.aborted ? "cancelled" : "running", startedAt: new Date().toISOString() });
    const result = await runWorker({
      task, cwd: launch.cwd, profile: task.profile ?? launch.profile,
      reasoningEffort: task.reasoning_effort ?? launch.reasoning_effort,
      timeoutSeconds: launch.timeout_seconds, sandbox: launch.sandbox,
      resultMaxChars: launch.result_max_chars, signal: controller.signal,
      onStarted: (workerPid) => updateTask(task.id, { workerPid }),
      onProgress: (progress) => {
        const entry = job.tasks.find((item) => item.id === task.id);
        if (progress.threadId) entry.threadId = progress.threadId;
        entry.progress.push({ at: new Date().toISOString(), type: progress.type, itemType: progress.itemType ?? null });
        entry.progress = entry.progress.slice(-20);
        if (progress.type === "thread.started" || Date.now() - lastProgressFlush >= 250) {
          writeJob(job);
          lastProgressFlush = Date.now();
        }
      },
    });
    const verified = enforceAttestation(result, {
      provider: task.expected_provider ?? launch.expected_provider,
      model: task.expected_model ?? launch.expected_model,
      reasoningEffort: task.expected_reasoning_effort ?? launch.expected_reasoning_effort,
    });
    const status = verified.cancelled ? "cancelled" : verified.failureCause === "worker_timeout" ? "timed_out" : verified.ok ? "succeeded" : "failed";
    updateTask(task.id, {
      status, endedAt: verified.endedAt, durationMs: verified.durationMs,
      threadId: verified.threadId ?? null, attestation: verified.attestation,
      failureCause: verified.failureCause ?? (verified.expectationsMet === false ? "attestation_mismatch" : null),
      error: verified.error, outputSizeChars: verified.outputSizeChars ?? 0,
      resultTruncated: verified.resultTruncated ?? false,
      partialWorkspaceChangePossible: launch.sandbox === "workspace-write" && status !== "succeeded",
    });
    return verified;
  });
  job.results = results;
  job.peakConcurrency = peakConcurrency;
  job.status = controller.signal.aborted ? "cancelled" : results.some((r) => r.failureCause === "worker_timeout") ? "timed_out" : results.every((r) => r.ok) ? "succeeded" : "failed";
  job.failureCause = job.status === "succeeded" ? null
    : job.status === "failed" ? (results.find((result) => !result.ok)?.failureCause ?? "attestation_mismatch")
    : job.status;
} catch (error) {
  job.status = "failed";
  job.failureCause = "supervisor_error";
  job.error = redactSecrets(error.message);
} finally {
  clearInterval(poll);
  job.endedAt = new Date().toISOString();
  writeJob(job);
}
