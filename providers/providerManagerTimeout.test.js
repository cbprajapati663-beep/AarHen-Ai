"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const manager = require("./providerManager");

function makeProvider(search) {
  return {
    getProviderStatus() {
      return {
        connected: true,
        status: "connected",
        providerType: "web-search",
        supportsSearch: true
      };
    },
    search
  };
}

test.afterEach(() => {
  manager.reset();
});

test("requested provider timeout returns a stable failure instead of hanging", async () => {
  const registration = manager.registerProvider(
    "test-hanging-requested",
    makeProvider(() => new Promise(() => {})),
    { priority: 1, searchTimeoutMs: 20 }
  );
  assert.equal(registration.success, true);

  const result = await manager.searchWeb({
    query: "timeout test",
    provider: "test-hanging-requested"
  });

  assert.equal(result.success, false);
  assert.equal(result.provider, "test-hanging-requested");
  assert.deepEqual(result.attemptedProviders, ["test-hanging-requested"]);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.error, /timed out after 20ms/i);
});

test("a timed-out provider opens its circuit and is skipped on subsequent requests", async () => {
  let hungCalls = 0;
  let fallbackCalls = 0;

  assert.equal(manager.registerProvider(
    "test-timeout-circuit-open",
    makeProvider(() => {
      hungCalls += 1;
      return new Promise(() => {});
    }),
    {
      priority: 1,
      searchTimeoutMs: 15,
      failureThreshold: 1,
      circuitCooldownMs: 1000
    }
  ).success, true);

  assert.equal(manager.registerProvider(
    "test-timeout-circuit-fallback",
    makeProvider(async () => {
      fallbackCalls += 1;
      return { success: true, provider: "test-timeout-circuit-fallback", results: [] };
    }),
    { priority: 2 }
  ).success, true);

  const first = await manager.searchWeb({ query: "timeout opens circuit" });
  assert.equal(first.success, true);
  assert.equal(first.provider, "test-timeout-circuit-fallback");
  assert.equal(hungCalls, 1);
  assert.equal(manager.getProviderHealth("test-timeout-circuit-open").circuitBreaker.open, true);

  const second = await manager.searchWeb({ query: "skip provider with open circuit" });
  assert.equal(second.success, true);
  assert.equal(second.provider, "test-timeout-circuit-fallback");
  assert.equal(hungCalls, 1, "open circuit should prevent another call to the hung provider");
  assert.equal(fallbackCalls, 2);
});

test("automatic routing times out a hung provider and continues to the next provider", async () => {
  const attempted = [];
  assert.equal(manager.registerProvider(
    "test-hanging-first",
    makeProvider(() => {
      attempted.push("test-hanging-first");
      return new Promise(() => {});
    }),
    { priority: 1, searchTimeoutMs: 20 }
  ).success, true);

  assert.equal(manager.registerProvider(
    "test-fallback-second",
    makeProvider(async ({ query }) => {
      attempted.push("test-fallback-second");
      return {
        success: true,
        provider: "test-fallback-second",
        results: [{ title: "Fallback result", url: "https://example.test", query }]
      };
    }),
    { priority: 2, searchTimeoutMs: 100 }
  ).success, true);

  const result = await manager.searchWeb({ query: "fallback test", maxSources: 3 });

  assert.equal(result.success, true);
  assert.equal(result.provider, "test-fallback-second");
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(result.attemptedProviders.slice(0, 2), [
    "test-hanging-first",
    "test-fallback-second"
  ]);
  assert.deepEqual(attempted, ["test-hanging-first", "test-fallback-second"]);
});


test("half-open recovery probe closes the circuit after provider recovery", async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;

  assert.equal(manager.registerProvider(
    "test-half-open-recovery-primary",
    makeProvider(async () => {
      primaryCalls += 1;
      if (primaryCalls === 1) {
        throw new Error("temporary outage");
      }
      return {
        success: true,
        provider: "test-half-open-recovery-primary",
        results: [{ title: "Recovered result" }]
      };
    }),
    {
      priority: 1,
      failureThreshold: 1,
      circuitCooldownMs: 25,
      searchTimeoutMs: 100
    }
  ).success, true);

  assert.equal(manager.registerProvider(
    "test-half-open-recovery-fallback",
    makeProvider(async () => {
      fallbackCalls += 1;
      return {
        success: true,
        provider: "test-half-open-recovery-fallback",
        results: []
      };
    }),
    { priority: 2, searchTimeoutMs: 100 }
  ).success, true);

  const first = await manager.searchWeb({ query: "open circuit" });
  assert.equal(first.success, true);
  assert.equal(first.provider, "test-half-open-recovery-fallback");
  assert.equal(manager.getProviderHealth("test-half-open-recovery-primary").circuitBreaker.open, true);

  await new Promise(resolve => setTimeout(resolve, 35));

  const recovered = await manager.searchWeb({ query: "probe recovered provider" });
  assert.equal(recovered.success, true);
  assert.equal(recovered.provider, "test-half-open-recovery-primary");
  assert.equal(recovered.fallbackUsed, false);
  assert.equal(primaryCalls, 2);
  assert.equal(fallbackCalls, 1);

  const health = manager.getProviderHealth("test-half-open-recovery-primary");
  assert.equal(health.circuitBreaker.status, "closed");
  assert.equal(health.circuitBreaker.open, false);
  assert.equal(health.circuitBreaker.failures, 0);
});

test("failed half-open recovery probe reopens the circuit and falls back safely", async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;

  assert.equal(manager.registerProvider(
    "test-half-open-failure-primary",
    makeProvider(async () => {
      primaryCalls += 1;
      throw new Error("provider remains unavailable");
    }),
    {
      priority: 1,
      failureThreshold: 1,
      circuitCooldownMs: 25,
      searchTimeoutMs: 100
    }
  ).success, true);

  assert.equal(manager.registerProvider(
    "test-half-open-failure-fallback",
    makeProvider(async () => {
      fallbackCalls += 1;
      return {
        success: true,
        provider: "test-half-open-failure-fallback",
        results: []
      };
    }),
    { priority: 2, searchTimeoutMs: 100 }
  ).success, true);

  const first = await manager.searchWeb({ query: "open circuit" });
  assert.equal(first.success, true);
  assert.equal(first.provider, "test-half-open-failure-fallback");
  assert.equal(manager.getProviderHealth("test-half-open-failure-primary").circuitBreaker.open, true);

  await new Promise(resolve => setTimeout(resolve, 35));

  const probe = await manager.searchWeb({ query: "failed recovery probe" });
  assert.equal(probe.success, true);
  assert.equal(probe.provider, "test-half-open-failure-fallback");
  assert.equal(probe.fallbackUsed, true);
  assert.equal(primaryCalls, 2);
  assert.equal(fallbackCalls, 2);

  const health = manager.getProviderHealth("test-half-open-failure-primary");
  assert.equal(health.circuitBreaker.open, true);
  assert.equal(health.circuitBreaker.status, "open");
});
