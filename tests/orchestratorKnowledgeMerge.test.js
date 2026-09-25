const test = require("node:test");
const assert = require("node:assert/strict");
const orchestrator = require("../core/orchestrator");

test("mergeKnowledgeIntoExecutionContext preserves document context and appends learned knowledge", () => {
  const existingEvidence = [{
    reference: "DOC-1",
    title: "Uploaded Guide",
    source: "guide.pdf",
    content: "Existing document evidence",
    confidence: 0.95,
    verified: true
  }];
  const context = {
    answerContext: "UPLOADED DOCUMENT CONTEXT:\nExisting answer evidence",
    documentKnowledge: [{ title: "Existing knowledge", content: "Keep this" }],
    documentDocuments: { results: [{ title: "Uploaded Guide", content: "Keep document" }] },
    documentEvidence: existingEvidence,
    documentRag: { status: "ready", previous: true },
    documentAware: true
  };
  const rag = {
    enabled: true,
    count: 1,
    results: [{ title: "Learned rule", content: "New learned evidence", source: "memory", confidence: 0.8, verified: false }]
  };
  const result = orchestrator.mergeKnowledgeIntoExecutionContext({}, context, rag);

  assert.match(result.answerContext, /UPLOADED DOCUMENT CONTEXT/);
  assert.match(result.answerContext, /LEARNED KNOWLEDGE CONTEXT/);
  assert.equal(result.documentKnowledge.length, 2);
  assert.equal(result.documentDocuments.results.length, 2);
  assert.equal(result.documentEvidence.length, 2);
  assert.equal(result.documentEvidence[0].reference, "DOC-1");
  assert.equal(result.documentEvidence[1].reference, "RAG-1");
  assert.equal(result.documentRag.status, "ready");
  assert.equal(result.documentRag.learnedKnowledge, rag);
  assert.equal(result.documentGrounding.evidenceCount, 2);
  assert.equal(result.documentAware, true);
});

test("mergeKnowledgeIntoExecutionContext handles empty learned results without losing existing context", () => {
  const context = {
    answerContext: "Keep original context",
    documentEvidence: [{ reference: "DOC-1", title: "Guide" }],
    documentKnowledge: [{ content: "Original" }]
  };
  const result = orchestrator.mergeKnowledgeIntoExecutionContext({}, context, {
    enabled: true, count: 0, results: []
  });

  assert.equal(result.answerContext, "Keep original context");
  assert.equal(result.documentKnowledge.length, 1);
  assert.equal(result.documentEvidence.length, 1);
  assert.equal(result.documentGrounding.evidenceCount, 1);
  assert.equal(result.documentAware, true);
});

test("mergeKnowledgeIntoExecutionContext caps generated evidence at five items", () => {
  const results = Array.from({ length: 7 }, (_, index) => ({
    title: "Learned " + (index + 1),
    content: "Evidence " + (index + 1)
  }));
  const result = orchestrator.mergeKnowledgeIntoExecutionContext({}, {}, {
    enabled: true, count: results.length, results
  });

  assert.equal(result.documentEvidence.length, 5);
  assert.deepEqual(result.documentEvidence.map(item => item.reference), [
    "RAG-1", "RAG-2", "RAG-3", "RAG-4", "RAG-5"
  ]);
});

test("mergeKnowledgeIntoExecutionContext respects disabled document knowledge grounding", () => {
  const result = orchestrator.mergeKnowledgeIntoExecutionContext({}, {
    documentKnowledgeEnabled: false
  }, {
    enabled: true, count: 1, results: [{ title: "Rule", content: "Evidence" }]
  });

  assert.equal(result.documentKnowledgeEnabled, false);
  assert.equal(result.documentGrounding.enabled, false);
  assert.equal(result.documentGrounding.evidenceCount, 1);
});
