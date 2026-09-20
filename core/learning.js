// ============================================================
// AARHEN CORE V5
// CONTINUOUS LEARNING ENGINE
// ============================================================

const memoryStore =
    require("./memoryStore");

const memory =
    require("./memory");

const verification =
    require("./verification");

// ============================================================
// TEXT CHUNKING
// ============================================================

function splitIntoChunks(
    text,
    size = 1200
) {
    const content =
        String(text || "").trim();

    if (!content) {
        return [];
    }

    const chunks = [];

    for (
        let i = 0;
        i < content.length;
        i += size
    ) {
        chunks.push(
            content.slice(
                i,
                i + size
            )
        );
    }

    return chunks;
}

// ============================================================
// CONCEPT EXTRACTION
// ============================================================

function extractConcepts(text) {

    const stopWords =
        new Set([

            "the",
            "is",
            "are",
            "was",
            "were",
            "and",
            "or",
            "to",
            "of",
            "in",
            "on",
            "for",
            "with",
            "a",
            "an",
            "this",
            "that",
            "it",

            "hai",
            "ka",
            "ki",
            "ke",
            "ko",
            "me",
            "mein",
            "se",
            "aur",
            "ye",
            "vo",
            "ek"
        ]);

    return [
        ...new Set(

            String(text || "")
                .toLowerCase()
                .replace(
                    /[^\p{L}\p{N}\s-]/gu,
                    " "
                )
                .split(/\s+/)
                .filter(
                    word =>
                        word.length > 2 &&
                        !stopWords.has(word)
                )
        )
    ].slice(
        0,
        100
    );
}

// ============================================================
// LEARN KNOWLEDGE
// ============================================================

function learn({
    title = "Untitled Knowledge",
    content,
    category = "general",
    source = "unknown",
    approved = false
} = {}) {

    if (
        !content ||
        String(content).trim().length < 10
    ) {
        return {
            success: false,
            error:
                "Learning content must contain at least 10 characters."
        };
    }

    const cleanContent =
        String(content).trim();

    const chunks =
        splitIntoChunks(
            cleanContent
        );

    const concepts =
        extractConcepts(
            cleanContent
        );

    const stored =
        memoryStore.saveKnowledge({

            type:
                "knowledge",

            title,

            category,

            content:
                cleanContent,

            source,

            verified:
                false,

            confidence:
                approved
                    ? 0.6
                    : 0.4
        });

    if (!stored.success) {
        return stored;
    }

    const updated =
        memory.update(
            stored.memoryId,
            {

                chunks,

                concepts,

                learnedAt:
                    new Date().toISOString(),

                userApproved:
                    Boolean(approved),

                verified:
                    false,

                verificationStatus:
                    approved
                        ? "partially-verified"
                        : "review",

                status:
                    "learned",

                learningVersion:
                    1,

                feedbackCount:
                    0
            }
        );

    return {

        success: true,

        memoryId:
            stored.memoryId,

        title,

        category,

        source,

        concepts,

        chunksCount:
            chunks.length,

        userApproved:
            Boolean(approved),

        verificationStatus:
            approved
                ? "partially-verified"
                : "review",

        status:
            "knowledge-learned",

        memory:
            updated
    };
}

// ============================================================
// VERIFY LEARNED KNOWLEDGE
// ============================================================

function verifyLearnedMemory({
    memoryId,
    sourceCount = 1,
    confidence = 0.5,
    notes = ""
} = {}) {

    return verification.verifyMemory({

        memoryId,

        verifiedBy:
            "AarHen Verification Engine",

        sourceCount,

        confidence,

        notes
    });
}

// ============================================================
// USER CORRECTION
// ============================================================

