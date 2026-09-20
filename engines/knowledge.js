// ============================================================
// AARHEN CORE V5
// Knowledge + RAG Engine
// ============================================================

const memory = require("../core/memory");
const verification = require("../core/verification");


// ------------------------------------------------------------
// Normalize text
// ------------------------------------------------------------

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}


// ------------------------------------------------------------
// Create search words
// ------------------------------------------------------------

function getWords(text) {

    return normalize(text)
        .split(" ")
        .filter(word => word.length >= 2);
}


// ------------------------------------------------------------
// Calculate relevance score
// ------------------------------------------------------------

function calculateScore(query, knowledge) {

    const queryWords = getWords(query);

    const searchableText = normalize(
        [
            knowledge.title,
            knowledge.category,
            knowledge.content,
            ...(knowledge.concepts || [])
        ].join(" ")
    );

    let score = 0;

    for (const word of queryWords) {

        if (searchableText.includes(word)) {
            score++;
        }
    }

    return score;
}


// ------------------------------------------------------------
// Search knowledge
// ------------------------------------------------------------

function searchKnowledge(query, options = {}) {

    if (!query || String(query).trim().length === 0) {

        return {
            success: false,
            error: "Search query is required."
        };
    }


    const limit = Number(options.limit || 5);

    const memories = memory.getAll()
        .filter(item => item.type === "knowledge");


    const results = memories
        .map(item => ({
            memory: item,
            score: calculateScore(query, item)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);


    return {
        success: true,
        query,
        resultCount: results.length,

        results: results.map(item => ({
            id: item.memory.id,
            title: item.memory.title,
            category: item.memory.category,
            score: item.score,
            verificationStatus:
                item.memory.verificationStatus || "unverified",
            confidence:
                item.memory.verificationConfidence ?? 0,
            content: item.memory.content
        }))
    };
}


// ------------------------------------------------------------
// Get verified knowledge only
// ------------------------------------------------------------

function searchVerifiedKnowledge(query, options = {}) {

    const result = searchKnowledge(query, options);

    if (!result.success) {
        return result;
    }


    result.results = result.results.filter(item => {

        const original = memory.getAll()
            .find(memoryItem => memoryItem.id === item.id);

        return verification.isVerified(original);
    });


    result.resultCount = result.results.length;

    return result;
}


// ------------------------------------------------------------
// Build context for AarHen's brain
// ------------------------------------------------------------

function buildContext(query, options = {}) {

    const result = searchKnowledge(query, options);

    if (!result.success) {
        return result;
    }


    const context = result.results
        .map((item, index) => {

            return [
                `Knowledge ${index + 1}:`,
                `Title: ${item.title}`,
                `Category: ${item.category}`,
                `Verification: ${item.verificationStatus}`,
                `Confidence: ${item.confidence}`,
                `Content: ${item.content}`
            ].join("\n");

        })
        .join("\n\n");


    return {
        success: true,
        query,
        resultCount: result.resultCount,
        context
    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    searchKnowledge,
    searchVerifiedKnowledge,
    buildContext,
    calculateScore

};
