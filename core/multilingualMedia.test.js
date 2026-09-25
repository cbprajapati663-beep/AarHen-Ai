"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveMediaLanguage,
  transcribeMultilingual,
  synthesizeMultilingual,
  analyzeMultilingual,
} = require("./multilingualMedia");

test("resolveMediaLanguage detects Hindi, Gujarati, Hinglish and defaults to English", () => {
  assert.equal(resolveMediaLanguage({ text: "नमस्ते आप कैसे हैं" }), "hindi");
  assert.equal(resolveMediaLanguage({ text: "નમસ્તે કેમ છો" }), "gujarati");
  assert.equal(resolveMediaLanguage({ text: "aap kaise ho mujhe batao" }), "hinglish");
  assert.equal(resolveMediaLanguage({ text: "Good morning" }), "english");
});

test("resolveMediaLanguage honors supported explicit language aliases", () => {
  assert.equal(resolveMediaLanguage({ language: "gujarati", text: "Hello" }), "gujarati");
  assert.equal(resolveMediaLanguage({ language: "gu", text: "Hello" }), "gujarati");
  assert.equal(resolveMediaLanguage({ language: "hi", text: "Hello" }), "hindi");
});

test("transcribeMultilingual detects language from returned transcript", async () => {
  const result = await transcribeMultilingual(async (_audio, options) => {
    assert.equal(options.language, "auto");
    return { success: true, result: { text: "નમસ્તે કેમ છો", language: "auto" } };
  }, Buffer.from("audio"));
  assert.equal(result.result.language, "gujarati");
  assert.equal(result.result.languageInfo.code, "gu");
});

test("transcribeMultilingual preserves provider errors", async () => {
  const failure = { success: false, error: "offline", code: "STT_UNAVAILABLE" };
  assert.equal(await transcribeMultilingual(async () => failure, "audio"), failure);
});

test("synthesizeMultilingual passes detected language to provider", async () => {
  const result = await synthesizeMultilingual(async (_text, options) => {
    assert.equal(options.language, "hindi");
    return { audioBase64: "YWJj" };
  }, "नमस्ते");
  assert.equal(result.language, "hindi");
  assert.equal(result.result.audioBase64, "YWJj");
});

test("synthesizeMultilingual preserves provider failures", async () => {
  const failure = { success: false, error: "offline", code: "TTS_UNAVAILABLE" };
  assert.equal(await synthesizeMultilingual(async () => failure, "hello"), failure);
});

test("analyzeMultilingual passes prompt language to provider", async () => {
  const result = await analyzeMultilingual(async (_image, options) => {
    assert.equal(options.language, "gujarati");
    return { description: "વાહન" };
  }, Buffer.from("image"), { prompt: "આ તસવીરમાં શું છે?" });
  assert.equal(result.language, "gujarati");
  assert.equal(result.result.description, "વાહન");
});

test("analyzeMultilingual preserves provider failures", async () => {
  const failure = { success: false, error: "offline", code: "VISION_UNAVAILABLE" };
  assert.equal(await analyzeMultilingual(async () => failure, "image"), failure);
});

test("helpers reject missing adapters", async () => {
  await assert.rejects(() => transcribeMultilingual(null, "audio"), /transcribe must be a function/);
  await assert.rejects(() => synthesizeMultilingual(null, "text"), /synthesize must be a function/);
  await assert.rejects(() => analyzeMultilingual(null, "image"), /analyze must be a function/);
});
