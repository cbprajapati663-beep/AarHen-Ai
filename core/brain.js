// ============================================================
// AARHEN CORE V5
// MASTER BRAIN
// ============================================================

const language = require("./language");
const memory = require("./memory");
const verification = require("./verification");
const knowledge = require("../engines/knowledge");

// ============================================================
// ANALYZE INPUT
// ============================================================

function analyze(input, context = {}) {
    const request = String(input || "").trim();

    if (!request) {
        return {
            success: false,
            error: "Request is empty."
        };
    }

    const detectedLanguage = language.resolveLanguage(
        context.language,
        request
    );

    return {
        success: true,
        request,
        language: detectedLanguage,
        languageInfo: language.getLanguageInfo(detectedLanguage),
        timestamp: new Date().toISOString()
    };
}

// ============================================================
// BASIC MEMORY RECALL
// ============================================================

function recall(request, limit = 5) {
    const results = memory.search(request);

    return results.slice(
        0,
        Number(limit) || 5
    );
}

// ============================================================
// VERIFIED MEMORY RECALL
// ============================================================

function recallVerified(request, limit = 5) {
    const results = recall(
        request,
        (Number(limit) || 3) * 2
    );

    return results
        .filter(item => verification.isVerified(item))
        .slice(
            0,
            Number(limit) || 3
        );
}

// ============================================================
// RAG KNOWLEDGE RECALL
// ============================================================

function recallKnowledge(request, limit = 5) {
    return knowledge.searchKnowledge(
        request,
        Number(limit) || 5
    );
}

// ============================================================
// VERIFIED RAG KNOWLEDGE RECALL
// ============================================================

function recallVerifiedKnowledge(request, limit = 5) {
    return knowledge.searchVerifiedKnowledge(
        request,
        Number(limit) || 3
    );
}

// ============================================================
// BUILD THINKING CONTEXT
// ============================================================

function buildThinkingContext(request, context = {}) {
    const memoryLimit =
        Number(context.memoryLimit) || 5;

    const verifiedMemoryLimit =
        Number(context.verifiedMemoryLimit) || 3;

    const knowledgeLimit =
        Number(context.knowledgeLimit) || 5;

    const verifiedKnowledgeLimit =
        Number(context.verifiedKnowledgeLimit) || 3;

    const memories = recall(
        request,
        memoryLimit
    );

    const verifiedMemories = recallVerified(
        request,
        verifiedMemoryLimit
    );

    const knowledgeResult = recallKnowledge(
        request,
        knowledgeLimit
    );

    const verifiedKnowledgeResult =
        recallVerifiedKnowledge(
            request,
            verifiedKnowledgeLimit
        );

    return {
        memories,
        verifiedMemories,

        knowledge:
            knowledgeResult.success
                ? knowledgeResult.results
                : [],

        verifiedKnowledge:
            verifiedKnowledgeResult.success
                ? verifiedKnowledgeResult.results
                : []
    };
}

// ============================================================
// MAIN THINKING PROCESS
// ============================================================

function think(input, context = {}) {
    const analysis = analyze(
        input,
        context
    );

    if (!analysis.success) {
        return analysis;
    }

    const thinkingContext =
        buildThinkingContext(
            analysis.request,
            context
        );

    return {
        success: true,

        brain: "AarHen Master Brain",

        version: "5.0.0",

        request: analysis.request,

        language: analysis.language,

        languageInfo: analysis.languageInfo,

        memory: {
            relatedCount:
                thinkingContext.memories.length,

            verifiedCount:
                thinkingContext.verifiedMemories.length,

            related:
                thinkingContext.memories,

            verified:
                thinkingContext.verifiedMemories
        },

        knowledge: {
            relatedCount:
                thinkingContext.knowledge.length,

            verifiedCount:
                thinkingContext.verifiedKnowledge.length,

            related:
                thinkingContext.knowledge,

            verified:
                thinkingContext.verifiedKnowledge
        },

        thinkingContext: {
            memory:
                thinkingContext.memories,

            verifiedMemory:
                thinkingContext.verifiedMemories,

            knowledge:
                thinkingContext.knowledge,

            verifiedKnowledge:
                thinkingContext.verifiedKnowledge
        },

        status: "thinking-context-built",

        timestamp: analysis.timestamp
    };
}

// ============================================================
// BRAIN STATUS
// ============================================================

function getStatus() {
    return {
        name: "AarHen",
        version: "5.0.0",
        status: "active",

        capabilities: [
            "advanced-reasoning",
            "memory",
            "long-term-memory",
            "knowledge-retrieval",
            "verified-knowledge",
            "learning",
            "language",
            "verification",
            "skill-routing",
            "web-research",
            "finance",
            "coding",
            "cybersecurity",
            "data-analysis",
            "documents",
            "business"
        ],

        connectedBrains: [
            "Memory Brain",
            "RAG Knowledge Brain",
            "Verification Brain",
            "Language Brain",
            "Learning Brain"
        ]
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    analyze,
    recall,
    recallVerified,
    recallKnowledge,
    recallVerifiedKnowledge,
    buildThinkingContext,
    think,
    getStatus
};
