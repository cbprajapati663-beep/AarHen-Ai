// ============================================================
// AARHEN CORE V5
// WEB RESEARCH ENGINE
// ============================================================


// ------------------------------------------------------------
// Research request
// ------------------------------------------------------------

function createResearchRequest({
    query = "",
    maxSources = 5,
    language = "auto"
} = {}) {

    const cleanQuery =
        String(query || "").trim();


    if (!cleanQuery) {
        return {
            success: false,
            error: "Research query is required."
        };
    }


    return {

        success: true,

        query: cleanQuery,

        maxSources:
            Math.max(1, Number(maxSources) || 5),

        language,

        status: "ready",

        providerRequired: true,

        verified: false

    };
}


// ------------------------------------------------------------
// Prepare research result
// ------------------------------------------------------------

function createResearchResult({
    query = "",
    sources = [],
    summary = ""
} = {}) {

    return {

        success: true,

        query,

        summary,

        sourceCount:
            Array.isArray(sources)
                ? sources.length
                : 0,

        sources:
            Array.isArray(sources)
                ? sources
                : [],

        researchedAt:
            new Date().toISOString(),

        status: "received"

    };
}


// ------------------------------------------------------------
// Validate a research source
// ------------------------------------------------------------

function validateSource(source) {

    if (!source || typeof source !== "object") {

        return {
            valid: false,
            reason: "Invalid source."
        };
    }


    const hasTitle =
        Boolean(source.title);


    const hasUrl =
        Boolean(source.url);


    const hasContent =
        Boolean(source.content);


    if (!hasTitle || !hasUrl) {

        return {
            valid: false,
            reason:
                "Source should contain title and URL."
        };
    }


    return {

        valid: true,

        title:
            String(source.title),

        url:
            String(source.url),

        content:
            String(source.content || ""),

        publishedAt:
            source.publishedAt || null

    };
}


// ------------------------------------------------------------
// Filter valid sources
// ------------------------------------------------------------

function validateSources(sources) {

    if (!Array.isArray(sources)) {

        return {
            success: false,
            error: "Sources must be an array."
        };
    }


    const validSources = [];


    for (const source of sources) {

        const result =
            validateSource(source);


        if (result.valid) {
            validSources.push(result);
        }
    }


    return {

        success: true,

        validSourceCount:
            validSources.length,

        sources:
            validSources

    };
}


// ------------------------------------------------------------
// Build research context
// ------------------------------------------------------------

function buildResearchContext(result) {

    if (!result || !Array.isArray(result.sources)) {

        return {
            success: false,
            error: "Invalid research result."
        };
    }


    const context =
        result.sources
            .map((source, index) => {

                return [
                    `Source ${index + 1}`,
                    `Title: ${source.title}`,
                    `URL: ${source.url}`,
                    `Content: ${source.content}`
                ].join("\n");

            })
            .join("\n\n");


    return {

        success: true,

        query:
            result.query,

        sourceCount:
            result.sources.length,

        context

    };
}


// ------------------------------------------------------------
// Research status
// ------------------------------------------------------------

function getResearchStatus() {

    return {

        engine:
            "AarHen Web Research Engine",

        version:
            "5.0.0",

        status:
            "provider-ready",

        internetAccess:
            "requires-search-provider",

        verification:
            "separate-verification-engine"

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    createResearchRequest,

    createResearchResult,

    validateSource,

    validateSources,

    buildResearchContext,

    getResearchStatus

};
