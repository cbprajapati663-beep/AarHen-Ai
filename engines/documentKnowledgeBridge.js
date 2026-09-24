// ============================================================
// AARHEN CORE V5
// DOCUMENT KNOWLEDGE BRIDGE
// Version: 5.6.3
//
// Fix:
// - Reliable document-result detection
// - Does not depend only on source filename extension
// - Supports document title/source/type/metadata detection
// - Knowledge retrieval
// - Document-only retrieval
// - RAG context generation
// ============================================================

const learning =
    require("../core/learning");

const memoryManager =
    require("../core/memoryManager");

const BRIDGE_VERSION =
    "5.6.3";


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


function normalizeResultList(
    result
) {

    if (
        result &&
        Array.isArray(
            result.results
        )
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
        (
            `${item.title || ""} ` +
            `${item.content || ""} ` +
            `${item.source || ""}`
        )
            .toLowerCase();

    const queryWords =
        safeString(
            query
        )
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
// DOCUMENT DETECTION
// ============================================================

function isDocumentKnowledgeItem(
    item = {}
) {

    const title =
        safeString(
            item.title
        ).toLowerCase();

    const source =
        safeString(
            item.source
        ).toLowerCase();

    const type =
        safeString(
            item.type
        ).toLowerCase();

    const sourceType =
        safeString(
            item.sourceType
        ).toLowerCase();

    const metadata =
        item &&
        typeof item.metadata === "object" &&
        item.metadata !== null
            ? item.metadata
            : {};

    const metadataType =
        safeString(
            metadata.documentType
        ).toLowerCase();

    const metadataName =
        safeString(
            metadata.documentName
        ).toLowerCase();

    // --------------------------------------------------------
    // Explicit document markers
    // --------------------------------------------------------

    if (
        type ===
        "document_knowledge"
    ) {
        return true;
    }

    if (
        sourceType
    ) {
        return true;
    }

    if (
        metadataType
    ) {
        return true;
    }

    if (
        metadataName
    ) {
        return true;
    }

    // --------------------------------------------------------
    // File extensions
    // --------------------------------------------------------

    const documentExtensions = [
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".md",
        ".markdown",
        ".json",
        ".rtf"
    ];

    if (
        documentExtensions.some(
            extension =>
                source.endsWith(
                    extension
                )
        )
    ) {
        return true;
    }

    if (
        documentExtensions.some(
            extension =>
                title.includes(
                    extension
                )
        )
    ) {
        return true;
    }

    // --------------------------------------------------------
    // Document-generated title marker
    //
    // documentLearning.js creates:
    // "filename - Document Knowledge"
    // --------------------------------------------------------

    if (
        title.includes(
            " - document knowledge"
        )
    ) {
        return true;
    }

    // --------------------------------------------------------
    // Explicit source markers
    // --------------------------------------------------------

    if (
        source.includes(
            "document"
        ) ||
        source.includes(
            "uploaded-file"
        ) ||
        source.includes(
            "file-ingestion"
        )
    ) {
        return true;
    }

    return false;
}


// ============================================================
// SEARCH LEARNED KNOWLEDGE
// ============================================================

function searchKnowledge(
    query,
    limit = 10
) {

    const cleanQuery =
        safeString(
            query
        );

    if (!cleanQuery) {

        return {

            success: false,

            query: "",

            count: 0,

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

                    documentDetected:
                        isDocumentKnowledgeItem(
                            item
                        ),

                    documentSource:
                        safeString(
                            item.source
                        ) ||
                        safeString(
                            item.metadata?.documentName
                        ) ||
                        null,

                    documentType:
                        safeString(
                            item.sourceType
                        ) ||
                        safeString(
                            item.metadata?.documentType
                        ) ||
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

            count: 0,

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
        safeString(
            query
        );

    if (!cleanQuery) {

        return {

            success: false,

            query: "",

            count: 0,

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
                {
                    limit:
                        finalLimit
                }
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

            count: 0,

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
        )
            .filter(
                item =>
                    isDocumentKnowledgeItem(
                        item
                    )
            )
            .slice(
                0,
                finalLimit
            );

    return {

        success: true,

        query:
            safeString(
                query
            ),

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
        safeString(
            query
        );

    if (!cleanQuery) {

        return {

            success: false,

            query: "",

            context: "",

            results: [],

            status:
                "query-required"
        };
    }

    const knowledgeResult =
        searchKnowledge(
            cleanQuery,
            options.knowledgeLimit ||
                5
        );

    const documentResult =
        searchDocuments(
            cleanQuery,
            options.documentLimit ||
                5
        );

    const memoryResult =
        options.includeMemory === false

            ? {
                success: true,
                results: []
            }

            : searchMemory(
                cleanQuery,
                options.memoryLimit ||
                    5
            );

    const combined = [];

    const seen =
        new Set();

    function addResults(
        list,
        layer
    ) {

        for (
            const item of
            safeArray(list)
        ) {

            const key =
                item.id ||
                (
                    `${layer}:` +
                    `${item.title || ""}:` +
                    `${item.content || ""}`
                );

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
        (
            a,
            b
        ) =>
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
        finalResults.map(
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

                const layer =
                    safeString(
                        item.retrievalLayer
                    ) ||
                    "knowledge";

                return (
                    `[${index + 1}] ${title}\n` +
                    `Layer: ${layer}\n` +
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
// PREPARE QUESTION CONTEXT
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
            safeString(
                question
            ),

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

            "document-type-detection",

            "document-source-detection",

            "document-title-detection",

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

        documentDetection: {

            explicitType:
                true,

            sourceType:
                true,

            metadata:
                true,

            fileExtension:
                true,

            generatedDocumentTitle:
                true,

            documentSourceMarker:
                true
        },

        pipeline: [

            "user-question",

            "knowledge-search",

            "document-detection",

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

    normalizeResultList,

    calculateDocumentScore,

    isDocumentKnowledgeItem,

    searchKnowledge,

    searchMemory,

    searchDocuments,

    buildRagContext,

    prepareQuestionContext,

    getStatus
};
