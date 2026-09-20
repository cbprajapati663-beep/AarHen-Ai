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
// IMPORTANCE SCORE
// ============================================================

function getImportanceScore(
    importance = "normal"
) {

    const scores = {

        low: 0.25,

        normal: 0.50,

        high: 0.75,

        critical: 1.00
    };

    return (

        scores[
            String(
                importance
            ).toLowerCase()
        ]

        || 0.50
    );
}

// ============================================================
// NORMALIZE IMPORTANCE
// ============================================================

function normalizeImportance(
    importance
) {

    const value =
        String(
            importance || ""
        )
        .trim()
        .toLowerCase();

    if (
        IMPORTANCE_LEVELS
            .includes(value)
    ) {

        return value;
    }

    return "normal";
}

// ============================================================
// NORMALIZE TYPE
// ============================================================

function normalizeType(
    type
) {

    const value =
        String(
            type || ""
        )
        .trim()
        .toLowerCase();

    if (
        MEMORY_TYPES
            .includes(value)
    ) {

        return value;
    }

    return null;
}

// ============================================================
// DETECT MEMORY TYPE
// ============================================================

function detectMemoryType(
    input = {}
) {

    const explicitType =
        normalizeType(
            input.type
        );

    if (explicitType) {

        return explicitType;
    }

    const text =
        normalize(
            input.content
        )
        .toLowerCase();

    if (!text) {

        return "temporary";
    }

    // --------------------------------------------------------
    // USER PREFERENCE
    // --------------------------------------------------------

    if (

        text.includes(
            "my preference"
        )

        ||

        text.includes(
            "i prefer"
        )

        ||

        text.includes(
            "always use"
        )

        ||

        text.includes(
            "don't use"
        )

        ||

        text.includes(
            "do not use"
        )

        ||

        text.includes(
            "from now on"
        )

        ||

        text.includes(
            "going forward"
        )
    ) {

        return "user-preference";
    }

    // --------------------------------------------------------
    // BUSINESS
    // --------------------------------------------------------

    if (

        text.includes(
            "heritage auto finance"
        )

        ||

        text.includes(
            "customer"
        )

        ||

        text.includes(
            "vehicle finance"
        )

        ||

        text.includes(
            "vehicle loan"
        )

        ||

        text.includes(
            "commercial vehicle"
        )

        ||

        text.includes(
            "car finance"
        )

        ||

        text.includes(
            "refinance"
        )
    ) {

        return "business";
    }

    // --------------------------------------------------------
    // IMPORTANT FACT
    // --------------------------------------------------------

    if (

        text.includes(
            "remember"
        )

        ||

        text.includes(
            "important"
        )

        ||

        text.includes(
            "must remember"
        )
    ) {

        return "important-fact";
    }

    // --------------------------------------------------------
    // KNOWLEDGE
    // --------------------------------------------------------

    if (

        text.includes(
            "learn"
        )

        ||

        text.includes(
            "knowledge"
        )

        ||

        text.includes(
            "information"
        )

        ||

        text.includes(
            "concept"
        )
    ) {

        return "knowledge";
    }

    return "conversation";
}

// ============================================================
// DETECT IMPORTANCE
// ============================================================

function detectImportance(
    input = {}
) {

    if (
        input.importance
    ) {

        return normalizeImportance(
            input.importance
        );
    }

    const text =
        normalize(
            input.content
        )
        .toLowerCase();

    if (!text) {

        return "low";
    }

    // --------------------------------------------------------
    // CRITICAL
    // --------------------------------------------------------

    if (

        text.includes(
            "critical"
        )

        ||

        text.includes(
            "never forget"
        )

        ||

        text.includes(
            "very important"
        )
    ) {

        return "critical";
    }

    // --------------------------------------------------------
    // HIGH
    // --------------------------------------------------------

    if (

        text.includes(
            "important"
        )

        ||

        text.includes(
            "remember this"
        )

        ||

        text.includes(
            "always remember"
        )

        ||

        text.includes(
            "from now on"
        )
    ) {

        return "high";
    }

    // --------------------------------------------------------
    // LOW
    // --------------------------------------------------------

    if (

        text.length < 25

        ||

        text.includes(
            "temporary"
        )
    ) {

        return "low";
    }

    return "normal";
}

// ============================================================
// DETECT CONFIDENCE
// ============================================================

function detectConfidence(
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
        input.verified === true
    ) {

        return 0.90;
    }

    if (
        input.source &&
        String(
            input.source
        ).trim()
            .toLowerCase() !==
            "user"
    ) {

        return 0.60;
    }

    return 0.50;
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

            remember: false,

            reason:
                "Empty content."
        };
    }

    if (
        content.length < 5
    ) {

        return {

            remember: false,

            reason:
                "Content is too short."
        };
    }

    if (
        input.remember === false
    ) {

        return {

            remember: false,

            reason:
                "Memory explicitly disabled."
        };
    }

    if (
        input.type ===
        "temporary"
    ) {

        return {

            remember: false,

            reason:
                "Temporary information should not enter long-term memory."
        };
    }

    return {

        remember: true,

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
        detectImportance(
            input
        );

    const importanceScore =
        getImportanceScore(
            importance
        );

    const confidence =
        detectConfidence(
            input
        );

    const tags =
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
                .filter(Boolean)

            : [];

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

        tags,

        memoryManaged:
            true,

        managerVersion:
            "5.0.0",

        createdBy:
            "AarHen Memory Manager"
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

    if (
        !decision.remember
    ) {

        return {

            success: true,

            remembered: false,

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

            remembered: true,

            memoryId:
                saved.id,

            memory:
                saved,

            duplicate:
                Boolean(
                    saved.duplicate
                ),

            type:
                record.type,

            importance:
                record.importance,

            importanceScore:
                record.importanceScore,

            confidence:
                record.confidence,

            status:

                saved.duplicate

                    ? "already-exists"

                    : "stored"
        };

    } catch (error) {

        return {

            success: false,

            remembered: false,

            error:
                error.message
        };
    }
}

