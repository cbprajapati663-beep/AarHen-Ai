"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const agentManager = require("./agentManager");
const checkpointBridge = require("./checkpointBridge");
const checkpointRecovery = require("./checkpointRecoveryController");
const providerManager = require("../providers/providerManager");
const providerBridge = require("./providerBridge");

function createTask(taskId) {
  const agent = agentManager.createAgent({ id: taskId + "-agent" });
  assert.equal(agent.success, true);

  const created = agentManager.createTask(
    agent.agent.id,
    "Research with provider fallback",
    { id: taskId }
  );
  assert.equal(created.success, true);

  const step = agentManager.addStep(taskId, {
    id: taskId + "-step",
    name: "Research step",
    action: "read_public_information",
    input: { query: "AarHen provider fallback test" }
  });
  assert.equal(step.success, true);

  const before = checkpointRecovery.saveBeforeExecution(taskId, {
    reason: "before provider-failure recovery test"
  });
  assert.equal(before.success, true);

  return taskId;
}

function fakeProvider(name, search) {
  return {
    getProviderStatus() {
      return {
        provider: name,
        providerType: "web-search",
        connected: true,
        status: "connected"
      };
    },
    search
  };
}

test.beforeEach(() => {
  providerManager.reset();
  agentManager.reset();
  assert.equal(checkpointBridge.reset().success, true);
});

test.afterEach(() => {
  providerManager.reset();
});

test("provider failure falls back to the next available provider and checkpoint records the fallback", async () => {
  const taskId = createTask("provider-fallback-checkpoint");
  const attempts = [];

  assert.equal(providerManager.registerProvider(
    "test-primary",
    fakeProvider("test-primary", async () => {
      attempts.push("test-primary");
      return { success: false, error: "simulated primary outage", results: [] };
    }),
    { priority: 1, providerType: "web-search" }
  ).success, true);

  assert.equal(providerManager.registerProvider(
    "test-fallback",
    fakeProvider("test-fallback", async ({ query }) => {
      attempts.push("test-fallback");
      return {
        success: true,
        provider: "test-fallback",
        results: [{ title: "Verified test result", url: "https://example.com", query }]
      };
    }),
    { priority: 2, providerType: "web-search" }
  ).success, true);

  const result = await providerBridge.search({
    query: "AarHen provider fallback test"
  });

  assert.equal(result.success, true);
  assert.equal(result.provider, "test-fallback");
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(result.attemptedProviders, ["test-primary", "test-fallback"]);
  assert.deepEqual(attempts, ["test-primary", "test-fallback"]);

  const saved = checkpointRecovery.saveAfterExecution(taskId, result, {
    metadata: { mode: "provider-research" }
  });
  assert.equal(saved.success, true);

  const latest = checkpointRecovery.getLatestCheckpoint(taskId);
  assert.equal(latest.success, true);
  assert.equal(latest.checkpoint.metadata.providerRecovery.provider, "test-fallback");
  assert.deepEqual(
    latest.checkpoint.metadata.providerRecovery.attemptedProviders,
    ["test-primary", "test-fallback"]
  );
  assert.equal(latest.checkpoint.metadata.providerRecovery.fallbackUsed, true);
  assert.equal(latest.checkpoint.metadata.providerRecovery.outcome, "fallback-succeeded");
});

test("when every provider fails, failure and attempted-provider history remain visible in checkpoint", async () => {
  const taskId = createTask("provider-all-fail-checkpoint");

  assert.equal(providerManager.registerProvider(
    "test-fail-one",
    fakeProvider("test-fail-one", async () => ({
      success: false,
      error: "simulated outage one",
      results: []
    })),
    { priority: 1, providerType: "web-search" }
  ).success, true);

  assert.equal(providerManager.registerProvider(
    "test-fail-two",
    fakeProvider("test-fail-two", async () => {
      throw new Error("simulated outage two");
    }),
    { priority: 2, providerType: "web-search" }
  ).success, true);

  const result = await providerBridge.search({
    query: "AarHen provider failure test"
  });

  assert.equal(result.success, false);
  assert.deepEqual(result.attemptedProviders, ["test-fail-one", "test-fail-two"]);
  assert.equal(result.fallbackUsed, true);

  const saved = checkpointRecovery.saveAfterExecution(taskId, result, {
    metadata: { mode: "provider-research" }
  });
  assert.equal(saved.success, true);

  const latest = checkpointRecovery.getLatestCheckpoint(taskId);
  assert.equal(latest.success, true);
  assert.deepEqual(
    latest.checkpoint.metadata.providerRecovery.attemptedProviders,
    ["test-fail-one", "test-fail-two"]
  );
  assert.equal(latest.checkpoint.metadata.providerRecovery.fallbackUsed, true);
  assert.equal(latest.checkpoint.metadata.providerRecovery.outcome, "failed");
  assert.equal(latest.checkpoint.metadata.execution.success, false);
  assert.match(latest.checkpoint.metadata.execution.error, /simulated outage two/);
});
