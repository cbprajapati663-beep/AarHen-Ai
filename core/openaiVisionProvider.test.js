"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createOpenAIVisionProvider } = require("./openaiVisionProvider");
const providerManager = require("../providers/providerManager");

function jsonResponse(payload, ok = true, status = 200) {
  return { ok, status, async json() { return payload; } };
}

test("sends image bytes and prompt through configured vision model", async () => {
  let request;
  const provider = createOpenAIVisionProvider({
    apiKey: "test-key",
    model: "test-vision-model",
    baseUrl: "https://example.test/v1/",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ choices: [{ message: { content: "  A red car  " } }] });
    },
  });

  const result = await provider.analyze(Buffer.from([1, 2, 3]), {
    prompt: "Describe this",
    language: "gu",
    mimeType: "image/png",
    detail: "high",
  });

  assert.equal(request.url, "https://example.test/v1/chat/completions");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.model, "test-vision-model");
  assert.match(payload.messages[0].content[0].text, /Respond in gu/);
  assert.match(payload.messages[0].content[0].text, /Describe this/);
  assert.equal(payload.messages[0].content[1].image_url.detail, "high");
  assert.equal(payload.messages[0].content[1].image_url.url, "data:image/png;base64,AQID");
  assert.deepEqual(result, { description: "A red car", language: "gu" });
});

test("returns a stable error for failed vision provider responses", async () => {
  const provider = createOpenAIVisionProvider({
    apiKey: "test-key",
    fetchImpl: async () => jsonResponse({ error: { message: "Invalid image" } }, false, 400),
  });
  await assert.rejects(
    () => provider.analyze(Buffer.from([1])),
    (error) => error.code === "VISION_PROVIDER_ERROR" && error.message === "Invalid image",
  );
});

test("rejects empty vision responses", async () => {
  const provider = createOpenAIVisionProvider({
    apiKey: "test-key",
    fetchImpl: async () => jsonResponse({ choices: [{ message: { content: " " } }] }),
  });
  await assert.rejects(
    () => provider.analyze(Buffer.from([1])),
    (error) => error.code === "EMPTY_VISION_RESPONSE",
  );
});

test("fails closed without API key and never calls fetch", async () => {
  let called = false;
  const provider = createOpenAIVisionProvider({
    apiKey: "",
    fetchImpl: async () => { called = true; return jsonResponse({}); },
  });
  await assert.rejects(
    () => provider.analyze(Buffer.from([1])),
    (error) => error.code === "VISION_UNAVAILABLE",
  );
  assert.equal(called, false);
});

test("Provider Manager centrally registers vision but excludes it from web search", async () => {
  const provider = providerManager.getProvider("vision");
  assert.ok(provider, "vision provider should be registered");
  assert.equal(typeof provider.getProviderStatus, "function");
  assert.equal(typeof provider.analyze, "function");

  const health = providerManager.getProviderHealth("vision");
  assert.equal(health.providerType, "vision");
  assert.equal(health.connected, Boolean(process.env.OPENAI_API_KEY));

  assert.ok(providerManager.getAvailableProviders().every(
    (entry) => typeof providerManager.getProvider(entry.provider)?.search === "function"
  ));

  const result = await providerManager.searchWeb({
    query: "vision capability routing test",
    provider: "vision",
  });
  assert.equal(result.success, false);
  assert.match(result.error, /does not support web search/);
});
