"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    LANGUAGES,
    detectLanguage,
    resolveLanguage,
    getLanguageInfo
} = require("./language");

test("declares the supported language identifiers", () => {
    assert.deepEqual(Object.keys(LANGUAGES), [
        "hindi", "english", "gujarati", "hinglish"
    ]);
});

test("detects Gujarati script", () => {
    assert.equal(detectLanguage("મને મદદ કરો"), "gujarati");
});

test("detects Hindi Devanagari script", () => {
    assert.equal(detectLanguage("मुझे मदद चाहिए"), "hindi");
});

test("detects common Hinglish phrases", () => {
    assert.equal(detectLanguage("mujhe batao kya karna hai"), "hinglish");
});

test("defaults ordinary Latin text to English", () => {
    assert.equal(detectLanguage("Please explain this feature"), "english");
});

test("handles null and empty input safely", () => {
    assert.equal(detectLanguage(null), "english");
    assert.equal(detectLanguage(""), "english");
});

test("explicit supported language takes precedence over detection", () => {
    assert.equal(resolveLanguage("gujarati", "Hello"), "gujarati");
});

test("unsupported requested language falls back to text detection", () => {
    assert.equal(resolveLanguage("fr", "મને મદદ કરો"), "gujarati");
});

test("language info returns configured metadata and English fallback", () => {
    assert.deepEqual(getLanguageInfo("hindi"), { name: "Hindi", code: "hi" });
    assert.deepEqual(getLanguageInfo("unknown"), { name: "English", code: "en" });
});
