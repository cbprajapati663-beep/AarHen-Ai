// ============================================================
// AARHEN CORE V5
// LEARNING API
// ============================================================

const learning =
    require("./learning");

const memoryStore =
    require("./memoryStore");

// ============================================================
// LEARN FROM USER
// ============================================================

function learnFromUser({
    title = "User Knowledge",
    content,
    category = "general",
    source = "user"
} = {}) {

    if (
        !content ||
        String(content).trim().length < 10
    ) {
        return {
            success: false,
            error:
                "Learning content must contain at least 10 characters."
        };
    }

    const result =
        learning.learn({

            title,

            content:
                String(content).trim(),

            category,

            source,

            approved:
                true
        });

    return {

        success:
            result.success,

        type:
            "user-learning",

        result,

        status:
            result.success
                ? "knowledge-stored"
                : "learning-failed"
    };
}

// ============================================================
// SEARCH LEARNED KNOWLEDGE
// ============================================================

function searchLearnedKnowledge(
    query,
    limit = 10
) {

    return memoryStore.findKnowledge(
        query,
        limit
    );
}

// ============================================================
// GET LEARNED KNOWLEDGE
// ============================================================

function getLearnedKnowledge(
    limit = 20
) {

    const result =
        memoryStore.findKnowledge(
            "",
            limit
        );

    if (!result.success) {

        return {
            success: true,
            knowledge: []
        };
    }

    return {

        success: true,

        knowledge:
            result.results
    };
}

// ============================================================
// GET KNOWLEDGE BY ID
// ============================================================

function getKnowledgeById(
    memoryId
) {

    return memoryStore.getMemory(
        memoryId
    );
}

// ============================================================
// CORRECT KNOWLEDGE
// ============================================================

function correctKnowledge({
    memoryId,
    correction,
    reason = ""
} = {}) {

    return learning.learnCorrection({

        memoryId,

        correction,

        reason
    });
}

// ============================================================
// ADD USER FEEDBACK
// ============================================================

function addKnowledgeFeedback({
    memoryId,
    feedback,
    helpful = null,
    reason = ""
} = {}) {

    return learning.addFeedback({

        memoryId,

        feedback,

        helpful,

        reason
    });
}

// ============================================================
// MARK KNOWLEDGE HELPFUL
// ============================================================

function markKnowledgeHelpful(
    memoryId,
    feedback
) {

    return learning.markHelpful(
        memoryId,
        feedback
    );
}

// ============================================================
// MARK KNOWLEDGE NOT HELPFUL
// ============================================================

function markKnowledgeNotHelpful(
    memoryId,
    feedback
) {

    return learning.markNotHelpful(
        memoryId,
        feedback
    );
}

// ============================================================
// GET LEARNING HISTORY
// ============================================================

function getLearningHistory(
    memoryId
) {

    return learning.getLearningHistory(
        memoryId
    );
}

// ============================================================
// VERIFY KNOWLEDGE
// ============================================================

function verifyKnowledge({
    memoryId,
    sourceCount = 1,
    confidence = 0.5,
    notes = ""
} = {}) {

    return learning.verifyLearnedMemory({

        memoryId,

        sourceCount,

        confidence,

        notes
    });
}

// ============================================================
// LEARNING STATUS
// ============================================================

function getLearningStatus() {

    return learning.getLearningStats();
}

// ============================================================
// MEMORY STATUS
// ============================================================

function getMemoryStatus() {

    return memoryStore.getMemoryStats();
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    learnFromUser,

    searchLearnedKnowledge,

    getLearnedKnowledge,

    getKnowledgeById,

    correctKnowledge,

    addKnowledgeFeedback,

    markKnowledgeHelpful,

    markKnowledgeNotHelpful,

    getLearningHistory,

    verifyKnowledge,

    getLearningStatus,

    getMemoryStatus
};
