// ============================================================
// AARHEN CORE V5
// DOCUMENT KNOWLEDGE MANAGER
// ============================================================
// Purpose:
// Connect Document Ingestion + Document RAG + Knowledge Search
// into one stable manager layer for the AarHen main pipeline.
// ============================================================

const ingestion =
    require("../engines/documentIngestion");

const bridge =
    require("../engines/documentKnowledgeBridge");

const DOCUMENT_MANAGER_VERSION =
    "5.7.0";


// ============================================================
// HELPERS
// ============================================================

function safeString(value) {
    return String(value ?? "").trim();
}

function safeObject(value) {
    return (
        value &&
        typeof value === "object"
    )
        ? value
        : {};
}

function safeArray(value) {
    return Array.isArray(value)
        ? value
        : [];
}

function normalizeLimit(
    value,
    fallback = 5,
    maximum = 20
) {
    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number <= 0
    ) {
        return fallback;
    }

    return Math.min(
        Math.floor(number),
        maximum
    );
}


// ============================================================
// DOCUMENT INGESTION
// ============================================================

async function ingestDocument(
    filePath,
    options = {}
) {
    const path =
        safeString(filePath);

    if (!path) {
        return {
            success: false,
            ingested: false,
            status:
                "document-path-required",
            error:
                "Document file path is required."
        };
    }

    try {
        const result =
            await ingestion.ingestDocument(
                path,
                safeObject(options)
            );

        return {
            success:
                Boolean(
                    result &&
                    result.success
                ),

            ingested:
                Boolean(
                    result &&
                    result.ingested
                ),

            status:
                result?.status ||
                "document-ingestion-completed",

            manager:
                "AarHen Document Knowledge Manager",

            version:
                DOCUMENT_MANAGER_VERSION,

            ingestion:
                result || null
        };

    } catch (error) {

        return {
            success: false,

            ingested: false,

            status:
                "document-manager-ingestion-error",

            error:
                error.message
        };
    }
}


// ============================================================
// TEXT INGESTION
// ============================================================

function ingestText(
    text,
    options = {}
) {
    const content =
        safeString(text);

    if (!content) {
        return {
            success: false,
            ingested: false,
            status:
                "text-content-required",
            error:
                "Text content is required."
        };
    }

    try {

        const result =
            ingestion.ingestText(
                content,
                safeObject(options)
            );

        return {
            success:
                Boolean(
                    result &&
                    result.success
                ),

            ingested:
                Boolean(
                    result &&
                    result.ingested
                ),

            status:
                result?.status ||
                "text-ingestion-completed",

            manager:
                "AarHen Document Knowledge Manager",

            version:
                DOCUMENT_MANAGER_VERSION,

            ingestion:
                result || null
        };

    } catch (error) {

        return {
            success: false,

            ingested: false,

            status:
                "text-ingestion-error",

            error:
                error.message
        };
    }
}


// ============================================================
// KNOWLEDGE SEARCH
// ============================================================

