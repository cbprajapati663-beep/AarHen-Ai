"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const manager = require("./agentManager");
const runner = require("./agentRunner");
const workerApi = require("./agentWorker");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");

function createRestoredTask(taskId) {
  const agentId = taskId + "-agent";
  const agent = manager.createAgent({ id: agentId, name: "Checkpoint Resume Agent" });
  assert.equal(agent.success, true);

  const created = manager.createTask(agentId, "Resume task after checkpoint recovery", {
    id: taskId,
    autonomy: true
  });
  assert.equal(created.success, true);

  const first = manager.addStep(taskId, {
    id: taskId + "-completed",
    name: "Previously completed step",
    action: "calculate"
  });
  const interrupted = manager.addStep(taskId, {
    id: taskId + "-interrupted",
    name: "Interrupted step",
    action: "calculate"
  });
  const pending = manager.addStep(taskId, {
    id: taskId + "-pending",
    name: "Pending step",
    action: "calculate"
  });
  assert.equal(first.success, true);
  assert.equal(interrupted.success, true);
  assert.equal(pending.success, true);

  assert.equal(manager.startTask(taskId).success, true);
  assert.equal(manager.startStep(taskId, first.step.id).success, true);
  assert.equal(manager.completeStep(taskId, first.step.id, { output: "already completed" }).success, true);
  assert.equal(manager.startStep(taskId, interrupted.step.id).success, true);

  const saved = checkpointRecovery.saveBeforeExecution(taskId, {
    reason: "controlled resume integration test"
  });
  assert.equal(saved.success, true);
  assert.equal(saved.checkpoint.recoveryEligible, true);

  manager.reset();
  const restored = checkpointRecovery.restoreFromCheckpoint(taskId);
  assert.equal(restored.success, true);
  assert.equal(restored.executionStarted, false);

  return {
    taskId,
    agentId,
    firstId: first.step.id,
    interruptedId: interrupted.step.id,
    pendingId: pending.step.id,
    restored
  };
}

async function runRestoredTask(taskId, agentId, controlledRunner) {
  const worker = workerApi.createWorker({
    id: taskId + "-worker",
    agentId
  });
  assert.equal(worker.success, true);

  const assigned = workerApi.assignTask(worker.worker.id, taskId);
  assert.equal(assigned.success, true);

  return workerApi.runAssignedTask(worker.worker.id, {
    runner: controlledRunner
  });
}

test.beforeEach(() => {
  workerApi.reset();
  runner.reset();
  manager.reset();
  assert.equal(checkpointBridge.reset().success, true);
});

test("owner-confirmed completion resumes through Worker/Runner and skips completed and resolved steps", async () => {
  const fixture = createRestoredTask("checkpoint-resume-completed");
  const resolution = checkpointRecovery.resolveInterruptedStep(
    fixture.taskId,
    fixture.interruptedId,
    "mark-completed",
    { result: { verifiedByOwner: true } }
  );
  assert.equal(resolution.success, true);
  assert.equal(resolution.executionStarted, false);

  const executed = [];
  const result = await runRestoredTask(
    fixture.taskId,
    fixture.agentId,
    async ({ task, step }) => {
      assert.equal(task.id, fixture.taskId);
      executed.push(step.id);
      return { success: true, output: "executed:" + step.id };
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.task.status, manager.TASK_STATES.COMPLETED);
  assert.deepEqual(executed, [fixture.pendingId]);
  const finalTask = manager.getTask(fixture.taskId).task;
  assert.equal(finalTask.steps.find(step => step.id === fixture.firstId).status, manager.STEP_STATES.COMPLETED);
  assert.equal(finalTask.steps.find(step => step.id === fixture.interruptedId).status, manager.STEP_STATES.COMPLETED);
  assert.equal(finalTask.steps.find(step => step.id === fixture.pendingId).status, manager.STEP_STATES.COMPLETED);
});

test("explicitly confirmed retry resumes interrupted step then pending work exactly once", async () => {
  const fixture = createRestoredTask("checkpoint-resume-retry");
  const blocked = checkpointRecovery.resolveInterruptedStep(
    fixture.taskId,
    fixture.interruptedId,
    "retry"
  );
  assert.equal(blocked.success, false);
  assert.equal(blocked.requiresConfirmation, true);

  const resolution = checkpointRecovery.resolveInterruptedStep(
    fixture.taskId,
    fixture.interruptedId,
    "retry",
    { confirmSideEffectRetry: true }
  );
  assert.equal(resolution.success, true);
  assert.equal(resolution.executionStarted, false);

  const counts = new Map();
  const result = await runRestoredTask(
    fixture.taskId,
    fixture.agentId,
    async ({ step }) => {
      counts.set(step.id, (counts.get(step.id) || 0) + 1);
      return { success: true, output: "executed:" + step.id };
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.task.status, manager.TASK_STATES.COMPLETED);
  assert.equal(counts.get(fixture.firstId) || 0, 0, "previously completed work must not repeat");
  assert.equal(counts.get(fixture.interruptedId), 1, "confirmed retry must run once");
  assert.equal(counts.get(fixture.pendingId), 1, "later pending work must run once");
});

test("stopped restored task cannot be resumed through a worker", async () => {
  const fixture = createRestoredTask("checkpoint-resume-stop");
  assert.equal(manager.stopTask(fixture.taskId, "owner requested STOP").success, true);

  const worker = workerApi.createWorker({
    id: fixture.taskId + "-worker",
    agentId: fixture.agentId
  });
  assert.equal(worker.success, true);

  const assigned = workerApi.assignTask(worker.worker.id, fixture.taskId);
  assert.equal(assigned.success, false);
  assert.equal(manager.getTask(fixture.taskId).task.status, manager.TASK_STATES.STOPPED);
});
