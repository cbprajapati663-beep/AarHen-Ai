"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  configureVoiceEngine,
  getVoiceStatus,
  transcribeAudio,
  synthesizeSpeech,
} = require("./voiceApi");

test("reports voice capabilities as unavailable before configuration", () => {
  configureVoiceEngine();
  assert.deepEqual(getVoiceStatus(), {
    available: false,
    speechToText: false,
    textToSpeech: false,
    defaultLanguage: "auto",
  });
});

test("transcription returns a stable unavailable response", async () => {
  configureVoiceEngine();
  const response = await transcribeAudio(Buffer.from("audio"));
  assert.equal(response.success, false);
  assert.equal(response.code, "STT_UNAVAILABLE");
});

test("transcription delegates to the configured provider", async () => {
  configureVoiceEngine({
    speechToText: { async transcribe(audio, options) {
      assert.equal(audio.toString(), "audio");
      assert.equal(options.language, "hi");
      return { text: "Namaste", language: "hi" };
    } },
  });
  assert.deepEqual(await transcribeAudio(Buffer.from("audio"), { language: "hi" }), {
    success: true,
    result: { text: "Namaste", language: "hi" },
  });
});

test("speech synthesis delegates to the configured provider", async () => {
  configureVoiceEngine({
    textToSpeech: { async synthesize(text, options) {
      return { text, language: options.language, audio: "mock-audio" };
    } },
  });
  assert.deepEqual(await synthesizeSpeech("Hello", { language: "en" }), {
    success: true,
    result: { text: "Hello", language: "en", audio: "mock-audio" },
  });
});

test("synthesis returns a stable unavailable response", async () => {
  configureVoiceEngine();
  const response = await synthesizeSpeech("Hello");
  assert.equal(response.success, false);
  assert.equal(response.code, "TTS_UNAVAILABLE");
});
