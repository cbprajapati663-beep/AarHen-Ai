// ============================================================
// AARHEN CORE V5
// ADVANCED LONG-TERM MEMORY
// ============================================================

const fs =
    require("fs");

const path =
    require("path");

const crypto =
    require("crypto");

// ============================================================
// MEMORY STORAGE
// ============================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const MEMORY_FILE =
    path.join(
        DATA_DIR,
        "memory.json"
    );

// ============================================================
// INITIALIZE MEMORY
// ============================================================

function ensureMemoryFile() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }

    if (!fs.existsSync(MEMORY_FILE)) {

        fs.writeFileSync(
            MEMORY_FILE,
            "[]",
            "utf8"
        );
    }
}

// ============================================================
// READ MEMORY
// ============================================================

function readMemory() {

    ensureMemoryFile();

    try {

        const data =
            fs.readFileSync(
                MEMORY_FILE,
                "utf8"
            );

        const parsed =
            JSON.parse(
                data || "[]"
            );

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        return [];
    }
}

// ============================================================
// WRITE MEMORY
// ============================================================

function writeMemory(
    memories
) {

    ensureMemoryFile();

    fs.writeFileSync(
        MEMORY_FILE,
        JSON.stringify(
            memories,
            null,
            2
        ),
        "utf8"
    );
}

// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalizeText(
    text = ""
) {

    return String(text || "")
        .toLowerCase()
        .replace(
            /[^\p{L}\p{N}\s-]/gu,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

// ============================================================
// CREATE MEMORY FINGERPRINT
// ============================================================

function createFingerprint(
    data = {}
) {

    const text =
        normalizeText(
            [
                data.type,
                data.title,
                data.category,
                data.content
            ]
                .filter(Boolean)
                .join(" ")
        );

    return crypto
        .createHash("sha256")
        .update(text)
        .digest("hex");
}

// ============================================================
// CHECK DUPLICATE
// ============================================================

function findDuplicate(
    data = {},
    memories = null
) {

    const list =
        memories ||
        readMemory();

    const fingerprint =
        createFingerprint(
            data
        );

    return (
        list.find(
            item =>
                item.fingerprint ===
                fingerprint
        ) || null
    );
}

// ============================================================
// REMEMBER
// ============================================================

function remember(
    data = {}
) {

    const memories =
        readMemory();

    const duplicate =
        findDuplicate(
            data,
            memories
        );

    // --------------------------------------------------------
    // DUPLICATE MEMORY
    // --------------------------------------------------------

    if (duplicate) {

        return {
            ...duplicate,

            duplicate: true,

            message:
                "Existing memory found."
        };
    }

    // --------------------------------------------------------
    // CREATE MEMORY
    // --------------------------------------------------------

    const now =
        new Date().toISOString();

    const newMemory = {

        id:
            crypto.randomUUID(),

        createdAt:
            now,

        updatedAt:
            now,

        fingerprint:
            createFingerprint(
                data
            ),

        memoryVersion:
            1,

        status:
            data.status ||
            "active",

        ...data
    };

    memories.push(
        newMemory
    );

    writeMemory(
        memories
    );

    return newMemory;
}

// ============================================================
// GET ALL MEMORY
// ============================================================

function getAll() {

    return readMemory();
}

// ============================================================
// SEARCH MEMORY
// ============================================================

function search(
    query
) {

    const memories =
        readMemory();

    const words =
        normalizeText(
            query
        )
            .split(/\s+/)
            .filter(Boolean);

    if (
        words.length === 0
    ) {

        return [];
    }

    return memories
        .map(
            memory => {

                const text =
                    normalizeText(
                        JSON.stringify(
                            memory
                        )
                    );

                let score = 0;

                for (
                    const word
                    of words
                ) {

                    if (
                        text.includes(
                            word
                        )
                    ) {

                        score++;
                    }
                }

                // Verified memory priority
                if (
                    memory.verificationStatus ===
                    "verified"
                ) {

                    score += 3;
                }

                // Corrected memory priority
                if (
                    memory.status ===
                    "corrected"
                ) {

                    score += 4;
                }

                return {
                    memory,
                    score
                };
            }
        )
        .filter(
            item =>
                item.score > 0
        )
        .sort(
            (a, b) =>
                b.score -
                a.score
        )
        .map(
            item =>
                item.memory
        );
}

// ============================================================
// GET VERIFIED MEMORY
// ============================================================

function getVerified() {

    return readMemory()
        .filter(
            item =>
                item.verificationStatus ===
                    "verified" &&
                Number(
                    item.verificationConfidence ||
                    item.confidence ||
                    0
                ) >= 0.8
        );
}

// ============================================================
// GET MEMORY BY ID
// ============================================================

function getById(
    id
) {

    return readMemory()
        .find(
            memory =>
                memory.id === id
        ) || null;
}

// ============================================================
// UPDATE MEMORY
// ============================================================

function update(
    id,
    changes = {}
) {

    const memories =
        readMemory();

    const index =
        memories.findIndex(
            memory =>
                memory.id === id
        );

    if (
        index === -1
    ) {

        return null;
    }

    const existing =
        memories[index];

    const updated = {

        ...existing,

        ...changes,

        updatedAt:
            new Date().toISOString(),

        memoryVersion:
            Number(
                existing.memoryVersion ||
                1
            ) + 1
    };

    // Recalculate fingerprint if content changed
    if (
        changes.title !== undefined ||
        changes.category !== undefined ||
        changes.content !== undefined ||
        changes.type !== undefined
    ) {

        updated.fingerprint =
            createFingerprint(
                updated
            );
    }

    memories[index] =
        updated;

    writeMemory(
        memories
    );

    return updated;
}

// ============================================================
// FORGET MEMORY
// ============================================================

function forget(
    id
) {

    const memories =
        readMemory();

    const filtered =
        memories.filter(
            memory =>
                memory.id !== id
        );

    const deleted =
        memories.length !==
        filtered.length;

    if (deleted) {

        writeMemory(
            filtered
        );
    }

    return {
        deleted,
        remaining:
            filtered.length
    };
}

// ============================================================
// MEMORY STATISTICS
// ============================================================

function getStats() {

    const memories =
        readMemory();

    const knowledge =
        memories.filter(
            item =>
                item.type ===
                "knowledge"
        );

    const verified =
        memories.filter(
            item =>
                item.verificationStatus ===
                "verified"
        );

    const corrected =
        memories.filter(
            item =>
                item.status ===
                "corrected"
        );

    const active =
        memories.filter(
            item =>
                item.status ===
                    "active" ||
                item.status ===
                    "learned"
        );

    return {

        success: true,

        totalMemories:
            memories.length,

        knowledgeCount:
            knowledge.length,

        verifiedCount:
            verified.length,

        correctedCount:
            corrected.length,

        activeCount:
            active.length,

        storage:
            "JSON",

        memoryEngine:
            "Advanced Long-Term Memory",

        status:
            "active"
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    remember,

    getAll,

    search,

    getVerified,

    getById,

    update,

    forget,

    getStats,

    createFingerprint,

    findDuplicate
};
