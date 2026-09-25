"use strict";

const assert = require("node:assert/strict");
const language = require("../core/language");

assert.equal(language.detectLanguage("નમસ્તે, કેમ છો?"), "gujarati");
assert.equal(language.detectLanguage("नमस्ते, आप कैसे हैं?"), "hindi");
assert.equal(language.detectLanguage("Hello, how are you today?"), "english");
assert.equal(language.detectLanguage("Mujhe batao kya karna hai"), "hinglish");

// A Hinglish marker embedded inside an English word must not count.
assert.equal(language.detectLanguage("Thailand has beautiful beaches"), "english");
assert.equal(language.detectLanguage("This is a chair"), "english");

// Detection should tolerate casing, punctuation, and repeated whitespace.
assert.equal(language.detectLanguage("  MUJHE,   BATAO! "), "hinglish");
assert.equal(language.resolveLanguage(" GUJARATI ", "Hello"), "gujarati");
assert.equal(language.resolveLanguage("unknown", "नमस्ते"), "hindi");
assert.equal(language.getLanguageInfo("unknown").code, "en");
assert.equal(language.detectLanguage(""), "english");

console.log("Multilingual language engine tests passed.");
