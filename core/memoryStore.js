// ============================================================
// AARHEN CORE V5
// MEMORY STORE
// ============================================================

const memory = require("./memory");

function saveKnowledge(data = {}) {
    if (!data.content || String(data.content).trim().length < 10) {
        return {
            success: false,
            error: "Knowledge content is too short."
        };
    }

    const saved = memory.remember({
        type: data.type || "knowledge",
        title: data.title || "Untitled Knowledge",
        category: data.category || "general",
        content: String(data.content).trim(),
        source: data.source || "unknown",
        verified: Boolean(data.verified),
        confidence:
            typeof data.confidence === "number"
                ? Math.max(0, Math.min(1, data.confidence))
                : 0.5
    });

    return {
        success: true,
        memoryId: saved.id,
        memory: saved,
        status: "stored"
    };
}

function findKnowledge(query, limit = 10) {
    if (!query || String(query).trim() === "") {
        return {
            success: false,
            error: "Search query is required."
        };
    }

    const results = memory.search(query);

    return {
        success: true,
        query: String(query),
        count: Math.min(results.length, Number(limit) || 10),
        results: results.slice(0, Number(limit) || 10)
    };
}

function getMemory(memoryId) {
    const all = memory.getAll();

    const found = all.find(
        item => item.id === memoryId
    );

    if (!found) {
        return {
            success: false,
            error: "Memory not found."
        };
    }

    return {
        success: true,
        memory: found
    };
}

function updateMemory(memoryId, changes = {}) {
    const updated = memory.update(
        memoryId,
        changes
    );

    if (!updated) {
        return {
            success: false,
            error: "Memory not found."
        };
    }

    return {
        success: true,
        memory: updated,
        status: "updated"
    };
}

function deleteMemory(memoryId) {
    return memory.forget(memoryId);
}

function getMemoryStats() {
    const all = memory.getAll();

    const knowledge = all.filter(
        item => item.type === "knowledge"
    );

    const verified = knowledge.filter(
        item =>
            item.verified === true ||
            item.verificationStatus === "verified"
    );

    return {
        success: true,
        totalMemories: all.length,
        knowledgeCount: knowledge.length,
        verifiedKnowledge: verified.length,
        unverifiedKnowledge:
            knowledge.length - verified.length
    };
}

module.exports = {
    saveKnowledge,
    findKnowledge,
    getMemory,
    updateMemory,
    deleteMemory,
    getMemoryStats
};
