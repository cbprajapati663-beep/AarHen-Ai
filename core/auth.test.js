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


function withOwnerApiKey(value, callback) {
    const previous = process.env.AARHEN_OWNER_API_KEY;
    if (value === undefined) {
        delete process.env.AARHEN_OWNER_API_KEY;
    } else {
        process.env.AARHEN_OWNER_API_KEY = value;
    }

    try {
        callback();
    } finally {
        if (previous === undefined) {
            delete process.env.AARHEN_OWNER_API_KEY;
        } else {
            process.env.AARHEN_OWNER_API_KEY = previous;
        }
    }
}

test("owner authentication fails closed when a separate owner key is not configured", () => {
    withOwnerApiKey(undefined, () => {
        const result = auth.verifyOwnerApiKey("ordinary-api-key");
        assert.equal(result.authenticated, false);
        assert.equal(result.mode, "owner-unconfigured");
    });
});

test("owner authentication accepts only the separate configured owner key", () => {
    withApiKey("ordinary-api-key", () => {
        withOwnerApiKey("dedicated-owner-key", () => {
            assert.equal(auth.authenticate({
                headers: { authorization: "Bearer ordinary-api-key" }
            }).authenticated, true);
            assert.equal(auth.authenticateOwner({
                headers: { authorization: "Bearer ordinary-api-key" }
            }).authenticated, false);
            assert.equal(auth.authenticateOwner({
                headers: { authorization: "Bearer dedicated-owner-key" }
            }).authenticated, true);
        });
    });
});
