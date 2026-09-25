"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  configureVisionEngine,
  getVisionStatus,
  analyzeImage,
} = require("./visionApi");

test("starts with vision unavailable until a provider is configured", () => {
  configureVisionEngine();
  assert.deepEqual(getVisionStatus(), {
    available: false,
    defaultLanguage: "auto",
  });
});

test("returns a stable unavailable response without a provider", async () => {
  configureVisionEngine();
  const response = await analyzeImage(Buffer.from([1]));
  assert.equal(response.success, false);
  assert.equal(response.code, "VISION_UNAVAILABLE");
});

test("uses the configured analyzer and returns its result", async () => {
  configureVisionEngine({
    analyzer: {
      async analyze(image, options) {
        assert.deepEqual([...image], [1, 2, 3]);
        assert.equal(options.prompt, "Describe it");
        return { description: "A vehicle" };
      },
    },
  });
  assert.deepEqual(await analyzeImage(Buffer.from([1, 2, 3]), {
    prompt: "Describe it",
  }), {
    success: true,
    result: { description: "A vehicle" },
  });
});

test("returns validation errors in a stable response shape", async () => {
  configureVisionEngine({ analyzer: { analyze: async () => ({}) } });
  const response = await analyzeImage("https://example.com/image.png");
  assert.equal(response.success, false);
  assert.equal(response.code, "INVALID_IMAGE");
});
