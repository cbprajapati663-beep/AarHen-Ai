const test = require("node:test");
const assert = require("node:assert/strict");
const pipeline = require("../core/requestPipeline");

test("processRequest rejects blank requests before orchestration", async () => {
  const result = await pipeline.processRequest("   ");

  assert.equal(result.success, false);
  assert.equal(result.status, "invalid-request");
  assert.equal(result.error, "AarHen requires a request.");
});

test("getDocumentContext rejects blank requests safely", () => {
  const result = pipeline.getDocumentContext(" ");

  assert.equal(result.success, false);
  assert.equal(result.status, "invalid-request");
  assert.equal(result.error, "Request is required.");
});

test("orchestrate aliases processRequest validation behavior", async () => {
  const result = await pipeline.orchestrate("");

  assert.equal(result.success, false);
  assert.equal(result.status, "invalid-request");
  assert.equal(result.error, "AarHen requires a request.");
});

test("buildRequestContext preserves context when document knowledge is disabled", () => {
  const existing = {
    documentKnowledge: false,
    brain: { knowledge: { keep: "yes" } },
    customFlag: 42
  };

  const result = pipeline.buildRequestContext("Question", existing);

  assert.equal(result.success, true);
  assert.equal(result.status, "document-knowledge-disabled");
  assert.equal(result.context.customFlag, 42);
  assert.equal(result.context.brain.knowledge.keep, "yes");
  assert.equal(result.context.documentKnowledgeEnabled, false);
  assert.equal(result.documentKnowledgeAvailable, false);
});

test("buildRequestContext safely falls back when knowledge augmentation throws", () => {
  const knowledge = require("../core/knowledgeContext");
  const originalAugment = knowledge.augmentBrainResult;
  knowledge.augmentBrainResult = () => {
    throw new Error("simulated knowledge failure");
  };

  try {
    const result = pipeline.buildRequestContext("Question", {
      customFlag: "preserve-me",
      brain: { knowledge: { keep: true } }
    });

    assert.equal(result.success, true);
    assert.equal(result.status, "document-context-fallback");
    assert.equal(result.context.customFlag, "preserve-me");
    assert.deepEqual(result.context.brain.knowledge, { keep: true });
    assert.equal(result.context.documentAware, false);
    assert.match(result.warning, /simulated knowledge failure/);
  } finally {
    knowledge.augmentBrainResult = originalAugment;
  }
});

test("buildRequestContext caps requested knowledge limit at ten", () => {
  const knowledge = require("../core/knowledgeContext");
  const originalAugment = knowledge.augmentBrainResult;
  let capturedLimit;
  knowledge.augmentBrainResult = (_request, _brain, options) => {
    capturedLimit = options.limit;
    return {
      unifiedKnowledge: { availability: { anyKnowledge: false }, documents: { results: [], count: 0 }, rag: {}, knowledge: { documentKnowledge: [] } },
      answerContext: "",
      knowledgeContext: null
    };
  };

  try {
    const result = pipeline.buildRequestContext("Question", {}, { limit: 99 });
    assert.equal(result.success, true);
    assert.equal(capturedLimit, 10);
    assert.equal(result.context.documentKnowledgeLimit, 10);
  } finally {
    knowledge.augmentBrainResult = originalAugment;
  }
});

test("buildRequestContext clears stale document data when document knowledge is disabled", () => {
  const result = pipeline.buildRequestContext("Question", {
    documentKnowledge: false,
    answerContext: "Sensitive prior document text",
    documentEvidence: [{ reference: "DOC-OLD" }],
    documentGrounding: { enabled: true },
    documentRag: { old: true },
    documentDocuments: { results: [{ title: "Old file" }] },
    brain: {
      knowledge: {
        keep: "yes",
        documentAnswerContext: "Sensitive prior document text",
        documentEvidence: [{ reference: "DOC-OLD" }]
      }
    }
  });

  assert.equal(result.context.answerContext, "");
  assert.deepEqual(result.context.documentEvidence, []);
  assert.equal(result.context.documentGrounding, null);
  assert.equal(result.context.documentRag, null);
  assert.equal(result.context.documentDocuments, null);
  assert.equal(result.context.brain.knowledge.keep, "yes");
  assert.equal(result.context.brain.knowledge.documentAnswerContext, "");
  assert.deepEqual(result.context.brain.knowledge.documentEvidence, []);
  assert.equal(result.context.documentKnowledgeEnabled, false);
});
