// ============================================================
// AARHEN CORE V5
// ADVANCED VERIFICATION ENGINE
// ============================================================

const memory =
    require("./memory");

// ============================================================
// HELPERS
// ============================================================

function clampConfidence(value) {

    const number =
        Number(value);

    if (Number.isNaN(number)) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(1, number)
    );
}

function normalizeSourceCount(value) {

    const count =
        Number(value);

    if (
        Number.isNaN(count) ||
        count < 0
    ) {
        return 0;
    }

    return Math.floor(count);
}

function determineStatus(
    sourceCount,
    confidence,
    conflictDetected = false
) {

    if (conflictDetected) {
        return "conflict-review";
    }

    if (
        sourceCount >= 2 &&
        confidence >= 0.8
    ) {
        return "verified";
    }

    if (
        sourceCount >= 1 &&
        confidence >= 0.6
    ) {
        return "partially-verified";
    }

    return "review";
}

// ============================================================
// VERIFY MEMORY
// ============================================================

function verifyMemory({

    memoryId,

    verifiedBy =
        "AarHen Verification Engine",

    sourceCount = 1,

    confidence = 0.5,

    notes = "",

    evidence = [],

    conflictDetected = false

} = {}) {

    if (!memoryId) {

        return {
            success: false,
            error:
                "Memory ID is required."
        };
    }

    const existing =
        memory.getById(
            memoryId
        );

    if (!existing) {

        return {
            success: false,
            error:
                "Memory not found."
        };
    }

    const normalizedSourceCount =
        normalizeSourceCount(
            sourceCount
        );

    const normalizedConfidence =
        clampConfidence(
            confidence
        );

    const normalizedEvidence =
        Array.isArray(evidence)
            ? evidence
            : [];

    const status =
        determineStatus(
            normalizedSourceCount,
            normalizedConfidence,
            Boolean(conflictDetected)
        );

    const updated =
        memory.update(
            memoryId,
            {

                verified:
                    status ===
                    "verified",

                verificationStatus:
                    status,

                verificationConfidence:
                    normalizedConfidence,

                verificationSourceCount:
                    normalizedSourceCount,

                verificationSources:
                    normalizedEvidence,

                verificationEvidence:
                    normalizedEvidence,

                verificationConflict:
                    Boolean(
                        conflictDetected
                    ),

                verifiedBy,

                verificationNotes:
                    String(
                        notes || ""
                    ).trim(),

                lastVerifiedAt:
                    new Date().toISOString()
            }
        );

    if (!updated) {

        return {
            success: false,
            error:
                "Memory update failed."
        };
    }

    return {

        success: true,

        memoryId,

        verificationStatus:
            status,

        verified:
            status === "verified",

        confidence:
            normalizedConfidence,

        sourceCount:
            normalizedSourceCount,

        evidenceCount:
            normalizedEvidence.length,

        conflictDetected:
            Boolean(
                conflictDetected
            ),

        verifiedBy,

        notes:
            String(
                notes || ""
            ).trim(),

        memory:
            updated
    };
}

// ============================================================
// GET VERIFICATION STATUS
// ============================================================

function getVerificationStatus(
    memoryId
) {

    if (!memoryId) {

        return {
            success: false,
            error:
                "Memory ID is required."
        };
    }

    const item =
        memory.getById(
            memoryId
        );

    if (!item) {

        return {
            success: false,
            error:
                "Memory not found."
        };
    }

    return {

        success: true,

        memoryId,

        verified:
            Boolean(
                item.verified
            ),

        verificationStatus:
            item.verificationStatus ||
            "review",

        verificationConfidence:
            Number(
                item.verificationConfidence ||
                item.confidence ||
                0
            ),

        verificationSourceCount:
            Number(
                item.verificationSourceCount ||
                item.sourceCount ||
                0
            ),

        verificationSources:
            Array.isArray(
                item.verificationSources
            )
                ? item.verificationSources
                : [],

        verificationEvidence:
            Array.isArray(
                item.verificationEvidence
            )
                ? item.verificationEvidence
                : [],

        verificationConflict:
            Boolean(
                item.verificationConflict
            ),

        verifiedBy:
            item.verifiedBy ||
            null,

        verificationNotes:
            item.verificationNotes ||
            "",

        lastVerifiedAt:
            item.lastVerifiedAt ||
            null
    };
}

// ============================================================
// CHECK VERIFIED
// ============================================================

function isVerified(
    memoryItem
) {

    if (!memoryItem) {
        return false;
    }

    return (

        memoryItem.verificationStatus ===
            "verified"

        &&

        Number(
            memoryItem.verificationConfidence ||
            0
        ) >= 0.8

        &&

        Number(
            memoryItem.verificationSourceCount ||
            memoryItem.sourceCount ||
            0
        ) >= 2

        &&

        memoryItem.verificationConflict !==
            true
    );
}

// ============================================================
// GET VERIFIED MEMORIES
// ============================================================

function getVerifiedMemories() {

    return memory
        .getAll()
        .filter(
            item =>
                isVerified(item)
        );
}

// ============================================================
// GET REVIEW REQUIRED
// ============================================================

function getReviewRequiredMemories() {

    return memory
        .getAll()
        .filter(
            item =>
                item.type === "knowledge" &&
                !isVerified(item)
        );
}

// ============================================================
// VERIFICATION SUMMARY
// ============================================================

function verificationSummary() {

    const all =
        memory.getAll();

    const knowledge =
        all.filter(
            item =>
                item.type === "knowledge"
        );

    const verified =
        knowledge.filter(
            item =>
                isVerified(item)
        );

    const partial =
        knowledge.filter(
            item =>
                item.verificationStatus ===
                "partially-verified"
        );

    const conflicts =
        knowledge.filter(
            item =>
                item.verificationConflict ===
                true
        );

    const review =
        knowledge.filter(
            item =>
                !isVerified(item)
        );

    return {

        success: true,

        totalKnowledge:
            knowledge.length,

        verified:
            verified.length,

        partiallyVerified:
            partial.length,

        conflicts:
            conflicts.length,

        reviewRequired:
            review.length,

        verificationEngine:
            "Advanced Verification Engine",

        rules: {

            verified:
                "2+ sources AND confidence >= 0.80",

            partiallyVerified:
                "1+ source AND confidence >= 0.60",

            conflict:
                "Conflicting evidence requires review",

            review:
                "Insufficient verification confidence"
        }
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    verifyMemory,

    getVerificationStatus,

    isVerified,

    getVerifiedMemories,

    getReviewRequiredMemories,

    verificationSummary,

    determineStatus,

    clampConfidence,

    normalizeSourceCount
};
