const test = require("node:test");
const assert = require("node:assert/strict");

const learningApi = require("./learningApi");

test("searchLearnedKnowledge returns a stable object with a results array", async () => {
    const result = await learningApi.searchLearnedKnowledge(
        "AarHen learning API regression",
        5
    );

    assert.equal(result.success, true);
    assert.equal(result.query, "AarHen learning API regression");
    assert.ok(Number.isFinite(result.count));
    assert.ok(Array.isArray(result.results));
    assert.equal(result.count, result.results.length);
});

test("searchLearnedKnowledge preserves validation failures", async () => {
    const result = await learningApi.searchLearnedKnowledge("   ", 5);

    assert.equal(result.success, false);
    assert.ok(Array.isArray(result.results));
});

test("getLearnedKnowledge exposes results and retains the legacy knowledge field", async () => {
    const result = await learningApi.getLearnedKnowledge(5);

    assert.equal(result.success, true);
    assert.ok(Number.isFinite(result.count));
    assert.ok(Array.isArray(result.results));
    assert.equal(result.count, result.results.length);
    assert.ok(Object.prototype.hasOwnProperty.call(result, "knowledge"));
});
