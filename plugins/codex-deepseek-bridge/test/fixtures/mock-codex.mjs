import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const prompt = process.argv.at(-1);
const threadId = randomUUID();
const date = new Date();
const sessionDir = path.join(process.env.CODEX_HOME, "sessions", String(date.getUTCFullYear()), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0"));
fs.mkdirSync(sessionDir, { recursive: true });
fs.writeFileSync(path.join(sessionDir, `rollout-${threadId}.jsonl`), [
  JSON.stringify({ type: "session_meta", payload: { model_provider: prompt.includes("WRONG_PROVIDER") ? "other" : "deepseek", base_instructions: { provenance: { model: prompt.includes("WRONG_MODEL") ? "other-model" : "deepseek-flash" } }, cli_version: "test-0.1" } }),
  JSON.stringify({ type: "turn_context", payload: { model: prompt.includes("WRONG_MODEL") ? "other-model" : "deepseek-flash", effort: prompt.includes("WRONG_EFFORT") ? "low" : "high" } }),
].join("\n"));
process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: threadId })}\n`);

if (prompt.includes("SPAWN_CHILD")) {
  const child = spawn(process.execPath, ["-e", "const fs=require('node:fs'); setInterval(() => fs.writeFileSync(process.argv[1], String(Date.now())), 25)", path.join(process.env.MOCK_CONTROL_DIR, "heartbeat")], { stdio: "ignore" });
  fs.writeFileSync(path.join(process.env.MOCK_CONTROL_DIR, "grandchild.pid"), String(child.pid));
}
if (prompt.includes("PARTIAL")) process.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "partial-work-done" } })}\n`);
if (prompt.includes("WAIT")) {
  while (!fs.existsSync(path.join(process.env.MOCK_CONTROL_DIR, "release"))) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
if (prompt.includes("FAIL")) {
  process.stdout.write(`${JSON.stringify({ type: "error", message: "mock provider failure" })}\n`);
  process.exit(2);
}
const result = prompt.includes("SECRET_OUTPUT") ? process.env.MOCK_SECRET_VALUE : prompt.includes("BIG_OUTPUT") ? "X".repeat(80000) : `MOCK_${prompt.match(/Task ID: ([^\n]+)/)?.[1] ?? "UNKNOWN"}_OK`;
process.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: result } })}\n`);
