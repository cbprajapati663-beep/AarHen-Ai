// ============================================================
// AARHEN CORE V5
// ADVANCED KNOWLEDGE / RAG ENGINE
// ============================================================

const memory =
    require("../core/memory");

const verification =
    require("../core/verification");

// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalize(text = "") {

    return String(text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ============================================================
// WORD EXTRACTION
// ============================================================

function getWords(text = "") {

    return [
        ...new Set(
            normalize(text)
                .split(/\s+/)
                .filter(
                    word =>
                        word.length >= 2
                )
        )
    ];
}

// ============================================================
// SCORE KNOWLEDGE
// ============================================================

function calculateScore(
    query,
    item
) {

    const queryWords =
        getWords(query);

    if (
        queryWords.length === 0 ||
        !item
    ) {
        return 0;
    }

    const title =
        normalize(item.title);

    const category =
        normalize(item.category);

    const content =
        normalize(item.content);

    const concepts =
        Array.isArray(item.concepts)
            ? item.concepts
                .map(normalize)
            : [];

    let score = 0;

    for (const word of queryWords) {

        // Title match = strong
        if (title.includes(word)) {
            score += 5;
        }

        // Category match
        if (category.includes(word)) {
            score += 3;
        }

        // Concept match
        if (
            concepts.some(
                concept =>
                    concept.includes(word)
            )
        ) {
            score += 4;
        }

        // Content match
        if (content.includes(word)) {
            score += 1;
        }
    }

    // --------------------------------------------------------
    // VERIFIED KNOWLEDGE BONUS
    // --------------------------------------------------------

    if (
        verification.isVerified(item)
    ) {
        score += 5;
    }

    // --------------------------------------------------------
    // PARTIALLY VERIFIED BONUS
    // --------------------------------------------------------

    if (
        item.verificationStatus ===
        "partially-verified"
    ) {
        score += 2;
    }

    return score;
}

// ============================================================
// SEARCH KNOWLEDGE
// ============================================================

function searchKnowledge(
    query,
    limit = 5
) {

    const cleanQuery =
        String(query || "").trim();

    if (!cleanQuery) {

        return {
            success: false,
            error:
                "Knowledge search query is required.",
            results: []
        };
    }

    const all =
        memory.getAll();

    const knowledge =
        all.filter(
            item =>
                item.type ===
                "knowledge"
        );

    const scored =
        knowledge
            .map(item => ({
                item,
                score:
                    calculateScore(
                        cleanQuery,
                        item
                    )
            }))
            .filter(
                entry =>
                    entry.score > 0
            )
            .sort(
                (a, b) =>
                    b.score - a.score
            );

    const results =
        scored
            .slice(
                0,
                Number(limit) || 5
            )
            .map(entry => ({
                ...entry.item,
                relevanceScore:
                    entry.score
            }));

    return {
        success: true,
        query: cleanQuery,
        count: results.length,
        results
    };
}

// ============================================================
// VERIFIED KNOWLEDGE SEARCH
// ============================================================

function searchVerifiedKnowledge(
    query,
    limit = 5
) {

    const cleanQuery =
        String(query || "").trim();

    if (!cleanQuery) {

        return {
            success: false,
            error:
                "Verified knowledge search query is required.",
            results: []
        };
    }

    const all =
        memory.getAll();

    const verified =
        all.filter(
            item =>
                item.type ===
                    "knowledge" &&
                verification.isVerified(
                    item
                )
        );

    const scored =
        verified
            .map(item => ({
                item,
                score:
                    calculateScore(
                        cleanQuery,
                        item
                    )
            }))
            .filter(
                entry =>
                    entry.score > 0
            )
            .sort(
                (a, b) =>
                    b.score - a.score
            );

    const results =
        scored
            .slice(
                0,
                Number(limit) || 5
            )
            .map(entry => ({
                ...entry.item,
                relevanceScore:
                    entry.score
            }));

    return {
        success: true,
        query: cleanQuery,
        count: results.length,
        verifiedOnly: true,
        results
    };
}

// ============================================================
// BUILD RAG CONTEXT
// ============================================================

function buildContext(
    query,
    limit = 5
) {

    const search =
        searchKnowledge(
            query,
            limit
        );

    if (!search.success) {
        return search;
    }

    const context =
        search.results
            .map(
                item => ({
                    id: item.id,
                    title:
                        item.title,
                    category:
                        item.category,
                    relevanceScore:
                        item.relevanceScore,
                    verificationStatus:
                        item.verificationStatus ||
                        "unverified",
                    verificationConfidence:
                        item.verificationConfidence ||
                        item.confidence ||
                        0,
                    content:
                        item.content,
                    concepts:
                        item.concepts || []
                })
            );

    return {
        success: true,
        query:
            String(query).trim(),
        count:
            context.length,
        context
    };
}

// ============================================================
// BUILD VERIFIED RAG CONTEXT
// ============================================================

function buildVerifiedContext(
    query,
    limit = 5
) {

    const search =
        searchVerifiedKnowledge(
            query,
            limit
        );

    if (!search.success) {
        return search;
    }

    const context =
        search.results
            .map(
                item => ({
                    id: item.id,
                    title:
                        item.title,
                    category:
                        item.category,
                    relevanceScore:
                        item.relevanceScore,
                    verificationStatus:
                        "verified",
                    verificationConfidence:
                        item.verificationConfidence ||
                        item.confidence ||
                        0,
                    content:
                        item.content,
                    concepts:
                        item.concepts || []
                })
            );

    return {
        success: true,
        query:
            String(query).trim(),
        count:
            context.length,
        verifiedOnly: true,
        context
    };
}

// ============================================================
// KNOWLEDGE SUMMARY
// ============================================================

function getKnowledgeStats() {

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

    const partial =
        knowledge.filter(
            item =>
                item.verificationStatus ===
                "partially-verified"
        );

    return {
        success: true,
        total:
            knowledge.length,
        verified:
            verified.length,
        partiallyVerified:
            partial.length,
        reviewRequired:
            knowledge.length -
            verified.length -
            partial.length
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    normalize,

    getWords,

    calculateScore,

    searchKnowledge,

    searchVerifiedKnowledge,

    buildContext,

    buildVerifiedContext,

    getKnowledgeStats
};
