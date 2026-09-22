// ============================================================
// AARHEN CORE V5
// CONTINUOUS LEARNING ENGINE
// ============================================================

const memoryStore =
    require("./memoryStore");

const memoryManager =
    require("./memoryManager");

const verification =
    require("./verification");

// ============================================================
// NORMALIZE
// ============================================================

function normalize(value = "") {
    return String(value || "").trim();
}

// ============================================================
// SPLIT TEXT INTO CHUNKS
// ============================================================

function splitIntoChunks(text, size = 1200) {

    const content =
        normalize(text);

    if (!content) {
        return [];
    }

    const chunkSize =
        Number(size) > 0
            ? Number(size)
            : 1200;

    const chunks = [];

    for (
        let i = 0;
        i < content.length;
        i += chunkSize
    ) {
        chunks.push(
            content.slice(
                i,
                i + chunkSize
            )
        );
    }

    return chunks;
}

// ============================================================
// EXTRACT CONCEPTS
// ============================================================

function extractConcepts(text) {

    const content =
        normalize(text);

    if (!content) {
        return [];
    }

    const words =
        content
            .toLowerCase()
            .replace(/[^\w\s-]/g, " ")
            .split(/\s+/)
            .filter(
                word =>
                    word.length >= 4
            );

    const stopWords =
        new Set([
            "this",
            "that",
            "with",
            "from",
            "have",
            "will",
            "your",
            "about",
            "there",
            "their",
            "which",
            "where",
            "when",
            "what",
            "into",
            "also",
            "than",
            "then",
            "they",
            "them",
            "were",
            "been",
            "being",
            "such",
            "more",
            "some",
            "very",
            "only",
            "just",
            "like",
            "using",
            "used",
            "user"
        ]);

    const frequency = {};

    for (const word of words) {

        if (stopWords.has(word)) {
            continue;
        }

        frequency[word] =
            (frequency[word] || 0) + 1;
    }

    return Object.entries(
        frequency
    )
        .sort(
            (a, b) =>
                b[1] - a[1]
        )
        .slice(0, 20)
        .map(
            item =>
                item[0]
        );
}

// ============================================================
// DETECT LEARNING TYPE
// ============================================================

function detectLearningType(input = {}) {

    const content =
        normalize(
            input.content
        ).toLowerCase();

    if (input.type) {
        return input.type;
    }

    if (
        content.includes("prefer") ||
        content.includes("preference") ||
        content.includes("always") ||
        content.includes("from now on")
    ) {
        return "user-preference";
    }

    if (
        content.includes(
            "heritage auto finance"
        ) ||
        content.includes(
            "vehicle finance"
        ) ||
        content.includes(
            "vehicle loan"
        ) ||
        content.includes(
            "customer"
        ) ||
        content.includes(
            "business"
        )
    ) {
        return "business";
    }

    return "knowledge";
}

// ============================================================
// LEARNING DECISION
// ============================================================

function analyzeLearningDecision(input = {}) {

    const content =
        normalize(
            input.content
        );

    if (!content) {

        return {
            success: true,
            learn: false,
            reason:
                "Learning content is empty."
        };
    }

    if (content.length < 10) {

        return {
            success: true,
            learn: false,
            reason:
                "Learning content is too short."
        };
    }

    if (input.learn === false) {

        return {
            success: true,
            learn: false,
            reason:
                "Learning explicitly disabled."
        };
    }

    return {
        success: true,
        learn: true,
        reason:
            "Content is suitable for learning."
    };
}

// ============================================================
// BUILD LEARNING RECORD
// ============================================================

function buildLearningRecord(input = {}) {

    const title =
        normalize(
            input.title
        ) ||
        "AarHen Learned Knowledge";

    const content =
        normalize(
            input.content
        );

    const category =
        normalize(
            input.category
        ) ||
        detectLearningType(input);

    const source =
        normalize(
            input.source
        ) ||
        "user";

    const concepts =
        extractConcepts(
            content
        );

    const chunks =
        splitIntoChunks(
            content
        );

    return {

        title,

        content,

        category,

        source,

        concepts,

        chunks,

        learnedAt:
            new Date()
                .toISOString(),

        learningEngine:
            "AarHen Continuous Learning Engine",

        learningVersion:
            "5.0.0"
    };
}

// ============================================================
// SAVE LEARNING TO MEMORY
// ============================================================

