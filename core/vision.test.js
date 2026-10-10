"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { VisionEngine, VisionEngineError } = require("./vision");

test("reports unavailable when no analyzer is configured", () => {
  assert.deepEqual(new VisionEngine().getStatus(), { available: false, defaultLanguage: "auto" });
});

test("passes image and options to injected analyzer", async () => {
  const bytes = Buffer.from("mock-image");
  const engine = new VisionEngine({
    analyzer: { async analyze(image, options) {
      assert.equal(image, bytes);
      assert.equal(options.prompt, "Read the sign");
      assert.equal(options.language, "gu");
      return { description: "નમસ્તે", labels: ["text"] };
    } },
  });
  assert.deepEqual(await engine.analyze(bytes, { prompt: "Read the sign", language: "gu" }), {
    description: "નમસ્તે", labels: ["text"],
  });
});

test("normalizes string provider output", async () => {
  const engine = new VisionEngine({ analyzer: { async analyze() { return "  A red car  "; } } });
  assert.deepEqual(await engine.analyze(new Uint8Array([1, 2])), {
    description: "A red car", language: "auto",
  });
});

test("rejects invalid image input", async () => {
  await assert.rejects(
    () => new VisionEngine({ analyzer: { analyze: async () => ({}) } }).analyze("https://example.com/image.jpg"),
    (error) => error instanceof VisionEngineError && error.code === "INVALID_IMAGE",
  );
});

test("rejects malformed provider output", async () => {
  await assert.rejects(
    () => new VisionEngine({ analyzer: { analyze: async () => null } }).analyze(Buffer.from([1])),
    (error) => error instanceof VisionEngineError && error.code === "INVALID_RESULT",
  );
});
