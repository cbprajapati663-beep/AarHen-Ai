"use strict";

const { VoiceEngine, VoiceEngineError } = require("./voice");
const providerManager = require("../providers/providerManager");

function createManagedEngine() {
  const provider = providerManager.isProviderAvailable("voice")
    ? providerManager.getProvider("voice")
    : null;
  return new VoiceEngine(provider
    ? { speechToText: provider, textToSpeech: provider }
    : {});
}

let engine = null;

function configureVoiceEngine(options = {}) {
  engine = new VoiceEngine(options);
  return engine.getStatus();
}

function getVoiceStatus() {
  return (engine || createManagedEngine()).getStatus();
}

async function transcribeAudio(audio, options = {}) {
  try {
    return { success: true, result: await (engine || createManagedEngine()).transcribe(audio, options) };
  } catch (error) {
    return normalizeError(error);
  }
}

async function synthesizeSpeech(text, options = {}) {
  try {
    return { success: true, result: await (engine || createManagedEngine()).synthesize(text, options) };
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
