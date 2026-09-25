const test = require("node:test");
const assert = require("node:assert/strict");
const orchestrator = require("../core/orchestrator");
const learningApi = require("../core/learningApi");

test("retrieveKnowledgeContext normalizes learned evidence for orchestration", async () => {
  const originalSearch = learningApi.searchLearnedKnowledge;
  learningApi.searchLearnedKnowledge = async (query, limit) => {
    assert.equal(query, "loan eligibility");
    assert.equal(limit, 3);
    return {
      success: true,
      results: [
        { title: "Eligibility", content: "Income proof needed", source: "manual.pdf", confidence: 0.92, verified: true },
        { text: "Address proof needed" },
        { title: "Empty item", content: "   " }
      ]
    };
  };

  try {
    const result = await orchestrator.retrieveKnowledgeContext("loan eligibility", { ragLimit: 3 });
    assert.equal(result.enabled, true);
    assert.equal(result.status, "retrieval-complete");
    assert.equal(result.count, 2);
    assert.deepEqual(result.results[0], {
      title: "Eligibility",
      content: "Income proof needed",
      source: "manual.pdf",
      category: null,
      confidence: 0.92,
      verified: true
    });
    assert.equal(result.results[1].content, "Address proof needed");
  } finally {
    learningApi.searchLearnedKnowledge = originalSearch;
  }
});

test("retrieveKnowledgeContext returns an explicit disabled state when RAG is off", async () => {
  const result = await orchestrator.retrieveKnowledgeContext("any question", { rag: false });
  assert.deepEqual(result, {
    enabled: false,
    status: "rag-disabled",
    count: 0,
    results: []
  });
});

test("retrieveKnowledgeContext safely reports provider errors", async () => {
  const originalSearch = learningApi.searchLearnedKnowledge;
  learningApi.searchLearnedKnowledge = async () => {
    throw new Error("temporary retrieval issue");
  };

  try {
    const result = await orchestrator.retrieveKnowledgeContext("any question");
    assert.equal(result.enabled, true);
    assert.equal(result.status, "retrieval-error");
    assert.equal(result.count, 0);
    assert.deepEqual(result.results, []);
    assert.equal(result.error, "temporary retrieval issue");
  } finally {
    learningApi.searchLearnedKnowledge = originalSearch;
  }
});
