"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const learningApi = require("./learningApi");
const documentLearningApi = require("./documentLearningApi");

test("document adapter sends extracted text to Learning API as unverified", async () => {
  const original = learningApi.learnFromUser;
  let captured;
  learningApi.learnFromUser = async (content, options) => {
    captured = { content, options };
    return { success: true, learned: true, status: "learned-and-stored" };
  };
  try {
    const result = await documentLearningApi.learnDocument({
      buffer: Buffer.from("Vehicle finance eligibility guide."),
      fileName: "guide.txt",
      title: "Eligibility Guide",
      source: "uploaded-document",
    });
    assert.equal(result.success, true);
    assert.equal(result.learned, true);
    assert.equal(captured.content, "Vehicle finance eligibility guide.");
    assert.equal(captured.options.title, "Eligibility Guide");
    assert.equal(captured.options.source, "uploaded-document");
    assert.equal(captured.options.verified, false);
  } finally {
    learningApi.learnFromUser = original;
  }
});

test("document status exposes the Learning API adapter", () => {
  const status = documentLearningApi.getDocumentLearningStatus();
  assert.equal(status.success, true);
  assert.equal(status.integration, "learning-api-adapter");
  assert.equal(status.connected, true);
});
