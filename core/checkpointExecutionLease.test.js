"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-execution-lease-"));
process.env.AARHEN_RECOVERY_LEASE_DIR = directory;

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");
const autonomousGuard = require("./autonomousGuard");
const autonomousWorker = require("./autonomousWorker");
const { createRecoveryLeaseStore } = require("./recoveryLeaseStore");
const leaseStore = createRecoveryLeaseStore({ directory });

function createTask(id) {
  const agent = agentManager.createAgent({ id: id + "-agent" });
  assert.equal(agent.success, true);
  const created = agentManager.createTask(agent.agent.id, "Persistent execution lease test", { id });
  assert.equal(created.success, true);
  const step = agentManager.addStep(id, {
    id: id + "-step",
    name: "Deterministic calculation",
    action: "calculate",
    input: { expression: "1 + 1" }
  });
  assert.equal(step.success, true);
  return id;
}

test.beforeEach(() => {
  agentManager.reset();
  autonomousGuard.reset();
  assert.equal(checkpointBridge.reset().success, true);
});

test.after(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

test("controller fails closed when another process already holds the task execution lease", async () => {
  const taskId = createTask("external-lease-holder");
  const claim = leaseStore.claim(taskId, { source: "simulated-other-process", purpose: "task-execution" });
  assert.equal(claim.success, true);

  const result = await checkpointRecovery.executeAssignedTask("lease-test-worker", taskId);

  assert.equal(result.success, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.stage, "execution-lease");
  assert.match(result.error, /already claimed|already claimed for this task/i);
  assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 0);
  assert.equal(agentManager.getTask(taskId).task.status, agentManager.TASK_STATES.CREATED);
  assert.equal(leaseStore.release(taskId, claim.token).released, true);
});

test("controller holds the persistent execution lease while the worker runs and releases it afterwards", async () => {
  const taskId = createTask("lease-lifecycle");
  const originalExecute = autonomousWorker.executeAssignedTask;
  let leaseObservedDuringExecution = false;

  autonomousWorker.executeAssignedTask = async () => {
    const observed = leaseStore.inspect(taskId);
    leaseObservedDuringExecution = observed.locked === true;
    return {
      success: true,
      stage: "worker-execution",
      status: "completed",
      task: agentManager.getTask(taskId).task,
      execution: { success: true }
    };
  };

  try {
    const result = await checkpointRecovery.executeAssignedTask("lease-lifecycle-worker", taskId);
    assert.equal(result.success, true);
    assert.equal(leaseObservedDuringExecution, true);
    assert.equal(leaseStore.inspect(taskId).locked, false);
    assert.equal(checkpointBridge.getStatus().checkpointEngine.checkpointCount, 2);
  } finally {
    autonomousWorker.executeAssignedTask = originalExecute;
  }
});

test("controller releases its persistent execution lease when the pre-execution checkpoint fails", async () => {
  const taskId = createTask("checkpoint-failure-releases-lease");
  const originalSaveBeforeExecution = checkpointBridge.saveBeforeExecution;
  let workerCalled = false;
  const originalExecute = autonomousWorker.executeAssignedTask;

  checkpointBridge.saveBeforeExecution = () => ({
    success: false,
    checkpoint: null,
    error: "Simulated transient checkpoint storage failure."
  });
  autonomousWorker.executeAssignedTask = async () => {
    workerCalled = true;
    return { success: true, stage: "worker-execution", status: "completed" };
  };

  try {
    const result = await checkpointRecovery.executeAssignedTask("checkpoint-failure-worker", taskId);

    assert.equal(result.success, false);
    assert.equal(result.stage, "checkpoint-before");
    assert.equal(result.executionStarted, false);
    assert.match(result.error, /checkpoint storage failure/i);
    assert.equal(workerCalled, false, "worker must not start without a durable pre-execution checkpoint");
    assert.equal(leaseStore.inspect(taskId).locked, false, "failed preflight must release its persistent lease");
    assert.equal(agentManager.getTask(taskId).task.status, agentManager.TASK_STATES.CREATED);
  } finally {
    checkpointBridge.saveBeforeExecution = originalSaveBeforeExecution;
    autonomousWorker.executeAssignedTask = originalExecute;
  }
});
