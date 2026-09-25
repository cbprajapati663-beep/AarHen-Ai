const test = require("node:test");
const assert = require("node:assert/strict");
const orchestrator = require("../core/orchestrator");

test("buildExecutionContext preserves retrieved knowledge and grounding metadata", () => {
  const context = {
    answerContext: "DOCUMENT KNOWLEDGE:\nEligibility proof required.",
    documentKnowledgeEnabled: true,
    documentEvidence: [{
      reference: "DOC-1",
      title: "Eligibility Guide",
      source: "guide.pdf",
      content: "Eligibility proof required.",
      confidence: 0.91,
      verified: true
    }],
    documentGrounding: {
      enabled: true,
      mode: "retrieved-evidence",
      evidenceCount: 1,
      instruction: "Use evidence only for supported claims."
    },
    ragKnowledge: {
      enabled: true,
      count: 1,
      results: [{ title: "Eligibility Guide", content: "Eligibility proof required." }]
    }
  };

  const result = orchestrator.buildExecutionContext(
    { request: "What proof is needed?", language: "en", memory: {}, knowledge: {}, thinkingContext: "reasoning" },
    { selectedSkill: { name: "knowledge" }, matches: [] },
    { category: "knowledge", intent: "answer-question", parameters: {} },
    context
  );

  assert.equal(result.answerContext, context.answerContext);
  assert.deepEqual(result.documentEvidence, context.documentEvidence);
  assert.deepEqual(result.documentGrounding, context.documentGrounding);
  assert.deepEqual(result.ragKnowledge, context.ragKnowledge);
  assert.equal(result.brain.thinkingContext, "reasoning");
});

test("buildExecutionContext safely defaults absent knowledge metadata", () => {
  const result = orchestrator.buildExecutionContext(
    { request: "Hello", language: "en", memory: {}, knowledge: {} },
    { selectedSkill: null, matches: [] },
    { category: "conversation", intent: "greeting", parameters: {} }
  );

  assert.equal(result.answerContext, undefined);
  assert.equal(result.documentEvidence, undefined);
  assert.equal(result.documentGrounding, undefined);
  assert.equal(result.ragKnowledge, undefined);
});
