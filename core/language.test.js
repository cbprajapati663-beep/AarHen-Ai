"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LANGUAGES,
  LANGUAGE_ALIASES,
  detectLanguage,
  resolveLanguage,
  getLanguageInfo,
} = require("./language");

test("detectLanguage identifies Gujarati and Devanagari text", () => {
  assert.equal(detectLanguage("નમસ્તે કેમ છો"), "gujarati");
  assert.equal(detectLanguage("नमस्ते आप कैसे हैं"), "hindi");
});

test("detectLanguage identifies Hinglish and defaults to English", () => {
  assert.equal(detectLanguage("aap kaise ho mujhe batao"), "hinglish");
  assert.equal(detectLanguage("Good morning, how are you?"), "english");
  assert.equal(detectLanguage(""), "english");
});

test("resolveLanguage accepts canonical names and language-code aliases", () => {
  assert.equal(resolveLanguage("hindi"), "hindi");
  assert.equal(resolveLanguage("HI"), "hindi");
  assert.equal(resolveLanguage("en"), "english");
  assert.equal(resolveLanguage("gu"), "gujarati");
  assert.equal(resolveLanguage("hi-en"), "hinglish");
});

test("resolveLanguage detects language for unknown hints", () => {
  assert.equal(resolveLanguage("unsupported", "નમસ્તે"), "gujarati");
});

test("getLanguageInfo resolves aliases and safely falls back to English", () => {
  assert.deepEqual(getLanguageInfo("gu"), LANGUAGES.gujarati);
  assert.deepEqual(getLanguageInfo("hi-en"), LANGUAGES.hinglish);
  assert.deepEqual(getLanguageInfo("unknown"), LANGUAGES.english);
});

test("language aliases map to canonical language names", () => {
  assert.equal(LANGUAGE_ALIASES.hi, "hindi");
  assert.equal(LANGUAGE_ALIASES.en, "english");
  assert.equal(LANGUAGE_ALIASES.gu, "gujarati");
});
