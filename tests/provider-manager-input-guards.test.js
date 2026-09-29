const assert = require("node:assert/strict");
const manager = require("../providers/providerManager");

async function main() {
  manager.reset();

  let received = null;
  const mockProvider = {
    async search(args) {
      received = args;
      return {
        success: true,
        provider: "Input Guard Mock",
        results: []
      };
    },
    getProviderStatus() {
      return {
        connected: true,
        status: "connected",
        providerType: "web-search",
        supportsSearch: true
      };
    }
  };

  const registration = manager.registerProvider("input-guard-mock", mockProvider, {
    priority: 1,
    enabled: true,
    providerType: "web-search"
  });
  assert.equal(registration.success, true, "mock provider should register");

  const result = await manager.searchWeb({
    query: "  guard test  ",
    maxSources: 999,
    provider: "input-guard-mock"
  });

  assert.equal(result.success, true, "valid search should succeed");
  assert.equal(received.query, "guard test", "query should be trimmed");
  assert.equal(received.maxSources, 10, "maxSources should be capped at 10");

  const emptyQuery = await manager.searchWeb({ query: "   " });
  assert.equal(emptyQuery.success, false, "blank query should be rejected");
  assert.deepEqual(emptyQuery.results, [], "blank query should return no results");

  manager.reset();
  console.log("Provider Manager input guard tests: PASSED");
}

main().catch((error) => {
  console.error("Provider Manager input guard tests: FAILED");
  console.error(error);
  process.exitCode = 1;
});
