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
