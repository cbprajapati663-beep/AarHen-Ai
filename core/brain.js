// ============================================================
// AARHEN CORE V5
// MASTER BRAIN
// ============================================================

const language =
    require("./language");

const memory =
    require("./memory");

const memoryManager =
    require("./memoryManager");

const verification =
    require("./verification");

const knowledge =
    require("../engines/knowledge");

// ============================================================
// ANALYZE INPUT
// ============================================================

function analyze(
    input,
    context = {}
) {

    const request =
        String(
            input || ""
        ).trim();

    if (!request) {

        return {

            success: false,

            error:
                "Request is empty."
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

// ============================================================
// BASIC MEMORY RECALL
// ============================================================

function recall(
    request,
    limit = 5
) {

    const results =
        memory.search(
            request
        );

    return results.slice(
        0,
        Number(limit) || 5
    );
}

// ============================================================
// MANAGED MEMORY RECALL
// ============================================================

function recallManaged(
    request,
    options = {}
) {

    return memoryManager.recall(
        request,
        {

            limit:
                Number(
                    options.limit
                ) || 5,

            verifiedOnly:
                Boolean(
                    options.verifiedOnly
                ),

            type:
                options.type,

            minimumImportance:
                options.minimumImportance
        }
    );
}

// ============================================================
// VERIFIED MEMORY RECALL
// ============================================================

function recallVerified(
    request,
    limit = 5
) {

    return memoryManager.recallVerified(
        request,
        Number(limit) || 5
    );
}

// ============================================================
// IMPORTANT MEMORY RECALL
// ============================================================

function recallImportant(
    request,
    limit = 5
) {

    return memoryManager.recallImportant(
        request,
        Number(limit) || 5
    );
}

// ============================================================
// RAG KNOWLEDGE RECALL
// ============================================================

function recallKnowledge(
    request,
    limit = 5
) {

    return knowledge.searchKnowledge(
        request,
        Number(limit) || 5
    );
}

// ============================================================
// VERIFIED RAG KNOWLEDGE RECALL
// ============================================================

function recallVerifiedKnowledge(
    request,
    limit = 5
) {

    return knowledge.searchVerifiedKnowledge(
        request,
        Number(limit) || 3
    );
}

// ============================================================
// MEMORY DECISION
// ============================================================

function analyzeMemoryDecision(
    request,
    context = {}
) {

    return memoryManager.analyzeMemoryDecision({

        content:
            request,

        type:
            context.memoryType,

        category:
            context.memoryCategory,

        importance:
            context.memoryImportance,

        confidence:
            context.memoryConfidence,

        source:
            context.memorySource ||
            "user",

        remember:
            context.remember
    });
}

// ============================================================
// BUILD THINKING CONTEXT
// ============================================================

function buildThinkingContext(
    request,
    context = {}
) {

    const memoryLimit =
        Number(
            context.memoryLimit
        ) || 5;

    const verifiedMemoryLimit =
        Number(
            context.verifiedMemoryLimit
        ) || 3;

    const importantMemoryLimit =
        Number(
            context.importantMemoryLimit
        ) || 3;

    const knowledgeLimit =
        Number(
            context.knowledgeLimit
        ) || 5;

    const verifiedKnowledgeLimit =
        Number(
            context.verifiedKnowledgeLimit
        ) || 3;

    // ------------------------------------------
    // BASIC MEMORY
    // ------------------------------------------

    const memories =
        recall(
            request,
            memoryLimit
        );

    // ------------------------------------------
    // MANAGED MEMORY
    // ------------------------------------------

    const managedMemory =
        recallManaged(
            request,
            {
                limit:
                    memoryLimit
            }
        );

    // ------------------------------------------
    // VERIFIED MEMORY
    // ------------------------------------------

    const verifiedMemories =
        recallVerified(
            request,
            verifiedMemoryLimit
        );

    // ------------------------------------------
    // IMPORTANT MEMORY
    // ------------------------------------------

    const importantMemories =
        recallImportant(
            request,
            importantMemoryLimit
        );

    // ------------------------------------------
    // KNOWLEDGE
    // ------------------------------------------

    const knowledgeResult =
        recallKnowledge(
            request,
            knowledgeLimit
        );

    // ------------------------------------------
    // VERIFIED KNOWLEDGE
    // ------------------------------------------

    const verifiedKnowledgeResult =
        recallVerifiedKnowledge(
            request,
            verifiedKnowledgeLimit
        );

    // ------------------------------------------
    // MEMORY DECISION
    // ------------------------------------------

    const memoryDecision =
        analyzeMemoryDecision(
            request,
            context
        );

    return {

        memories,

        managedMemory:
            managedMemory.success
                ? managedMemory.results
                : [],

        verifiedMemories,

        importantMemories,

        knowledge:
            knowledgeResult.success
                ? knowledgeResult.results
                : [],

        verifiedKnowledge:
            verifiedKnowledgeResult.success
                ? verifiedKnowledgeResult.results
                : [],

        memoryDecision:
            memoryDecision.success
                ? memoryDecision.decision
                : null
    };
}

// ============================================================
// MAIN THINKING PROCESS
// ============================================================

function think(
    input,
    context = {}
) {

    const analysis =
        analyze(
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
                thinkingContext.memories.length,

            managedCount:
                thinkingContext
                    .managedMemory.length,

            verifiedCount:
                thinkingContext
                    .verifiedMemories.length,

            importantCount:
                thinkingContext
                    .importantMemories.length,

            related:
                thinkingContext.memories,

            managed:
                thinkingContext
                    .managedMemory,

            verified:
                thinkingContext
                    .verifiedMemories,

            important:
                thinkingContext
                    .importantMemories,

            decision:
                thinkingContext
                    .memoryDecision
        },

        knowledge: {

            relatedCount:
                thinkingContext
                    .knowledge.length,

            verifiedCount:
                thinkingContext
                    .verifiedKnowledge.length,

            related:
                thinkingContext
                    .knowledge,

            verified:
                thinkingContext
                    .verifiedKnowledge
        },

        thinkingContext: {

            memory:
                thinkingContext.memories,

            managedMemory:
                thinkingContext
                    .managedMemory,

            verifiedMemory:
                thinkingContext
                    .verifiedMemories,

            importantMemory:
                thinkingContext
                    .importantMemories,

            knowledge:
                thinkingContext
                    .knowledge,

            verifiedKnowledge:
                thinkingContext
                    .verifiedKnowledge,

            memoryDecision:
                thinkingContext
                    .memoryDecision
        },

        status:
            "thinking-context-built",

        timestamp:
            analysis.timestamp
    };
}

// ============================================================
// BRAIN STATUS
// ============================================================

function getStatus() {

    return {

        name:
            "AarHen",

        version:
            "5.0.0",

        status:
            "active",

        capabilities: [

            "advanced-reasoning",

            "memory",

            "long-term-memory",

            "memory-management",

            "automatic-memory-decision",

            "memory-classification",

            "importance-scoring",

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

            "Memory Manager",

            "RAG Knowledge Brain",

            "Verification Brain",

            "Language Brain",

            "Learning Brain"
        ],

        memorySystem: {

            manager:
                "Advanced Memory Manager",

            automaticDecision:
                true,

            classification:
                true,

            importanceScoring:
                true,

            confidenceTracking:
                true,

            verifiedRecall:
                true,

            importantRecall:
                true
        }
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    analyze,

    recall,

    recallManaged,

    recallVerified,

    recallImportant,

    recallKnowledge,

    recallVerifiedKnowledge,

    analyzeMemoryDecision,

    buildThinkingContext,

    think,

    getStatus
};
