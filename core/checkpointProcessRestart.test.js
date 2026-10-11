"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("checkpoint restore survives a real Node process restart with disk persistence enabled", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-checkpoint-restart-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const taskId = "restart-recovery-task";
  const env = { ...process.env, AARHEN_CHECKPOINT_STORE_DIR: directory };

  const saveScript = `
    const assert = require("node:assert/strict");
    const manager = require("./core/agentManager");
    const recovery = require("./core/checkpointRecoveryController");
    const taskId = ${JSON.stringify(taskId)};
    const agent = manager.createAgent({ id: "restart-recovery-agent" });
    assert.equal(agent.success, true, JSON.stringify(agent));
    const task = manager.createTask(agent.agent.id, "Process restart recovery test", { id: taskId });
    assert.equal(task.success, true, JSON.stringify(task));
    const added = manager.addSteps(taskId, [
      { id: "step-completed", name: "Completed", action: "calculate" },
      { id: "step-interrupted", name: "Interrupted", action: "calculate" },
      { id: "step-pending", name: "Pending", action: "calculate" }
    ]);
    assert.equal(added.success, true, JSON.stringify(added));
    assert.equal(manager.startTask(taskId).success, true);
    assert.equal(manager.startStep(taskId, "step-completed").success, true);
    assert.equal(manager.completeStep(taskId, "step-completed", { value: 42 }).success, true);
    assert.equal(manager.startStep(taskId, "step-interrupted").success, true);
    const saved = recovery.saveBeforeExecution(taskId, { reason: "subprocess restart regression test" });
    assert.equal(saved.success, true, JSON.stringify(saved));
    assert.equal(saved.checkpoint.recoveryEligible, true, JSON.stringify(saved.checkpoint));
    process.stdout.write(JSON.stringify({ checkpointId: saved.checkpoint.id }));
  `;

  const saved = spawnSync(process.execPath, ["-e", saveScript], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    timeout: 10000
  });
  assert.equal(saved.status, 0, saved.stderr || saved.stdout || "Checkpoint writer subprocess failed.");

  const restoreScript = `
    const assert = require("node:assert/strict");
    const manager = require("./core/agentManager");
    const recovery = require("./core/checkpointRecoveryController");
    const restored = recovery.restoreFromCheckpoint(${JSON.stringify(taskId)});
    assert.equal(restored.success, true, JSON.stringify(restored));
    assert.equal(restored.restored, true);
    assert.equal(restored.executionStarted, false);
    assert.equal(restored.task.status, manager.TASK_STATES.WAITING_APPROVAL);
    const steps = restored.task.steps;
    assert.equal(steps.find(step => step.id === "step-completed").status, manager.STEP_STATES.COMPLETED);
    const interrupted = steps.find(step => step.id === "step-interrupted");
    assert.equal(interrupted.status, manager.STEP_STATES.WAITING_APPROVAL);
    assert.equal(interrupted.requiresApproval, true);
    assert.equal(interrupted.approved, false);
    assert.equal(steps.find(step => step.id === "step-pending").status, manager.STEP_STATES.PENDING);
    process.stdout.write(JSON.stringify({
      success: true,
      status: restored.task.status,
      executionStarted: restored.executionStarted,
      stepStatuses: steps.map(step => ({ id: step.id, status: step.status }))
    }));
  `;

  const restored = spawnSync(process.execPath, ["-e", restoreScript], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    timeout: 10000
  });
  assert.equal(restored.status, 0, restored.stderr || restored.stdout || "Checkpoint restore subprocess failed.");
  const result = JSON.parse(restored.stdout);
  assert.equal(result.success, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.status, "waiting_approval");
});
