const test = require("node:test");
const assert = require("node:assert/strict");
const knowledgeContext = require("../core/knowledgeContext");
const documentContext = require("../core/documentContext");

test("buildAnswerContext combines memory, document knowledge, and RAG evidence", () => {
  const originalBuild = documentContext.buildDocumentContext;
  documentContext.buildDocumentContext = () => ({
    success: true,
    documents: [{ title: "Policy.pdf", content: "Eligibility rules" }],
    knowledge: [{ title: "Loan policy", content: "Income proof required" }],
    context: "Relevant excerpt from the uploaded policy.",
    count: 1,
    documentCount: 1
  });

  try {
    const result = knowledgeContext.buildAnswerContext("What documents are required?", {
      memory: {
        related: [{ content: "Customer prefers Gujarati" }],
        verified: [{ content: "Business operates in Gujarat" }]
      },
      knowledge: {
        related: [{ content: "Vehicle finance service" }],
        verified: [{ content: "Finance applications require verification" }]
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.hasContext, true);
    assert.match(result.context, /MEMORY:[\s\S]*Customer prefers Gujarati/);
    assert.match(result.context, /VERIFIED MEMORY:[\s\S]*Business operates in Gujarat/);
    assert.match(result.context, /KNOWLEDGE:[\s\S]*Vehicle finance service/);
    assert.match(result.context, /VERIFIED KNOWLEDGE:[\s\S]*Finance applications require verification/);
    assert.match(result.context, /DOCUMENT KNOWLEDGE:[\s\S]*Eligibility rules/);
    assert.match(result.context, /DOCUMENT RAG CONTEXT:[\s\S]*Relevant excerpt from the uploaded policy/);
    assert.equal(result.unified.documents.count, 1);
    assert.equal(result.unified.rag.available, true);
  } finally {
    documentContext.buildDocumentContext = originalBuild;
  }
});

test("buildAnswerContext reports empty context when no knowledge is available", () => {
  const originalBuild = documentContext.buildDocumentContext;
  documentContext.buildDocumentContext = () => ({
    success: true,
    documents: [],
    knowledge: [],
    context: "",
    count: 0,
    documentCount: 0
  });

  try {
    const result = knowledgeContext.buildAnswerContext("A question", {});
    assert.equal(result.success, true);
    assert.equal(result.hasContext, false);
    assert.equal(result.context, "");
    assert.equal(result.unified.availability.anyKnowledge, false);
  } finally {
    documentContext.buildDocumentContext = originalBuild;
  }
});
