// ============================================================
// AARHEN CORE V5
// MEMORY API LAYER
// ============================================================

const memory =
    require("./memory");

const knowledge =
    require("../engines/knowledge");

// ============================================================
// REMEMBER
// ============================================================

function remember(data = {}) {

    try {

        if (
            !data.content ||
            String(data.content).trim().length < 2
        ) {

            return {
                success: false,
                error:
                    "Memory content is required."
            };
        }

        const saved =
            memory.remember({

                type:
                    data.type ||
                    "memory",

                title:
                    data.title ||
                    "Untitled Memory",

                category:
                    data.category ||
                    "general",

                content:
                    data.content,

                source:
                    data.source ||
                    "user",

                verified:
                    Boolean(
                        data.verified
                    ),

                confidence:
                    typeof data.confidence ===
                    "number"
                        ? data.confidence
                        : 0.5
            });

        return {

            success: true,

            memoryId:
                saved.id,

            memory:
                saved,

            duplicate:
                Boolean(
                    saved.duplicate
                ),

            status:
                saved.duplicate
                    ? "already-exists"
                    : "stored"
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
// SEARCH MEMORY
// ============================================================

function search(
    query = "",
    limit = 10
) {

    try {

        const cleanQuery =
            String(query || "").trim();

        if (!cleanQuery) {

            return {

                success: false,

                error:
                    "Memory search query is required.",

                results: []
            };
        }

        const results =
            memory.search(
                cleanQuery
            );

        return {

            success: true,

            query:
                cleanQuery,

            count:
                Math.min(
                    results.length,
                    Number(limit) || 10
                ),

            results:
                results.slice(
                    0,
                    Number(limit) || 10
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
// GET MEMORY
// ============================================================

function get(
    memoryId
) {

    try {

        if (!memoryId) {

            return {

                success: false,

                error:
                    "Memory ID is required."
            };
        }

        const result =
            memory.getById(
                memoryId
            );

        if (!result) {

            return {

                success: false,

                error:
                    "Memory not found."
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
// UPDATE MEMORY
// ============================================================

function update(
    memoryId,
    changes = {}
) {

    try {

        if (!memoryId) {

            return {

                success: false,

                error:
                    "Memory ID is required."
            };
        }

        if (
            !changes ||
            typeof changes !==
                "object"
        ) {

            return {

                success: false,

                error:
                    "Memory changes are required."
            };
        }

        const updated =
            memory.update(
                memoryId,
                changes
            );

        if (!updated) {

            return {

                success: false,

                error:
                    "Memory not found or could not be updated."
            };
        }

        return {

            success: true,

            memory:
                updated,

            status:
                "updated"
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
// FORGET MEMORY
// ============================================================

function forget(
    memoryId
) {

    try {

        if (!memoryId) {

            return {

                success: false,

                error:
                    "Memory ID is required."
            };
        }

        return memory.forget(
            memoryId
        );

    } catch (error) {

        return {

            success: false,

            error:
                error.message
        };
    }
}

// ============================================================
// VERIFIED MEMORY
// ============================================================

function getVerified(
    limit = 10
) {

    try {

        const results =
            memory.getVerified();

        const finalResults =
            results.slice(
                0,
                Number(limit) || 10
            );

        return {

            success: true,

            count:
                finalResults.length,

            results:
                finalResults
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
// KNOWLEDGE SEARCH
// ============================================================

function searchKnowledge(
    query = "",
    limit = 10
) {

    try {

        return knowledge.searchKnowledge(
            query,
            limit
        );

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
// VERIFIED KNOWLEDGE SEARCH
// ============================================================

function searchVerifiedKnowledge(
    query = "",
    limit = 10
) {

    try {

        return knowledge.searchVerifiedKnowledge(
            query,
            limit
        );

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
// MEMORY HISTORY
// ============================================================

function history(
    memoryId,
    limit = 50
) {

    try {

        if (!memoryId) {

            return {

                success: false,

                error:
                    "Memory ID is required."
            };
        }

        return memory.getHistory(
            memoryId,
            limit
        );

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

function status() {

    try {

        return memory.getStats();

    } catch (error) {

        return {

            success: false,

            error:
                error.message
        };
    }
}

// ============================================================
// MEMORY HEALTH
// ============================================================

function health() {

    try {

        return memory.healthCheck();

    } catch (error) {

        return {

            success: false,

            healthy: false,

            error:
                error.message,

            status:
                "memory-error"
        };
    }
}

// ============================================================
// MEMORY CONTROL STATUS
// ============================================================

function getControlStatus() {

    return {

        success: true,

        memoryEngine:
            "Advanced Long-Term Memory",

        controls: {

            remember:
                true,

            search:
                true,

            get:
                true,

            update:
                true,

            forget:
                true,

            verifiedRecall:
                true,

            knowledgeSearch:
                true,

            verifiedKnowledgeSearch:
                true,

            history:
                true,

            status:
                true,

            health:
                true
        },

        capabilities: [

            "remember",

            "recall",

            "search",

            "update",

            "forget",

            "verified-memory",

            "knowledge-retrieval",

            "verified-knowledge",

            "memory-history",

            "memory-health"
        ],

        status:
            "active"
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    remember,

    search,

    get,

    update,

    forget,

    getVerified,

    searchKnowledge,

    searchVerifiedKnowledge,

    history,

    status,

    health,

    getControlStatus
};
