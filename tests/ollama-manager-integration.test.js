const test = require("node:test");
const assert = require("node:assert/strict");

const oldEnabled = process.env.AARHEN_OLLAMA_ENABLED;
const oldModel = process.env.AARHEN_OLLAMA_MODEL;
const oldFetch = global.fetch;
process.env.AARHEN_OLLAMA_ENABLED = "true";
process.env.AARHEN_OLLAMA_MODEL = "aarhen-local";

const manager = require("../providers/providerManager");

test.after(() => {
  manager.reset();
  global.fetch = oldFetch;
  if (oldEnabled === undefined) delete process.env.AARHEN_OLLAMA_ENABLED;
  else process.env.AARHEN_OLLAMA_ENABLED = oldEnabled;
  if (oldModel === undefined) delete process.env.AARHEN_OLLAMA_MODEL;
  else process.env.AARHEN_OLLAMA_MODEL = oldModel;
});

test("Provider Manager routes text generation to local Ollama without cloud fallback", async () => {
  let called = false;
  global.fetch = async (url, init) => {
    called = true;
    assert.equal(url, "http://127.0.0.1:11434/api/chat");
    return {
      ok: true,
      status: 200,
      json: async () => ({ model: "aarhen-local", message: { content: "AarHen ready." }, done: true })
    };
  };

  const result = await manager.generateText({
    prompt: "Introduce yourself",
    system: "You are AarHen.",
    provider: "localAI"
  });

  assert.equal(called, true);
  assert.equal(result.success, true);
  assert.equal(result.text, "AarHen ready.");
  assert.equal(result.provider, "Ollama");
  assert.equal(result.providerType, "text-generation");
});

test("Provider Manager rejects empty text prompts", async () => {
  const result = await manager.generateText({ prompt: "   ", provider: "localAI" });
  assert.equal(result.success, false);
  assert.match(result.error, /prompt is required/i);
});
