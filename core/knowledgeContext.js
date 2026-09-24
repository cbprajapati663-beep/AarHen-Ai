// ============================================================
// AARHEN CORE V5
// UNIFIED KNOWLEDGE CONTEXT
// ============================================================
// Combines:
//
// Brain Knowledge
// Memory
// Document Knowledge
// Document RAG
//
// into one predictable context object.
// ============================================================

const documentContext =
    require("./documentContext");

const knowledgeContext =
    require("./documentManager");

const KNOWLEDGE_CONTEXT_VERSION =
    "5.7.2";


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
// BUILD UNIFIED CONTEXT
// ============================================================

function buildUnifiedContext(
    request,
    brainResult = {},
    options = {}
) {
    const query =
        safeString(request);

    const brain =
        safeObject(brainResult);

    const settings =
        safeObject(options);

    const limit =
        normalizeLimit(
            settings.limit,
            5,
            10
        );

    if (!query) {

        return {

            success: false,

            query: "",

            memory: [],

            knowledge: [],

            documents: [],

            rag: "",

            status:
                "knowledge-context-query-required",

            error:
                "Request is required."
        };
    }

    // ========================================================
    // EXISTING BRAIN MEMORY
    // ========================================================

    const brainMemory =
        safeObject(
            brain.memory
        );

    const brainKnowledge =
        safeObject(
            brain.knowledge
        );

    const relatedMemory =
        safeArray(
            brainMemory.related
        );

    const verifiedMemory =
        safeArray(
            brainMemory.verified
        );

    const relatedKnowledge =
        safeArray(
            brainKnowledge.related
        );

    const verifiedKnowledge =
        safeArray(
            brainKnowledge.verified
        );


    // ========================================================
    // DOCUMENT KNOWLEDGE
    // ========================================================

    let documentResult = {

        success: false,

        documents: [],

        knowledge: [],

        context: "",

        count: 0,

        documentCount: 0
    };

    try {

        documentResult =
            documentContext.buildDocumentContext(
                query,
                {
                    limit
                }
            );

    } catch (error) {

        documentResult = {

            success: false,

            documents: [],

            knowledge: [],

            context: "",

            count: 0,

            documentCount: 0,

            error:
                error.message
        };
    }


    // ========================================================
    // NORMALIZE DOCUMENT DATA
    // ========================================================

    const documentItems =
        safeArray(
            documentResult.documents
        );

    const documentKnowledge =
        safeArray(
            documentResult.knowledge
        );

    const ragContext =
        safeString(
            documentResult.context
        );


    // ========================================================
    // UNIFIED KNOWLEDGE COUNTS
    // ========================================================

    const memoryCount =
        relatedMemory.length +
        verifiedMemory.length;

    const knowledgeCount =
        relatedKnowledge.length +
        verifiedKnowledge.length +
        documentKnowledge.length;

    const totalDocumentCount =
        documentItems.length;


    // ========================================================
    // RETURN
    // ========================================================

    return {

        success: true,

        query,

        limit,

        memory: {

            related:
                relatedMemory,

            verified:
                verifiedMemory,

            count:
                memoryCount
        },

        knowledge: {

            related:
                relatedKnowledge,

            verified:
                verifiedKnowledge,

            documentKnowledge,

            count:
                knowledgeCount
        },

        documents: {

            results:
                documentItems,

            count:
                totalDocumentCount,

            available:
                totalDocumentCount > 0
        },

        rag: {

            context:
                ragContext,

            available:
                Boolean(
                    ragContext
                )
        },

        availability: {

            memory:
                memoryCount > 0,

            knowledge:
                knowledgeCount > 0,

            documents:
                totalDocumentCount > 0,

            rag:
                Boolean(
                    ragContext
                ),

            anyKnowledge:
                memoryCount > 0 ||
                knowledgeCount > 0 ||
                totalDocumentCount > 0 ||
                Boolean(ragContext)
        },

        source: {

            engine:
                "AarHen Unified Knowledge Context",

            version:
                KNOWLEDGE_CONTEXT_VERSION,

            documentContextVersion:
                documentResult.version ||
                null
        },

        status:
            "unified-knowledge-context-ready"
    };
}


// ============================================================
// BUILD ANSWER CONTEXT
// ============================================================
// Creates a compact textual context for future reasoning/
// response generation.
// ============================================================

