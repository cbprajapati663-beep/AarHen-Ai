// ============================================================
// AARHEN CORE V5
// ADVANCED MEMORY MANAGER
// ============================================================

const memory =
    require("./memory");

const verification =
    require("./verification");

// ============================================================
// MEMORY TYPES
// ============================================================

const MEMORY_TYPES = [

    "user-preference",

    "business",

    "knowledge",

    "conversation",

    "important-fact",

    "temporary",

    "system"
];

// ============================================================
// IMPORTANCE LEVELS
// ============================================================

const IMPORTANCE_LEVELS = [

    "low",

    "normal",

    "high",

    "critical"
];

// ============================================================
// NORMALIZE
// ============================================================

function normalize(
    value = ""
) {

    return String(value || "")
        .trim();
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
        Number.isNaN(
            number
        )
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
// IMPORTANCE SCORE
// ============================================================

function getImportanceScore(
    importance = "normal"
) {

    const scores = {

        low:
            0.25,

        normal:
            0.50,

        high:
            0.75,

        critical:
            1.00
    };

    return (
        scores[
            String(
                importance
            ).toLowerCase()
        ] ||
        0.50
    );
}

// ============================================================
// DETECT MEMORY TYPE
// ============================================================

function detectMemoryType(
    input = {}
) {

    if (
        input.type &&
        MEMORY_TYPES.includes(
            input.type
        )
    ) {

        return input.type;
    }

    const text =
        normalize(
            input.content
        ).toLowerCase();

    if (!text) {

        return "temporary";
    }

    if (
        text.includes(
            "my preference"
        ) ||
        text.includes(
            "i prefer"
        ) ||
        text.includes(
            "always use"
        ) ||
        text.includes(
            "don't use"
        ) ||
        text.includes(
            "do not use"
        )
    ) {

        return "user-preference";
    }

    if (
        text.includes(
            "heritage auto finance"
        ) ||
        text.includes(
            "business"
        ) ||
        text.includes(
            "customer"
        ) ||
        text.includes(
            "loan"
        ) ||
        text.includes(
            "finance"
        )
    ) {

        return "business";
    }

    if (
        text.includes(
            "remember"
        ) ||
        text.includes(
            "important"
        )
    ) {

        return "important-fact";
    }

    return "conversation";
}

// ============================================================
// SHOULD REMEMBER
// ============================================================

function shouldRemember(
    input = {}
) {

    const content =
        normalize(
            input.content
        );

    if (!content) {

        return {

            remember:
                false,

            reason:
                "Empty content."
        };
    }

    if (
        content.length < 5
    ) {

        return {

            remember:
                false,

            reason:
                "Content is too short."
        };
    }

    if (
        input.remember ===
        false
    ) {

        return {

            remember:
                false,

            reason:
                "Memory explicitly disabled."
        };
    }

    if (
        input.type ===
        "temporary"
    ) {

        return {

            remember:
                false,

            reason:
                "Temporary information should not enter long-term memory."
        };
    }

    return {

        remember:
            true,

        reason:
            "Information is suitable for memory."
    };
}

// ============================================================
// BUILD MEMORY RECORD
// ============================================================

function buildMemoryRecord(
    input = {}
) {

    const type =
        detectMemoryType(
            input
        );

    const importance =
        IMPORTANCE_LEVELS.includes(
            input.importance
        )
            ? input.importance
            : "normal";

    const importanceScore =
        getImportanceScore(
            importance
        );

    const confidence =
        clamp(
            typeof input.confidence ===
            "number"
                ? input.confidence
                : 0.5
        );

    return {

        type,

        title:
            normalize(
                input.title
            ) ||
            "AarHen Memory",

        category:
            normalize(
                input.category
            ) ||
            type,

        content:
            normalize(
                input.content
            ),

        source:
            normalize(
                input.source
            ) ||
            "user",

        importance,

        importanceScore,

        confidence,

        verified:
            Boolean(
                input.verified
            ),

        tags:
            Array.isArray(
                input.tags
            )
                ? input.tags
                    .map(
                        tag =>
                            normalize(
                                tag
                            )
                    )
                    .filter(
                        Boolean
                    )
                : []
    };
}

// ============================================================
// REMEMBER
// ============================================================

function remember(
    input = {}
) {

    const decision =
        shouldRemember(
            input
        );

    if (!decision.remember) {

        return {

            success: true,

            remembered:
                false,

            status:
                "not-stored",

            reason:
                decision.reason
        };
    }

    try {

        const record =
            buildMemoryRecord(
                input
            );

        const saved =
            memory.remember(
                record
            );

        return {

            success: true,

            remembered:
                true,

            memoryId:
                saved.id,

            memory:
                saved,

            duplicate:
                Boolean(
                    saved.duplicate
                ),

            importance:
                record.importance,

            importanceScore:
                record.importanceScore,

            status:
                saved.duplicate
                    ? "already-exists"
                    : "stored"
        };

    } catch (error) {

        return {

            success: false,

            remembered:
                false,

            error:
                error.message
        };
    }
}

// ============================================================
// RECALL
// ============================================================

function recall(
    query = "",
    options = {}
) {

    const cleanQuery =
        normalize(
            query
        );

    if (!cleanQuery) {

        return {

            success: false,

            error:
                "Recall query is required.",

            results: []
        };
    }

    const limit =
        Number(
            options.limit
        ) || 10;

    let results =
        memory.search(
            cleanQuery
        );

    // ------------------------------------------
    // VERIFIED ONLY
    // ------------------------------------------

    if (
        options.verifiedOnly ===
        true
    ) {

        results =
            results.filter(
                item =>
                    verification.isVerified(
                        item
                    )
            );
    }

    // ------------------------------------------
    // TYPE FILTER
    // ------------------------------------------

    if (
        options.type &&
        MEMORY_TYPES.includes(
            options.type
        )
    ) {

        results =
            results.filter(
                item =>
                    item.type ===
                    options.type
            );
    }

    // ------------------------------------------
    // IMPORTANCE FILTER
    // ------------------------------------------

    if (
        options.minimumImportance
    ) {

        const minimum =
            getImportanceScore(
                options.minimumImportance
            );

        results =
            results.filter(
                item =>
                    Number(
                        item.importanceScore ||
                        0
                    ) >= minimum
            );
    }

    return {

        success: true,

        query:
            cleanQuery,

        count:
            Math.min(
                results.length,
                limit
            ),

        results:
            results.slice(
                0,
                limit
            )
    };
}

// ============================================================
// RECALL IMPORTANT
// ============================================================

function recallImportant(
    query = "",
    limit = 10
) {

    return recall(
        query,
        {

            limit,

            minimumImportance:
                "high"
        }
    );
}

// ============================================================
// RECALL VERIFIED
// ============================================================

function recallVerified(
    query = "",
    limit = 10
) {

    return recall(
        query,
        {

            limit,

            verifiedOnly:
                true
        }
    );
}

// ============================================================
// GET MEMORY
// ============================================================

function get(
    memoryId
) {

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
}

// ============================================================
// UPDATE
// ============================================================

function update(
    memoryId,
    changes = {}
) {

    if (!memoryId) {

        return {

            success: false,

            error:
                "Memory ID is required."
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
                "Memory not found or update failed."
        };
    }

    return {

        success: true,

        memory:
            updated,

        status:
            "updated"
    };
}

// ============================================================
// FORGET
// ============================================================

function forget(
    memoryId
) {

    return memory.forget(
        memoryId
    );
}

// ============================================================
// MEMORY PROFILE
// ============================================================

function getMemoryProfile(
    memoryId
) {

    const result =
        get(
            memoryId
        );

    if (!result.success) {

        return result;
    }

    const item =
        result.memory;

    return {

        success: true,

        memoryId:
            item.id,

        profile: {

            type:
                item.type,

            category:
                item.category,

            importance:
                item.importance ||
                "normal",

            importanceScore:
                Number(
                    item.importanceScore ||
                    0.5
                ),

            confidence:
                Number(
                    item.confidence ||
                    0
                ),

            verified:
                Boolean(
                    item.verified
                ),

            verificationStatus:
                item.verificationStatus ||
                "unverified",

            source:
                item.source ||
                "unknown",

            createdAt:
                item.createdAt,

            updatedAt:
                item.updatedAt
        }
    };
}

// ============================================================
// MEMORY SUMMARY
// ============================================================

function getSummary() {

    const all =
        memory.getAll();

    const summary = {

        total:
            all.length,

        byType: {},

        byImportance: {

            low: 0,

            normal: 0,

            high: 0,

            critical: 0
        },

        verified: 0,

        unverified: 0
    };

    for (
        const item
        of all
    ) {

        const type =
            item.type ||
            "unknown";

        summary.byType[type] =
            (
                summary.byType[type] ||
                0
            ) + 1;

        const importance =
            IMPORTANCE_LEVELS.includes(
                item.importance
            )
                ? item.importance
                : "normal";

        summary.byImportance[
            importance
        ]++;

        if (
            verification.isVerified(
                item
            )
        ) {

            summary.verified++;

        } else {

            summary.unverified++;
        }
    }

    return {

        success: true,

        summary,

        status:
            "memory-manager-online"
    };
}

// ============================================================
// MEMORY DECISION
// ============================================================

function analyzeMemoryDecision(
    input = {}
) {

    const decision =
        shouldRemember(
            input
        );

    const record =
        decision.remember
            ? buildMemoryRecord(
                input
            )
            : null;

    return {

        success: true,

        decision: {

            shouldRemember:
                decision.remember,

            reason:
                decision.reason,

            type:
                record
                    ? record.type
                    : null,

            importance:
                record
                    ? record.importance
                    : null,

            importanceScore:
                record
                    ? record.importanceScore
                    : 0,

            confidence:
                record
                    ? record.confidence
                    : 0
        }
    };
}

// ============================================================
// HEALTH
// ============================================================

function health() {

    try {

        const result =
            memory.healthCheck();

        return {

            success:
                result.success,

            healthy:
                result.healthy,

            memoryManager:
                "Advanced Memory Manager",

            memory:
                result,

            status:
                result.healthy
                    ? "memory-manager-online"
                    : "memory-manager-error"
        };

    } catch (error) {

        return {

            success: false,

            healthy: false,

            memoryManager:
                "Advanced Memory Manager",

            error:
                error.message,

            status:
                "memory-manager-error"
        };
    }
}

// ============================================================
// STATUS
// ============================================================

function getStatus() {

    return {

        success: true,

        name:
            "AarHen Advanced Memory Manager",

        version:
            "5.0.0",

        status:
            "active",

        capabilities: [

            "automatic-memory-decision",

            "memory-classification",

            "importance-scoring",

            "confidence-tracking",

            "memory-recall",

            "important-memory-recall",

            "verified-memory-recall",

            "memory-update",

            "memory-forget",

            "memory-profile",

            "memory-summary",

            "memory-health"
        ],

        memoryTypes:
            MEMORY_TYPES,

        importanceLevels:
            IMPORTANCE_LEVELS
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    MEMORY_TYPES,

    IMPORTANCE_LEVELS,

    normalize,

    clamp,

    getImportanceScore,

    detectMemoryType,

    shouldRemember,

    buildMemoryRecord,

    remember,

    recall,

    recallImportant,

    recallVerified,

    get,

    update,

    forget,

    getMemoryProfile,

    getSummary,

    analyzeMemoryDecision,

    health,

    getStatus
};
