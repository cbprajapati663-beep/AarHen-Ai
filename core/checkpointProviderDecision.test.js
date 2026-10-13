"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");

function createProviderFailureCheckpoint(taskId, stepAction = "read_public_information") {
  const agent = agentManager.createAgent({ id: taskId + "-agent" });
  assert.equal(agent.success, true);

  const created = agentManager.createTask(
    agent.agent.id,
    "Recover after provider failure",
    { id: taskId }
  );
  assert.equal(created.success, true);

  const step = agentManager.addStep(taskId, {
    id: taskId + "-step",
    name: "Provider-backed step",
    action: stepAction,
    input: { query: "owner decision regression test" }
  });
  assert.equal(step.success, true);
  assert.equal(agentManager.startStep(taskId, step.step.id).success, true);
  const failed = agentManager.failStep(taskId, step.step.id, "simulated provider failure");
  assert.equal(failed.success, true);
  assert.equal(failed.step.status, agentManager.STEP_STATES.FAILED);

  const saved = checkpointRecovery.saveAfterExecution(taskId, {
    success: false,
    stage: "provider-search",
    error: "simulated provider outage",
    provider: null,
    attemptedProviders: ["primary-test", "fallback-test"],
    fallbackUsed: true
  }, {
    reason: "provider failure decision regression test",
    metadata: { mode: "provider-research" }
  });

  assert.equal(saved.success, true);
  assert.equal(saved.checkpoint.metadata.providerRecovery.requiresOwnerDecision, true);
  assert.equal(saved.checkpoint.metadata.providerRecovery.automaticRetryAllowed, false);

  agentManager.reset();
  return taskId;
}

test.beforeEach(() => {
  agentManager.reset();
  assert.equal(checkpointBridge.reset().success, true);
});

test("provider-failure resolution requires trusted owner authorization", () => {
  const taskId = createProviderFailureCheckpoint("provider-decision-auth");
  const result = checkpointRecovery.resolveProviderFailure(taskId, "retry", {
    confirmProviderRetry: true
  });

  assert.equal(result.success, false);
  assert.equal(result.requiresOwnerAuthorization, true);
  assert.equal(result.executionStarted, false);
  assert.equal(agentManager.getTask(taskId).success, false);
});

test("retry requires explicit side-effect confirmation and records the owner decision", () => {
  const taskId = createProviderFailureCheckpoint("provider-decision-retry");
  const blocked = checkpointRecovery.resolveProviderFailure(taskId, "retry", {
    ownerAuthorized: true
  });
  assert.equal(blocked.success, false);
  assert.equal(blocked.requiresConfirmation, true);
  assert.equal(blocked.executionStarted, false);

  const resolved = checkpointRecovery.resolveProviderFailure(taskId, "retry", {
    ownerAuthorized: true,
    confirmProviderRetry: true
  });

  assert.equal(resolved.success, true);
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.decision, "retry");
  assert.equal(resolved.executionStarted, false);
  assert.equal(resolved.automaticRetryAllowed, false);
  assert.equal(resolved.auditCheckpointSaved, true);
  assert.equal(resolved.task.status, agentManager.TASK_STATES.PAUSED);
  assert.equal(resolved.task.steps[0].status, agentManager.STEP_STATES.PENDING);
  assert.equal(resolved.task.steps[0].error, null);

  const latest = checkpointRecovery.getLatestCheckpoint(taskId);
  assert.equal(latest.success, true);
  assert.equal(latest.checkpoint.metadata.providerRecovery.requiresOwnerDecision, false);
  assert.equal(latest.checkpoint.metadata.providerRecovery.automaticRetryAllowed, false);
  assert.equal(latest.checkpoint.metadata.providerRecovery.ownerDecision.decision, "retry");
  assert.equal(latest.checkpoint.metadata.providerRecovery.ownerDecision.retryConfirmed, true);
});

