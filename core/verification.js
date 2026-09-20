// ============================================================
// AARHEN CORE V5
// SELF-VERIFICATION BRAIN
// ============================================================

const memory = require("./memory");


// ------------------------------------------------------------
// Create a verification record
// ------------------------------------------------------------

function verifyMemory({
    memoryId,
    verifiedBy = "system",
    sourceCount = 1,
    confidence = 0.5,
    notes = ""
} = {}) {

    if (!memoryId) {

        return {
            success: false,
            error: "memoryId is required."
        };

    }


    const existing =
        memory.getAll()
            .find(
                item =>
                    item.id === memoryId
            );


    if (!existing) {

        return {
            success: false,
            error: "Memory not found."
        };

    }


    let safeConfidence =
        Number(confidence);


    if (
        Number.isNaN(
            safeConfidence
        )
    ) {

        safeConfidence = 0.5;

    }


    safeConfidence =
        Math.max(
            0,
            Math.min(
                1,
                safeConfidence
            )
        );


    let verificationStatus =
        "review";


    if (
        sourceCount >= 2 &&
        safeConfidence >= 0.80
    ) {

        verificationStatus =
            "verified";

    }
    else if (
        sourceCount >= 1 &&
        safeConfidence >= 0.60
    ) {

        verificationStatus =
            "partially-verified";

    }


    const updated =
        memory.update(
            memoryId,
            {

                verificationStatus,

                verifiedBy,

                sourceCount:
                    Number(sourceCount),

                verificationConfidence:
                    safeConfidence,

                verificationNotes:
                    notes,

                lastVerifiedAt:
                    new Date().toISOString()

            }
        );


    return {

        success: true,

        memoryId:
            updated.id,

        verificationStatus,

        verificationConfidence:
            safeConfidence,

        sourceCount:
            Number(sourceCount)

    };

}


// ------------------------------------------------------------
// Check verification status
// ------------------------------------------------------------

function getVerificationStatus(
    memoryId
) {

    const existing =
        memory.getAll()
            .find(
                item =>
                    item.id === memoryId
            );


    if (!existing) {

        return {

            success: false,

            error:
                "Memory not found."

        };

    }


    return {

        success: true,

        memoryId:
            existing.id,

        title:
            existing.title,

        verificationStatus:
            existing.verificationStatus ||
            "unverified",

        confidence:
            existing.verificationConfidence ??
            0,

        sourceCount:
            existing.sourceCount ??
            0

    };

}


// ------------------------------------------------------------
// Check whether memory is verified
// ------------------------------------------------------------

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
            memoryItem.verificationConfidence || 0
        ) >= 0.80

    );

}


// ------------------------------------------------------------
// Verify multiple memories
// ------------------------------------------------------------

function getVerifiedMemories(
    memories = []
) {

    if (!Array.isArray(memories)) {

        return [];

    }


    return memories.filter(
        item =>
            isVerified(item)
    );

}


// ------------------------------------------------------------
// Calculate verification summary
// ------------------------------------------------------------

function verificationSummary(
    memories = []
) {

    const list =
        Array.isArray(memories)
            ? memories
            : [];


    const verified =
        getVerifiedMemories(
            list
        );


    const partiallyVerified =
        list.filter(
            item =>
                item.verificationStatus ===
                "partially-verified"
        );


    return {

        total:
            list.length,

        verified:
            verified.length,

        partiallyVerified:
            partiallyVerified.length,

        unverified:
            list.length -
            verified.length -
            partiallyVerified.length

    };

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    verifyMemory,

    getVerificationStatus,

    isVerified,

    getVerifiedMemories,

    verificationSummary

};
