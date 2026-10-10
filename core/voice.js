/**
 * AarHen-AI Voice Engine foundation.
 *
 * Provider-agnostic speech-to-text and text-to-speech adapter.
 * No audio is stored or transmitted by this module; providers are injected by
 * the application. Provider credentials and transport belong in providerManager.
 */
"use strict";

class VoiceEngineError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "VoiceEngineError";
    this.code = code;
  }
}

class VoiceEngine {
  constructor({ speechToText = null, textToSpeech = null, defaultLanguage = "auto" } = {}) {
    this.speechToText = speechToText;
    this.textToSpeech = textToSpeech;
    this.defaultLanguage = defaultLanguage;
  }

  getStatus() {
    return {
      available: Boolean(this.speechToText || this.textToSpeech),
      speechToText: Boolean(this.speechToText),
      textToSpeech: Boolean(this.textToSpeech),
      defaultLanguage: this.defaultLanguage,
    };
  }

  async transcribe(audio, options = {}) {
    if (!this.speechToText || typeof this.speechToText.transcribe !== "function") {
      throw new VoiceEngineError("Speech-to-text provider is not configured.", "STT_UNAVAILABLE");
    }
    if (audio == null || (typeof audio === "string" && audio.trim() === "")) {
      throw new VoiceEngineError("Audio input is required.", "INVALID_AUDIO");
    }

    const result = await this.speechToText.transcribe(audio, {
      language: options.language || this.defaultLanguage,
      mimeType: options.mimeType || null,
    });

    const text = typeof result === "string" ? result : result && result.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new VoiceEngineError("Speech-to-text provider returned no transcript.", "EMPTY_TRANSCRIPT");
    }
    return {
      text: text.trim(),
      language: (result && typeof result === "object" && result.language) || options.language || this.defaultLanguage,
    };
  }

  async synthesize(text, options = {}) {
    if (!this.textToSpeech || typeof this.textToSpeech.synthesize !== "function") {
      throw new VoiceEngineError("Text-to-speech provider is not configured.", "TTS_UNAVAILABLE");
    }
    if (typeof text !== "string" || !text.trim()) {
      throw new VoiceEngineError("Text is required for speech synthesis.", "INVALID_TEXT");
    }

    return this.textToSpeech.synthesize(text.trim(), {
      language: options.language || this.defaultLanguage,
      voice: options.voice || null,
      format: options.format || null,
    });
  }
}

module.exports = { VoiceEngine, VoiceEngineError };
