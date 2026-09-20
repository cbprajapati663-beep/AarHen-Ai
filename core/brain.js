// ============================================================
// AARHEN CORE V5
// MASTER BRAIN
// ============================================================

const language = require("./language");
const memory = require("./memory");
const verification = require("./verification");


// ------------------------------------------------------------
// Analyze user request
// ------------------------------------------------------------

function analyze(input, context = {}) {

    const request =
        String(input || "").trim();


    if (!request) {

        return {
            success: false,
            error: "Request is empty."
        };
    }


    const detectedLanguage =
        language.resolveLanguage(
            context.language,
            request
        );


    return {

        success: true,

        request,

        language:
            detectedLanguage,

        languageInfo:
            language.getLanguageInfo(
                detectedLanguage
            ),

        timestamp:
            new Date().toISOString()

    };
}


// ------------------------------------------------------------
// Search AarHen memory
// ------------------------------------------------------------

function recall(request, limit = 5) {

    const results =
        memory.search(request);


    return results.slice(
        0,
        Number(limit) || 5
    );
}


// ------------------------------------------------------------
// Get verified memories
// ------------------------------------------------------------

function recallVerified(request, limit = 5) {

    const results =
        recall(request, limit * 2);


    return results.filter(item =>
        verification.isVerified(item)
    ).slice(
        0,
        Number(limit) || 5
    );
}


// ------------------------------------------------------------
// Build brain response
// ------------------------------------------------------------

function think(input, context = {}) {

    const analysis =
        analyze(input, context);


    if (!analysis.success) {
        return analysis;
    }


    const memories =
        recall(
            analysis.request,
            context.memoryLimit || 5
        );


    const verifiedMemories =
        recallVerified(
            analysis.request,
            context.verifiedMemoryLimit || 3
        );


    return {

        success: true,

        brain:
            "AarHen Master Brain",

        version:
            "5.0.0",

        request:
            analysis.request,

        language:
            analysis.language,

        languageInfo:
            analysis.languageInfo,

        memory: {

            relatedCount:
                memories.length,

            verifiedCount:
                verifiedMemories.length,

            related:
                memories,

            verified:
                verifiedMemories

        },

        status:
            "thinking-complete",

        timestamp:
            analysis.timestamp

    };
}


// ------------------------------------------------------------
// Brain status
// ------------------------------------------------------------

function getStatus() {

    return {

        name:
            "AarHen",

        version:
            "5.0.0",

        status:
            "active",

        capabilities: [

            "reasoning",

            "memory",

            "learning",

            "language",

            "verification",

            "skill-routing",

            "web-research",

            "knowledge",

            "finance",

            "coding",

            "cybersecurity",

            "data-analysis",

            "documents",

            "business"

        ]

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    analyze,

    recall,

    recallVerified,

    think,

    getStatus

};
