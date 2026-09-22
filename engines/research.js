// ============================================================
// AARHEN CORE V5
// ADVANCED WEB RESEARCH ENGINE
// ============================================================

const verification =
    require("../core/verification");

const learning =
    require("../core/learning");

// ============================================================
// CONSTANTS
// ============================================================

const RESEARCH_VERSION = "5.0.0";

const MIN_VERIFIED_SOURCES = 2;

const MIN_VERIFIED_CONFIDENCE = 0.80;

const MIN_PARTIAL_SOURCES = 1;

const MIN_PARTIAL_CONFIDENCE = 0.60;

// ============================================================
// NORMALIZE
// ============================================================

function normalize(value = "") {
    return String(value || "").trim();
}

// ============================================================
// CLAMP
// ============================================================

function clamp(
    value,
    min = 0,
    max = 1
) {
    const number = Number(value);

    if (Number.isNaN(number)) {
        return min;
    }

    return Math.max(
        min,
        Math.min(max, number)
    );
}

// ============================================================
// CREATE RESEARCH REQUEST
// ============================================================

function createResearchRequest({
    query,
    maxSources = 5,
    language = "auto"
} = {}) {

    const cleanQuery =
        normalize(query);

    if (!cleanQuery) {
        return {
            success: false,
            error:
                "Research query is required."
        };
    }

    const sourceLimit =
        Math.max(
            1,
            Math.min(
                Number(maxSources) || 5,
                20
            )
        );

    return {
        success: true,

        query:
            cleanQuery,

        maxSources:
            sourceLimit,

        language:
            language || "auto",

        providerRequired: true,

        verificationRequired: true,

        learningEnabled: true,

        verified: false,

        status:
            "research-request-created"
    };
}

// ============================================================
// VALIDATE SINGLE SOURCE
// ============================================================

function validateSource(
    source = {}
) {

    if (
        !source ||
        typeof source !== "object"
    ) {
        return {
            valid: false,
            reason:
                "Invalid source object."
        };
    }

    const title =
        normalize(source.title);

    const url =
        normalize(source.url);

    if (!title) {
        return {
            valid: false,
            reason:
                "Source title is missing."
        };
    }

    if (!url) {
        return {
            valid: false,
            reason:
                "Source URL is missing.",
            title
        };
    }

    return {
        valid: true,

        title,

        url,

        publisher:
            normalize(
                source.publisher
            ),

        publishedAt:
            source.publishedAt ||
            null,

        retrievedAt:
            source.retrievedAt ||
            new Date().toISOString(),

        snippet:
            normalize(
                source.snippet
            ),

        score:
            typeof source.score ===
            "number"
                ? source.score
                : null
    };
}

// ============================================================
// VALIDATE SOURCES
// ============================================================

function validateSources(
    sources = []
) {

    if (!Array.isArray(sources)) {
        return [];
    }

    const validated =
        sources
            .map(validateSource)
            .filter(
                source =>
                    source.valid
            );

    // --------------------------------------------------------
    // Remove duplicate URLs
    // --------------------------------------------------------

    const seen =
        new Set();

    return validated.filter(
        source => {

            const key =
                source.url
                    .toLowerCase();

            if (
                seen.has(key)
            ) {
                return false;
            }

            seen.add(key);

            return true;
        }
    );
}

// ============================================================
// CREATE RESEARCH RESULT
// ============================================================

function createResearchResult({
    query,
    sources = [],
    summary = "",
    confidence = 0
} = {}) {

    const validSources =
        validateSources(
            sources
        );

    return {
        success: true,

        query:
            normalize(query),

        sources:
            validSources,

        sourceCount:
            validSources.length,

        summary:
            normalize(summary),

        confidence:
            clamp(confidence),

        verified: false,

        verificationStatus:
            "review",

        status:
            "research-result-created"
    };
}

// ============================================================
// BUILD RESEARCH CONTEXT
// ============================================================

function buildResearchContext(
    result = {}
) {

    if (
        !result ||
        !result.success
    ) {
        return {
            success: false,
            error:
                "Valid research result is required."
        };
    }

    const sources =
        validateSources(
            result.sources
        );

    const sourceText =
        sources
            .map(
                source =>
                    `${source.title} - ${source.url}`
            )
            .join("\n");

    return {
        success: true,

        query:
            normalize(result.query),

        summary:
            normalize(result.summary),

        sources:
            sourceText,

        sourceList:
            sources,

        sourceCount:
            sources.length,

        confidence:
            clamp(
                result.confidence
            ),

        verified:
            Boolean(
                result.verified
            ),

        verificationStatus:
            result.verificationStatus ||
            "review"
    };
}