test("confirmed provider retry resumes through Worker/Runner and executes the failed step once", async () => {
  const taskId = createProviderFailureCheckpoint("provider-decision-worker-resume", "calculate");
  const resolved = checkpointRecovery.resolveProviderFailure(taskId, "retry", {
    ownerAuthorized: true,
    confirmProviderRetry: true
  });
  assert.equal(resolved.success, true);
  assert.equal(resolved.task.steps[0].status, agentManager.STEP_STATES.PENDING);

  const workerApi = require("./agentWorker");
  const runner = require("./agentRunner");
  const autonomousWorker = require("./autonomousWorker");
  workerApi.reset();
  runner.reset();
  autonomousWorker.reset();

  const executed = [];
  const result = await checkpointRecovery.resumeResolvedProviderFailure(taskId, {
    ownerAuthorized: true,
    confirmExecution: true,
    executionOptions: {
      runner: async ({ step }) => {
        executed.push(step.id);
        return { success: true, output: "owner-approved retry completed" };
      }
    }
  });

  assert.equal(result.success, true, result.error);
  assert.equal(result.executionStarted, true);
  assert.equal(result.task.status, agentManager.TASK_STATES.COMPLETED);
  assert.deepEqual(executed, [taskId + "-step"]);
});

test("abort records owner decision and leaves task stopped without execution", () => {
  const taskId = createProviderFailureCheckpoint("provider-decision-abort");
  const resolved = checkpointRecovery.resolveProviderFailure(taskId, "abort", {
    ownerAuthorized: true
  });

  assert.equal(resolved.success, true);
  assert.equal(resolved.decision, "abort");
  assert.equal(resolved.executionStarted, false);
  assert.equal(resolved.auditCheckpointSaved, true);
  assert.equal(resolved.task.status, agentManager.TASK_STATES.STOPPED);

  const latest = checkpointRecovery.getLatestCheckpoint(taskId);
  assert.equal(latest.success, true);
  assert.equal(latest.checkpoint.metadata.providerRecovery.ownerDecision.decision, "abort");
  assert.equal(latest.checkpoint.task.status, agentManager.TASK_STATES.STOPPED);
});

test("provider failure cannot be resolved twice by restoring over a live task", () => {
  const taskId = createProviderFailureCheckpoint("provider-decision-once");
  const first = checkpointRecovery.resolveProviderFailure(taskId, "retry", {
    ownerAuthorized: true,
    confirmProviderRetry: true
  });
  assert.equal(first.success, true);

  const second = checkpointRecovery.resolveProviderFailure(taskId, "retry", {
    ownerAuthorized: true,
    confirmProviderRetry: true
  });
  assert.equal(second.success, false);
  assert.match(second.error, /does not contain an unresolved|already exists/i);
});


test("concurrent provider recovery execution is single-flight per task", async () => {
  const taskId = createProviderFailureCheckpoint("provider-decision-single-flight", "calculate");
  const resolved = checkpointRecovery.resolveProviderFailure(taskId, "retry", {
    ownerAuthorized: true,
    confirmProviderRetry: true
  });
  assert.equal(resolved.success, true);

  const executed = [];
  let markRunnerStarted;
  const runnerStarted = new Promise(resolve => { markRunnerStarted = resolve; });
  let releaseRunner;
  const runnerGate = new Promise(resolve => { releaseRunner = resolve; });

  const firstRun = checkpointRecovery.resumeResolvedProviderFailure(taskId, {
    ownerAuthorized: true,
    confirmExecution: true,
    executionOptions: {
      runner: async ({ step }) => {
        executed.push(step.id);
        markRunnerStarted();
        await runnerGate;
        return { success: true, output: "single-flight test completed" };
      }
    }
  });

  await runnerStarted;
  const duplicate = await checkpointRecovery.resumeResolvedProviderFailure(taskId, {
    ownerAuthorized: true,
    confirmExecution: true,
    executionOptions: {
      runner: async () => {
        executed.push("duplicate-execution");
        return { success: true };
      }
    }
  });

  assert.equal(duplicate.success, false);
  assert.equal(duplicate.executionStarted, false);
  assert.equal(duplicate.recoveryAlreadyInProgress, true);
  assert.match(duplicate.error, /already in progress/i);

  releaseRunner();
  const completed = await firstRun;
  assert.equal(completed.success, true, completed.error);
  assert.equal(completed.executionStarted, true);
  assert.deepEqual(executed, [taskId + "-step"]);
});
