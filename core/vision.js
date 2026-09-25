"use strict";

/**
 * AarHen-AI Vision Engine foundation.
 * Provider-agnostic image analysis adapter. The application injects an analyzer;
 * this module does not fetch remote URLs, persist images, or embed credentials.
 */
class VisionEngineError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "VisionEngineError";
    this.code = code;
  }
}

class VisionEngine {
  constructor({ analyzer = null, defaultLanguage = "auto" } = {}) {
    this.analyzer = analyzer;
    this.defaultLanguage = defaultLanguage;
  }

  getStatus() {
    return {
      available: Boolean(this.analyzer && typeof this.analyzer.analyze === "function"),
      defaultLanguage: this.defaultLanguage,
    };
  }

  async analyze(image, options = {}) {
    if (!this.analyzer || typeof this.analyzer.analyze !== "function") {
      throw new VisionEngineError("Image analysis provider is not configured.", "VISION_UNAVAILABLE");
    }
    const isBytes = Buffer.isBuffer(image) || image instanceof Uint8Array;
    const isDataUrl = typeof image === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image);
    if (!isBytes && !isDataUrl) {
      throw new VisionEngineError("Image must be a Buffer, Uint8Array, or base64 image data URL.", "INVALID_IMAGE");
    }
    if (isBytes && image.byteLength === 0) {
      throw new VisionEngineError("Image input is empty.", "INVALID_IMAGE");
    }
    if (isDataUrl && image.split(",")[1].trim() === "") {
      throw new VisionEngineError("Image data URL is empty.", "INVALID_IMAGE");
    }

    const result = await this.analyzer.analyze(image, {
      prompt: typeof options.prompt === "string" ? options.prompt : null,
      language: options.language || this.defaultLanguage,
      detail: options.detail || "auto",
    });
    if (typeof result === "string" && result.trim()) {
      return { description: result.trim(), language: options.language || this.defaultLanguage };
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new VisionEngineError("Vision provider returned an invalid result.", "INVALID_RESULT");
    }
    return result;
  }
}

module.exports = { VisionEngine, VisionEngineError };
