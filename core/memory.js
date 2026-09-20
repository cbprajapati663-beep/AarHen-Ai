// ============================================================
// AARHEN CORE V5
// ADVANCED LONG-TERM MEMORY
// ============================================================

const crypto =
    require("crypto");

const storage =
    require("./storage");

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

    return storage.getAll();
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
                fingerprint
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

    storage.add(
        memory
    );

    return memory;
}

// ============================================================
// GET ALL
// ============================================================

function getAll() {

    return getMemoryData();
}

// ============================================================
// GET BY ID
// ============================================================

function getById(
    id
) {

    return storage.findById(
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
        getMemoryData();

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

    return getMemoryData()
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
// UPDATE
// ============================================================

function update(
    id,
    changes = {}
) {

    if (!id) {
        return null;
    }

    const existing =
        storage.findById(
            id
        );

    if (!existing) {
        return null;
    }

    const updated =
        storage.update(
            id,
            changes
        );

    return updated;
}

// ============================================================
// FORGET
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
        storage.findById(
            id
        );

    if (!existing) {

        return {
            success: false,
            error:
                "Memory not found."
        };
    }

    const removed =
        storage.remove(
            id
        );

    return {

        success:
            removed,

        memoryId:
            id,

        status:
            removed
                ? "forgotten"
                : "not-removed"
    };
}

// ============================================================
// MEMORY STATISTICS
// ============================================================

function getStats() {

    const all =
        getMemoryData();

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

        storage:
            storage.getInfo(),

        memoryEngine:
            "Advanced Long-Term Memory",

        status:
            "active"
    };
}

// ============================================================
// STORAGE HEALTH
// ============================================================

function getStorageHealth() {

    return storage.healthCheck();
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

    getStats,

    getStorageHealth,

    createFingerprint,

    normalize
};
