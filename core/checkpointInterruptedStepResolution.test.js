"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");

function createRecoverableTask(taskId) {
  const agent = agentManager.createAgent({ id: taskId + "-agent" });
  assert.equal(agent.success, true);
  const created = agentManager.createTask(agent.agent.id, "Interrupted step resolution test", { id: taskId });
  assert.equal(created.success, true);
  const added = agentManager.addSteps(taskId, [
    { id: taskId + "-done", name: "Completed", action: "calculate" },
    { id: taskId + "-interrupted", name: "Interrupted", action: "calculate" },
    { id: taskId + "-pending", name: "Pending", action: "calculate" }
  ]);
  assert.equal(added.success, true);
  assert.equal(agentManager.startTask(taskId).success, true);
  assert.equal(agentManager.startStep(taskId, taskId + "-done").success, true);
  assert.equal(agentManager.completeStep(taskId, taskId + "-done", { value: 1 }).success, true);
  assert.equal(agentManager.startStep(taskId, taskId + "-interrupted").success, true);
  const saved = checkpointRecovery.saveBeforeExecution(taskId, { reason: "explicit interrupted-step resolution test" });
  assert.equal(saved.success, true);
  assert.equal(saved.checkpoint.recoveryEligible, true);
  agentManager.reset();
  const restored = checkpointRecovery.restoreFromCheckpoint(taskId);
  assert.equal(restored.success, true);
  return { taskId, interruptedId: taskId + "-interrupted", restored };
}

test.beforeEach(() => {
  agentManager.reset();
  assert.equal(checkpointBridge.reset().success, true);
});

test("generic task and step approval cannot bypass interrupted-step resolution", () => {
  const { taskId, interruptedId } = createRecoverableTask("resolution-approval-gate");
  const taskApproval = agentManager.approveTask(taskId);
  assert.equal(taskApproval.success, false);
  assert.equal(taskApproval.requiresRecoveryResolution, true);

  const stepApproval = agentManager.approveStep(taskId, interruptedId);
  assert.equal(stepApproval.success, false);
  assert.equal(stepApproval.requiresRecoveryResolution, true);

  const current = agentManager.getTask(taskId).task;
  assert.equal(current.status, agentManager.TASK_STATES.WAITING_APPROVAL);
  assert.equal(current.steps.find(step => step.id === interruptedId).recoveryInterrupted, true);
});

test("retry resolution requires explicit side-effect duplication confirmation and never executes immediately", () => {
  const { taskId, interruptedId } = createRecoverableTask("resolution-retry-gate");
  const blocked = checkpointRecovery.resolveInterruptedStep(taskId, interruptedId, "retry");
  assert.equal(blocked.success, false);
  assert.equal(blocked.requiresConfirmation, true);

  const resolved = checkpointRecovery.resolveInterruptedStep(taskId, interruptedId, "retry", {
    confirmSideEffectRetry: true
  });
  assert.equal(resolved.success, true);
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.executionStarted, false);
  assert.equal(resolved.task.status, agentManager.TASK_STATES.READY);
  const step = resolved.task.steps.find(item => item.id === interruptedId);
  assert.equal(step.status, agentManager.STEP_STATES.PENDING);
  assert.equal(step.recoveryInterrupted, false);
  assert.ok(resolved.task.warnings.some(value => /external side effects may be duplicated/i.test(value)));
});

test("owner-confirmed completion preserves completed result and leaves later work pending", () => {
  const { taskId, interruptedId } = createRecoverableTask("resolution-complete-gate");
  const resolved = checkpointRecovery.resolveInterruptedStep(taskId, interruptedId, "mark-completed", {
    result: { verifiedByOwner: true }
  });
  assert.equal(resolved.success, true);
  assert.equal(resolved.executionStarted, false);
  assert.equal(resolved.task.status, agentManager.TASK_STATES.READY);
  const step = resolved.task.steps.find(item => item.id === interruptedId);
  assert.equal(step.status, agentManager.STEP_STATES.COMPLETED);
  assert.deepEqual(step.result, { verifiedByOwner: true });
  assert.equal(resolved.task.steps.find(item => item.id === taskId + "-pending").status, agentManager.STEP_STATES.PENDING);
});

test("stopped tasks cannot resolve an interrupted checkpoint step", () => {
  const { taskId, interruptedId } = createRecoverableTask("resolution-stop-gate");
  assert.equal(agentManager.stopTask(taskId, "owner requested stop").success, true);
  const resolved = checkpointRecovery.resolveInterruptedStep(taskId, interruptedId, "mark-completed");
  assert.equal(resolved.success, false);
  assert.equal(agentManager.getTask(taskId).task.status, agentManager.TASK_STATES.STOPPED);
});
