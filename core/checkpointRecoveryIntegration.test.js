const test = require("node:test");
const assert = require("node:assert/strict");

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");

function createTask() {
  const agent = agentManager.createAgent({ id: "checkpoint-integration-agent" });
  assert.equal(agent.success, true);

  const created = agentManager.createTask(
    agent.agent.id,
    "Checkpoint recovery integration test",
    { id: "checkpoint-integration-task" }
  );
  assert.equal(created.success, true);

  const step = agentManager.addStep(created.task.id, {
    id: "checkpoint-integration-step",
    name: "Controlled calculation",
    description: "A deterministic step for checkpoint testing",
    action: "calculate",
    input: { request: "calculate 1 + 1" }
  });
  assert.equal(step.success, true);

  return created.task.id;
}

test.beforeEach(() => {
  agentManager.reset();
  const reset = checkpointBridge.reset();
  assert.equal(reset.success, true);
});

test("checkpoint recovery controller captures before/after execution metadata", () => {
  const taskId = createTask();

  const before = checkpointRecovery.saveBeforeExecution(taskId);
  assert.equal(before.success, true);
  assert.equal(before.checkpoint.taskId, taskId);

  const after = checkpointRecovery.saveAfterExecution(taskId, {
    success: true,
    stage: "worker-execution",
    status: "completed"
  });
  assert.equal(after.success, true);
  assert.equal(after.checkpoint.taskId, taskId);

  const latest = checkpointRecovery.getLatestCheckpoint(taskId);
  assert.equal(latest.success, true);
  assert.equal(latest.checkpoint.id, after.checkpoint.id);
  assert.equal(latest.checkpoint.metadata.execution.success, true);
  assert.equal(latest.checkpoint.metadata.execution.status, "completed");
});

test("recovery controller reports inspection-only recovery and no automatic restore", () => {
  const status = checkpointRecovery.getStatus();

  assert.equal(status.success, true);
  assert.equal(status.capabilities.recoveryPlanInspectionOnly, true);
  assert.equal(status.capabilities.controlledCheckpointRestore, true);
  assert.equal(status.capabilities.automaticCheckpointRestore, false);
  assert.equal(status.capabilities.automaticTaskResume, false);
  assert.equal(status.capabilities.controlledExecutionRequired, true);
});

test("missing task IDs fail closed without creating checkpoints", () => {
  const result = checkpointRecovery.saveBeforeExecution("missing-checkpoint-task");

  assert.equal(result.success, false);
  assert.equal(result.checkpoint, null);
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);
});
