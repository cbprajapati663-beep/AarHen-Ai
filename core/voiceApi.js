"use strict";

const { VoiceEngine, VoiceEngineError } = require("./voice");
const { createOpenAIVoiceProvider } = require("./openaiVoiceProvider");

const openAIProvider = process.env.OPENAI_API_KEY ? createOpenAIVoiceProvider() : null;
let engine = new VoiceEngine(openAIProvider ? { speechToText: openAIProvider, textToSpeech: openAIProvider } : {});

function configureVoiceEngine(options = {}) {
  engine = new VoiceEngine(options);
  return engine.getStatus();
}

function getVoiceStatus() {
  return engine.getStatus();
}

async function transcribeAudio(audio, options = {}) {
  try {
    return { success: true, result: await engine.transcribe(audio, options) };
  } catch (error) {
    return normalizeError(error);
  }
}

async function synthesizeSpeech(text, options = {}) {
  try {
    return { success: true, result: await engine.synthesize(text, options) };
  } catch (error) {
    return normalizeError(error);
  }
}

function normalizeError(error) {
  if (error instanceof VoiceEngineError) {
    return { success: false, error: error.message, code: error.code };
  }
  return { success: false, error: "Voice processing failed.", code: "VOICE_ERROR" };
}

module.exports = {
  configureVoiceEngine,
  getVoiceStatus,
  transcribeAudio,
  synthesizeSpeech,
};
