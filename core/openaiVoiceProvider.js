"use strict";

/**
 * OpenAI-compatible speech-to-text and text-to-speech provider.
 * Audio is sent to the configured provider for processing and is not persisted here.
 */
function createOpenAIVoiceProvider({
  apiKey = process.env.OPENAI_API_KEY,
  baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  transcriptionModel = process.env.OPENAI_STT_MODEL || "whisper-1",
  speechModel = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
  fetchImpl = globalThis.fetch,
} = {}) {
  function endpoint(path) {
    return `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}${path}`;
  }

  function requireConfig() {
    if (!apiKey) {
      const error = new Error("OPENAI_API_KEY is not configured.");
      error.code = "VOICE_UNAVAILABLE";
      throw error;
    }
    if (typeof fetchImpl !== "function") {
      throw new Error("This Node.js runtime does not provide fetch().");
    }
  }

  return {
    async transcribe(audio, options = {}) {
      requireConfig();
      const bytes = Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
      const mimeType = options.mimeType || "audio/mpeg";
      const extByMime = {
        "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a",
        "audio/m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav",
        "audio/webm": "webm", "audio/ogg": "ogg", "audio/flac": "flac",
      };
      const ext = extByMime[mimeType] || "bin";
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: mimeType }), `audio.${ext}`);
      form.append("model", transcriptionModel);
      if (options.language && options.language !== "auto") form.append("language", options.language);
      const response = await fetchImpl(endpoint("/audio/transcriptions"), {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error && payload.error.message || `Speech transcription HTTP ${response.status}`);
        error.code = "VOICE_PROVIDER_ERROR";
        throw error;
      }
      if (typeof payload.text !== "string" || !payload.text.trim()) {
        const error = new Error("Speech provider returned an empty transcript.");
        error.code = "EMPTY_TRANSCRIPT";
        throw error;
      }
      return { text: payload.text.trim(), language: options.language || "auto" };
    },

    async synthesize(text, options = {}) {
      requireConfig();
      const format = options.format || "mp3";
      const response = await fetchImpl(endpoint("/audio/speech"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: speechModel,
          voice: options.voice || "alloy",
          input: text,
          response_format: format,
          ...(options.language && options.language !== "auto"
            ? { instructions: `Speak naturally in ${options.language}.` }
            : {}),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload.error && payload.error.message || `Speech synthesis HTTP ${response.status}`);
        error.code = "VOICE_PROVIDER_ERROR";
        throw error;
      }
      const audioBytes = Buffer.from(await response.arrayBuffer());
      return {
        audioBase64: audioBytes.toString("base64"),
        mimeType: format === "wav" ? "audio/wav" : format === "opus" ? "audio/opus" : "audio/mpeg",
        format,
      };
    },
  };
}

module.exports = { createOpenAIVoiceProvider };
