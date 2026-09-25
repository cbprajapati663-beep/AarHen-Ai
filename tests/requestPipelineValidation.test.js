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
