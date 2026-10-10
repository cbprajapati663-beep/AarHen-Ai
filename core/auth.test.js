const test = require("node:test");
const assert = require("node:assert/strict");

const auth = require("./auth");

function withApiKey(value, callback) {
    const previous = process.env.AARHEN_API_KEY;
    if (value === undefined) {
        delete process.env.AARHEN_API_KEY;
    } else {
        process.env.AARHEN_API_KEY = value;
    }

    try {
        callback();
    } finally {
        if (previous === undefined) {
            delete process.env.AARHEN_API_KEY;
        } else {
            process.env.AARHEN_API_KEY = previous;
        }
    }
}

test("unconfigured authentication never claims the caller is authenticated", () => {
    withApiKey(undefined, () => {
        const result = auth.verifyApiKey("anything");
        assert.equal(result.success, true);
        assert.equal(result.authenticated, false);
        assert.equal(result.mode, "development");
    });
});

test("configured API key accepts the exact key", () => {
    withApiKey("test-secret-key", () => {
        const result = auth.verifyApiKey("test-secret-key");
        assert.equal(result.success, true);
        assert.equal(result.authenticated, true);
        assert.equal(result.mode, "protected");
    });
});

test("configured API key rejects wrong, missing, and different-length keys", () => {
    withApiKey("test-secret-key", () => {
        for (const candidate of ["wrong", "", null, 123]) {
            const result = auth.verifyApiKey(candidate);
            assert.equal(result.success, false);
            assert.equal(result.authenticated, false);
        }
    });
});

test("authenticate accepts a valid Bearer token", () => {
    withApiKey("test-secret-key", () => {
        const result = auth.authenticate({
            headers: { authorization: "Bearer test-secret-key" }
        });
        assert.equal(result.authenticated, true);
    });
});

test("authenticate accepts the X-Aarhen-API-Key header", () => {
    withApiKey("test-secret-key", () => {
        const result = auth.authenticate({
            headers: { "x-aarhen-api-key": "test-secret-key" }
        });
        assert.equal(result.authenticated, true);
    });
});

test("authenticate rejects a token supplied in an unrelated header", () => {
    withApiKey("test-secret-key", () => {
        const result = auth.authenticate({
            headers: { authorization: "Basic test-secret-key" }
        });
        assert.equal(result.authenticated, false);
    });
});
