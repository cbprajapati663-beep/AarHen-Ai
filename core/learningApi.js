const learning = require("./learning");

/**
 * AARHEN LEARNING API
 * Compatible + Extended API Layer
 */

/**
 * Learn from user
 */
async function learnFromUser(input, context = {}) {
    if (!input || !String(input).trim()) {
        return {
            success: false,
            error: "Learning input is required"
        };
    }

    try {
        const result = await Promise.resolve(
            learning.learnFromUser(
                String(input),
                context
            )
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
 * Generic learning alias
 */
async function learn(data = {}) {
    const input =
        typeof data === "string"
            ? data
            : data.input ||
              data.content ||
              data.text ||
              "";

    const context =
        typeof data === "object"
            ? data.context || {}
            : {};

    return learnFromUser(input, context);
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
            count: Array.isArray(result)
                ? result.length
                : 0,
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
            count: Array.isArray(result)
                ? result.length
                : 0,
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
 * Get knowledge by ID
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
 * Correct knowledge
 */
async function correctKnowledge(
    memoryId,
    correction,
    options = {}
) {
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
 * Add feedback
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
 * Mark helpful
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
 * Mark not helpful
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
 * Learning history
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
            count: Array.isArray(result)
                ? result.length
                : 0,
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
 * Verify knowledge
 */
async function verifyKnowledge(
    memoryId,
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
            learning.verifyKnowledge(
                memoryId,
                options
            )
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
 * Learning status
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
 * Memory status
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
 * API health
 */
async function health() {
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
}


/**
 * Export everything
 *
 * IMPORTANT:
 * Old function names are preserved
 * for test.js and server compatibility.
 */
module.exports = {
    // New API
    learn,

    // Compatibility API
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
    getMemoryStatus,

    health
};