// ============================================================
// CALCULATE RESEARCH CONFIDENCE
// ============================================================

function calculateResearchConfidence({
    sources = [],
    confidence = 0
} = {}) {

    const validSources =
        validateSources(
            sources
        );

    const suppliedConfidence =
        clamp(confidence);

    if (
        validSources.length === 0
    ) {
        return 0;
    }

    // --------------------------------------------------------
    // If provider already supplied confidence,
    // keep it within safe limits.
    // --------------------------------------------------------

    if (
        suppliedConfidence > 0
    ) {
        return suppliedConfidence;
    }

    // --------------------------------------------------------
    // Basic source-count confidence.
    // This is NOT verification.
    // Verification still requires the thresholds below.
    // --------------------------------------------------------

    if (
        validSources.length >= 5
    ) {
        return 0.90;
    }

    if (
        validSources.length >= 3
    ) {
        return 0.82;
    }

    if (
        validSources.length >= 2
    ) {
        return 0.75;
    }

    return 0.60;
}

// ============================================================
// VERIFY RESEARCH
// ============================================================

function verifyResearch({
    result,
    sourceCount,
    confidence,
    notes = ""
} = {}) {

    if (
        !result ||
        !result.success
    ) {
        return {
            success: false,
            error:
                "Research result is required."
        };
    }

    const actualSources =
        validateSources(
            result.sources || []
        );

    const count =
        Number(sourceCount) ||
        actualSources.length ||
        result.sourceCount ||
        0;

    const score =
        typeof confidence ===
        "number"
            ? clamp(confidence)
            : calculateResearchConfidence({
                sources:
                    actualSources,
                confidence:
                    result.confidence
            });

    let status =
        "review";

    if (
        count >= MIN_VERIFIED_SOURCES &&
        score >= MIN_VERIFIED_CONFIDENCE
    ) {

        status =
            "verified";

    } else if (
        count >= MIN_PARTIAL_SOURCES &&
        score >= MIN_PARTIAL_CONFIDENCE
    ) {

        status =
            "partially-verified";
    }

    return {
        success: true,

        query:
            normalize(result.query),

        sourceCount:
            count,

        confidence:
            score,

        verificationStatus:
            status,

        verificationNotes:
            normalize(notes),

        verified:
            status === "verified",

        verifiedAt:
            new Date().toISOString()
    };
}

// ============================================================
// VERIFY WITH VERIFICATION ENGINE
// ============================================================

function verifyWithEngine({
    memoryId,
    sourceCount,
    confidence,
    notes = "",
    evidence = [],
    conflictDetected = false
} = {}) {

    if (!memoryId) {
        return {
            success: false,
            error:
                "Memory ID is required."
        };
    }

    try {

        return verification.verifyMemory({

            memoryId,

            verifiedBy:
                "AarHen Web Research Engine",

            sourceCount:
                Number(sourceCount) || 0,

            confidence:
                clamp(confidence),

            notes:
                notes ||
                "Verified through web research.",

            evidence:
                Array.isArray(evidence)
                    ? evidence
                    : [],

            conflictDetected:
                Boolean(
                    conflictDetected
                )
        });

    } catch (error) {

        return {
            success: false,
            error:
                error.message
        };
    }
}

// ============================================================
// BUILD LEARNING CONTENT
// ============================================================

function buildLearningContent({
    summary = "",
    sources = []
} = {}) {

    const cleanSummary =
        normalize(summary);

    const validSources =
        validateSources(
            sources
        );

    if (
        !cleanSummary
    ) {
        return "";
    }

    const sourceText =
        validSources
            .map(
                source =>
                    `${source.title}: ${source.url}`
            )
            .join("\n");

    if (!sourceText) {
        return cleanSummary;
    }

    return (
        `${cleanSummary}\n\n` +
        `Sources:\n` +
        sourceText
    );
}

// ============================================================
// LEARN VERIFIED RESEARCH
// ============================================================

