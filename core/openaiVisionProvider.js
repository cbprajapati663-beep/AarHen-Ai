"use strict";

function createOpenAIVisionProvider({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
  baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    async analyze(image, options = {}) {
      if (!apiKey) {
        const error = new Error("OPENAI_API_KEY is not configured.");
        error.code = "VISION_UNAVAILABLE";
        throw error;
      }
      if (typeof fetchImpl !== "function") throw new Error("This Node.js runtime does not provide fetch().");
      const bytes = Buffer.isBuffer(image) ? image : Buffer.from(image);
      const mimeType = options.mimeType || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
      const language = options.language && options.language !== "auto" ? `Respond in ${options.language}. ` : "";
      const prompt = options.prompt || "Describe the image accurately.";
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: [
          { type: "text", text: language + prompt },
          { type: "image_url", image_url: { url: dataUrl, detail: options.detail || "auto" } },
        ] }] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error && payload.error.message || `Vision provider HTTP ${response.status}`);
        error.code = "VISION_PROVIDER_ERROR";
        throw error;
      }
      const description = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
      if (typeof description !== "string" || !description.trim()) {
        const error = new Error("Vision provider returned an empty response.");
        error.code = "EMPTY_VISION_RESPONSE";
        throw error;
      }
      return { description: description.trim(), language: options.language || "auto" };
    },
  };
}

module.exports = { createOpenAIVisionProvider };
