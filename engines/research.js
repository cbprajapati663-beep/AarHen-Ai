// ============================================================
// AARHEN CORE V5
// WEB RESEARCH ENGINE
// ============================================================

const verification = require("../core/verification");
const learning = require("../core/learning");

function createResearchRequest({
    query,
    maxSources = 5,
    language = "auto"
} = {}) {

    if (!query || String(query).trim() === "") {
        return {
            success: false,
            error: "Research query is required."
        };
    }

    return {
        success: true,
        query: String(query).trim(),
        maxSources: Math.max(
            1,
            Math.min(Number(maxSources) || 5, 20)
        ),
        language,
        providerRequired: true,
        verified: false,
        status: "research-request-created"
    };
}

function createResearchResult({
    query,
    sources = [],
    summary = "",
    confidence = 0
} = {}) {

    const validSources =
        validateSources(sources);

    return {
        success: true,
        query: String(query || "").trim(),
        sources: validSources,
        sourceCount: validSources.length,
        summary: String(summary || "").trim(),
        confidence: Math.max(
            0,
            Math.min(Number(confidence) || 0, 1)
        ),
        verified: false,
        status: "research-result-created"
    };
}

function validateSource(source = {}) {

    if (!source || typeof source !== "object") {
        return {
            valid: false,
            reason: "Invalid source object."
        };
    }

    const title =
        String(source.title || "").trim();

    const url =
        String(source.url || "").trim();

    if (!title) {
        return {
            valid: false,
            reason: "Source title is missing."
        };
    }

    if (!url) {
        return {
            valid: false,
            reason: "Source URL is missing.",
            title
        };
    }

    return {
        valid: true,
        title,
        url,
        publisher:
            String(source.publisher || "").trim(),
        publishedAt:
            source.publishedAt || null,
        retrievedAt:
            source.retrievedAt ||
            new Date().toISOString()
    };
}

function validateSources(sources = []) {

    if (!Array.isArray(sources)) {
        return [];
    }

    return sources
        .map(validateSource)
        .filter(source => source.valid);
}

function buildResearchContext(result = {}) {

    if (!result || !result.success) {
        return {
            success: false,
            error: "Valid research result is required."
        };
    }

    const sourceText =
        result.sources
            .map(
                source =>
                    `${source.title} - ${source.url}`
            )
            .join("\n");

    return {
        success: true,
        query: result.query,
        summary: result.summary,
        sources: sourceText,
        confidence: result.confidence,
        verified: Boolean(result.verified)
    };
}

function verifyResearch({
    result,
    sourceCount,
    confidence,
    notes = ""
} = {}) {

    if (!result || !result.success) {
        return {
            success: false,
            error: "Research result is required."
        };
    }

    const count =
        Number(sourceCount) ||
        result.sourceCount ||
        0;

    const score =
        typeof confidence === "number"
            ? confidence
            : result.confidence;

    let status = "review";

    if (count >= 2 && score >= 0.8) {
        status = "verified";
    } else if (count >= 1 && score >= 0.6) {
        status = "partially-verified";
    }

    return {
        success: true,
        query: result.query,
        sourceCount: count,
        confidence: score,
        verificationStatus: status,
        verificationNotes: notes,
        verified: status === "verified",
        verifiedAt:
            new Date().toISOString()
    };
}

function learnVerifiedResearch({
    title = "Web Research",
    query,
    summary,
    sources = [],
    category = "research",
    confidence = 0
} = {}) {

    const validSources =
        validateSources(sources);

    if (!summary ||
        String(summary).trim().length < 10) {

        return {
            success: false,
            error: "Research summary is too short."
        };
    }

    const verificationResult =
        verifyResearch({
            result: {
                success: true,
                query,
                summary,
                sources: validSources,
                sourceCount: validSources.length,
                confidence
            }
        });

    if (!verificationResult.verified) {
        return {
            success: false,
            status: "verification-required",
            verification: verificationResult,
            message:
                "Research cannot be stored as verified knowledge until verification requirements are met."
        };
    }

    const sourceText =
        validSources
            .map(source =>
                `${source.title}: ${source.url}`
            )
            .join("\n");

    const content =
        `${summary}\n\nSources:\n${sourceText}`;

    const learned =
        learning.learn({
            title,
            content,
            category,
            source: "web-research",
            approved: true
        });

    return {
        success: learned.success,
        query,
        verification: verificationResult,
        learning: learned,
        status: learned.success
            ? "verified-research-learned"
            : "learning-failed"
    };
}

function getResearchStatus() {

    return {
        success: true,
        engine: "AarHen Web Research Engine",
        status: "provider-ready",
        internetAccess: false,
        providerRequired: true,
        verificationRequired: true,
        automaticLearning: false
    };
}

module.exports = {
    createResearchRequest,
    createResearchResult,
    validateSource,
    validateSources,
    buildResearchContext,
    verifyResearch,
    learnVerifiedResearch,
    getResearchStatus
};