function learnVerifiedResearch({
    title = "Web Research",
    query,
    summary,
    sources = [],
    category = "research",
    confidence = 0,
    notes = ""
} = {}) {

    const cleanQuery =
        normalize(query);

    const cleanSummary =
        normalize(summary);

    const validSources =
        validateSources(
            sources
        );

    if (!cleanQuery) {

        return {
            success: false,
            error:
                "Research query is required."
        };
    }

    if (
        cleanSummary.length < 10
    ) {

        return {
            success: false,
            error:
                "Research summary is too short."
        };
    }

    if (
        validSources.length === 0
    ) {

        return {
            success: false,
            error:
                "At least one valid research source is required."
        };
    }

    const researchResult =
        createResearchResult({

            query:
                cleanQuery,

            sources:
                validSources,

            summary:
                cleanSummary,

            confidence:
                clamp(confidence)
        });

    // --------------------------------------------------------
    // VERIFY
    // --------------------------------------------------------

    const verificationResult =
        verifyResearch({

            result:
                researchResult,

            sourceCount:
                validSources.length,

            confidence:
                calculateResearchConfidence({
                    sources:
                        validSources,

                    confidence:
                        confidence
                }),

            notes
        });

    // --------------------------------------------------------
    // DO NOT LEARN UNVERIFIED RESEARCH
    // --------------------------------------------------------

    if (
        !verificationResult.verified
    ) {

        return {
            success: false,

            query:
                cleanQuery,

            verification:
                verificationResult,

            status:
                "verification-required",

            message:
                "Research cannot be stored as verified knowledge until verification requirements are met."
        };
    }

    // --------------------------------------------------------
    // BUILD KNOWLEDGE
    // --------------------------------------------------------

    const content =
        buildLearningContent({

            summary:
                cleanSummary,

            sources:
                validSources
        });

    // --------------------------------------------------------
    // LEARN
    // --------------------------------------------------------

    const learned =
        learning.learnVerified({

            title,

            content,

            category,

            source:
                "web-research",

            confidence:
                verificationResult.confidence,

            approved:
                true,

            verified:
                true,

            storeMemory:
                true
        });

    if (
        !learned ||
        !learned.success
    ) {

        return {
            success: false,

            query:
                cleanQuery,

            verification:
                verificationResult,

            learning:
                learned,

            status:
                "learning-failed"
        };
    }

    // --------------------------------------------------------
    // FINAL RESULT
    // --------------------------------------------------------

    return {

        success: true,

        query:
            cleanQuery,

        verification:
            verificationResult,

        learning:
            learned,

        memoryId:
            learned.memoryId ||
            null,

        sourceCount:
            validSources.length,

        confidence:
            verificationResult.confidence,

        status:
            "verified-research-learned"
    };
}

// ============================================================
// RESEARCH → VERIFY → LEARN PIPELINE
// ============================================================

function processResearchResult({
    result,
    title = "Web Research",
    category = "research",
    notes = ""
} = {}) {

    if (
        !result ||
        !result.success
    ) {

        return {
            success: false,
            error:
                "Valid research result is required."
        };
    }

    return learnVerifiedResearch({

        title,

        query:
            result.query,

        summary:
            result.summary,

        sources:
            result.sources,

        category,

        confidence:
            result.confidence,

        notes
    });
}

// ============================================================
// RESEARCH STATUS
// ============================================================

function getResearchStatus() {

    return {

        success: true,

        engine:
            "AarHen Advanced Web Research Engine",

        version:
            RESEARCH_VERSION,

        status:
            "provider-ready",

        internetAccess:
            false,

        providerRequired:
            true,

        verificationRequired:
            true,

        automaticLearning:
            true,

        learningRequiresVerification:
            true,

        minimumVerifiedSources:
            MIN_VERIFIED_SOURCES,

        minimumVerifiedConfidence:
            MIN_VERIFIED_CONFIDENCE,

        pipeline: [
            "research",
            "validate-sources",
            "compare",
            "verify",
            "learn",
            "memory-storage",
            "future-recall"
        ]
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    createResearchRequest,

    createResearchResult,

    validateSource,

    validateSources,

    buildResearchContext,

    calculateResearchConfidence,

    verifyResearch,

    verifyWithEngine,

    buildLearningContent,

    learnVerifiedResearch,

    processResearchResult,

    getResearchStatus
};
