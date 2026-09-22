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
// CONFIGURATION
// ============================================================

const DEFAULT_CHUNK_SIZE = 1200;

const DEFAULT_CONFIDENCE = 0.60;

const LEARNING_VERSION = "5.0.0";

// ============================================================
// NORMALIZE
// ============================================================

function normalize(value = "") {

    return String(
        value || ""
    ).trim();
}

// ============================================================
// CLAMP
// ============================================================

function clamp(
    value,
    min = 0,
    max = 1
) {

    const number =
        Number(value);

    if (
        Number.isNaN(number)
    ) {

        return min;
    }

    return Math.max(
        min,
        Math.min(
            max,
            number
        )
    );
}

// ============================================================
// SPLIT TEXT INTO CHUNKS
// ============================================================

function splitIntoChunks(
    text,
    size = DEFAULT_CHUNK_SIZE
) {

    const content =
        normalize(text);

    if (!content) {

        return [];
    }

    const chunkSize =
        Number(size) ||
        DEFAULT_CHUNK_SIZE;

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
// EXTRACT SIMPLE CONCEPTS
// ============================================================

function extractConcepts(
    text
) {

    const content =
        normalize(text);

    if (!content) {

        return [];
    }

    const words =
        content
            .toLowerCase()
            .replace(
                /[^a-z0-9\u0900-\u097f\u0a80-\u0aff\s-]/gi,
                " "
            )
            .split(/\s+/)
            .filter(
                word =>
                    word.length >= 4
            );

    const unique =
        [...new Set(words)];

    return unique.slice(
        0,
        50
    );
}

// ============================================================
// DETECT LEARNING TYPE
// ============================================================

function detectLearningType(
    category = "",
    content = ""
) {

    const categoryText =
        normalize(
            category
        ).toLowerCase();

    const contentText =
        normalize(
            content
        ).toLowerCase();

    if (

        categoryText.includes(
            "business"
        )

        ||

        contentText.includes(
            "heritage auto finance"
        )
    ) {

        return "business";
    }

    if (
        categoryText.includes(
            "preference"
        )
    ) {

        return "user-preference";
    }

    if (
        categoryText.includes(
            "conversation"
        )
    ) {

        return "conversation";
    }

    if (
        categoryText.includes(
            "system"
        )
    ) {

        return "system";
    }

    return "knowledge";
}

// ============================================================
// DETECT IMPORTANCE
// ============================================================

function detectLearningImportance(
    input = {}
) {

    if (
        input.importance
    ) {

        return input.importance;
    }

    const text =
        normalize(
            input.content
        ).toLowerCase();

    if (

        text.includes(
            "critical"
        )

        ||

        text.includes(
            "never forget"
        )
    ) {

        return "critical";
    }

    if (

        text.includes(
            "important"
        )

        ||

        text.includes(
            "always"
        )

        ||

        text.includes(
            "must"
        )
    ) {

        return "high";
    }

    return "normal";
}

// ============================================================
// DETECT CONFIDENCE
// ============================================================

function detectLearningConfidence(
    input = {}
) {

    if (
        typeof input.confidence ===
        "number"
    ) {

        return clamp(
            input.confidence
        );
    }

    if (
        input.approved === true
    ) {

        return 0.85;
    }

    if (
        input.verified === true
    ) {

        return 0.90;
    }

    if (

        input.source &&

        String(
            input.source
        ).toLowerCase() !==
        "user"
    ) {

        return 0.65;
    }

    return DEFAULT_CONFIDENCE;
}

// ============================================================
// BUILD LEARNING RECORD
// ============================================================

function buildLearningRecord(
    input = {}
) {

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
        "knowledge";

    const source =
        normalize(
            input.source
        ) ||
        "user";

    const type =
        input.type ||
        detectLearningType(
            category,
            content
        );

    const importance =
        detectLearningImportance(
            input
        );

    const confidence =
        detectLearningConfidence(
            input
        );

    const concepts =
        extractConcepts(
            content
        );

    return {

        type,

        title,

        category,

        content,

        source,

        importance,

        importanceScore:
            memoryManager
                .getImportanceScore(
                    importance
                ),

        confidence,

        concepts,

        approved:
            Boolean(
                input.approved
            ),

        verified:
            Boolean(
                input.verified
            ),

        learningManaged:
            true,

        learningVersion:
            LEARNING_VERSION,

        learnedAt:
            new Date()
                .toISOString()
    };
}

// ============================================================
// LEARN
// ============================================================

function learn(
    input = {}
) {

    const content =
        normalize(
            input.content
        );

    if (!content) {

        return {

            success: false,

            learned: false,

            error:
                "Learning content is required."
        };
    }

    const record =
        buildLearningRecord(
            input
        );

    const chunks =
        splitIntoChunks(
            content
        );

    try {

        const saved =
            memoryStore.saveKnowledge(
                record
            );

        let memoryResult =
            null;

        // ----------------------------------------------------
        // CONNECT LEARNING TO MEMORY MANAGER
        // ----------------------------------------------------

        if (
            input.storeMemory !== false
        ) {

            memoryResult =
                memoryManager.remember({

                    type:
                        record.type,

                    title:
                        record.title,

                    category:
                        record.category,

                    content:
                        record.content,

                    source:
                        record.source,

                    importance:
                        record.importance,

                    confidence:
                        record.confidence,

                    verified:
                        record.verified,

                    tags:
                        record.concepts,

                    remember:
                        true
                });
        }

        return {

            success: true,

            learned: true,

            memoryId:
                saved?.id ||
                memoryResult?.memoryId ||
                null,

            knowledge:
                saved,

            memory:
                memoryResult,

            chunks,

            chunkCount:
                chunks.length,

            concepts:
                record.concepts,

            type:
                record.type,

            importance:
                record.importance,

            confidence:
                record.confidence,

            status:
                "knowledge-learned"
        };

    } catch (error) {

        return {

            success: false,

            learned: false,

            error:
                error.message,

            status:
                "learning-error"
        };
    }
}

// ============================================================
// LEARN FROM USER
// ============================================================

function learnFromUser(
    input = {}
) {

    return learn({

        ...input,

        source:
            input.source ||
            "user",

        approved:
            input.approved !== false
    });
}

// ============================================================
// LEARN VERIFIED KNOWLEDGE
// ============================================================

function learnVerified(
    input = {}
) {

    return learn({

        ...input,

        verified: true,

        approved: true,

        confidence:
            Math.max(
                detectLearningConfidence(
                    input
                ),
                0.80
            )
    });
}

// ============================================================
// VERIFY LEARNED MEMORY
// ============================================================

function verifyLearnedMemory(
    input = {}
) {

    if (
        !input.memoryId
    ) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }

    try {

        return verification.verifyMemory({

            memoryId:
                input.memoryId,

            verifiedBy:
                input.verifiedBy ||
                "AarHen Learning Engine",

            sourceCount:
                Number(
                    input.sourceCount
                ) || 1,

            confidence:
                clamp(

                    typeof input.confidence ===
                    "number"

                        ? input.confidence

                        : 0.80
                ),

            notes:
                input.notes ||
                "Verified through learning engine.",

            evidence:
                input.evidence || [],

            conflictDetected:
                Boolean(
                    input.conflictDetected
                )
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
// CORRECT LEARNED MEMORY
// ============================================================

function learnCorrection(
    input = {}
) {

    if (
        !input.memoryId
    ) {

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

        const updated =
            memoryManager.update(

                input.memoryId,

                {

                    content:
                        correction,

                    corrected:
                        true,

                    correctionReason:
                        input.reason ||
                        "User correction",

                    correctedBy:
                        input.correctedBy ||
                        "user",

                    correctedAt:
                        new Date()
                            .toISOString(),

                    confidence:

                        typeof input.confidence ===
                        "number"

                            ? clamp(
                                input.confidence
                            )

                            : 0.80
                }
            );

        return {

            success:
                updated.success,

            corrected:
                updated.success,

            memory:
                updated.memory,

            status:
                updated.success
                    ? "memory-corrected"
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
// ADD FEEDBACK
// ============================================================

function addFeedback(
    input = {}
) {

    if (
        !input.memoryId
    ) {

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

        const existingResult =
            memoryStore.getMemory(
                input.memoryId
            );

        if (

            !existingResult ||

            existingResult.success === false ||

            !existingResult.memory
        ) {

            return {

                success: false,

                error:
                    "Memory not found."
            };
        }

        const existing =
            existingResult.memory;

        const history =
            Array.isArray(
                existing.feedbackHistory
            )

                ? existing.feedbackHistory

                : [];

        const feedbackRecord = {

            feedback,

            helpful:
                input.helpful !== false,

            reason:
                input.reason ||
                null,

            source:
                input.source ||
                "user",

            createdAt:
                new Date()
                    .toISOString()
        };

        history.push(
            feedbackRecord
        );

        const updated =
            memoryManager.update(

                input.memoryId,

                {

                    feedbackHistory:
                        history,

                    lastFeedback:
                        feedbackRecord,

                    feedbackCount:
                        history.length,

                    updatedBy:
                        "AarHen Learning Engine"
                }
            );

        return {

            success:
                updated.success,

            feedback:
                feedbackRecord,

            memory:
                updated.memory,

            status:
                updated.success
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
// MARK HELPFUL
// ============================================================

function markHelpful(
    memoryId,
    feedback =
        "User marked memory helpful."
) {

    return addFeedback({

        memoryId,

        feedback,

        helpful: true,

        source:
            "user"
    });
}

// ============================================================
// MARK NOT HELPFUL
// ============================================================

function markNotHelpful(
    memoryId,
    feedback =
        "User marked memory not helpful."
) {

    return addFeedback({

        memoryId,

        feedback,

        helpful: false,

        source:
            "user"
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
        normalize(
            query
        );

    if (!cleanQuery) {

        return {

            success: false,

            error:
                "Search query is required.",

            results: []
        };
    }

    try {

        const result =
            memoryManager.recall(

                cleanQuery,

                {

                    limit:
                        Number(limit) || 10,

                    type:
                        "knowledge"
                }
            );

        return {

            success:
                result.success,

            query:
                cleanQuery,

            count:
                result.count,

            results:
                result.results || []
        };

    } catch (error) {

        return {

            success: false,

            error:
                error.message,

            results: []
        };
    }
}

// ============================================================
// GET LEARNED KNOWLEDGE
// ============================================================

function getLearnedKnowledge(
    limit = 50
) {

    try {

        const result =
            memoryStore.findKnowledge(
                "",
                Number(limit) || 50
            );

        const results =
            result &&
            Array.isArray(
                result.results
            )

                ? result.results

                : [];

        const finalLimit =
            Number(limit) || 50;

        return {

            success:
                result?.success !== false,

            count:
                Math.min(
                    results.length,
                    finalLimit
                ),

            results:
                results.slice(
                    0,
                    finalLimit
                )
        };

    } catch (error) {

        return {

            success: false,

            error:
                error.message,

            results: []
        };
    }
}

// ============================================================
// GET KNOWLEDGE BY ID
// ============================================================

function getKnowledgeById(
    memoryId
) {

    if (
        !memoryId
    ) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }

    try {

        const result =
            memoryStore.getMemory(
                memoryId
            );

        if (

            !result ||

            result.success === false ||

            !result.memory
        ) {

            return {

                success: false,

                error:
                    "Knowledge not found."
            };
        }

        return {

            success: true,

            knowledge:
                result.memory
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
// GET LEARNING HISTORY
// ============================================================

function getLearningHistory(
    memoryId
) {

    if (
        !memoryId
    ) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }

    try {

        const result =
            memoryManager.get(
                memoryId
            );

        if (!result.success) {

            return result;
        }

        const item =
            result.memory;

        return {

            success: true,

            memoryId,

            history:
                Array.isArray(
                    item.feedbackHistory
                )
                    ? item.feedbackHistory
                    : [],

            correction:
                item.correctionReason ||
                null,

            corrected:
                Boolean(
                    item.corrected
                ),

            updatedAt:
                item.updatedAt ||
                null
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
// LEARNING STATS
// ============================================================

function getLearningStats() {

    try {

        const result =
            memoryStore.findKnowledge(
                "",
                100000
            );

        const all =
            result &&
            Array.isArray(
                result.results
            )

                ? result.results

                : [];

        const stats = {

            total:
                all.length,

            verified: 0,

            approved: 0,

            corrected: 0,

            withFeedback: 0,

            byType: {},

            byCategory: {}
        };

        for (
            const item of all
        ) {

            if (

                item.verified === true ||

                item.verificationStatus ===
                    "verified"
            ) {

                stats.verified++;
            }

            if (
                item.approved === true
            ) {

                stats.approved++;
            }

            if (
                item.corrected === true
            ) {

                stats.corrected++;
            }

            if (

                Array.isArray(
                    item.feedbackHistory
                ) &&

                item.feedbackHistory.length > 0
            ) {

                stats.withFeedback++;
            }

            const type =
                item.type ||
                "unknown";

            stats.byType[type] =
                (
                    stats
                        .byType[type] ||
                    0
                ) + 1;

            const category =
                item.category ||
                "general";

            stats.byCategory[
                category
            ] =
                (
                    stats
                        .byCategory[
                            category
                        ] ||
                    0
                ) + 1;
        }

        return {

            success: true,

            stats,

            status:
                "learning-engine-online"
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
// LEARNING STATUS
// ============================================================

function getLearningStatus() {

    return {

        success: true,

        name:
            "AarHen Continuous Learning Engine",

        version:
            LEARNING_VERSION,

        status:
            "active",

        capabilities: [

            "text-learning",

            "knowledge-chunking",

            "concept-extraction",

            "memory-manager-integration",

            "knowledge-storage",

            "verified-learning",

            "memory-correction",

            "feedback-learning",

            "learning-history",

            "learning-statistics",

            "knowledge-recall"
        ],

        connectedSystems: [

            "Memory Store",

            "Memory Manager",

            "Verification Engine",

            "RAG Knowledge Engine"
        ]
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    splitIntoChunks,

    extractConcepts,

    detectLearningType,

    detectLearningImportance,

    detectLearningConfidence,

    buildLearningRecord,

    learn,

    learnFromUser,

    learnVerified,

    verifyLearnedMemory,

    learnCorrection,

    addFeedback,

    markHelpful,

    markNotHelpful,

    searchLearnedKnowledge,

    getLearnedKnowledge,

    getKnowledgeById,

    getLearningHistory,

    getLearningStats,

    getLearningStatus
};
