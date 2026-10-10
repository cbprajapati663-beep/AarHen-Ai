"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveMediaLanguage,
  transcribeMultilingual,
  synthesizeMultilingual,
  analyzeMultilingual,
} = require("./multilingualMedia");

test("detects Hindi, Gujarati, Hinglish and English", () => {
  assert.equal(resolveMediaLanguage({ text: "नमस्ते आप कैसे हैं" }), "hindi");
  assert.equal(resolveMediaLanguage({ text: "નમસ્તે કેમ છો" }), "gujarati");
  assert.equal(resolveMediaLanguage({ text: "aap kaise ho mujhe batao" }), "hinglish");
  assert.equal(resolveMediaLanguage({ text: "Good morning" }), "english");
});

test("resolves language aliases and provider-compatible ISO codes", async () => {
  assert.equal(resolveMediaLanguage({ language: "gu", text: "Hello" }), "gujarati");
  assert.equal(resolveMediaLanguage({ language: "hi", text: "Hello" }), "hindi");
  assert.equal(resolveMediaLanguage({ language: "hi-en", text: "Hello" }), "hinglish");
  let passedLanguage;
  const result = await transcribeMultilingual(async (_audio, options) => {
    passedLanguage = options.language;
    return { success: true, result: { text: "નમસ્તે", language: options.language } };
  }, Buffer.from("audio"), { language: "gu" });
  assert.equal(passedLanguage, "gu");
  assert.equal(result.result.language, "gujarati");
  assert.deepEqual(result.result.languageInfo, { name: "Gujarati", code: "gu" });
});

test("detects language from automatic transcription and preserves response metadata", async () => {
  const response = await transcribeMultilingual(async (_audio, options) => {
    assert.equal(options.language, "auto");
    return { success: true, result: { text: "નમસ્તે કેમ છો", language: "auto" } };
  }, Buffer.from("audio"));
  assert.equal(response.result.language, "gujarati");
  assert.equal(response.result.languageInfo.code, "gu");
});

test("preserves transcription provider failures", async () => {
  const failure = { success: false, error: "offline", code: "STT_UNAVAILABLE" };
  assert.equal(await transcribeMultilingual(async () => failure, "audio"), failure);
});

test("passes detected language and unwraps synthesis payload", async () => {
  const response = await synthesizeMultilingual(async (_text, options) => {
    assert.equal(options.language, "hindi");
    return { success: true, result: { audioBase64: "YWJj" } };
  }, "नमस्ते");
  assert.equal(response.language, "hindi");
  assert.equal(response.languageInfo.code, "hi");
  assert.deepEqual(response.result, { audioBase64: "YWJj" });
});

test("preserves synthesis provider failures", async () => {
  const failure = { success: false, error: "offline", code: "TTS_UNAVAILABLE" };
  assert.equal(await synthesizeMultilingual(async () => failure, "hello"), failure);
});

test("passes prompt language and unwraps vision payload", async () => {
  const response = await analyzeMultilingual(async (_image, options) => {
    assert.equal(options.language, "gujarati");
    return { success: true, result: { description: "વાહન" } };
  }, Buffer.from("image"), { prompt: "આ તસવીરમાં શું છે?" });
  assert.equal(response.language, "gujarati");
  assert.equal(response.languageInfo.code, "gu");
  assert.deepEqual(response.result, { description: "વાહન" });
});

test("preserves vision provider failures and rejects missing adapters", async () => {
  const failure = { success: false, error: "offline", code: "VISION_UNAVAILABLE" };
  assert.equal(await analyzeMultilingual(async () => failure, "image"), failure);
  await assert.rejects(() => transcribeMultilingual(null, "audio"), /transcribe must be a function/);
  await assert.rejects(() => synthesizeMultilingual(null, "text"), /synthesize must be a function/);
  await assert.rejects(() => analyzeMultilingual(null, "image"), /analyze must be a function/);
});
