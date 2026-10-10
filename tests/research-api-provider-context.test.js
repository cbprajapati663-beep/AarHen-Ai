const assert = require("node:assert/strict");
const manager = require("../providers/providerManager");
const researchApi = require("../core/researchApi");

async function main() {
  manager.reset();

  const mockProvider = {
    async search({ query, maxSources }) {
      assert.equal(query, "provider context regression");
      assert.equal(maxSources, 3);
      return {
        success: true,
        provider: "Research Context Mock",
        answer: "Test summary",
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

  const registration = manager.registerProvider("research-context-test", mockProvider, {
    priority: 1,
    enabled: true,
    providerType: "web-search"
  });
  assert.equal(registration.success, true);

  const result = await researchApi.searchWeb({
    query: "provider context regression",
    maxSources: 3,
    provider: "research-context-test"
  });

  assert.equal(result.success, true, result.error || "research API should succeed");
  assert.equal(result.provider, "Research Context Mock");
  assert.equal(result.providerType, "web-search");
  assert.deepEqual(result.attemptedProviders, ["research-context-test"]);
  assert.equal(result.fallbackUsed, false);

  assert.equal(result.context.provider, "Research Context Mock");
  assert.equal(result.context.providerType, "web-search");
  assert.deepEqual(result.context.attemptedProviders, ["research-context-test"]);
  assert.equal(result.context.fallbackUsed, false);

  assert.equal(result.research.provider, "Research Context Mock");
  assert.deepEqual(result.research.attemptedProviders, ["research-context-test"]);

  manager.reset();
  console.log("Research API provider context propagation tests: PASSED");
}

main().catch((error) => {
  console.error("Research API provider context propagation tests: FAILED");
  console.error(error);
  process.exitCode = 1;
});