function saveLearningToMemory(
    record,
    input = {}
) {

    return memoryManager.remember({

        type:
            input.memoryType ||
            "knowledge",

        title:
            record.title,

        category:
            record.category,

        content:
            record.content,

        source:
            record.source,

        importance:
            input.importance ||
            "normal",

        confidence:
            typeof input.confidence ===
            "number"
                ? input.confidence
                : 0.60,

        verified:
            Boolean(
                input.verified
            ),

        tags:
            record.concepts,

        remember: true
    });
}

// ============================================================
// LEARN
// ============================================================

function learn(input = {}) {

    const decision =
        analyzeLearningDecision(
            input
        );

    if (!decision.learn) {

        return {

            success: true,

            learned: false,

            status:
                "learning-skipped",

            reason:
                decision.reason
        };
    }

    try {

        const record =
            buildLearningRecord(
                input
            );

        const saved =
            memoryStore.saveKnowledge({

                title:
                    record.title,

                content:
                    record.content,

                category:
                    record.category,

                source:
                    record.source,

                concepts:
                    record.concepts,

                chunks:
                    record.chunks,

                learnedAt:
                    record.learnedAt,

                learningEngine:
                    record.learningEngine,

                learningVersion:
                    record.learningVersion,

                verified:
                    Boolean(
                        input.verified
                    ),

                confidence:
                    typeof input.confidence ===
                    "number"
                        ? input.confidence
                        : 0.60
            });

        const memoryResult =
            saveLearningToMemory(
                record,
                input
            );

        return {

            success: true,

            learned: true,

            status:
                "learned-and-stored",

            title:
                record.title,

            category:
                record.category,

            source:
                record.source,

            concepts:
                record.concepts,

            chunkCount:
                record.chunks.length,

            knowledge:
                saved,

            memory:
                memoryResult,

            memoryId:
                memoryResult &&
                (
                    memoryResult.memoryId ||
                    memoryResult.id
                )
                    ? (
                        memoryResult.memoryId ||
                        memoryResult.id
                    )
                    : null,

            verified:
                Boolean(
                    input.verified
                ),

            confidence:
                typeof input.confidence ===
                "number"
                    ? input.confidence
                    : 0.60,

            timestamp:
                record.learnedAt
        };

    } catch (error) {

        return {

            success: false,

            learned: false,

            status:
                "learning-error",

            error:
                error.message
        };
    }
}

// ============================================================
// LEARN VERIFIED
// ============================================================
// Used by the Advanced Web Research Engine.
//
// IMPORTANT:
// This function does not bypass verification.
// The caller must provide:
//   verified: true
//   approved: true
//   confidence >= required level
//
// Research engine already performs source verification
// before calling this function.
// ============================================================

function learnVerified(input = {}) {

    const content =
        normalize(
            input.content
        );

    if (!content) {

        return {

            success: false,

            learned: false,

            verified: false,

            status:
                "verified-learning-failed",

            error:
                "Verified learning content is required."
        };
    }

    const confidence =
        typeof input.confidence ===
        "number"
            ? Math.max(
                0,
                Math.min(
                    1,
                    input.confidence
                )
            )
            : 0;

    // --------------------------------------------------------
    // Verified learning must explicitly be verified.
    // --------------------------------------------------------

    if (
        input.verified !== true
    ) {

        return {

            success: false,

            learned: false,

            verified: false,

            status:
                "verification-required",

            error:
                "Verified learning requires verified=true."
        };
    }

    // --------------------------------------------------------
    // Approved flag is also required for automatic learning.
    // --------------------------------------------------------

    if (
        input.approved !== true
    ) {

        return {

            success: false,

            learned: false,

            verified: false,

            status:
                "approval-required",

            error:
                "Verified learning requires approved=true."
        };
    }

    // --------------------------------------------------------
    // Safe minimum confidence.
    // The research engine normally sends >= 0.80.
    // --------------------------------------------------------

    if (
        confidence < 0.80
    ) {

        return {

            success: false,

            learned: false,

            verified: false,

            status:
                "confidence-too-low",

            confidence,

            error:
                "Verified learning requires confidence of at least 0.80."
        };
    }

    try {

        const result =
            learn({

                title:
                    input.title ||
                    "AarHen Verified Web Knowledge",

                content,

                category:
                    input.category ||
                    "research",

                source:
                    input.source ||
                    "web-research",

                memoryType:
                    input.memoryType ||
                    "knowledge",

                importance:
                    input.importance ||
                    "important",

                confidence,

                verified: true,

                learn: true
            });

        if (
            !result ||
            !result.success
        ) {

            return {

                success: false,

                learned: false,

                verified: false,

                status:
                    "verified-learning-failed",

                learning:
                    result || null,

                error:
                    result &&
                    result.error
                        ? result.error
                        : "Verified learning failed."
            };
        }

        return {

            success: true,

            learned: true,

            verified: true,

            approved: true,

            status:
                "verified-knowledge-learned",

            title:
                result.title,

            category:
                result.category,

            source:
                result.source,

            confidence,

            memoryId:
                result.memoryId ||
                null,

            knowledge:
                result.knowledge ||
                null,

            memory:
                result.memory ||
                null,

            concepts:
                result.concepts ||
                [],

            chunkCount:
                result.chunkCount ||
                0,

            learning:
                result,

            timestamp:
                result.timestamp ||
                new Date().toISOString()
        };

    } catch (error) {

        return {

            success: false,

            learned: false,

            verified: false,

            status:
                "verified-learning-error",

            error:
                error.message
        };
    }
}

