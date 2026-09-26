"use strict";

const { detectLanguage, resolveLanguage, getLanguageInfo } = require("./language");

/**
 * Multilingual bridge for media features.
 * Resolves language hints consistently without coupling language detection to
 * a particular voice or vision provider. Providers remain responsible for
 * actual transcription, translation, and speech generation.
 */
function resolveMediaLanguage({ language, text, fallback = "english" } = {}) {
  const requested = String(language || "").trim().toLowerCase();
  if (requested === "auto" || !requested) {
    return text ? detectLanguage(text) : fallback;
  }
  return resolveLanguage(requested, text);
}

async function transcribeMultilingual(transcribe, audio, options = {}) {
  if (typeof transcribe !== "function") {
    throw new TypeError("transcribe must be a function.");
  }
  const requested = String(options.language || "auto").toLowerCase();
  const result = await transcribe(audio, {
    ...options,
    language: requested === "auto" ? "auto" : resolveMediaLanguage({ language: requested }),
  });
  if (!result || result.success === false) return result;

  const payload = result.result && typeof result.result === "object" ? result.result : result;
  const transcript = typeof payload.text === "string" ? payload.text : "";
  const detectedLanguage = transcript ? detectLanguage(transcript) : null;
  const providerLanguage = payload.language;
  const language = providerLanguage && providerLanguage !== "auto"
    ? resolveLanguage(providerLanguage, transcript)
    : detectedLanguage || "english";

  return {
    ...result,
    result: { ...payload, language, languageInfo: getLanguageInfo(language) },
  };
}

async function synthesizeMultilingual(synthesize, text, options = {}) {
  if (typeof synthesize !== "function") {
    throw new TypeError("synthesize must be a function.");
  }
  const language = resolveMediaLanguage({ language: options.language, text });
  const result = await synthesize(text, { ...options, language });
  if (result && result.success === false) return result;
  return { success: true, language, languageInfo: getLanguageInfo(language), result };
}

async function analyzeMultilingual(analyze, image, options = {}) {
  if (typeof analyze !== "function") {
    throw new TypeError("analyze must be a function.");
  }
  const language = resolveMediaLanguage({
    language: options.language,
    text: options.prompt,
  });
  const result = await analyze(image, { ...options, language });
  if (result && result.success === false) return result;
  return { success: true, language, languageInfo: getLanguageInfo(language), result };
}

module.exports = {
  resolveMediaLanguage,
  transcribeMultilingual,
  synthesizeMultilingual,
  analyzeMultilingual,
};
