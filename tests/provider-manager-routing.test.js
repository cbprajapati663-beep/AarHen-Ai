const test = require("node:test");
const assert = require("node:assert/strict");
const manager = require("../providers/providerManager");

function mockProvider({ connected = true, search, providerType = "web-search" } = {}) {
  return {
    async search(args) {
      if (search) return search(args);
      return { success: true, provider: "mock-provider", results: [] };
    },
    getProviderStatus() {
      return {
        connected,
        status: connected ? "connected" : "disconnected",
        providerType,
        supportsSearch: true
      };
    }
  };
}

test.beforeEach(() => {
  manager.reset();
});

test.after(() => {
  manager.reset();
});

test("automatic routing uses the lowest priority available provider", async () => {
  const later = manager.registerProvider("fallback-later", mockProvider(), {
    priority: 20, enabled: true, providerType: "web-search"
  });
  const first = manager.registerProvider("fallback-first", mockProvider(), {
    priority: 5, enabled: true, providerType: "web-search"
  });
  assert.equal(later.success, true);
  assert.equal(first.success, true);

  const result = await manager.searchWeb({ query: "  routing check  " });
  assert.equal(result.success, true);
  assert.equal(result.provider, "mock-provider");
  assert.deepEqual(result.attemptedProviders, ["fallback-first"]);
  assert.equal(result.fallbackUsed, false);
});

test("automatic routing falls back after a provider throws", async () => {
  const calls = [];
  manager.registerProvider("fallback-throws", mockProvider({
    search: async () => {
      calls.push("throws");
      throw new Error("simulated provider outage");
    }
  }), { priority: 1, enabled: true, providerType: "web-search" });

  manager.registerProvider("fallback-success", mockProvider({
    search: async ({ query, maxSources }) => {
      calls.push("success");
      return { success: true, provider: "fallback-success", results: [{ query, maxSources }] };
    }
  }), { priority: 2, enabled: true, providerType: "web-search" });

  const result = await manager.searchWeb({ query: "fallback query", maxSources: 3 });
  assert.equal(result.success, true);
  assert.equal(result.provider, "fallback-success");
  assert.deepEqual(calls, ["throws", "success"]);
  assert.deepEqual(result.attemptedProviders, ["fallback-throws", "fallback-success"]);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.results[0].query, "fallback query");
  assert.equal(result.results[0].maxSources, 3);
});

test("disabled and disconnected dynamic providers are not selected", async () => {
  manager.registerProvider("fallback-disabled", mockProvider(), {
    priority: 0, enabled: false, providerType: "web-search"
  });
  manager.registerProvider("fallback-disconnected", mockProvider({ connected: false }), {
    priority: 1, enabled: true, providerType: "web-search"
  });
  manager.registerProvider("fallback-available", mockProvider({
    search: async () => ({ success: true, provider: "fallback-available", results: [] })
  }), { priority: 2, enabled: true, providerType: "web-search" });

  const result = await manager.searchWeb({ query: "availability check" });
  assert.equal(result.success, true);
  assert.equal(result.provider, "fallback-available");
  assert.deepEqual(result.attemptedProviders, ["fallback-available"]);
  assert.equal(manager.isProviderAvailable("fallback-disabled"), false);
  assert.equal(manager.isProviderAvailable("fallback-disconnected"), false);
});

test("explicit unavailable or non-search provider fails without silently switching", async () => {
  manager.registerProvider("fallback-only", mockProvider(), {
    priority: 1, enabled: true, providerType: "web-search"
  });
  manager.setProviderEnabled("fallback-only", false);

  const unavailable = await manager.searchWeb({
    query: "explicit provider",
    provider: "fallback-only"
  });
  assert.equal(unavailable.success, false);
  assert.deepEqual(unavailable.attemptedProviders, ["fallback-only"]);
  assert.equal(unavailable.fallbackUsed, undefined);

  const voice = await manager.searchWeb({ query: "explicit provider", provider: "voice" });
  assert.equal(voice.success, false);
  assert.deepEqual(voice.attemptedProviders, ["voice"]);
  assert.match(voice.error, /does not support web search/i);
});

test("repeated provider failures open its circuit and automatic routing skips it during cooldown", async () => {
  let failingCalls = 0;
  let fallbackCalls = 0;

  manager.registerProvider("circuit-failing", mockProvider({
    search: async () => {
      failingCalls += 1;
      throw new Error("temporary provider failure");
    }
  }), {
    priority: 1,
    enabled: true,
    providerType: "web-search",
    failureThreshold: 2,
    circuitCooldownMs: 100
  });

  manager.registerProvider("circuit-fallback", mockProvider({
    search: async () => {
      fallbackCalls += 1;
      return { success: true, provider: "circuit-fallback", results: [] };
    }
  }), {
    priority: 2,
    enabled: true,
    providerType: "web-search"
  });

  const first = await manager.searchWeb({ query: "circuit failure one" });
  const second = await manager.searchWeb({ query: "circuit failure two" });
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(failingCalls, 2);

  const health = manager.getProviderHealth("circuit-failing");
  assert.equal(health.circuitBreaker.status, "open");
  assert.equal(health.circuitBreaker.open, true);

  const third = await manager.searchWeb({ query: "circuit should skip" });
  assert.equal(third.success, true);
  assert.equal(third.provider, "circuit-fallback");
  assert.equal(failingCalls, 2);
  assert.equal(fallbackCalls, 3);

  const explicit = await manager.searchWeb({
    query: "explicit open circuit",
    provider: "circuit-failing"
  });
  assert.equal(explicit.success, false);
  assert.equal(explicit.circuitOpen, true);
  assert.match(explicit.error, /circuit is open/i);
});

test("registration rejects malformed providers and attempts to replace built-ins", () => {
  assert.equal(manager.registerProvider("  ", mockProvider()).success, false);
  assert.equal(manager.registerProvider("bad-provider", {}).success, false);
  const builtIn = manager.registerProvider("research", mockProvider());
  assert.equal(builtIn.success, false);
  assert.match(builtIn.error, /cannot be replaced/i);
});
