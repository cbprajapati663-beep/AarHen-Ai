// ============================================================
// AARHEN CORE V5
// UNIFIED REQUEST PIPELINE
// ============================================================
// Purpose:
// Connect Document Knowledge Context with the existing
// AarHen Master Orchestrator without modifying the
// large orchestrator file yet.
//
// Flow:
//
// USER REQUEST
//      ↓
// DOCUMENT KNOWLEDGE
//      ↓
// CONTEXT AUGMENTATION
//      ↓
// MASTER ORCHESTRATOR
//      ↓
// EXECUTION
//      ↓
// RESPONSE
// ============================================================

const orchestrator =
    require("./orchestrator");

const knowledgeContext =
    require("./knowledgeContext");

const REQUEST_PIPELINE_VERSION =
    "5.7.3";


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
// BUILD REQUEST CONTEXT
// ============================================================

function buildRequestContext(
    request,
    context = {},
    options = {}
) {
    const cleanRequest =
        safeString(request);

    const existingContext =
        safeObject(context);

    const settings =
        safeObject(options);

    if (!cleanRequest) {

        return {

            success: false,

            context:
                existingContext,

            status:
                "request-context-query-required",

            error:
                "Request is required."
        };
    }

    // --------------------------------------------------------
    // Document knowledge can be disabled explicitly.
    // --------------------------------------------------------

    if (
        settings.documentKnowledge === false ||
        existingContext.documentKnowledge === false
    ) {

        return {

            success: true,

            context: {
                ...existingContext,

                documentKnowledgeEnabled:
                    false
            },

            documentKnowledge: null,

            status:
                "document-knowledge-disabled"
        };
    }

    const limit =
        normalizeLimit(
            settings.limit ??
            existingContext.documentKnowledgeLimit,
            5,
            10
        );

    try {

        const documentContext =
            knowledgeContext.augmentBrainResult(
                cleanRequest,
                {
                    success: true,

                    memory:
                        existingContext.memory ||
                        {
                            related: [],
                            verified: []
                        },

                    knowledge:
                        existingContext.knowledge ||
                        {
                            related: [],
                            verified: []
                        }
                },
                {
                    limit
                }
            );

        // ----------------------------------------------------
        // Preserve every existing context field.
        // Add document-aware context alongside it.
        // ----------------------------------------------------

        const augmentedContext = {

            ...existingContext,

            documentKnowledgeEnabled:
                true,

            documentKnowledgeLimit:
                limit,

            documentContext:
                documentContext.unifiedKnowledge ||
                null,

            documentRag:
                documentContext.unifiedKnowledge
                    ?.rag ||
                null,

            documentDocuments:
                documentContext.unifiedKnowledge
                    ?.documents ||
                {
                    results: [],
                    count: 0,
                    available: false
                },

            documentKnowledge:
                documentContext.unifiedKnowledge
                    ?.knowledge
                    ?.documentKnowledge ||
                [],

            answerContext:
                documentContext.answerContext ||
                "",

            knowledgeContext:
                documentContext.knowledgeContext ||
                null
        };

        return {

            success: true,

            context:
                augmentedContext,

            documentKnowledge:
                documentContext.unifiedKnowledge ||
                null,

            answerContext:
                documentContext.answerContext ||
                "",

            documentKnowledgeAvailable:
                Boolean(
                    documentContext
                        .unifiedKnowledge
                        ?.availability
                        ?.anyKnowledge
                ),

            documentCount:
                Number(
                    documentContext
                        .unifiedKnowledge
                        ?.documents
                        ?.count
                ) || 0,

            status:
                "request-context-ready"
        };

    } catch (error) {

        // ----------------------------------------------------
        // Safe fallback:
        // Existing context must survive even when document
        // retrieval fails.
        // ----------------------------------------------------

        return {

            success: true,

            context: {

                ...existingContext,

                documentKnowledgeEnabled:
                    true,

                documentKnowledgeError:
                    error.message
            },

            documentKnowledge:
                null,

            answerContext:
                "",

            documentKnowledgeAvailable:
                false,

            documentCount:
                0,

            status:
                "document-context-fallback",

            warning:
                error.message
        };
    }
}


// ============================================================
// PROCESS REQUEST
// ============================================================

