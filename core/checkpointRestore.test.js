const test = require("node:test");
const assert = require("node:assert/strict");

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");

function createTask(taskId) {
  const agent = agentManager.createAgent({ id: taskId + "-agent" });
  assert.equal(agent.success, true);

  const created = agentManager.createTask(agent.agent.id, "Recoverable checkpoint task", {
    id: taskId
  });
  assert.equal(created.success, true);

  const added = agentManager.addSteps(taskId, [
    { id: taskId + "-step-1", name: "Completed work", action: "calculate", description: "First safe calculation" },
    { id: taskId + "-step-2", name: "Interrupted work", action: "calculate", description: "Step interrupted during process" },
    { id: taskId + "-step-3", name: "Pending work", action: "calculate", description: "Work after interruption" }
  ]);
  assert.equal(added.success, true);
  return taskId;
}

test.beforeEach(() => {
  agentManager.reset();
  const reset = checkpointBridge.reset();
  assert.equal(reset.success, true);
});

test("restores completed steps and gates an interrupted in-flight step for approval", () => {
  const taskId = createTask("restore-inflight-task");
  assert.equal(agentManager.startTask(taskId).success, true);

  const first = agentManager.startStep(taskId, taskId + "-step-1");
  assert.equal(first.success, true);
  assert.equal(agentManager.completeStep(taskId, taskId + "-step-1", { value: 2 }).success, true);

  const second = agentManager.startStep(taskId, taskId + "-step-2");
  assert.equal(second.success, true);

  const saved = checkpointRecovery.saveBeforeExecution(taskId, { reason: "simulated process interruption" });
  assert.equal(saved.success, true);
  assert.equal(saved.checkpoint.recoveryEligible, true);

  // Simulate process restart: task memory is lost while the checkpoint remains.
  agentManager.reset();

  const restored = checkpointRecovery.restoreFromCheckpoint(taskId);
  assert.equal(restored.success, true);
  assert.equal(restored.restored, true);
  assert.equal(restored.executionStarted, false);
  assert.equal(restored.task.status, agentManager.TASK_STATES.WAITING_APPROVAL);

  const steps = restored.task.steps;
  assert.equal(steps.find(step => step.id === taskId + "-step-1").status, agentManager.STEP_STATES.COMPLETED);
  const interrupted = steps.find(step => step.id === taskId + "-step-2");
  assert.equal(interrupted.status, agentManager.STEP_STATES.WAITING_APPROVAL);
  assert.equal(interrupted.requiresApproval, true);
  assert.equal(interrupted.approved, false);
  assert.equal(steps.find(step => step.id === taskId + "-step-3").status, agentManager.STEP_STATES.PENDING);
});

test("refuses to restore a stopped task", () => {
  const taskId = createTask("restore-stopped-task");
  assert.equal(agentManager.stopTask(taskId, "test stop").success, true);

  const saved = checkpointRecovery.saveBeforeExecution(taskId, { reason: "stopped task must not resume" });
  assert.equal(saved.success, true);
  assert.equal(saved.checkpoint.recoveryEligible, false);

  agentManager.reset();
  const restored = checkpointRecovery.restoreFromCheckpoint(taskId);
  assert.equal(restored.success, false);
  assert.equal(restored.restored, false);
  assert.equal(restored.task, null);
});

test("refuses to overwrite an existing live task during restore", () => {
  const taskId = createTask("restore-no-overwrite-task");
  const saved = checkpointRecovery.saveBeforeExecution(taskId);
  assert.equal(saved.success, true);

  const restored = checkpointRecovery.restoreFromCheckpoint(taskId);
  assert.equal(restored.success, false);
  assert.match(restored.error, /already exists/i);
  assert.equal(agentManager.getTask(taskId).success, true);
});
