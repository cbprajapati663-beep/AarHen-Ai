const test = require("node:test");
const assert = require("node:assert/strict");
const { createLocalReasoning } = require("./localReasoning");

test("local reasoning sends the request through the local provider and labels output advisory-only", async () => {
    let call;
    const result = await createLocalReasoning("Mujhe weekly study plan banao", {
        generateText: async args => {
            call = args;
            return { success: true, provider: "Ollama", model: "aarhen-local", text: "Create a seven-day plan." };
        }
    });

    assert.equal(call.provider, "localai");
    assert.match(call.prompt, /weekly study plan/);
    assert.equal(result.success, true);
    assert.equal(result.advisoryOnly, true);
    assert.equal(result.analysis, "Create a seven-day plan.");
});

test("local reasoning rejects empty requests without calling the provider", async () => {
    let called = false;
    const result = await createLocalReasoning(" ", {
        generateText: async () => { called = true; return { success: true, text: "unexpected" }; }
    });

    assert.equal(called, false);
    assert.equal(result.success, false);
    assert.equal(result.status, "invalid-input");
});

test("provider failure is reported without inventing analysis", async () => {
    const result = await createLocalReasoning("Explain this", {
        generateText: async () => ({ success: false, error: "Ollama offline" })
    });

    assert.equal(result.success, false);
    assert.equal(result.status, "provider-unavailable");
    assert.equal(result.error, "Ollama offline");
});
