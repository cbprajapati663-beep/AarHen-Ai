const test = require("node:test");
const assert = require("node:assert/strict");
const executor = require("../skills/executor");

test("prepareContext forwards merged answer and grounding evidence to executor context", () => {
  const evidence = [
    { reference: "DOC-1", title: "Uploaded Guide", source: "guide.pdf", content: "Document evidence" },
    { reference: "RAG-1", title: "Learned Rule", source: "memory", content: "Learned evidence" }
  ];
  const grounding = {
    enabled: true,
    mode: "retrieved-evidence",
    evidenceCount: 2,
    evidence: evidence.map(({ reference, title, source }) => ({ reference, title, source })),
    instruction: "Use evidence only."
  };
  const input = {
    request: "What does the guide say?",
    context: {
      answerContext: "DOCUMENT CONTEXT\nGuide says X.\n\nLEARNED KNOWLEDGE CONTEXT\nRule says Y.",
      documentKnowledgeEnabled: true,
      documentAware: true,
      documentKnowledge: [{ title: "Uploaded Guide", content: "Guide says X." }, { title: "Learned Rule", content: "Rule says Y." }],
      documentDocuments: { results: [{ title: "Uploaded Guide" }, { title: "Learned Rule" }], count: 2, available: true },
      documentEvidence: evidence,
      documentGrounding: grounding,
      documentRag: { status: "ready", learnedKnowledge: { count: 1 } },
      knowledgeContext: { available: true },
      brain: { memory: {}, knowledge: {}, thinkingContext: {} },
      routing: { selectedSkill: { name: "knowledge" } },
      intent: { category: "knowledge", intent: "answer-question" }
    }
  };

  const result = executor.prepareContext(input);

  assert.equal(result.answerContext, input.context.answerContext);
  assert.deepEqual(result.documentEvidence, evidence);
  assert.deepEqual(result.documentGrounding, grounding);
  assert.deepEqual(result.documentRag, input.context.documentRag);
  assert.equal(result.documentAware, true);
  assert.equal(result.documentKnowledgeEnabled, true);
  assert.equal(result.documentKnowledge.length, 2);
  assert.equal(result.documentDocuments.count, 2);
});

test("prepareContext safely defaults missing grounding metadata", () => {
  const result = executor.prepareContext({ request: "Hello", context: {} });

  assert.equal(result.answerContext, "");
  assert.deepEqual(result.documentEvidence, []);
  assert.equal(result.documentGrounding, null);
  assert.equal(result.documentAware, false);
  assert.equal(result.documentKnowledgeEnabled, true);
});
