// ============================================================
// AARHEN CORE V5
// Continuous Learning Engine
// ============================================================

const memory = require("./memory");

function splitIntoChunks(text, size = 1200) {
    const chunks = [];

    for (let i = 0; i < text.length; i += size) {
        chunks.push(text.slice(i, i + size));
    }

    return chunks;
}

function extractConcepts(text) {
    const stopWords = new Set([
        "this", "that", "with", "from", "have", "will",
        "your", "about", "there", "which", "their",
        "और", "यह", "वह", "से", "को", "का", "की",
        "है", "में", "और", "के", "पर"
    ]);

    return [...new Set(
        String(text)
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .split(/\s+/)
            .filter(word =>
                word.length >= 4 &&
                !stopWords.has(word)
            )
    )].slice(0, 100);
}

function learn({
    title = "Untitled Knowledge",
    content,
    category = "general",
    source = "user",
    approved = true
}) {

    if (!content || String(content).trim().length < 10) {
        return {
            success: false,
            error: "Knowledge content is too short."
        };
    }

    const cleanContent = String(content).trim();

    const chunks = splitIntoChunks(cleanContent);

    const concepts = extractConcepts(cleanContent);

    const knowledge = memory.remember({
        type: "knowledge",

        title,

        category,

        source,

        content: cleanContent,

        concepts,

        chunks,

        learnedAt: new Date().toISOString(),

        userApproved: Boolean(approved),

        verified: false,

        status: approved
            ? "knowledge-candidate"
            : "awaiting-approval",

        confidence: approved ? 0.85 : 0.60
    });

    return {
        success: true,

        message: "Knowledge successfully received by AarHen.",

        knowledgeId: knowledge.id,

        title: knowledge.title,

        category: knowledge.category,

        conceptsFound: concepts.length,

        chunksCreated: chunks.length,

        status: knowledge.status
    };
}

function learnCorrection({
    memoryId,
    correction,
    reason = "user correction"
}) {

    if (!memoryId || !correction) {
        return {
            success: false,
            error: "memoryId and correction are required."
        };
    }

    const updated = memory.update(memoryId, {
        correction,
        correctionReason: reason,
        verified: true,
        status: "corrected",
        confidence: 0.95
    });

    if (!updated) {
        return {
            success: false,
            error: "Memory not found."
        };
    }

    return {
        success: true,
        message: "AarHen knowledge updated from user correction.",
        memory: updated
    };
}

module.exports = {
    learn,
    learnCorrection,
    splitIntoChunks,
    extractConcepts
};
