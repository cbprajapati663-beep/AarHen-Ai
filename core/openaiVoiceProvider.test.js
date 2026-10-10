"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createOpenAIVoiceProvider } = require("./openaiVoiceProvider");

function jsonResponse(payload, ok = true, status = 200) {
  return { ok, status, async json() { return payload; } };
}

test("transcribes audio with configured model, language, and MIME type", async () => {
  let request;
  const provider = createOpenAIVoiceProvider({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1/",
    transcriptionModel: "test-stt",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ text: "  Kem cho?  " });
    },
  });

  const result = await provider.transcribe(Buffer.from("mock-audio"), {
    language: "gu",
    mimeType: "audio/wav",
  });

  assert.equal(request.url, "https://example.test/v1/audio/transcriptions");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(request.options.body.get("model"), "test-stt");
  assert.equal(request.options.body.get("language"), "gu");
  assert.equal(request.options.body.get("file").type, "audio/wav");
  assert.deepEqual(result, { text: "Kem cho?", language: "gu" });
});

test("omits automatic language from transcription request", async () => {
  let request;
  const provider = createOpenAIVoiceProvider({
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      request = options;
      return jsonResponse({ text: "Hello" });
    },
  });

  await provider.transcribe(Buffer.from("mock-audio"), { language: "auto" });
  assert.equal(request.body.has("language"), false);
});

test("returns synthesized audio as base64 with format metadata", async () => {
  let request;
  const bytes = new Uint8Array([1, 2, 3]);
  const provider = createOpenAIVoiceProvider({
    apiKey: "test-key",
    speechModel: "test-tts",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async arrayBuffer() { return bytes.buffer; },
      };
    },
  });

  const result = await provider.synthesize("Hello", {
    voice: "alloy",
    language: "en",
    format: "wav",
  });

  assert.equal(request.url, "https://api.openai.com/v1/audio/speech");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.model, "test-tts");
  assert.equal(payload.input, "Hello");
  assert.equal(payload.voice, "alloy");
  assert.equal(payload.response_format, "wav");
  assert.match(payload.instructions, /en/);
  assert.deepEqual(result, {
    audioBase64: Buffer.from(bytes).toString("base64"),
    mimeType: "audio/wav",
    format: "wav",
  });
});

test("reports transcription HTTP errors with a stable provider error code", async () => {
  const provider = createOpenAIVoiceProvider({
    apiKey: "test-key",
    fetchImpl: async () => jsonResponse({ error: { message: "Invalid audio" } }, false, 400),
  });

  await assert.rejects(
    () => provider.transcribe(Buffer.from("mock-audio")),
    (error) => error.code === "VOICE_PROVIDER_ERROR" && error.message === "Invalid audio",
  );
});

test("rejects an empty transcription result", async () => {
  const provider = createOpenAIVoiceProvider({
    apiKey: "test-key",
    fetchImpl: async () => jsonResponse({ text: "  " }),
  });

  await assert.rejects(
    () => provider.transcribe(Buffer.from("mock-audio")),
    (error) => error.code === "EMPTY_TRANSCRIPT",
  );
});

test("fails closed when the API key is missing without making a request", async () => {
  let called = false;
  const provider = createOpenAIVoiceProvider({
    apiKey: "",
    fetchImpl: async () => { called = true; return jsonResponse({}); },
  });

  await assert.rejects(
    () => provider.transcribe(Buffer.from("mock-audio")),
    (error) => error.code === "VOICE_UNAVAILABLE",
  );
  assert.equal(called, false);
});

const providerManager = require("../providers/providerManager");

test("Provider Manager registers voice capability without routing it to web search", async () => {
  const provider = providerManager.getProvider("voice");
  assert.ok(provider, "voice provider should be centrally registered");
  assert.equal(typeof provider.getProviderStatus, "function");
  assert.equal(typeof provider.transcribe, "function");
  assert.equal(typeof provider.synthesize, "function");

  const status = providerManager.getProviderHealth("voice");
  assert.equal(status.providerType, "speech");
  assert.equal(status.connected, Boolean(process.env.OPENAI_API_KEY));

  const availableProviders = providerManager.getAvailableProviders();
  assert.ok(
    availableProviders.every((entry) => typeof providerManager.getProvider(entry.provider)?.search === "function"),
    "search routing should only expose providers implementing search()"
  );

  const searchResult = await providerManager.searchWeb({
    query: "voice provider capability routing test",
    provider: "voice",
  });
  assert.equal(searchResult.success, false);
  assert.match(searchResult.error, /does not support web search/);
});
