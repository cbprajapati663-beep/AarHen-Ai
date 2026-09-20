// ============================================================
// AARHEN CORE V5
// TAVILY WEB RESEARCH PROVIDER
// ============================================================

const TAVILY_ENDPOINT =
    "https://api.tavily.com/search";

function normalizeResult(item = {}) {
    return {
        title: String(item.title || "").trim(),
        url: String(item.url || "").trim(),
        snippet: String(
            item.content ||
            item.snippet ||
            ""
        ).trim(),
        publisher: String(
            item.publisher ||
            ""
        ).trim(),
        publishedAt:
            item.published_date ||
            item.publishedAt ||
            null
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
        .filter(item =>
            validateResult(item).valid
        );
}

async function search({
    query,
    maxSources = 5
} = {}) {

    const apiKey =
        process.env.TAVILY_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            providerConnected: false,
            providerRequired: true,
            results: [],
            error:
                "TAVILY_API_KEY is not configured."
        };
    }

    if (!query ||
        String(query).trim() === "") {

        return {
            success: false,
            providerConnected: true,
            results: [],
            error:
                "Research query is required."
        };
    }

    try {

        const response =
            await fetch(TAVILY_ENDPOINT, {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    api_key: apiKey,
                    query:
                        String(query).trim(),
                    search_depth: "basic",
                    max_results:
                        Math.max(
                            1,
                            Math.min(
                                Number(maxSources) || 5,
                                10
                            )
                        ),
                    include_answer: true,
                    include_raw_content: false,
                    include_images: false
                })
            });

        const data =
            await response.json();

        if (!response.ok) {
            return {
                success: false,
                providerConnected: true,
                results: [],
                error:
                    data?.detail ||
                    data?.message ||
                    `Tavily API error: ${response.status}`
            };
        }

        const results =
            normalizeResults(
                data.results || []
            );

        return {
            success: true,
            providerConnected: true,
            provider: "Tavily",
            query:
                String(query).trim(),
            answer:
                String(
                    data.answer || ""
                ).trim(),
            results,
            sourceCount:
                results.length,
            responseTime:
                data.response_time || null,
            status:
                "web-search-completed"
        };

    } catch (error) {

        return {
            success: false,
            providerConnected: true,
            results: [],
            error:
                `Tavily connection failed: ${error.message}`
        };
    }
}

function getProviderStatus() {

    const connected =
        Boolean(
            process.env.TAVILY_API_KEY
        );

    return {
        success: true,
        provider:
            "Tavily Web Research Provider",
        connected,
        status:
            connected
                ? "connected"
                : "waiting-for-api-key",
        supportsSearch: true,
        supportsSourceValidation: true,
        supportsResultNormalization: true,
        providerType: "web-search"
    };
}

module.exports = {
    search,
    normalizeResult,
    normalizeResults,
    validateResult,
    getProviderStatus
};