// ============================================================
// AUTO REMEMBER
// ============================================================

function autoRemember(
    input = {}
) {

    const decision =
        shouldRemember(
            input
        );

    if (
        !decision.remember
    ) {

        return {

            success: true,

            remembered: false,

            automatic: true,

            status:
                "auto-memory-skipped",

            reason:
                decision.reason
        };
    }

    return remember(
        {
            ...input,

            source:
                input.source ||
                "automatic-memory"
        }
    );
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

    // --------------------------------------------------------
    // VERIFIED ONLY
    // --------------------------------------------------------

    if (
        options.verifiedOnly ===
        true
    ) {

        results =
            results.filter(
                item =>
                    verification
                        .isVerified(
                            item
                        )
            );
    }

    // --------------------------------------------------------
    // TYPE FILTER
    // --------------------------------------------------------

    const requestedType =
        normalizeType(
            options.type
        );

    if (requestedType) {

        results =
            results.filter(
                item =>
                    item.type ===
                    requestedType
            );
    }

    // --------------------------------------------------------
    // IMPORTANCE FILTER
    // --------------------------------------------------------

    if (
        options.minimumImportance
    ) {

        const minimum =
            getImportanceScore(
                options
                    .minimumImportance
            );

        results =
            results.filter(
                item =>
                    Number(
                        item.importanceScore ||
                        getImportanceScore(
                            item.importance
                        )
                    ) >= minimum
            );
    }

    // --------------------------------------------------------
    // MANAGED MEMORY BOOST
    // --------------------------------------------------------

    results =
        results.map(
            item => {

                let managerScore =
                    0;

                if (
                    item.memoryManaged
                ) {

                    managerScore +=
                        0.10;
                }

                if (
                    item.importance ===
                    "critical"
                ) {

                    managerScore +=
                        0.20;
                }

                else if (
                    item.importance ===
                    "high"
                ) {

                    managerScore +=
                        0.10;
                }

                return {

                    ...item,

                    memoryManagerScore:
                        managerScore
                };
            }
        );

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
// RECALL CRITICAL
// ============================================================

function recallCritical(
    query = "",
    limit = 10
) {

    return recall(

        query,

        {

            limit,

            minimumImportance:
                "critical"
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

            verifiedOnly: true
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
// UPDATE IMPORTANCE
// ============================================================

function updateImportance(
    memoryId,
    importance
) {

    const normalized =
        normalizeImportance(
            importance
        );

    return update(

        memoryId,

        {

            importance:
                normalized,

            importanceScore:
                getImportanceScore(
                    normalized
                ),

            updatedBy:
                "AarHen Memory Manager"
        }
    );
}

// ============================================================
// UPDATE CONFIDENCE
// ============================================================

function updateConfidence(
    memoryId,
    confidence
) {

    return update(

        memoryId,

        {

            confidence:
                clamp(
                    confidence
                ),

            updatedBy:
                "AarHen Memory Manager"
        }
    );
}

// ============================================================
// FORGET
// ============================================================

function forget(
    memoryId
) {

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
}

// ============================================================
// GET MEMORY PROFILE
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
                    getImportanceScore(
                        item.importance
                    )
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

            memoryManaged:
                Boolean(
                    item.memoryManaged
                ),

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

        managed:
            0,

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
        const item of all
    ) {

        // ----------------------------------------------
        // MANAGED
        // ----------------------------------------------

        if (
            item.memoryManaged
        ) {

            summary.managed++;
        }

        // ----------------------------------------------
        // TYPE
        // ----------------------------------------------

        const type =
            MEMORY_TYPES.includes(
                item.type
            )

                ? item.type

                : "unknown";

        summary.byType[type] =
            (
                summary
                    .byType[type] ||
                0
            ) + 1;

        // ----------------------------------------------
        // IMPORTANCE
        // ----------------------------------------------

        const importance =
            IMPORTANCE_LEVELS
                .includes(
                    item.importance
                )

                ? item.importance

                : "normal";

        summary
            .byImportance[
                importance
            ]++;

        // ----------------------------------------------
        // VERIFICATION
        // ----------------------------------------------

        if (
            verification
                .isVerified(
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
// MEMORY HEALTH
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

            "automatic-memory-storage",

            "memory-classification",

            "importance-detection",

            "importance-scoring",

            "confidence-detection",

            "confidence-tracking",

            "duplicate-safe-memory",

            "memory-recall",

            "important-memory-recall",

            "critical-memory-recall",

            "verified-memory-recall",

            "memory-update",

            "importance-update",

            "confidence-update",

            "memory-forget",

            "memory-profile",

            "memory-summary",

            "memory-health"
        ],

        memoryTypes:
            MEMORY_TYPES,

        importanceLevels:
            IMPORTANCE_LEVELS,

        automaticMemory:
            true,

        userControl:
            true
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

    normalizeImportance,

    normalizeType,

    detectMemoryType,

    detectImportance,

    detectConfidence,

    shouldRemember,

    buildMemoryRecord,

    remember,

    autoRemember,

    recall,

    recallImportant,

    recallCritical,

    recallVerified,

    get,

    update,

    updateImportance,

    updateConfidence,

    forget,

    getMemoryProfile,

    getSummary,

    analyzeMemoryDecision,

    health,

    getStatus
};
