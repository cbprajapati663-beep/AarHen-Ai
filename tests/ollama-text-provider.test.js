const test = require("node:test");
const assert = require("node:assert/strict");
const { createOllamaTextProvider } = require("../providers/ollamaTextProvider");

const originalFetch = global.fetch;
const savedEnv = {};
for (const key of ["AARHEN_OLLAMA_ENABLED", "AARHEN_OLLAMA_MODEL", "AARHEN_OLLAMA_URL"]) savedEnv[key] = process.env[key];

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("Ollama provider sends chat request and returns generated text", async () => {
  process.env.AARHEN_OLLAMA_ENABLED = "true";
  process.env.AARHEN_OLLAMA_MODEL = "aarhen-local";
  let request;
  global.fetch = async (url, init) => {
    request = { url, body: JSON.parse(init.body) };
    return { ok: true, status: 200, json: async () => ({
      model: "aarhen-local", message: { content: "Namaste!" }, done: true, total_duration: 1200000
    }) };
  };
  const result = await createOllamaTextProvider().generateText({ prompt: "Hello", system: "You are AarHen" });
  assert.equal(result.success, true);
  assert.equal(result.text, "Namaste!");
  assert.equal(request.url, "http://127.0.0.1:11434/api/chat");
  assert.equal(request.body.model, "aarhen-local");
  assert.equal(request.body.messages[0].role, "system");
  assert.equal(request.body.messages[1].content, "Hello");
});

test("Ollama provider reports HTTP errors safely", async () => {
  process.env.AARHEN_OLLAMA_ENABLED = "true";
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: "model not found" }) });
  const result = await createOllamaTextProvider().generateText({ prompt: "Hello" });
  assert.equal(result.success, false);
  assert.match(result.error, /model not found/);
});

test("Ollama provider returns a useful connection error", async () => {
  process.env.AARHEN_OLLAMA_ENABLED = "true";
  global.fetch = async () => { throw new Error("connection refused"); };
  const result = await createOllamaTextProvider().generateText({ prompt: "Hello" });
  assert.equal(result.success, false);
  assert.equal(result.code, "OLLAMA_CONNECTION_FAILED");
});

test("Ollama provider remains disabled unless explicitly enabled", async () => {
  process.env.AARHEN_OLLAMA_ENABLED = "false";
  global.fetch = async () => { throw new Error("must not be called"); };
  const result = await createOllamaTextProvider().generateText({ prompt: "Hello" });
  assert.equal(result.success, false);
  assert.match(result.error, /disabled/i);
});
