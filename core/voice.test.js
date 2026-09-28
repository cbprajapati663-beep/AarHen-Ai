"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { VoiceEngine, VoiceEngineError } = require("./voice");

test("reports disabled providers without throwing", () => {
  const engine = new VoiceEngine();
  assert.deepEqual(engine.getStatus(), {
    available: false,
    speechToText: false,
    textToSpeech: false,
    defaultLanguage: "auto",
  });
});

test("transcribes through an injected provider", async () => {
  const engine = new VoiceEngine({
    speechToText: { async transcribe(_audio, options) {
      assert.equal(options.language, "gu");
      return { text: "  Kem cho?  ", language: "gu" };
    } },
  });
  assert.deepEqual(await engine.transcribe(Buffer.from("audio"), { language: "gu" }), {
    text: "Kem cho?",
    language: "gu",
  });
});

test("rejects missing speech-to-text provider with a stable code", async () => {
  await assert.rejects(
    () => new VoiceEngine().transcribe(Buffer.from("audio")),
    (error) => error instanceof VoiceEngineError && error.code === "STT_UNAVAILABLE",
  );
});

test("synthesizes through an injected provider", async () => {
  const engine = new VoiceEngine({
    textToSpeech: { async synthesize(text, options) {
      return { text, language: options.language, audio: Buffer.from("mock") };
    } },
  });
  const result = await engine.synthesize("  Hello  ", { language: "en" });
  assert.equal(result.text, "Hello");
  assert.equal(result.language, "en");
  assert.equal(result.audio.toString(), "mock");
});

test("rejects blank synthesis text", async () => {
  await assert.rejects(
    () => new VoiceEngine({ textToSpeech: { synthesize: async () => "unused" } }).synthesize("  "),
    (error) => error instanceof VoiceEngineError && error.code === "INVALID_TEXT",
  );
});
