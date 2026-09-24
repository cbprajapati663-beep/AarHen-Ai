// ============================================================
// AARHEN CORE V5
// DOCUMENT CONTEXT ADAPTER
// ============================================================
// Connects Document Knowledge Manager with Brain / Orchestrator
// without changing the existing core pipeline yet.
// ============================================================

const documentManager =
    require("./documentManager");

const DOCUMENT_CONTEXT_VERSION =
    "5.7.1";


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
    maximum = 10
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
// BUILD DOCUMENT CONTEXT
// ============================================================

function buildDocumentContext(
    request,
    options = {}
) {
    const query =
        safeString(request);

    if (!query) {
        return {
            success: false,

            query: "",

            context: "",

            documents: [],

            knowledge: [],

            count: 0,

            documentCount: 0,

            status:
                "document-context-query-required",

            error:
                "Request is required."
        };
    }

    const settings =
        safeObject(options);

    const limit =
        normalizeLimit(
            settings.limit,
            5,
            10
        );

    try {

        const result =
            documentManager.queryKnowledge(
                query,
                {
                    limit
                }
            );

        const safeResult =
            safeObject(result);

        const documentResults =
            safeArray(
                safeResult.documents?.results
            );

        const knowledgeResults =
            safeArray(
                safeResult.knowledge?.results
            );

        const ragContext =
            safeString(
                safeResult.rag?.context
            );

        return {

            success:
                safeResult.success !== false,

            query,

            context:
                ragContext,

            documents:
                documentResults,

            knowledge:
                knowledgeResults,

            count:
                Number(
                    safeResult.totalKnowledgeResults
                ) || knowledgeResults.length,

            documentCount:
                Number(
                    safeResult.totalDocumentResults
                ) || documentResults.length,

            contextAvailable:
                Boolean(
                    ragContext
                ),

            documentKnowledgeAvailable:
                documentResults.length > 0,

            limit,

            source:
                "AarHen Document Knowledge Manager",

            version:
                DOCUMENT_CONTEXT_VERSION,

            status:
                safeResult.status ||
                "document-context-ready"
        };

    } catch (error) {

        return {

            success: false,

            query,

            context: "",

            documents: [],

            knowledge: [],

            count: 0,

            documentCount: 0,

            contextAvailable: false,

            documentKnowledgeAvailable: false,

            status:
                "document-context-error",

            error:
                error.message
        };
    }
}


// ============================================================
// PREPARE BRAIN CONTEXT
// ============================================================
// Converts document knowledge into a predictable object that
// can later be inserted into Brain.think() context.
// ============================================================

function prepareBrainContext(
    request,
    options = {}
) {
    const documentContext =
        buildDocumentContext(
            request,
            options
        );

    return {

        documents: {

            success:
                documentContext.success,

            query:
                documentContext.query,

            results:
                documentContext.documents,

            count:
                documentContext.documentCount,

            available:
                documentContext.documentKnowledgeAvailable
        },

        knowledge: {

            results:
                documentContext.knowledge,

            count:
                documentContext.count
        },

        rag: {

            context:
                documentContext.context,

            available:
                documentContext.contextAvailable
        },

        metadata: {

            source:
                documentContext.source,

            version:
                documentContext.version,

            status:
                documentContext.status
        }
    };
}


// ============================================================
// AUGMENT EXISTING CONTEXT
// ============================================================
// Does not destroy existing context.
// Existing context is preserved and document context is added.
// ============================================================

function augmentContext(
    request,
    existingContext = {},
    options = {}
) {
    const currentContext =
        safeObject(existingContext);

    const documentContext =
        buildDocumentContext(
            request,
            options
        );

    return {

        ...currentContext,

        documents:
            documentContext,

        documentKnowledge:
            {

                results:
                    documentContext.documents,

                count:
                    documentContext.documentCount,

                available:
                    documentContext
                        .documentKnowledgeAvailable
            },

        documentRag:
            {

                context:
                    documentContext.context,

                available:
                    documentContext.contextAvailable
            },

        documentContextVersion:
            DOCUMENT_CONTEXT_VERSION
    };
}


// ============================================================
// CHECK WHETHER DOCUMENT KNOWLEDGE EXISTS
// ============================================================

function hasDocumentKnowledge(
    context = {}
) {
    const value =
        safeObject(context);

    if (
        value.documents &&
        Number(
            value.documents.count
        ) > 0
    ) {
        return true;
    }

    if (
        value.documentKnowledge &&
        Number(
            value.documentKnowledge.count
        ) > 0
    ) {
        return true;
    }

    if (
        value.documentRag &&
        safeString(
            value.documentRag.context
        )
    ) {
        return true;
    }

    return false;
}


// ============================================================
// GET DOCUMENT CONTEXT STATUS
// ============================================================

function getStatus() {

    let managerStatus = null;

    try {

        managerStatus =
            documentManager.getStatus();

    } catch (error) {

        managerStatus = {

            success: false,

            error:
                error.message
        };
    }

    return {

        success: true,

        name:
            "AarHen Document Context Adapter",

        version:
            DOCUMENT_CONTEXT_VERSION,

        status:
            "active",

        connectedManager:
            "AarHen Document Knowledge Manager",

        capabilities: [

            "document-context",

            "brain-context-preparation",

            "rag-context-adaptation",

            "knowledge-context-adaptation",

            "context-preservation",

            "document-knowledge-detection",

            "safe-context-augmentation"
        ],

        manager:
            managerStatus,

        pipeline: [

            "user-request",

            "document-knowledge-query",

            "document-retrieval",

            "rag-context",

            "brain-context-adapter",

            "future-orchestrator-integration"
        ]
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    DOCUMENT_CONTEXT_VERSION,

    safeString,

    safeObject,

    safeArray,

    normalizeLimit,

    buildDocumentContext,

    prepareBrainContext,

    augmentContext,

    hasDocumentKnowledge,

    getStatus
};
