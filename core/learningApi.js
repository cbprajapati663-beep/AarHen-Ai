// ============================================================
// AARHEN CORE V5
// LEARNING API LAYER
// ============================================================

const learning = require("./learning");
const memoryStore = require("./memoryStore");

function learnFromUser({
    title = "User Knowledge",
    content,
    category = "general",
    source = "user"
} = {}) {

    if (!content || String(content).trim().length < 10) {
        return {
            success: false,
            error: "Learning content must contain at least 10 characters."
        };
    }

    const result = learning.learn({
        title,
        content: String(content).trim(),
        category,
        source,
        approved: true
    });

    return {
        success: result.success,
        type: "user-learning",
        result,
        status: result.success
            ? "knowledge-stored"
            : "learning-failed"
    };
}

function searchLearnedKnowledge(query, limit = 10) {
    return memoryStore.findKnowledge(
        query,
        limit
    );
}

function getLearnedKnowledge(limit = 20) {
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
        knowledge: result.results
    };
}

function getKnowledgeById(memoryId) {
    return memoryStore.getMemory(memoryId);
}

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

function getLearningStatus() {
    return learning.getLearningStats();
}

module.exports = {
    learnFromUser,
    searchLearnedKnowledge,
    getLearnedKnowledge,
    getKnowledgeById,
    correctKnowledge,
    verifyKnowledge,
    getLearningStatus
};
