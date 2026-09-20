// ============================================================
// AARHEN CORE V5
// LEARNING API LAYER
// ============================================================

const learning = require("./learning");
const memory = require("./memory");

function learnFromUser({
    title,
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
        title: title || "User Knowledge",
        content: String(content).trim(),
        category,
        source,
        approved: true
    });

    return {
        success: true,
        type: "user-learning",
        result,
        status: "knowledge-stored"
    };
}

function getLearnedKnowledge(limit = 20) {
    const all = memory.getAll();

    return all
        .filter(item => item.type === "knowledge")
        .slice(-Number(limit || 20))
        .reverse();
}

function getLearningStatus() {
    const all = memory.getAll();

    const knowledge = all.filter(
        item => item.type === "knowledge"
    );

    const verified = knowledge.filter(
        item => item.verified === true ||
                item.verificationStatus === "verified"
    );

    return {
        success: true,
        totalKnowledge: knowledge.length,
        verifiedKnowledge: verified.length,
        learningEngine: "active",
        status: "ready"
    };
}

module.exports = {
    learnFromUser,
    getLearnedKnowledge,
    getLearningStatus
};
