// ============================================================
// AARHEN CORE V5
// ADVANCED LONG-TERM MEMORY
// ============================================================

const crypto =
    require("crypto");

const storageProvider =
    require("./storageProvider");

const memoryHistory =
    require("./memoryHistory");

// ============================================================
// HELPERS
// ============================================================

function createId() {

    return (
        "mem_" +
        Date.now() +
        "_" +
        crypto
            .randomBytes(4)
            .toString("hex")
    );
}

function normalize(
    text = ""
) {

    return String(text || "")
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

function createFingerprint(
    item = {}
) {

    const source =
        [
            item.type || "",
            item.title || "",
            item.category || "",
            item.content || ""
        ]
            .map(normalize)
            .join("|");

    return crypto
        .createHash("sha256")
        .update(source)
        .digest("hex");
}

function getMemoryData() {

    return storageProvider.getAll();
}

// ============================================================
// REMEMBER
// ============================================================

function remember(
    data = {}
) {

    if (
        !data.content ||
        String(data.content)
            .trim()
            .length < 2
    ) {

        throw new Error(
            "Memory content is required."
        );
    }

    const fingerprint =
        createFingerprint(
            data
        );

    const existing =
        getMemoryData().find(
            item =>
                item.fingerprint ===
                fingerprint &&
                item.type !==
                    "memory-history"
        );

    if (existing) {

        return {

            ...existing,

            duplicate: true,

            status:
                "already-exists"
        };
    }

    const now =
        new Date().toISOString();

    const memory = {

        id:
            createId(),

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
            String(
                data.content
            ).trim(),

        source:
            data.source ||
            "unknown",

        verified:
            Boolean(
                data.verified
            ),

        confidence:
            typeof data.confidence ===
            "number"
                ? Math.max(
                    0,
                    Math.min(
                        1,
                        data.confidence
                    )
                )
                : 0.5,

        fingerprint,

        createdAt:
            now,

        updatedAt:
            now
    };

    storageProvider.add(
        memory
    );

    memoryHistory.recordChange({

        memoryId:
            memory.id,

        action:
            "create",

        previousData:
            null,

        newData:
            memory,

        reason:
            "Memory created.",

        source:
            data.source ||
            "unknown",

        actor:
            "AarHen"
    });

    return memory;
}

// ============================================================
// GET ALL MEMORY
// ============================================================

function getAll() {

    return getMemoryData()
        .filter(
            item =>
                item.type !==
                "memory-history"
        );
}

// ============================================================
// GET BY ID
// ============================================================

function getById(
    id
) {

    return storageProvider.findById(
        id
    );
}

// ============================================================
// SEARCH
// ============================================================

function search(
    query
) {

    const cleanQuery =
        normalize(
            query
        );

    if (!cleanQuery) {
        return [];
    }

    const words =
        [
            ...new Set(
                cleanQuery
                    .split(/\s+/)
                    .filter(
                        word =>
                            word.length >= 2
                    )
            )
        ];

    const memories =
        getAll();

    const scored =
        memories
            .map(
                item => {

                    const title =
                        normalize(
                            item.title
                        );

                    const category =
                        normalize(
                            item.category
                        );

                    const content =
                        normalize(
                            item.content
                        );

                    const concepts =
                        Array.isArray(
                            item.concepts
                        )
                            ? item.concepts
                                .map(
                                    normalize
                                )
                            : [];

                    let score = 0;

                    for (
                        const word
                        of words
                    ) {

                        if (
                            title.includes(
                                word
                            )
                        ) {
                            score += 5;
                        }

                        if (
                            category.includes(
                                word
                            )
                        ) {
                            score += 3;
                        }

                        if (
                            content.includes(
                                word
                            )
                        ) {
                            score += 1;
                        }

                        if (
                            concepts.some(
                                concept =>
                                    concept.includes(
                                        word
                                    )
                            )
                        ) {
                            score += 4;
                        }
                    }

                    if (
                        item.verified ===
                        true
                    ) {
                        score += 4;
                    }

                    if (
                        item.verificationStatus ===
                        "verified"
                    ) {
                        score += 5;
                    }

                    if (
                        item.status ===
                        "corrected"
                    ) {
                        score += 3;
                    }

                    return {
                        item,
                        score
                    };
                }
            )
            .filter(
                entry =>
                    entry.score > 0
            )
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );

    return scored.map(
        entry => ({

            ...entry.item,

            relevanceScore:
                entry.score
        })
    );
}