// ============================================================
// LEARN FROM USER
// ============================================================

function learnFromUser(
    content,
    options = {}
) {

    const text =
        normalize(content);

    if (!text) {

        return {

            success: false,

            error:
                "Learning content is required."
        };
    }

    return learn({

        title:
            options.title ||
            "User Learned Information",

        content:
            text,

        category:
            options.category ||
            detectLearningType({
                content: text
            }),

        source:
            options.source ||
            "user",

        memoryType:
            options.memoryType ||
            "knowledge",

        importance:
            options.importance ||
            "normal",

        confidence:
            typeof options.confidence ===
            "number"
                ? options.confidence
                : 0.60,

        verified:
            Boolean(
                options.verified
            ),

        learn:
            options.learn !== false
    });
}

// ============================================================
// SEARCH LEARNED KNOWLEDGE
// ============================================================

function searchLearnedKnowledge(
    query = "",
    limit = 10
) {

    const cleanQuery =
        normalize(query);

    if (!cleanQuery) {

        return {

            success: false,

            error:
                "Knowledge search query is required.",

            results: []
        };
    }

    try {

        const results =
            memoryStore.findKnowledge(
                cleanQuery
            );

        const list =
            Array.isArray(results)
                ? results
                : [];

        const finalLimit =
            Number(limit) || 10;

        return {

            success: true,

            query:
                cleanQuery,

            count:
                Math.min(
                    list.length,
                    finalLimit
                ),

            results:
                list.slice(
                    0,
                    finalLimit
                ),

            status:
                "knowledge-search-complete"
        };

    } catch (error) {

        try {

            const fallback =
                memoryManager.recall(
                    cleanQuery,
                    {
                        limit:
                            Number(limit) ||
                            10
                    }
                );

            return {

                success:
                    Boolean(
                        fallback.success
                    ),

                query:
                    cleanQuery,

                count:
                    fallback.results
                        ?.length || 0,

                results:
                    fallback.results || [],

                status:
                    "knowledge-search-fallback"
            };

        } catch (fallbackError) {

            return {

                success: false,

                error:
                    error.message,

                results: []
            };
        }
    }
}

// ============================================================
// GET LEARNED KNOWLEDGE
// ============================================================

function getLearnedKnowledge(
    limit = 100
) {

    try {

        const results =
            memoryStore.findKnowledge(
                ""
            );

        const list =
            Array.isArray(results)
                ? results
                : [];

        const finalLimit =
            Number(limit) || 100;

        return {

            success: true,

            count:
                Math.min(
                    list.length,
                    finalLimit
                ),

            results:
                list.slice(
                    0,
                    finalLimit
                ),

            status:
                "learned-knowledge-loaded"
        };

    } catch (error) {

        try {

            const stats =
                memoryStore.getMemoryStats();

            return {

                success: true,

                count: 0,

                results: [],

                stats,

                status:
                    "learned-knowledge-empty"
            };

        } catch (fallbackError) {

            return {

                success: false,

                error:
                    error.message,

                results: []
            };
        }
    }
}

// ============================================================
// GET KNOWLEDGE BY ID
// ============================================================

function getKnowledgeById(
    memoryId
) {

    if (!memoryId) {

        return {

            success: false,

            error:
                "Knowledge ID is required."
        };
    }

    try {

        const result =
            memoryStore.getMemory(
                memoryId
            );

        if (!result) {

            return {

                success: false,

                error:
                    "Knowledge not found."
            };
        }

        return {

            success: true,

            memory:
                result
        };

    } catch (error) {

        return {

            success: false,

            error:
                error.message
        };
    }
}

// ============================================================
// VERIFY LEARNED MEMORY
// ============================================================

