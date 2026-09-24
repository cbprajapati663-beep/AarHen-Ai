// ============================================================
// AARHEN CORE V5
// WEB RESEARCH API
// ============================================================

const research =
    require("../engines/research");

const providerManager =
    require("../providers/providerManager");

// ============================================================
// CREATE RESEARCH REQUEST
// ============================================================

function createRequest(data = {}) {

    return research.createResearchRequest({
        query:
            data.query,

        maxSources:
            data.maxSources || 5,

        language:
            data.language || "auto"
    });
}

// ============================================================
// LIVE WEB SEARCH
// ============================================================

async function searchWeb(data = {}) {

    const request =
        createRequest(data);

    if (!request.success) {
        return request;
    }

    try {

        // ----------------------------------------------------
        // IMPORTANT:
        // providerManager.searchWeb() expects ONE OBJECT
        // ----------------------------------------------------

        const providerResult =
            await providerManager.searchWeb({
                query:
                    request.query,

                maxSources:
                    request.maxSources,

                provider:
                    data.provider ||
                    data.researchProvider ||
                    null
            });

        if (
            !providerResult ||
            providerResult.success === false
        ) {

            return {
                success: false,

                query:
                    request.query,

                error:
                    providerResult &&
                    providerResult.error
                        ? providerResult.error
                        : "Web research provider failed.",

                status:
                    "research-failed"
            };
        }

        const rawSources =
            Array.isArray(
                providerResult.results
            )
                ? providerResult.results
                : [];

        const sources =
            research.validateSources(
                rawSources
            );

        const summary =
            providerResult.answer ||
            providerResult.summary ||
            "";

        const confidence =
            research.calculateResearchConfidence({
                sources,

                confidence:
                    providerResult.confidence || 0
            });

        const result =
            research.createResearchResult({

                query:
                    request.query,

                sources,

                summary,

                confidence
            });

        const context =
            research.buildResearchContext(
                result
            );

        return {

            success: true,

            query:
                request.query,

            research:
                result,

            context,

            provider:
                providerResult.provider ||
                "web-research-provider",

            sourceCount:
                sources.length,

            confidence,

            verified:
                false,

            verificationStatus:
                "review",

            status:
                "research-completed-verification-required"
        };

    } catch (error) {

        return {

            success: false,

            query:
                request.query,

            error:
                error.message,

            status:
                "research-error"
        };
    }
}

// ============================================================
// VERIFY RESEARCH RESULT
// ============================================================

function verify(data = {}) {

    const result =
        data.result || {

            success:
                true,

            query:
                data.query,

            sources:
                data.sources || [],

            summary:
                data.summary || "",

            confidence:
                data.confidence || 0
        };

    return research.verifyResearch({

        result,

        sourceCount:
            data.sourceCount,

        confidence:
            data.confidence,

        notes:
            data.notes || ""
    });
}

// ============================================================
// PROCESS RESEARCH → VERIFY → LEARN
// ============================================================

function process(data = {}) {

    if (
        !data.result ||
        !data.result.success
    ) {

        return {

            success: false,

            error:
                "Valid research result is required."
        };
    }

    return research.processResearchResult({

        result:
            data.result,

        title:
            data.title ||
            "Web Research",

        category:
            data.category ||
            "research",

        notes:
            data.notes ||
            ""
    });
}

// ============================================================
// DIRECT VERIFIED RESEARCH LEARNING
// ============================================================

function learnVerified(data = {}) {

    return research.learnVerifiedResearch({

        title:
            data.title ||
            "Web Research",

        query:
            data.query,

        summary:
            data.summary,

        sources:
            data.sources || [],

        category:
            data.category ||
            "research",

        confidence:
            data.confidence || 0,

        notes:
            data.notes ||
            ""
    });
}

// ============================================================
// BUILD CONTEXT
// ============================================================

function buildContext(data = {}) {

    return research.buildResearchContext(
        data.result || data
    );
}

// ============================================================
// VALIDATE SOURCE
// ============================================================

function validateSource(source = {}) {

    return research.validateSource(
        source
    );
}

// ============================================================
// VALIDATE SOURCES
// ============================================================

function validateSources(sources = []) {

    return research.validateSources(
        sources
    );
}

// ============================================================
// RESEARCH STATUS
// ============================================================

function getStatus() {

    return research.getResearchStatus();
}

// ============================================================
// MODULE STATUS
// ============================================================

function getApiStatus() {

    const researchStatus =
        research.getResearchStatus();

    return {

        success: true,

        api:
            "AarHen Web Research API",

        version:
            "5.0.0",

        status:
            "ready",

        engine:
            researchStatus,

        provider:
            "provider-manager",

        capabilities: [

            "research-request",

            "live-web-search",

            "source-validation",

            "research-context",

            "confidence-calculation",

            "research-verification",

            "verified-learning",

            "research-memory-pipeline"
        ]
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    createRequest,

    searchWeb,

    verify,

    process,

    learnVerified,

    buildContext,

    validateSource,

    validateSources,

    getStatus,

    getApiStatus
};
