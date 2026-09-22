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

function normalize(
    value = ""
) {
    return String(
        value || ""
    ).trim();
}

// ============================================================
// SPLIT TEXT INTO CHUNKS
// ============================================================

function splitIntoChunks(
    text,
    size = 1200
) {

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
                /[^\w\s-]/g,
                " "
            )
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

    for (
        const word of words
    ) {

        if (
            stopWords.has(word)
        ) {
            continue;
        }

        frequency[word] =
            (
                frequency[word] ||
                0
            ) + 1;
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

function detectLearningType(
    input = {}
) {

    const content =
        normalize(
            input.content
        ).toLowerCase();

    if (
        input.type
    ) {

        return input.type;
    }

    if (

        content.includes(
            "prefer"
        )

        ||

        content.includes(
            "preference"
        )

        ||

        content.includes(
            "always"
        )

        ||

        content.includes(
            "from now on"
        )
    ) {

        return "user-preference";
    }

    if (

        content.includes(
            "heritage auto finance"
        )

        ||

        content.includes(
            "vehicle finance"
        )

        ||

        content.includes(
            "vehicle loan"
        )

        ||

        content.includes(
            "customer"
        )

        ||

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

function analyzeLearningDecision(
    input = {}
) {

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

    if (
        content.length < 10
    ) {

        return {

            success: true,

            learn: false,

            reason:
                "Learning content is too short."
        };
    }

    if (
        input.learn === false
    ) {

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
        detectLearningType(
            input
        );

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

    const memoryResult =
        memoryManager.remember({

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

            remember:
                true
        });

    return memoryResult;
}

// ============================================================
// LEARN
// ============================================================

function learn(
    input = {}
) {

    const decision =
        analyzeLearningDecision(
            input
        );

    if (
        !decision.learn
    ) {

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

        // ----------------------------------------------------
        // SAVE TO EXISTING KNOWLEDGE STORE
        // ----------------------------------------------------

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
                    record.learningVersion
            });

        // ----------------------------------------------------
        // SAVE THROUGH MEMORY MANAGER
        // ----------------------------------------------------

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
// LEARN FROM USER
// ============================================================

function learnFromUser(
    content,
    options = {}
) {

    const text =
        normalize(
            content
        );

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
                content:
                    text
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
// FEEDBACK
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

        const memory =
            memoryStore.getMemory(
                input.memoryId
            );

        if (!memory) {

            return {

                success: false,

                error:
                    "Memory not found."
            };
        }

        const history =
            Array.isArray(
                memory.feedbackHistory
            )

                ? memory.feedbackHistory

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

    const memory =
        memoryStore.getMemory(
            memoryId
        );

    if (!memory) {

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
                memory.createdAt,

            updatedAt:
                memory.updatedAt,

            learnedAt:
                memory.learnedAt,

            correctedAt:
                memory.correctedAt ||
                null,

            corrected:
                Boolean(
                    memory.corrected
                ),

            correctionReason:
                memory.correctionReason ||
                null,

            feedback:
                Array.isArray(
                    memory.feedbackHistory
                )
                    ? memory.feedbackHistory
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

            "concept-extraction",

            "text-chunking",

            "knowledge-storage",

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

    learnFromUser,

    verifyLearnedMemory,

    learnCorrection,

    addFeedback,

    markHelpful,

    markNotHelpful,

    getLearningHistory,

    getLearningStats,

    getLearningStatus
};
