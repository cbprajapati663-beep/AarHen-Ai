"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-engine-persist-"));
const env = { ...process.env, AARHEN_CHECKPOINT_STORE_DIR: directory };
const node = process.execPath;
try {
  execFileSync(node, ["-e", `
    const engine = require("./core/checkpointEngine");
    const result = engine.saveCheckpoint({
      id: "task-restart-check",
      agentId: "agent-1",
      status: "running",
      steps: [{ id: "step-1", index: 0, status: "pending" }],
      currentStepIndex: 0
    });
    if (!result.success) throw new Error(result.error);
    if (engine.getStatus().persistentStorage !== true) throw new Error("Persistence not enabled");
  `], { cwd: process.cwd(), env, stdio: "pipe" });

  const output = execFileSync(node, ["-e", `
    const engine = require("./core/checkpointEngine");
    const result = engine.getLatestCheckpoint("task-restart-check");
    if (!result.success) throw new Error(result.error);
    if (result.checkpoint.taskId !== "task-restart-check") throw new Error("Wrong task checkpoint");
    if (engine.getStatus().checkpointCount !== 1) throw new Error("Checkpoint index was not restored");
    const plan = engine.buildRecoveryPlan("task-restart-check");
    if (!plan.success || plan.recoverable !== true) throw new Error("Persisted checkpoint was not recognized as recoverable");
    if (plan.plan.action !== "resume-from-checkpoint") throw new Error("Unexpected recovery plan action");
    if (plan.plan.executable !== false || plan.plan.executionMode !== "inspection-only") {
      throw new Error("Recovery plan must remain inspection-only");
    }
    console.log("Checkpoint engine restart persistence and safe recovery-plan test passed.");
  `], { cwd: process.cwd(), env, encoding: "utf8" });
  assert.match(output, /passed/);
  console.log(output.trim());
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
