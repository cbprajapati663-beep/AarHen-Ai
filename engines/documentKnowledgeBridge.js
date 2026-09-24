// ============================================================
// AARHEN CORE V5
// DOCUMENT KNOWLEDGE BRIDGE
// Version: 5.6.2
//
// Purpose:
// - Search knowledge learned from documents
// - Search normal learned knowledge
// - Search document chunks
// - Provide RAG-ready context
// - Keep document ingestion separate from existing engines
// ============================================================

const learning =
    require("../core/learning");

const memoryManager =
    require("../core/memoryManager");

const BRIDGE_VERSION =
    "5.6.2";


// ============================================================
// HELPERS
// ============================================================

function safeString(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}


function safeArray(value) {
    return Array.isArray(value)
        ? value
        : [];
}


function normalizeResultList(result) {

    if (
        result &&
        Array.isArray(result.results)
    ) {
        return result.results;
    }

    if (
        Array.isArray(result)
    ) {
        return result;
    }

    return [];
}


function calculateDocumentScore(
    item,
    query
) {

    const text =
        `${item.title || ""} ${item.content || ""} ${item.source || ""}`
            .toLowerCase();

    const queryWords =
        safeString(query)
            .toLowerCase()
            .split(/\s+/)
            .filter(
                word =>
                    word.length >= 2
            );

    if (
        queryWords.length === 0
    ) {
        return 0;
    }

    let matches = 0;

    for (
        const word of queryWords
    ) {

        if (
            text.includes(word)
        ) {
            matches++;
        }
    }

    return (
        matches /
        queryWords.length
    );
}


// ============================================================
// SEARCH LEARNED KNOWLEDGE
// ============================================================

function searchKnowledge(
    query,
    limit = 10
) {

    const cleanQuery =
        safeString(query);

    if (!cleanQuery) {

        return {

            success: false,

            query:
                "",

            count:
                0,

            results: [],

            status:
                "query-required",

            error:
                "Knowledge search query is required."
        };
    }

    const finalLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 10,
                50
            )
        );

    try {

        const result =
            learning.searchLearnedKnowledge(
                cleanQuery,
                finalLimit
            );

        const rawResults =
            normalizeResultList(
                result
            );

        const results =
            rawResults.map(
                item => ({

                    ...item,

                    documentSource:
                        item.source ||
                        item.metadata?.documentName ||
                        null,

                    documentType:
                        item.metadata?.documentType ||
                        null,

                    relevance:
                        Number(
                            calculateDocumentScore(
                                item,
                                cleanQuery
                            ).toFixed(3)
                        )
                })
            );

        results.sort(
            (a, b) =>
                Number(
                    b.relevance || 0
                ) -
                Number(
                    a.relevance || 0
                )
        );

        return {

            success: true,

            query:
                cleanQuery,

            count:
                results.length,

            results,

            status:
                "knowledge-retrieved"
        };

    } catch (error) {

        return {

            success: false,

            query:
                cleanQuery,

            count:
                0,

            results: [],

            status:
                "knowledge-search-error",

            error:
                error.message
        };
    }
}


// ============================================================
// SEARCH MEMORY
// ============================================================

function searchMemory(
    query,
    limit = 10
) {

    const cleanQuery =
        safeString(query);

    if (!cleanQuery) {

        return {

            success: false,

            query:
                "",

            count:
                0,

            results: [],

            status:
                "query-required"
        };
    }

    const finalLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 10,
                50
            )
        );

    try {

        const result =
            memoryManager.recall(
                cleanQuery,
                finalLimit
            );

        const results =
            normalizeResultList(
                result
            );

        return {

            success: true,

            query:
                cleanQuery,

            count:
                results.length,

            results,

            status:
                "memory-retrieved"
        };

    } catch (error) {

        return {

            success: false,

            query:
                cleanQuery,

            count:
                0,

            results: [],

            status:
                "memory-search-error",

            error:
                error.message
        };
    }
}


// ============================================================
// DOCUMENT-ONLY SEARCH
// ============================================================

function searchDocuments(
    query,
    limit = 10
) {

    const result =
        searchKnowledge(
            query,
            50
        );

    if (
        !result.success
    ) {
        return result;
    }

    const finalLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 10,
                50
            )
        );

    const documentResults =
        safeArray(
            result.results
        ).filter(
            item => {

                const source =
                    safeString(
                        item.source
                    ).toLowerCase();

                const type =
                    safeString(
                        item.metadata?.documentType
                    ).toLowerCase();

                return (
                    source.endsWith(".pdf") ||
                    source.endsWith(".docx") ||
                    source.endsWith(".txt") ||
                    source.endsWith(".md") ||
                    source.endsWith(".markdown") ||
                    source.endsWith(".json") ||
                    Boolean(type)
                );
            }
        )
        .slice(
            0,
            finalLimit
        );

    return {

        success: true,

        query:
            safeString(query),

        count:
            documentResults.length,

        results:
            documentResults,

        status:
            "document-search-completed"
    };
}