function searchKnowledge(
    query,
    limit = 5
) {
    const cleanQuery =
        safeString(query);

    if (!cleanQuery) {
        return {
            success: false,
            count: 0,
            results: [],
            status:
                "knowledge-query-required",
            error:
                "Knowledge search query is required."
        };
    }

    try {

        const result =
            bridge.searchKnowledge(
                cleanQuery,
                normalizeLimit(limit)
            );

        const safeResult =
            safeObject(result);

        const results =
            safeArray(
                safeResult.results
            );

        return {
            success:
                safeResult.success !== false,

            query:
                cleanQuery,

            count:
                Number(
                    safeResult.count
                ) || results.length,

            results,

            documentDetected:
                safeArray(
                    results
                ).some(
                    item =>
                        item.documentDetected === true
                ),

            status:
                safeResult.status ||
                "knowledge-search-completed"
        };

    } catch (error) {

        return {
            success: false,
            query: cleanQuery,
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
// DOCUMENT-ONLY SEARCH
// ============================================================

function searchDocuments(
    query,
    limit = 5
) {
    const cleanQuery =
        safeString(query);

    if (!cleanQuery) {
        return {
            success: false,
            count: 0,
            results: [],
            status:
                "document-query-required",
            error:
                "Document search query is required."
        };
    }

    try {

        const result =
            bridge.searchDocuments(
                cleanQuery,
                normalizeLimit(limit)
            );

        const safeResult =
            safeObject(result);

        const results =
            safeArray(
                safeResult.results
            );

        return {
            success:
                safeResult.success !== false,

            query:
                cleanQuery,

            count:
                Number(
                    safeResult.count
                ) || results.length,

            results,

            status:
                safeResult.status ||
                "document-search-completed"
        };

    } catch (error) {

        return {
            success: false,
            query: cleanQuery,
            count: 0,
            results: [],
            status:
                "document-search-error",
            error:
                error.message
        };
    }
}


// ============================================================
// RAG CONTEXT
// ============================================================

function buildRagContext(
    query,
    limit = 5
) {
    const cleanQuery =
        safeString(query);

    if (!cleanQuery) {
        return {
            success: false,
            query: "",
            context: "",
            results: [],
            status:
                "rag-query-required",
            error:
                "RAG query is required."
        };
    }

    try {

        const result =
            bridge.buildRagContext(
                cleanQuery,
                normalizeLimit(limit)
            );

        const safeResult =
            safeObject(result);

        return {
            success:
                safeResult.success !== false,

            query:
                cleanQuery,

            context:
                safeString(
                    safeResult.context
                ),

            results:
                safeArray(
                    safeResult.results
                ),

            count:
                Number(
                    safeResult.count
                ) ||
                safeArray(
                    safeResult.results
                ).length,

            status:
                safeResult.status ||
                "rag-context-built"
        };

    } catch (error) {

        return {
            success: false,
            query: cleanQuery,
            context: "",
            results: [],
            count: 0,
            status:
                "rag-context-error",
            error:
                error.message
        };
    }
}


// ============================================================
// QUESTION CONTEXT
// ============================================================

function prepareQuestionContext(
    question,
    limit = 5
) {
    const cleanQuestion =
        safeString(question);

    if (!cleanQuestion) {
        return {
            success: false,
            question: "",
            status:
                "question-required",
            error:
                "Question is required."
        };
    }

    try {

        const result =
            bridge.prepareQuestionContext(
                cleanQuestion,
                normalizeLimit(limit)
            );

        const safeResult =
            safeObject(result);

        return {
            success:
                safeResult.success !== false,

            question:
                cleanQuestion,

            context:
                safeString(
                    safeResult.context
                ),

            knowledge:
                safeArray(
                    safeResult.knowledge
                ),

            documents:
                safeArray(
                    safeResult.documents
                ),

            memory:
                safeArray(
                    safeResult.memory
                ),

            status:
                safeResult.status ||
                "question-context-prepared"
        };

    } catch (error) {

        return {
            success: false,
            question: cleanQuestion,
            context: "",
            knowledge: [],
            documents: [],
            memory: [],
            status:
                "question-context-error",
            error:
                error.message
        };
    }
}


// ============================================================
// UNIFIED KNOWLEDGE QUERY
// ============================================================
// Searches general knowledge + document knowledge + builds RAG
// context in one operation.
// ============================================================

function queryKnowledge(
    query,
    options = {}
) {
    const cleanQuery =
        safeString(query);

    if (!cleanQuery) {
        return {
            success: false,
            query: "",
            status:
                "knowledge-query-required",
            error:
                "Knowledge query is required."
        };
    }

    const settings =
        safeObject(options);

    const limit =
        normalizeLimit(
            settings.limit,
            5,
            20
        );

    const knowledge =
        searchKnowledge(
            cleanQuery,
            limit
        );

    const documents =
        searchDocuments(
            cleanQuery,
            limit
        );

    const rag =
        buildRagContext(
            cleanQuery,
            limit
        );

    return {

        success:
            knowledge.success ||
            documents.success ||
            rag.success,

        query:
            cleanQuery,

        limit,

        knowledge: {
            count:
                knowledge.count,
            results:
                knowledge.results
        },

        documents: {
            count:
                documents.count,
            results:
                documents.results
        },

        rag: {
            context:
                rag.context,
            count:
                rag.count,
            results:
                rag.results
        },

        totalKnowledgeResults:
            knowledge.count,

        totalDocumentResults:
            documents.count,

        contextAvailable:
            Boolean(
                rag.context
            ),

        status:
            "unified-knowledge-query-completed"
    };
}


// ============================================================
// DOCUMENT STATUS
// ============================================================

function getStatus() {

    let ingestionStatus = null;
    let bridgeStatus = null;

    try {

        if (
            ingestion &&
            typeof ingestion.getStatus ===
                "function"
        ) {
            ingestionStatus =
                ingestion.getStatus();
        }

    } catch (error) {

        ingestionStatus = {
            success: false,
            error:
                error.message
        };
    }

    try {

        if (
            bridge &&
            typeof bridge.getStatus ===
                "function"
        ) {
            bridgeStatus =
                bridge.getStatus();
        }

    } catch (error) {

        bridgeStatus = {
            success: false,
            error:
                error.message
        };
    }

    return {

        success: true,

        name:
            "AarHen Document Knowledge Manager",

        version:
            DOCUMENT_MANAGER_VERSION,

        status:
            "active",

        capabilities: [

            "document-ingestion",

            "pdf-learning",

            "docx-learning",

            "txt-learning",

            "markdown-learning",

            "json-learning",

            "document-chunk-learning",

            "document-knowledge-search",

            "document-only-search",

            "unified-knowledge-search",

            "rag-context",

            "question-context",

            "document-provenance",

            "duplicate-safe-learning",

            "knowledge-retrieval"
        ],

        connectedEngines: {

            documentIngestion:
                Boolean(
                    ingestion
                ),

            documentKnowledgeBridge:
                Boolean(
                    bridge
                )
        },

        ingestion:
            ingestionStatus,

        knowledgeBridge:
            bridgeStatus,

        pipeline: [

            "document-input",

            "document-processing",

            "text-extraction",

            "chunking",

            "learning",

            "knowledge-storage",

            "document-retrieval",

            "rag-context",

            "question-context",

            "main-brain-integration"
        ]
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    DOCUMENT_MANAGER_VERSION,

    safeString,

    safeObject,

    safeArray,

    normalizeLimit,

    ingestDocument,

    ingestText,

    searchKnowledge,

    searchDocuments,

    buildRagContext,

    prepareQuestionContext,

    queryKnowledge,

    getStatus
};