async function processRequest(
    request,
    context = {},
    options = {}
) {
    const cleanRequest =
        safeString(request);

    if (!cleanRequest) {

        return {

            success: false,

            status:
                "invalid-request",

            error:
                "AarHen requires a request."
        };
    }

    const requestContext =
        buildRequestContext(
            cleanRequest,
            context,
            options
        );

    if (!requestContext.success) {
        return requestContext;
    }

    let orchestrationResult;

    try {

        orchestrationResult =
            await orchestrator.process(
                cleanRequest,
                requestContext.context
            );

    } catch (error) {

        return {

            success: false,

            request:
                cleanRequest,

            context:
                requestContext.context,

            documentKnowledge:
                requestContext.documentKnowledge,

            status:
                "orchestrator-error",

            error:
                error.message
        };
    }


    // ========================================================
    // FINAL UNIFIED RESULT
    // ========================================================

    return {

        ...safeObject(
            orchestrationResult
        ),

        request:
            safeString(
                orchestrationResult?.request
            ) ||
            cleanRequest,

        pipeline: {

            name:
                "AarHen Unified Request Pipeline",

            version:
                REQUEST_PIPELINE_VERSION,

            status:
                "completed",

            documentKnowledgeEnabled:
                requestContext
                    .context
                    ?.documentKnowledgeEnabled !== false,

            documentKnowledgeAvailable:
                Boolean(
                    requestContext
                        .documentKnowledgeAvailable
                ),

            documentCount:
                requestContext.documentCount,

            answerContextAvailable:
                Boolean(
                    requestContext.answerContext
                )
        },

        documentKnowledge:
            requestContext.documentKnowledge,

        answerContext:
            requestContext.answerContext,

        requestContext:
            requestContext.context,

        status:
            orchestrationResult?.status ||
            "completed"
    };
}


// ============================================================
// SIMPLE ORCHESTRATE ALIAS
// ============================================================

async function orchestrate(
    request,
    context = {},
    options = {}
) {
    return processRequest(
        request,
        context,
        options
    );
}


// ============================================================
// DOCUMENT KNOWLEDGE ONLY
// ============================================================
// Useful for UI/API callers that need local knowledge without
// executing the full request.
// ============================================================

function getDocumentContext(
    request,
    options = {}
) {
    const cleanRequest =
        safeString(request);

    if (!cleanRequest) {

        return {

            success: false,

            status:
                "invalid-request",

            error:
                "Request is required."
        };
    }

    try {

        return knowledgeContext.buildAnswerContext(
            cleanRequest,
            {},
            {
                limit:
                    normalizeLimit(
                        options.limit,
                        5,
                        10
                    )
            }
        );

    } catch (error) {

        return {

            success: false,

            status:
                "document-context-error",

            error:
                error.message
        };
    }
}


// ============================================================
// HEALTH
// ============================================================

function health() {

    let orchestratorStatus =
        null;

    let knowledgeStatus =
        null;

    try {

        if (
            orchestrator &&
            typeof orchestrator.getStatus ===
                "function"
        ) {

            orchestratorStatus =
                orchestrator.getStatus();
        }

    } catch (error) {

        orchestratorStatus = {

            success: false,

            error:
                error.message
        };
    }


    try {

        if (
            knowledgeContext &&
            typeof knowledgeContext.getStatus ===
                "function"
        ) {

            knowledgeStatus =
                knowledgeContext.getStatus();
        }

    } catch (error) {

        knowledgeStatus = {

            success: false,

            error:
                error.message
        };
    }


    return {

        success: true,

        name:
            "AarHen Unified Request Pipeline",

        version:
            REQUEST_PIPELINE_VERSION,

        status:
            "active",

        connectedSystems: {

            masterOrchestrator:
                Boolean(
                    orchestrator
                ),

            unifiedKnowledgeContext:
                Boolean(
                    knowledgeContext
                ),

            documentKnowledge:
                Boolean(
                    knowledgeContext
                )
        },

        orchestrator:
            orchestratorStatus,

        knowledge:
            knowledgeStatus,

        pipeline: [

            "user-request",

            "request-validation",

            "document-knowledge-retrieval",

            "context-augmentation",

            "master-orchestrator",

            "brain-analysis",

            "skill-routing",

            "intent-analysis",

            "permission",

            "execution",

            "response"
        ]
    };
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    return {

        success: true,

        name:
            "AarHen Unified Request Pipeline",

        version:
            REQUEST_PIPELINE_VERSION,

        status:
            "active",

        capabilities: [

            "unified-request-processing",

            "document-knowledge-injection",

            "document-rag-context",

            "context-preservation",

            "master-orchestrator-integration",

            "safe-fallback",

            "document-context-only-query",

            "pipeline-health"
        ],

        connectedSystems: [

            "AarHen Master Orchestrator",

            "AarHen Unified Knowledge Context",

            "AarHen Document Knowledge Manager",

            "AarHen Document Context Adapter"
        ],

        pipeline: [

            "User Request",

            "Input Validation",

            "Document Knowledge Retrieval",

            "Context Augmentation",

            "Master Brain",

            "Skill Router",

            "Intent Engine",

            "Permission Brain",

            "Skill Executor",

            "Response Engine"
        ]
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    REQUEST_PIPELINE_VERSION,

    safeString,

    safeObject,

    safeArray,

    normalizeLimit,

    buildRequestContext,

    processRequest,

    orchestrate,

    getDocumentContext,

    health,

    getStatus
};