// ============================================================
// BUILD RAG CONTEXT
// ============================================================

function buildRagContext(
    query,
    options = {}
) {

    const cleanQuery =
        safeString(query);

    if (!cleanQuery) {

        return {

            success: false,

            query:
                "",

            context:
                "",

            results: [],

            status:
                "query-required"
        };
    }

    const knowledgeResult =
        searchKnowledge(
            cleanQuery,
            options.knowledgeLimit || 5
        );

    const documentResult =
        searchDocuments(
            cleanQuery,
            options.documentLimit || 5
        );

    const memoryResult =
        options.includeMemory === false
            ? {
                success: true,
                results: []
            }
            : searchMemory(
                cleanQuery,
                options.memoryLimit || 5
            );

    const combined = [];

    const seen = new Set();

    function addResults(
        list,
        layer
    ) {

        for (
            const item of safeArray(list)
        ) {

            const key =
                item.id ||
                `${layer}:${item.title || ""}:${item.content || ""}`;

            if (
                seen.has(key)
            ) {
                continue;
            }

            seen.add(key);

            combined.push({

                ...item,

                retrievalLayer:
                    layer
            });
        }
    }

    addResults(
        documentResult.results,
        "document"
    );

    addResults(
        knowledgeResult.results,
        "knowledge"
    );

    addResults(
        memoryResult.results,
        "memory"
    );

    combined.sort(
        (a, b) =>
            Number(
                b.relevance || 0
            ) -
            Number(
                a.relevance || 0
            )
    );

    const finalLimit =
        Math.max(
            1,
            Math.min(
                Number(
                    options.limit
                ) || 10,
                50
            )
        );

    const finalResults =
        combined.slice(
            0,
            finalLimit
        );

    const contextParts =
        finalResults
            .map(
                (
                    item,
                    index
                ) => {

                    const title =
                        safeString(
                            item.title
                        ) ||
                        `Knowledge ${index + 1}`;

                    const content =
                        safeString(
                            item.content
                        );

                    const source =
                        safeString(
                            item.source
                        );

                    return (
                        `[${index + 1}] ${title}\n` +
                        `Source: ${source}\n` +
                        `Content: ${content}`
                    );
                }
            );

    return {

        success: true,

        query:
            cleanQuery,

        count:
            finalResults.length,

        results:
            finalResults,

        context:
            contextParts.join(
                "\n\n"
            ),

        layers: {

            document:
                safeArray(
                    documentResult.results
                ).length,

            knowledge:
                safeArray(
                    knowledgeResult.results
                ).length,

            memory:
                safeArray(
                    memoryResult.results
                ).length
        },

        status:
            "rag-context-built"
    };
}


// ============================================================
// DOCUMENT QUESTION
//
// This does retrieval only.
// It does NOT fabricate an answer.
// The reasoning/response layer can consume the context.
// ============================================================

function prepareQuestionContext(
    question,
    options = {}
) {

    const rag =
        buildRagContext(
            question,
            options
        );

    if (
        !rag.success
    ) {
        return rag;
    }

    return {

        success: true,

        question:
            safeString(question),

        context:
            rag.context,

        results:
            rag.results,

        count:
            rag.count,

        layers:
            rag.layers,

        status:
            rag.count > 0
                ? "question-context-ready"
                : "no-relevant-knowledge"
    };
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    return {

        success: true,

        name:
            "AarHen Document Knowledge Bridge",

        version:
            BRIDGE_VERSION,

        status:
            "active",

        capabilities: [

            "document-knowledge-search",

            "learned-knowledge-search",

            "memory-search",

            "document-only-filtering",

            "rag-context-building",

            "duplicate-result-filtering",

            "relevance-scoring",

            "question-context-preparation"
        ],

        connectedSystems: {

            documentLearning:
                true,

            documentIngestion:
                true,

            continuousLearning:
                true,

            knowledgeStore:
                true,

            memoryManager:
                true
        },

        pipeline: [

            "user-question",

            "knowledge-search",

            "document-filter",

            "memory-search",

            "result-merging",

            "relevance-ranking",

            "rag-context"
        ]
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    BRIDGE_VERSION,

    safeString,

    safeArray,

    calculateDocumentScore,

    searchKnowledge,

    searchMemory,

    searchDocuments,

    buildRagContext,

    prepareQuestionContext,

    getStatus
};
