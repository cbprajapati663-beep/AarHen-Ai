// ============================================================
// AARHEN CORE V5
// RESEARCH PROVIDER ADAPTER
// ============================================================

function normalizeResult(item = {}) {
    return {
        title: String(item.title || "").trim(),
        url: String(item.url || "").trim(),
        snippet: String(item.snippet || "").trim(),
        publisher: String(item.publisher || "").trim(),
        publishedAt: item.publishedAt || null
    };
}

function validateResult(result) {
    if (!result.title) {
        return {
            valid: false,
            error: "Research result title is missing."
        };
    }

    if (!result.url) {
        return {
            valid: false,
            error: "Research result URL is missing."
        };
    }

    return {
        valid: true,
        result
    };
}

function normalizeResults(results = []) {
    if (!Array.isArray(results)) {
        return [];
    }

    return results
        .map(normalizeResult)
        .filter(item => validateResult(item).valid);
}

async function search() {
    return {
        success: false,
        providerConnected: false,
        providerRequired: true,
        results: [],
        error:
            "No web research provider is connected yet."
    };
}

function getProviderStatus() {
    return {
        success: true,
        provider: "Research Provider Adapter",
        connected: false,
        status: "waiting-for-provider",
        supportsSearch: true,
        supportsSourceValidation: true,
        supportsResultNormalization: true
    };
}

module.exports = {
    search,
    normalizeResult,
    normalizeResults,
    validateResult,
    getProviderStatus
};
