import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  enforceAttestation,
  rejectCredentialMaterial,
  resolveWorkspaceCwd,
  runTaskPool,
  runWorker,
  validateProfileName,
  validateTasks,
} from "./core.mjs";
import { cancelJob, collectResults, getJobStatus, listJobs, submitJobs } from "./jobs.mjs";

const server = new McpServer({
  name: "codex-provider-workers",
  version: "0.1.0",
});

const taskSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(30000),
  profile: z.string().min(1).max(64).optional(),
  reasoning_effort: z.enum(["profile", "low", "medium", "high", "xhigh", "max"]).optional(),
  expected_provider: z.string().min(1).max(128).optional(),
  expected_model: z.string().min(1).max(128).optional(),
  expected_reasoning_effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
});

function toolResult(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
}

server.registerTool(
  "run_parallel",
  {
    title: "Run DeepSeek or custom-provider workers in parallel",
    description:
      "Visibly delegate 1-8 independent engineering tasks to bounded Codex workers using configured provider profiles. Runs at most four concurrently, defaults to the deepseek profile, and returns runtime-attested provider, model, reasoning effort, child thread IDs, timing, and results. Never include credentials in prompts.",
    inputSchema: {
      tasks: z.array(taskSchema).min(1).max(8),
      cwd: z.string().min(1),
      profile: z.string().min(1).max(64).default("deepseek"),
      reasoning_effort: z.enum(["profile", "low", "medium", "high", "xhigh", "max"]).default("profile"),
      expected_provider: z.string().min(1).max(128).optional(),
      expected_model: z.string().min(1).max(128).optional(),
      expected_reasoning_effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
      timeout_seconds: z.number().int().min(30).max(1200).default(600),
      max_concurrency: z.number().int().min(1).max(4).default(4),
      sandbox: z.enum(["read-only", "workspace-write"]).default("workspace-write"),
      result_max_chars: z.number().int().min(1000).max(100000).default(40000),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({
    tasks,
    cwd,
    profile,
    reasoning_effort,
    expected_provider,
    expected_model,
    expected_reasoning_effort,
    timeout_seconds,
    max_concurrency,
    sandbox,
    result_max_chars,
  }, extra) => {
    validateProfileName(profile);
    validateTasks(tasks);
    rejectCredentialMaterial(tasks);
    rejectCredentialMaterial([{ id: "arguments", prompt: JSON.stringify({ profile, reasoning_effort, expected_provider, expected_model, expected_reasoning_effort }) }]);
    const workspaceRoot = resolveWorkspaceCwd(cwd);

    const batchStartedAt = new Date();
    const { results, peakConcurrency } = await runTaskPool(tasks, max_concurrency, async (task) => {
      const result = await runWorker({
        task,
        cwd: workspaceRoot,
        profile: task.profile ?? profile,
        timeoutSeconds: timeout_seconds,
        reasoningEffort: task.reasoning_effort ?? reasoning_effort,
        sandbox,
        resultMaxChars: result_max_chars,
        signal: extra.signal,
      });
      return enforceAttestation(result, {
        provider: task.expected_provider ?? expected_provider,
        model: task.expected_model ?? expected_model,
        reasoningEffort: task.expected_reasoning_effort ?? expected_reasoning_effort,
      });
    });
    const batchEndedAt = new Date();
    const providers = [...new Set(results.map((item) => item.attestation?.provider).filter(Boolean))];
    const models = [...new Set(results.map((item) => item.attestation?.model).filter(Boolean))];
    const successCount = results.filter((item) => item.ok).length;
    const totalWorkerDurationMs = results.reduce((sum, item) => sum + (item.durationMs ?? 0), 0);
    const durationMs = batchEndedAt.getTime() - batchStartedAt.getTime();
    const payload = {
      ok: results.every((item) => item.ok),
      execution: peakConcurrency > 1 ? "parallel" : "sequential",
      workerCount: results.length,
      successCount,
      failureCount: results.length - successCount,
      maxConcurrency: max_concurrency,
      peakConcurrency,
      workspaceRoot,
      requestedProfile: profile,
      verifiedProviders: providers,
      verifiedModels: models,
      batchStartedAt: batchStartedAt.toISOString(),
      batchEndedAt: batchEndedAt.toISOString(),
      durationMs,
      overlapMs: Math.max(0, totalWorkerDurationMs - durationMs),
      results,
    };
    const summary = [
      `Provider batch: ${successCount}/${results.length} workers succeeded; peak concurrency ${peakConcurrency}.`,
      `Verified provider(s): ${providers.join(", ") || "unverified"}.`,
      `Verified model(s): ${models.join(", ") || "unverified"}.`,
      `Workspace root: ${workspaceRoot}.`,
    ].join(" ");

    return {
      content: [{ type: "text", text: `${summary}\n${JSON.stringify(payload, null, 2)}` }],
      structuredContent: payload,
      isError: !payload.ok,
    };
  },
);

server.registerTool("submit_jobs", {
  title: "Submit persistent background provider jobs",
  description: "Start 1-8 bounded workers in a detached local supervisor and return immediately with a durable job_id. Use get_job_status, collect_results, and cancel_job afterward. Only DeepSeek has live verification in this project.",
  inputSchema: {
    tasks: z.array(taskSchema).min(1).max(8),
    cwd: z.string().min(1),
    profile: z.string().min(1).max(64).default("deepseek"),
    reasoning_effort: z.enum(["profile", "low", "medium", "high", "xhigh", "max"]).default("profile"),
    expected_provider: z.string().min(1).max(128).optional(),
    expected_model: z.string().min(1).max(128).optional(),
    expected_reasoning_effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
    timeout_policy: z.enum(["short", "feature", "extended"]).default("feature"),
    timeout_seconds: z.number().int().min(30).max(7200).optional(),
    max_concurrency: z.number().int().min(1).max(4).default(4),
    sandbox: z.enum(["read-only", "workspace-write"]).default("workspace-write"),
    result_max_chars: z.number().int().min(1000).max(100000).default(40000),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async (input) => toolResult(submitJobs(input)));

server.registerTool("get_job_status", {
  title: "Inspect a persistent provider job",
  description: "Read durable status, per-task progress, runtime attestation, and failure cause without waiting for completion.",
  inputSchema: { job_id: z.string().uuid() },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ job_id }) => toolResult(getJobStatus(job_id)));

server.registerTool("list_jobs", {
  title: "Find recent persistent provider jobs",
  description: "Recover recent job IDs after a parent task or MCP tool response is lost. Returns bounded metadata only, never prompts or results.",
  inputSchema: { limit: z.number().int().min(1).max(20).default(20) },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ limit }) => toolResult({ jobs: listJobs(limit) }));

server.registerTool("collect_results", {
  title: "Collect bounded results from a completed job",
  description: "Return persisted final results; safe to call repeatedly. Returns ready=false while the job is active.",
  inputSchema: { job_id: z.string().uuid() },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ job_id }) => toolResult(collectResults(job_id)));

server.registerTool("cancel_job", {
  title: "Cancel a persistent provider job",
  description: "Request cancellation of only this job's worker process trees while preserving progress and partial results.",
  inputSchema: { job_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, async ({ job_id }) => toolResult(await cancelJob(job_id)));

const transport = new StdioServerTransport();
await server.connect(transport);
