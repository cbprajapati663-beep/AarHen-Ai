"use strict";

const { detectLanguage, resolveLanguage, getLanguageInfo } = require("./language");

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

  const requested = String(options.language || "auto").trim().toLowerCase();
  const resolved = requested === "auto"
    ? "auto"
    : resolveMediaLanguage({ language: requested });
  const providerLanguage = resolved === "auto" ? "auto" : getLanguageInfo(resolved).code;
  const response = await transcribe(audio, { ...options, language: providerLanguage });
  if (!response || response.success === false) return response;

  const payload = response.result && typeof response.result === "object"
    ? response.result
    : response;
  const transcript = typeof payload.text === "string" ? payload.text : "";
  const detectedLanguage = transcript ? detectLanguage(transcript) : null;
  const reportedLanguage = payload.language;
  const language = reportedLanguage && reportedLanguage !== "auto"
    ? resolveLanguage(reportedLanguage, transcript)
    : detectedLanguage || (resolved === "auto" ? "english" : resolved);

  return {
    ...response,
    result: { ...payload, language, languageInfo: getLanguageInfo(language) },
  };
}

async function synthesizeMultilingual(synthesize, text, options = {}) {
  if (typeof synthesize !== "function") {
    throw new TypeError("synthesize must be a function.");
  }
  const language = resolveMediaLanguage({ language: options.language, text });
  const response = await synthesize(text, { ...options, language });
  if (response && response.success === false) return response;
  const payload = response && response.success === true &&
    Object.prototype.hasOwnProperty.call(response, "result")
    ? response.result
    : response;
  return { success: true, language, languageInfo: getLanguageInfo(language), result: payload };
}

async function analyzeMultilingual(analyze, image, options = {}) {
  if (typeof analyze !== "function") {
    throw new TypeError("analyze must be a function.");
  }
  const language = resolveMediaLanguage({
    language: options.language,
    text: options.prompt,
  });
  const response = await analyze(image, { ...options, language });
  if (response && response.success === false) return response;
  const payload = response && response.success === true &&
    Object.prototype.hasOwnProperty.call(response, "result")
    ? response.result
    : response;
  return { success: true, language, languageInfo: getLanguageInfo(language), result: payload };
}

module.exports = {
  resolveMediaLanguage,
  transcribeMultilingual,
  synthesizeMultilingual,
  analyzeMultilingual,
};