// ============================================================
// VERIFIED MEMORY
// ============================================================

function getVerified() {

    return getAll()
        .filter(
            item =>
                item.verified === true ||
                (
                    item.verificationStatus ===
                    "verified" &&
                    Number(
                        item.verificationConfidence ||
                        0
                    ) >= 0.8
                )
        );
}

// ============================================================
// UPDATE MEMORY
// ============================================================

function update(
    id,
    changes = {}
) {

    if (!id) {
        return null;
    }

    const existing =
        storageProvider.findById(
            id
        );

    if (!existing) {
        return null;
    }

    if (
        existing.type ===
        "memory-history"
    ) {
        return null;
    }

    const previousData =
        {
            ...existing
        };

    const updated =
        storageProvider.update(
            id,
            changes
        );

    if (!updated) {
        return null;
    }

    memoryHistory.recordChange({

        memoryId:
            id,

        action:
            changes.correction
                ? "correction"
                : changes.verificationStatus
                    ? "verification"
                    : "update",

        previousData,

        newData:
            updated,

        reason:
            changes.correctionReason ||
            changes.verificationNotes ||
            "Memory updated.",

        source:
            changes.source ||
            existing.source ||
            "system",

        actor:
            changes.actor ||
            "AarHen"
    });

    return updated;
}

// ============================================================
// FORGET MEMORY
// ============================================================

function forget(
    id
) {

    if (!id) {

        return {
            success: false,
            error:
                "Memory ID is required."
        };
    }

    const existing =
        storageProvider.findById(
            id
        );

    if (!existing) {

        return {
            success: false,
            error:
                "Memory not found."
        };
    }

    if (
        existing.type ===
        "memory-history"
    ) {

        return {
            success: false,
            error:
                "Memory history records cannot be deleted through memory."
        };
    }

    const removed =
        storageProvider.remove(
            id
        );

    if (!removed) {

        return {
            success: false,
            error:
                "Memory could not be removed."
        };
    }

    memoryHistory.recordChange({

        memoryId:
            id,

        action:
            "forget",

        previousData:
            existing,

        newData:
            null,

        reason:
            "Memory forgotten.",

        source:
            "system",

        actor:
            "AarHen"
    });

    return {

        success: true,

        memoryId:
            id,

        status:
            "forgotten"
    };
}

// ============================================================
// MEMORY HISTORY
// ============================================================

function getHistory(
    memoryId,
    limit = 50
) {

    return memoryHistory.getHistory(
        memoryId,
        limit
    );
}

// ============================================================
// MEMORY STATISTICS
// ============================================================

function getStats() {

    const all =
        getAll();

    const verified =
        all.filter(
            item =>
                item.verified ===
                true ||
                item.verificationStatus ===
                "verified"
        );

    const knowledge =
        all.filter(
            item =>
                item.type ===
                "knowledge"
        );

    return {

        success: true,

        total:
            all.length,

        knowledge:
            knowledge.length,

        verified:
            verified.length,

        unverified:
            all.length -
            verified.length,

        historyRecords:
            memoryHistory.countHistory(),

        storage:
            storageProvider.getInfo(),

        memoryEngine:
            "Advanced Long-Term Memory",

        storageProvider:
            storageProvider
                .getProviderInfo()
                .name,

        status:
            "active"
    };
}

// ============================================================
// STORAGE HEALTH
// ============================================================

function getStorageHealth() {

    return storageProvider.healthCheck();
}

// ============================================================
// MEMORY HEALTH
// ============================================================

function healthCheck() {

    try {

        const storageHealth =
            storageProvider.healthCheck();

        const all =
            getAll();

        return {

            success:
                storageHealth.success,

            healthy:
                storageHealth.healthy,

            memoryEngine:
                "Advanced Long-Term Memory",

            storage:
                storageHealth,

            memoryCount:
                all.length,

            historyRecords:
                memoryHistory.countHistory(),

            status:
                storageHealth.healthy
                    ? "memory-online"
                    : "memory-storage-error"
        };

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
// EXPORTS
// ============================================================

module.exports = {

    remember,

    getAll,

    getById,

    search,

    getVerified,

    update,

    forget,

    getHistory,

    getStats,

    getStorageHealth,

    healthCheck,

    createFingerprint,

    normalize
};
