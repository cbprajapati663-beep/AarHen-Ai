// ============================================================
// AARHEN CORE V5
// CONTINUOUS LEARNING ENGINE
// ============================================================

const memoryStore = require("./memoryStore");
const memory = require("./memory");
const verification = require("./verification");

function splitIntoChunks(text, size = 1200) {
    const content = String(text || "").trim();

    if (!content) return [];

    const chunks = [];

    for (let i = 0; i < content.length; i += size) {
        chunks.push(content.slice(i, i + size));
    }

    return chunks;
}

function extractConcepts(text) {
    const stopWords = new Set([
        "the", "is", "are", "was", "were",
        "and", "or", "to", "of", "in", "on",
        "for", "with", "a", "an",
        "this", "that", "it",
        "hai", "ka", "ki", "ke", "ko",
        "me", "mein", "se", "aur",
        "ye", "vo", "ek"
    ]);

    return [
        ...new Set(
            String(text || "")
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s-]/gu, " ")
                .split(/\s+/)
                .filter(word =>
                    word.length > 2 &&
                    !stopWords.has(word)
                )
        )
    ].slice(0, 100);
}

function learn({
    title = "Untitled Knowledge",
    content,
    category = "general",
    source = "unknown",
    approved = false
} = {}) {

    if (!content ||
        String(content).trim().length < 10) {

        return {
            success: false,
            error: "Learning content must contain at least 10 characters."
        };
    }

    const cleanContent =
        String(content).trim();

    const chunks =
        splitIntoChunks(cleanContent);

    const concepts =
        extractConcepts(cleanContent);

    const stored =
        memoryStore.saveKnowledge({
            type: "knowledge",
            title,
            category,
            content: cleanContent,
            source,
            verified: false,
            confidence: approved ? 0.6 : 0.4
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
                userApproved: Boolean(approved),
                verified: false,
                verificationStatus:
                    approved
                        ? "partially-verified"
                        : "review",
                status: "learned"
            }
        );

    return {
        success: true,
        memoryId: stored.memoryId,
        title,
        category,
        source,
        concepts,
        chunksCount: chunks.length,
        userApproved: Boolean(approved),
        verificationStatus:
            approved
                ? "partially-verified"
                : "review",
        status: "knowledge-learned",
        memory: updated
    };
}

function learnCorrection({
    memoryId,
    correction,
    reason = ""
} = {}) {

    if (!memoryId) {
        return {
            success: false,
            error: "Memory ID is required."
        };
    }

    if (!correction ||
        String(correction).trim().length < 3) {

        return {
            success: false,
            error: "Correction is required."
        };
    }

    const updated =
        memory.update(
            memoryId,
            {
                correction:
                    String(correction).trim(),

                correctionReason:
                    String(reason || "").trim(),

                correctedAt:
                    new Date().toISOString(),

                verified: true,
                verificationStatus: "verified",
                verificationConfidence: 0.95,
                verificationNotes:
                    "Corrected through learning feedback.",
                status: "corrected"
            }
        );

    if (!updated) {
        return {
            success: false,
            error: "Memory not found."
        };
    }

    return {
        success: true,
        memoryId,
        status: "knowledge-corrected",
        memory: updated
    };
}

function verifyLearnedMemory({
    memoryId,
    sourceCount = 1,
    confidence = 0.5,
    notes = ""
} = {}) {

    return verification.verifyMemory({
        memoryId,
        verifiedBy: "AarHen Verification Engine",
        sourceCount,
        confidence,
        notes
    });
}

function getLearningStats() {
    const all = memory.getAll();

    const knowledge =
        all.filter(item =>
            item.type === "knowledge"
        );

    const verified =
        knowledge.filter(item =>
            verification.isVerified(item)
        );

    return {
        success: true,
        totalKnowledge: knowledge.length,
        verifiedKnowledge: verified.length,
        reviewRequired:
            knowledge.length - verified.length,
        learningEngine: "active",
        status: "ready"
    };
}

module.exports = {
    learn,
    learnCorrection,
    verifyLearnedMemory,
    getLearningStats,
    splitIntoChunks,
    extractConcepts
};
