"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");

function createProviderFailureCheckpoint(taskId) {
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
    action: "read_public_information",
    input: { query: "owner decision regression test" }
  });
  assert.equal(step.success, true);

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

  const latest = checkpointRecovery.getLatestCheckpoint(taskId);
  assert.equal(latest.success, true);
  assert.equal(latest.checkpoint.metadata.providerRecovery.requiresOwnerDecision, false);
  assert.equal(latest.checkpoint.metadata.providerRecovery.automaticRetryAllowed, false);
  assert.equal(latest.checkpoint.metadata.providerRecovery.ownerDecision.decision, "retry");
  assert.equal(latest.checkpoint.metadata.providerRecovery.ownerDecision.retryConfirmed, true);
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