function verifyLearnedMemory(
    input = {}
) {

    if (!input.memoryId) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }

    return verification.verifyMemory({

        memoryId:
            input.memoryId,

        verifiedBy:
            input.verifiedBy ||
            "AarHen Verification Brain",

        sourceCount:
            input.sourceCount,

        confidence:
            input.confidence,

        notes:
            input.notes,

        evidence:
            input.evidence,

        conflictDetected:
            Boolean(
                input.conflictDetected
            )
    });
}

// ============================================================
// VERIFY KNOWLEDGE
// ============================================================

function verifyKnowledge(
    memoryId,
    options = {}
) {

    if (
        typeof memoryId ===
        "object"
    ) {

        options =
            memoryId;

        memoryId =
            options.memoryId;
    }

    return verifyLearnedMemory({

        memoryId,

        verifiedBy:
            options.verifiedBy,

        sourceCount:
            options.sourceCount,

        confidence:
            options.confidence,

        notes:
            options.notes,

        evidence:
            options.evidence,

        conflictDetected:
            options.conflictDetected
    });
}

// ============================================================
// CORRECT LEARNED MEMORY
// ============================================================

function learnCorrection(
    input = {}
) {

    if (!input.memoryId) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }

    const correction =
        normalize(
            input.correction
        );

    if (!correction) {

        return {

            success: false,

            error:
                "Correction content is required."
        };
    }

    try {

        const result =
            memoryStore.updateMemory(

                input.memoryId,

                {

                    content:
                        correction,

                    corrected:
                        true,

                    correctionReason:
                        input.reason ||
                        "User correction",

                    correctedAt:
                        new Date()
                            .toISOString(),

                    confidence:
                        typeof input.confidence ===
                        "number"

                            ? input.confidence

                            : 0.80
                }
            );

        return {

            success:
                Boolean(result),

            corrected:
                Boolean(result),

            memoryId:
                input.memoryId,

            status:
                result
                    ? "corrected"
                    : "correction-failed"
        };

    } catch (error) {

        return {

            success: false,

            corrected: false,

            error:
                error.message
        };
    }
}

// ============================================================
// CORRECT KNOWLEDGE
// ============================================================

function correctKnowledge(
    memoryId,
    correction,
    reason = "Knowledge correction"
) {

    if (
        typeof memoryId ===
        "object"
    ) {

        const input =
            memoryId;

        return learnCorrection({

            memoryId:
                input.memoryId,

            correction:
                input.correction,

            reason:
                input.reason,

            confidence:
                input.confidence
        });
    }

    return learnCorrection({

        memoryId,

        correction,

        reason
    });
}

// ============================================================
// ADD FEEDBACK
// ============================================================

function addFeedback(
    input = {}
) {

    if (!input.memoryId) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }

    const feedback =
        normalize(
            input.feedback
        );

    if (!feedback) {

        return {

            success: false,

            error:
                "Feedback is required."
        };
    }

    try {

        const storedMemory =
            memoryStore.getMemory(
                input.memoryId
            );

        if (!storedMemory) {

            return {

                success: false,

                error:
                    "Memory not found."
            };
        }

        const history =
            Array.isArray(
                storedMemory
                    .feedbackHistory
            )
                ? storedMemory
                    .feedbackHistory
                : [];

        history.push({

            feedback,

            helpful:
                input.helpful !== false,

            reason:
                input.reason ||
                "",

            createdAt:
                new Date()
                    .toISOString()
        });

        const updated =
            memoryStore.updateMemory(

                input.memoryId,

                {

                    feedbackHistory:
                        history,

                    lastFeedback:
                        feedback,

                    lastFeedbackHelpful:
                        input.helpful !== false,

                    updatedAt:
                        new Date()
                            .toISOString()
                }
            );

        return {

            success:
                Boolean(updated),

            memoryId:
                input.memoryId,

            helpful:
                input.helpful !== false,

            feedback,

            status:
                updated
                    ? "feedback-added"
                    : "feedback-failed"
        };

    } catch (error) {

        return {

            success: false,

            error:
                error.message
        };
    }
}

// ============================================================
// KNOWLEDGE FEEDBACK
// ============================================================

function addKnowledgeFeedback(
    memoryId,
    feedback,
    helpful = true,
    reason = ""
) {

    if (
        typeof memoryId ===
        "object"
    ) {

        const input =
            memoryId;

        return addFeedback({

            memoryId:
                input.memoryId,

            feedback:
                input.feedback,

            helpful:
                input.helpful,

            reason:
                input.reason
        });
    }

    return addFeedback({

        memoryId,

        feedback,

        helpful,

        reason
    });
}

