// ============================================================
// AARHEN CORE V5
// MEMORY HISTORY & AUDIT ENGINE
// ============================================================

const crypto =
    require("crypto");

const storageProvider =
    require("./storageProvider");

// ============================================================
// HISTORY ID
// ============================================================

function createHistoryId() {

    return (
        "hist_" +
        Date.now() +
        "_" +
        crypto
            .randomBytes(4)
            .toString("hex")
    );
}

// ============================================================
// RECORD CHANGE
// ============================================================

function recordChange({

    memoryId,

    action =
        "update",

    previousData = null,

    newData = null,

    reason =
        "",

    source =
        "system",

    actor =
        "AarHen",

    metadata = {}

} = {}) {

    if (!memoryId) {

        return {
            success: false,
            error:
                "Memory ID is required."
        };
    }

    const historyRecord = {

        id:
            createHistoryId(),

        type:
            "memory-history",

        memoryId,

        action,

        previousData,

        newData,

        reason:
            String(
                reason || ""
            ).trim(),

        source,

        actor,

        metadata,

        createdAt:
            new Date().toISOString()
    };

    storageProvider.add(
        historyRecord
    );

    return {

        success: true,

        historyId:
            historyRecord.id,

        memoryId,

        action,

        record:
            historyRecord,

        status:
            "history-recorded"
    };
}

// ============================================================
// GET MEMORY HISTORY
// ============================================================

function getHistory(
    memoryId,
    limit = 50
) {

    if (!memoryId) {

        return {
            success: false,
            error:
                "Memory ID is required.",
            history: []
        };
    }

    const records =
        storageProvider
            .find(
                item =>
                    item &&
                    item.type ===
                        "memory-history" &&
                    item.memoryId ===
                        memoryId
            )
            .sort(
                (a, b) =>
                    new Date(
                        b.createdAt
                    ) -
                    new Date(
                        a.createdAt
                    )
            )
            .slice(
                0,
                Number(limit) || 50
            );

    return {

        success: true,

        memoryId,

        count:
            records.length,

        history:
            records
    };
}

// ============================================================
// GET HISTORY BY ACTION
// ============================================================

function getHistoryByAction(
    memoryId,
    action,
    limit = 50
) {

    const result =
        getHistory(
            memoryId,
            1000
        );

    if (!result.success) {
        return result;
    }

    const filtered =
        result.history
            .filter(
                item =>
                    item.action ===
                    action
            )
            .slice(
                0,
                Number(limit) || 50
            );

    return {

        success: true,

        memoryId,

        action,

        count:
            filtered.length,

        history:
            filtered
    };
}

// ============================================================
// GET LATEST CHANGE
// ============================================================

function getLatestChange(
    memoryId
) {

    const result =
        getHistory(
            memoryId,
            1
        );

    if (!result.success) {
        return result;
    }

    return {

        success: true,

        memoryId,

        latest:
            result.history[0] ||
            null
    };
}

// ============================================================
// COUNT HISTORY
// ============================================================

function countHistory(
    memoryId = null
) {

    const records =
        storageProvider
            .find(
                item =>
                    item &&
                    item.type ===
                        "memory-history"
            );

    if (!memoryId) {
        return records.length;
    }

    return records.filter(
        item =>
            item.memoryId ===
            memoryId
    ).length;
}

// ============================================================
// HISTORY STATISTICS
// ============================================================

function getHistoryStats() {

    const records =
        storageProvider
            .find(
                item =>
                    item &&
                    item.type ===
                        "memory-history"
            );

    const actionCounts = {};

    for (
        const record
        of records
    ) {

        const action =
            record.action ||
            "unknown";

        actionCounts[action] =
            (
                actionCounts[action] ||
                0
            ) + 1;
    }

    const memoryIds =
        [
            ...new Set(
                records
                    .map(
                        item =>
                            item.memoryId
                    )
                    .filter(Boolean)
            )
        ];

    return {

        success: true,

        totalHistoryRecords:
            records.length,

        memoriesWithHistory:
            memoryIds.length,

        actionCounts,

        historyEngine:
            "Memory History & Audit Engine",

        status:
            "active"
    };
}

// ============================================================
// VERIFY HISTORY INTEGRITY
// ============================================================

function verifyHistoryRecord(
    record
) {

    if (!record) {

        return {
            success: false,
            valid: false,
            error:
                "History record is required."
        };
    }

    const requiredFields =
        [
            "id",
            "memoryId",
            "action",
            "createdAt"
        ];

    const missingFields =
        requiredFields.filter(
            field =>
                !record[field]
        );

    return {

        success: true,

        valid:
            missingFields.length ===
            0,

        historyId:
            record.id,

        memoryId:
            record.memoryId,

        missingFields,

        status:
            missingFields.length ===
            0
                ? "valid"
                : "invalid"
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    createHistoryId,

    recordChange,

    getHistory,

    getHistoryByAction,

    getLatestChange,

    countHistory,

    getHistoryStats,

    verifyHistoryRecord

};
