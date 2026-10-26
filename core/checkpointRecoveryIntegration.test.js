const test = require("node:test");
const assert = require("node:assert/strict");

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");
const autonomousGuard = require("./autonomousGuard");
const autonomousWorker = require("./autonomousWorker");

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
  autonomousGuard.reset();
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

test("approveAndExecute refuses to approve a task that has no unresolved approval gate", async () => {
  const taskId = createTask();
  const before = agentManager.getTask(taskId);
  assert.equal(before.success, true);
  assert.equal(before.task.status, agentManager.TASK_STATES.CREATED);
  assert.equal(before.task.approved, false);

  const result = await checkpointRecovery.approveAndExecute(taskId);

  assert.equal(result.success, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "approval");
  assert.match(result.error, /not waiting for an unresolved approval gate/i);

  const after = agentManager.getTask(taskId);
  assert.equal(after.task.status, agentManager.TASK_STATES.CREATED);
  assert.equal(after.task.approved, false);
  assert.equal(after.task.steps[0].approved, true); // Non-protected steps are normalized as approved.
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);
});

test("approveAndExecute only executes a protected task through its explicit approval path", async () => {
  const agent = agentManager.createAgent({ id: "checkpoint-approval-gate-agent" });
  assert.equal(agent.success, true);
  const created = agentManager.createTask(
    agent.agent.id,
    "Protected action must wait for approval",
    { id: "checkpoint-approval-gate-task" }
  );
  assert.equal(created.success, true);

  const step = agentManager.addStep(created.task.id, {
    id: "checkpoint-approval-gate-step",
    name: "Send protected message",
    description: "Send a message only after explicit approval",
    action: "send_message",
    requiresApproval: true,
    approved: false,
    input: { request: "Send a message" }
  });
  assert.equal(step.success, true);

  const result = await checkpointRecovery.approveAndExecute(created.task.id);
  assert.equal(result.success, true);
  assert.equal(result.task.status, agentManager.TASK_STATES.COMPLETED);
  assert.equal(result.task.steps[0].approved, true);
});


test("concurrent controller calls cannot execute the same task twice", async () => {
  const taskId = createTask();
  const originalExecute = autonomousWorker.executeAssignedTask;
  let signalStarted;
  let releaseExecution;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const gate = new Promise(resolve => { releaseExecution = resolve; });

  autonomousWorker.executeAssignedTask = async () => {
    signalStarted();
    await gate;
    return {
      success: true,
      stage: "worker-execution",
      status: "completed",
      task: agentManager.getTask(taskId).task,
      execution: { success: true }
    };
  };

  try {
    const firstExecution = checkpointRecovery.executeAssignedTask("single-flight-worker", taskId);
    await started;

    const duplicate = await checkpointRecovery.executeAssignedTask("single-flight-worker", taskId);
    assert.equal(duplicate.success, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.executionStarted, false);
    assert.equal(duplicate.stage, "duplicate-execution");
    assert.match(duplicate.error, /already active/i);
    assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 1,
      "duplicate call must not write its own checkpoint");

    releaseExecution();
    const first = await firstExecution;
    assert.equal(first.success, true);
    assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 2,
      "only the first execution should save before/after checkpoints");
  } finally {
    releaseExecution();
    autonomousWorker.executeAssignedTask = originalExecute;
  }
});

test("terminal completed tasks are rejected before checkpoint writes or re-execution", async () => {
  const taskId = createTask();
  const completed = await agentManager.runTask(taskId, async () => ({
    success: true,
    output: "completed once"
  }));
  assert.equal(completed.success, true);
  assert.equal(completed.task.status, agentManager.TASK_STATES.COMPLETED);
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);

  const result = await checkpointRecovery.executeAssignedTask("terminal-test-worker", taskId);

  assert.equal(result.success, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "terminal-task-guard");
  assert.match(result.error, /terminal task state cannot be executed again/i);
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);
  const after = agentManager.getTask(taskId);
  assert.equal(after.task.status, agentManager.TASK_STATES.COMPLETED);
});

test("global STOP blocks new autonomous requests before task creation or checkpoint writes", async () => {
  assert.equal(autonomousGuard.activateStop("controller STOP test").success, true);

  const result = await checkpointRecovery.executeRequest("Calculate 1 + 1");

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "emergency-stop");
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);
});

test("global STOP blocks assigned task execution before checkpoint writes", async () => {
  const taskId = createTask();
  assert.equal(autonomousGuard.activateStop("controller STOP test").success, true);

  const result = await checkpointRecovery.executeAssignedTask("stop-test-worker", taskId);

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "emergency-stop");
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);
  assert.equal(agentManager.getTask(taskId).task.status, agentManager.TASK_STATES.CREATED);
});

test("global STOP blocks explicit approval execution without approving the protected step", async () => {
  const agent = agentManager.createAgent({ id: "controller-stop-approval-agent" });
  assert.equal(agent.success, true);
  const created = agentManager.createTask(agent.agent.id, "Wait for explicit approval", {
    id: "controller-stop-approval-task"
  });
  assert.equal(created.success, true);
  const step = agentManager.addStep(created.task.id, {
    id: "controller-stop-approval-step",
    name: "Protected message",
    action: "send_message",
    requiresApproval: true,
    approved: false,
    input: { request: "Do not send without approval" }
  });
  assert.equal(step.success, true);
  const waiting = agentManager.startTask(created.task.id);
  assert.equal(waiting.success, false);
  assert.equal(waiting.requiresApproval, true);
  assert.equal(agentManager.getTask(created.task.id).task.status, agentManager.TASK_STATES.WAITING_APPROVAL);

  assert.equal(autonomousGuard.activateStop("controller STOP test").success, true);
  const result = await checkpointRecovery.approveAndExecute(created.task.id);

  assert.equal(result.success, false);
  assert.equal(result.stopped, true);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "emergency-stop");
  const finalTask = agentManager.getTask(created.task.id).task;
  assert.equal(finalTask.status, agentManager.TASK_STATES.WAITING_APPROVAL);
  assert.equal(finalTask.steps[0].approved, false);
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);
});