function buildAnswerContext(
    request,
    brainResult = {},
    options = {}
) {
    const unified =
        buildUnifiedContext(
            request,
            brainResult,
            options
        );

    if (!unified.success) {
        return unified;
    }

    const sections = [];


    // ========================================================
    // MEMORY
    // ========================================================

    if (
        unified.memory.count > 0
    ) {

        sections.push(
            "MEMORY:\n" +
            unified.memory.related
                .map(
                    item =>
                        safeString(
                            item.content ||
                            item.title
                        )
                )
                .filter(Boolean)
                .join("\n")
        );
    }


    // ========================================================
    // VERIFIED MEMORY
    // ========================================================

    if (
        unified.memory.verified.length > 0
    ) {

        sections.push(
            "VERIFIED MEMORY:\n" +
            unified.memory.verified
                .map(
                    item =>
                        safeString(
                            item.content ||
                            item.title
                        )
                )
                .filter(Boolean)
                .join("\n")
        );
    }


    // ========================================================
    // KNOWLEDGE
    // ========================================================

    if (
        unified.knowledge.related.length > 0
    ) {

        sections.push(
            "KNOWLEDGE:\n" +
            unified.knowledge.related
                .map(
                    item =>
                        safeString(
                            item.content ||
                            item.title
                        )
                )
                .filter(Boolean)
                .join("\n")
        );
    }


    // ========================================================
    // VERIFIED KNOWLEDGE
    // ========================================================

    if (
        unified.knowledge.verified.length > 0
    ) {

        sections.push(
            "VERIFIED KNOWLEDGE:\n" +
            unified.knowledge.verified
                .map(
                    item =>
                        safeString(
                            item.content ||
                            item.title
                        )
                )
                .filter(Boolean)
                .join("\n")
        );
    }


    // ========================================================
    // DOCUMENT KNOWLEDGE
    // ========================================================

    if (
        unified.documents.results.length > 0
    ) {

        sections.push(
            "DOCUMENT KNOWLEDGE:\n" +
            unified.documents.results
                .map(
                    item =>
                        safeString(
                            item.content ||
                            item.snippet ||
                            item.title
                        )
                )
                .filter(Boolean)
                .join("\n")
        );
    }


    // ========================================================
    // RAG
    // ========================================================

    if (
        unified.rag.available
    ) {

        sections.push(
            "DOCUMENT RAG CONTEXT:\n" +
            unified.rag.context
        );
    }


    const context =
        sections
            .filter(
                section =>
                    safeString(section)
            )
            .join("\n\n");


    return {

        success: true,

        query:
            unified.query,

        context,

        hasContext:
            Boolean(
                context
            ),

        unified,

        status:
            "answer-context-built"
    };
}


// ============================================================
// AUGMENT EXISTING BRAIN RESULT
// ============================================================

function augmentBrainResult(
    request,
    brainResult = {},
    options = {}
) {
    const currentBrain =
        safeObject(
            brainResult
        );

    const answerContext =
        buildAnswerContext(
            request,
            currentBrain,
            options
        );

    return {

        ...currentBrain,

        unifiedKnowledge:
            answerContext.unified,

        answerContext:
            answerContext.context,

        knowledgeContext:
            {

                available:
                    answerContext.hasContext,

                context:
                    answerContext.context,

                source:
                    "AarHen Unified Knowledge Context",

                version:
                    KNOWLEDGE_CONTEXT_VERSION
            }
    };
}


// ============================================================
// CHECK CONTEXT AVAILABILITY
// ============================================================

function hasKnowledge(
    context = {}
) {
    const item =
        safeObject(context);

    if (
        item.availability &&
        item.availability.anyKnowledge
    ) {
        return true;
    }

    if (
        item.rag &&
        safeString(
            item.rag.context
        )
    ) {
        return true;
    }

    if (
        item.documents &&
        Number(
            item.documents.count
        ) > 0
    ) {
        return true;
    }

    return false;
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    let documentStatus = null;

    try {

        documentStatus =
            documentContext.getStatus();

    } catch (error) {

        documentStatus = {

            success: false,

            error:
                error.message
        };
    }

    return {

        success: true,

        name:
            "AarHen Unified Knowledge Context",

        version:
            KNOWLEDGE_CONTEXT_VERSION,

        status:
            "active",

        capabilities: [

            "memory-context",

            "knowledge-context",

            "document-context",

            "document-rag-context",

            "unified-context",

            "answer-context",

            "brain-context-augmentation",

            "context-availability-detection"
        ],

        connectedSystems: {

            documentContext:
                true,

            documentManager:
                true,

            memory:
                true,

            knowledge:
                true,

            rag:
                true
        },

        documentSystem:
            documentStatus,

        pipeline: [

            "user-request",

            "brain-memory",

            "brain-knowledge",

            "document-search",

            "document-rag",

            "unified-knowledge",

            "answer-context",

            "future-brain-integration",

            "future-orchestrator-integration"
        ]
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    KNOWLEDGE_CONTEXT_VERSION,

    safeString,

    safeObject,

    safeArray,

    normalizeLimit,

    buildUnifiedContext,

    buildAnswerContext,

    augmentBrainResult,

    hasKnowledge,

    getStatus
};