// ============================================================
// MARK HELPFUL
// ============================================================

function markHelpful(
    memoryId,
    feedback = "Helpful"
) {

    return addFeedback({

        memoryId,

        feedback,

        helpful: true
    });
}

// ============================================================
// MARK NOT HELPFUL
// ============================================================

function markNotHelpful(
    memoryId,
    feedback = "Not helpful"
) {

    return addFeedback({

        memoryId,

        feedback,

        helpful: false
    });
}

// ============================================================
// KNOWLEDGE HELPFUL
// ============================================================

function markKnowledgeHelpful(
    memoryId,
    feedback = "Knowledge was helpful"
) {

    return markHelpful(
        memoryId,
        feedback
    );
}

// ============================================================
// KNOWLEDGE NOT HELPFUL
// ============================================================

function markKnowledgeNotHelpful(
    memoryId,
    feedback = "Knowledge was not helpful"
) {

    return markNotHelpful(
        memoryId,
        feedback
    );
}

// ============================================================
// LEARNING HISTORY
// ============================================================

function getLearningHistory(
    memoryId
) {

    if (!memoryId) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }

    const storedMemory =
        memoryStore.getMemory(
            memoryId
        );

    if (!storedMemory) {

        return {

            success: false,

            error:
                "Memory not found."
        };
    }

    return {

        success: true,

        memoryId,

        history: {

            createdAt:
                storedMemory
                    .createdAt,

            updatedAt:
                storedMemory
                    .updatedAt,

            learnedAt:
                storedMemory
                    .learnedAt,

            correctedAt:
                storedMemory
                    .correctedAt ||
                null,

            corrected:
                Boolean(
                    storedMemory
                        .corrected
                ),

            correctionReason:
                storedMemory
                    .correctionReason ||
                null,

            feedback:
                Array.isArray(
                    storedMemory
                        .feedbackHistory
                )
                    ? storedMemory
                        .feedbackHistory
                    : []
        }
    };
}

// ============================================================
// LEARNING STATS
// ============================================================

function getLearningStats() {

    try {

        const stats =
            memoryStore.getMemoryStats();

        return {

            success: true,

            stats,

            learningEngine:
                "AarHen Continuous Learning Engine",

            memoryManager:
                "Advanced Memory Manager",

            status:
                "learning-system-online"
        };

    } catch (error) {

        return {

            success: false,

            error:
                error.message
        };
    }
}

// ============================================================
// MEMORY STATUS
// ============================================================

function getMemoryStatus() {

    try {

        return memoryManager.getSummary();

    } catch (error) {

        return {

            success: false,

            error:
                error.message
        };
    }
}

// ============================================================
// LEARNING STATUS
// ============================================================

function getLearningStatus() {

    return {

        success: true,

        name:
            "AarHen Continuous Learning Engine",

        version:
            "5.0.0",

        status:
            "active",

        capabilities: [

            "text-learning",

            "verified-learning",

            "concept-extraction",

            "text-chunking",

            "knowledge-storage",

            "knowledge-search",

            "knowledge-retrieval",

            "memory-manager-integration",

            "automatic-memory-classification",

            "importance-tracking",

            "confidence-tracking",

            "learning-verification",

            "learning-correction",

            "learning-feedback",

            "learning-history",

            "learning-statistics"
        ],

        learningFlow: [

            "Observe",

            "Read",

            "Analyze",

            "Extract Concepts",

            "Classify",

            "Store Knowledge",

            "Store Memory",

            "Verify",

            "Receive Feedback",

            "Correct",

            "Recall"
        ],

        memoryIntegration: {

            enabled: true,

            manager:
                "Advanced Memory Manager",

            status:
                "connected"
        }
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    normalize,

    splitIntoChunks,

    extractConcepts,

    detectLearningType,

    analyzeLearningDecision,

    buildLearningRecord,

    saveLearningToMemory,

    learn,

    learnVerified,

    learnFromUser,

    searchLearnedKnowledge,

    getLearnedKnowledge,

    getKnowledgeById,

    verifyLearnedMemory,

    verifyKnowledge,

    learnCorrection,

    correctKnowledge,

    addFeedback,

    addKnowledgeFeedback,

    markHelpful,

    markNotHelpful,

    markKnowledgeHelpful,

    markKnowledgeNotHelpful,

    getLearningHistory,

    getLearningStats,

    getMemoryStatus,

    getLearningStatus
};
