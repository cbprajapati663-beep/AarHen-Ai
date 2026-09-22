const learning = require("./learning");

/**
 * AARHEN LEARNING API
 * Controlled API layer for the Learning Engine
 */

/**
 * Learn from user input
 */
async function learn(data = {}) {
    const input =
        typeof data === "string"
            ? data
            : data.input || data.content || data.text || "";

    if (!input || !String(input).trim()) {
        return {
            success: false,
            error: "Learning input is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.learnFromUser(
                input,
                data.context || {}
            )
        );

        return {
            success: true,
            action: "learn",
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Search learned knowledge
 */
async function searchLearnedKnowledge(query, limit = 10) {
    try {
        const result = await Promise.resolve(
            learning.searchLearnedKnowledge(
                query || "",
                Number(limit) || 10
            )
        );

        return {
            success: true,
            query: query || "",
            count: Array.isArray(result) ? result.length : 0,
            results: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get learned knowledge
 */
async function getLearnedKnowledge(limit = 50) {
    try {
        const result = await Promise.resolve(
            learning.getLearnedKnowledge(
                Number(limit) || 50
            )
        );

        return {
            success: true,
            count: Array.isArray(result) ? result.length : 0,
            knowledge: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get one knowledge/memory record
 */
async function getKnowledgeById(memoryId) {
    if (!memoryId) {
        return {
            success: false,
            error: "memoryId is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.getKnowledgeById(memoryId)
        );

        return {
            success: true,
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Correct learned knowledge
 */
async function correctKnowledge(memoryId, correction, options = {}) {
    if (!memoryId) {
        return {
            success: false,
            error: "memoryId is required"
        };
    }

    if (!correction) {
        return {
            success: false,
            error: "correction is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.correctKnowledge(
                memoryId,
                correction,
                options
            )
        );

        return {
            success: true,
            action: "correct",
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Add feedback to knowledge
 */
async function addKnowledgeFeedback(
    memoryId,
    feedback,
    options = {}
) {
    if (!memoryId) {
        return {
            success: false,
            error: "memoryId is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.addKnowledgeFeedback(
                memoryId,
                feedback,
                options
            )
        );

        return {
            success: true,
            action: "feedback",
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Mark knowledge helpful
 */
async function markKnowledgeHelpful(memoryId) {
    if (!memoryId) {
        return {
            success: false,
            error: "memoryId is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.markKnowledgeHelpful(memoryId)
        );

        return {
            success: true,
            action: "helpful",
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Mark knowledge not helpful
 */
async function markKnowledgeNotHelpful(memoryId) {
    if (!memoryId) {
        return {
            success: false,
            error: "memoryId is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.markKnowledgeNotHelpful(memoryId)
        );

        return {
            success: true,
            action: "not-helpful",
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get learning history
 */
async function getLearningHistory(limit = 50) {
    try {
        const result = await Promise.resolve(
            learning.getLearningHistory(
                Number(limit) || 50
            )
        );

        return {
            success: true,
            count: Array.isArray(result) ? result.length : 0,
            history: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Verify learned knowledge
 */
async function verifyKnowledge(memoryId, options = {}) {
    if (!memoryId) {
        return {
            success: false,
            error: "memoryId is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.verifyKnowledge(
                memoryId,
                options
            )
        );

        return {
            success: true,
            action: "verify",
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Learning system status
 */
async function getLearningStatus() {
    try {
        const result = await Promise.resolve(
            learning.getLearningStatus()
        );

        return {
            success: true,
            status: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Memory status used by Learning Engine
 */
async function getMemoryStatus() {
    try {
        const result = await Promise.resolve(
            learning.getMemoryStatus()
        );

        return {
            success: true,
            status: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}


/**
 * Learning API health
 */
async function health() {
    try {
        const learningStatus =
            await getLearningStatus();

        const memoryStatus =
            await getMemoryStatus();

        return {
            success:
                learningStatus.success &&
                memoryStatus.success,

            service: "AarHen Learning API",

            learning: learningStatus,

            memory: memoryStatus,

            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            success: false,
            service: "AarHen Learning API",
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}


/**
 * Public API
 */
module.exports = {
    learn,
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
    getMemoryStatus,
    health
};