function learnCorrection({
    memoryId,
    correction,
    reason = ""
} = {}) {

    if (!memoryId) {

        return {
            success: false,
            error:
                "Memory ID is required."
        };
    }

    if (
        !correction ||
        String(correction).trim().length < 3
    ) {

        return {
            success: false,
            error:
                "Correction is required."
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

    const previousContent =
        existing.content || "";

    const correctedContent =
        String(correction).trim();

    const chunks =
        splitIntoChunks(
            correctedContent
        );

    const concepts =
        extractConcepts(
            correctedContent
        );

    const feedbackHistory =
        Array.isArray(
            existing.feedbackHistory
        )
            ? existing.feedbackHistory
            : [];

    feedbackHistory.push({

        type:
            "correction",

        previousContent,

        correction:
            correctedContent,

        reason:
            String(reason || "").trim(),

        createdAt:
            new Date().toISOString()
    });

    const updated =
        memory.update(
            memoryId,
            {

                content:
                    correctedContent,

                chunks,

                concepts,

                correction:
                    correctedContent,

                correctionReason:
                    String(
                        reason || ""
                    ).trim(),

                correctedAt:
                    new Date().toISOString(),

                verified:
                    true,

                verificationStatus:
                    "verified",

                verificationConfidence:
                    0.95,

                verificationNotes:
                    "Knowledge corrected through user feedback.",

                status:
                    "corrected",

                learningVersion:
                    Number(
                        existing.learningVersion ||
                        1
                    ) + 1,

                feedbackCount:
                    Number(
                        existing.feedbackCount ||
                        0
                    ) + 1,

                feedbackHistory
            }
        );

    return {

        success: true,

        memoryId,

        status:
            "knowledge-corrected",

        learningAction:
            "updated-from-user-feedback",

        memory:
            updated
    };
}

// ============================================================
// GENERAL USER FEEDBACK
// ============================================================

function addFeedback({
    memoryId,
    feedback,
    helpful = null,
    reason = ""
} = {}) {

    if (!memoryId) {

        return {
            success: false,
            error:
                "Memory ID is required."
        };
    }

    if (
        !feedback ||
        String(feedback).trim().length < 2
    ) {

        return {
            success: false,
            error:
                "Feedback is required."
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

    const history =
        Array.isArray(
            existing.feedbackHistory
        )
            ? existing.feedbackHistory
            : [];

    history.push({

        type:
            "user-feedback",

        feedback:
            String(
                feedback
            ).trim(),

        helpful:

            helpful === null
                ? null
                : Boolean(helpful),

        reason:
            String(
                reason || ""
            ).trim(),

        createdAt:
            new Date().toISOString()
    });

    const updated =
        memory.update(
            memoryId,
            {

                feedbackHistory:
                    history,

                feedbackCount:
                    history.length,

                lastFeedbackAt:
                    new Date().toISOString(),

                lastFeedbackHelpful:
                    helpful === null
                        ? null
                        : Boolean(helpful)
            }
        );

    return {

        success: true,

        memoryId,

        feedbackCount:
            history.length,

        status:
            "feedback-recorded",

        memory:
            updated
    };
}

// ============================================================
// APPLY POSITIVE FEEDBACK
// ============================================================

function markHelpful(
    memoryId,
    feedback = "This knowledge was helpful."
) {

    return addFeedback({

        memoryId,

        feedback,

        helpful:
            true
    });
}

// ============================================================
// APPLY NEGATIVE FEEDBACK
// ============================================================

function markNotHelpful(
    memoryId,
    feedback = "This knowledge was not helpful."
) {

    return addFeedback({

        memoryId,

        feedback,

        helpful:
            false
    });
}

// ============================================================
// GET LEARNING HISTORY
// ============================================================

function getLearningHistory(
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

        feedbackCount:
            Number(
                item.feedbackCount || 0
            ),

        feedbackHistory:
            Array.isArray(
                item.feedbackHistory
            )
                ? item.feedbackHistory
                : [],

        learningVersion:
            Number(
                item.learningVersion || 1
            ),

        status:
            item.status || "active"
    };
}

// ============================================================
// LEARNING STATISTICS
// ============================================================

function getLearningStats() {

    const all =
        memory.getAll();

    const knowledge =
        all.filter(
            item =>
                item.type ===
                "knowledge"
        );

    const verified =
        knowledge.filter(
            item =>
                verification.isVerified(
                    item
                )
        );

    const corrected =
        knowledge.filter(
            item =>
                item.status ===
                "corrected"
        );

    const feedbackReceived =
        knowledge.filter(
            item =>
                Number(
                    item.feedbackCount || 0
                ) > 0
        );

    return {

        success: true,

        totalKnowledge:
            knowledge.length,

        verifiedKnowledge:
            verified.length,

        correctedKnowledge:
            corrected.length,

        feedbackKnowledge:
            feedbackReceived.length,

        reviewRequired:
            knowledge.length -
            verified.length,

        learningEngine:
            "Continuous Learning Engine",

        learningLoop: [

            "learn",

            "store",

            "verify",

            "recall",

            "use",

            "feedback",

            "correct",

            "update"
        ],

        status:
            "active"
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    learn,

    learnCorrection,

    verifyLearnedMemory,

    addFeedback,

    markHelpful,

    markNotHelpful,

    getLearningHistory,

    getLearningStats,

    splitIntoChunks,

    extractConcepts
};
