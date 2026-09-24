// ============================================================
// AARHEN CORE V5
// UNIFIED REQUEST PIPELINE
// ============================================================
// Version: 5.7.4
//
// Purpose:
// Connect Document Knowledge with the existing AarHen
// Master Orchestrator while preserving document-aware
// knowledge through the request context.
//
// Flow:
//
// USER REQUEST
//      ↓
// DOCUMENT KNOWLEDGE
//      ↓
// CONTEXT AUGMENTATION
//      ↓
// BRAIN-AWARE CONTEXT
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
    "5.7.4";


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
// DOCUMENT KNOWLEDGE BLOCK
// ============================================================

function buildDocumentKnowledgeBlock(
    documentContext = {}
) {
    const unifiedKnowledge =
        safeObject(
            documentContext.unifiedKnowledge
        );

    const documents =
        safeObject(
            unifiedKnowledge.documents
        );

    const rag =
        safeObject(
            unifiedKnowledge.rag
        );

    const knowledge =
        safeObject(
            unifiedKnowledge.knowledge
        );

    const documentKnowledge =
        safeArray(
            knowledge.documentKnowledge
        );

    const documentResults =
        safeArray(
            documents.results
        );

    return {

        unified:
            unifiedKnowledge,

        rag,

        documents: {

            ...documents,

            results:
                documentResults,

            count:
                Number(
                    documents.count
                ) ||
                documentResults.length,

            available:
                Boolean(
                    documents.available
                )
        },

        documentKnowledge,

        answerContext:
            safeString(
                documentContext.answerContext
            ),

        knowledgeContext:
            documentContext.knowledgeContext ||
            null,

        available:
            Boolean(
                unifiedKnowledge
                    ?.availability
                    ?.anyKnowledge
            ),

        documentDetected:
            Boolean(
                documentResults.length > 0 ||
                documentKnowledge.length > 0
            )
    };
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
    // DOCUMENT KNOWLEDGE DISABLE
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

            documentKnowledge:
                null,

            answerContext:
                "",

            documentKnowledgeAvailable:
                false,

            documentCount:
                0,

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

        // ----------------------------------------------------
        // BUILD UNIFIED KNOWLEDGE
        // ----------------------------------------------------

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
        // NORMALIZE DOCUMENT KNOWLEDGE
        // ----------------------------------------------------

        const documentKnowledgeBlock =
            buildDocumentKnowledgeBlock(
                documentContext
            );


        // ----------------------------------------------------
        // PRESERVE EXISTING BRAIN
        // ----------------------------------------------------

        const existingBrain =
            safeObject(
                existingContext.brain
            );


        const existingBrainKnowledge =
            safeObject(
                existingBrain.knowledge
            );


        // ----------------------------------------------------
        // MERGE DOCUMENT KNOWLEDGE INTO BRAIN KNOWLEDGE
        // ----------------------------------------------------
        //
        // Existing knowledge is preserved.
        // Document knowledge is added as an additional
        // knowledge layer.
        //
        // This gives downstream Brain-aware components a
        // predictable place to find document knowledge.
        // ----------------------------------------------------

        const mergedBrainKnowledge = {

            ...existingBrainKnowledge,

            documentKnowledge:
                documentKnowledgeBlock
                    .documentKnowledge,

            documentDocuments:
                documentKnowledgeBlock
                    .documents,

            documentRag:
                documentKnowledgeBlock
                    .rag,

            documentUnifiedKnowledge:
                documentKnowledgeBlock
                    .unified,

            documentAnswerContext:
                documentKnowledgeBlock
                    .answerContext,

            documentKnowledgeContext:
                documentKnowledgeBlock
                    .knowledgeContext,

            documentKnowledgeAvailable:
                documentKnowledgeBlock
                    .available,

            documentDetected:
                documentKnowledgeBlock
                    .documentDetected
        };


        // ----------------------------------------------------
        // BRAIN CONTEXT
        // ----------------------------------------------------

        const augmentedBrain = {

            ...existingBrain,

            knowledge:
                mergedBrainKnowledge,

            documentKnowledge:
                documentKnowledgeBlock,

            documentAware:
                true
        };


        // ----------------------------------------------------
        // COMPLETE AUGMENTED CONTEXT
        // ----------------------------------------------------

        const augmentedContext = {

            ...existingContext,

            // ------------------------------------------------
            // MAIN FLAGS
            // ------------------------------------------------

            documentKnowledgeEnabled:
                true,

            documentKnowledgeLimit:
                limit,

            documentAware:
                true,


            // ------------------------------------------------
            // BRAIN-AWARE CONTEXT
            // ------------------------------------------------

            brain:
                augmentedBrain,


            // ------------------------------------------------
            // DOCUMENT CONTEXT
            // ------------------------------------------------

            documentContext:
                documentKnowledgeBlock
                    .unified,

            documentRag:
                documentKnowledgeBlock
                    .rag,

            documentDocuments:
                documentKnowledgeBlock
                    .documents,

            documentKnowledge:
                documentKnowledgeBlock
                    .documentKnowledge,

            answerContext:
                documentKnowledgeBlock
                    .answerContext,

            knowledgeContext:
                documentKnowledgeBlock
                    .knowledgeContext
        };


        return {

            success: true,

            context:
                augmentedContext,

            documentKnowledge:
                documentKnowledgeBlock
                    .unified,

            answerContext:
                documentKnowledgeBlock
                    .answerContext,

            documentKnowledgeAvailable:
                documentKnowledgeBlock
                    .available,

            documentCount:
                Number(
                    documentKnowledgeBlock
                        .documents
                        .count
                ) || 0,

            documentDetected:
                documentKnowledgeBlock
                    .documentDetected,

            status:
                "request-context-ready"
        };

    } catch (error) {

        // ----------------------------------------------------
        // SAFE FALLBACK
        // ----------------------------------------------------
        //
        // Existing context is never destroyed.
        // ----------------------------------------------------

        return {

            success: true,

            context: {

                ...existingContext,

                documentKnowledgeEnabled:
                    true,

                documentAware:
                    false,

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

            documentDetected:
                false,

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


        // ----------------------------------------------------
        // PIPELINE METADATA
        // ----------------------------------------------------

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

            documentAware:
                requestContext
                    .context
                    ?.documentAware === true,

            documentKnowledgeAvailable:
                Boolean(
                    requestContext
                        .documentKnowledgeAvailable
                ),

            documentDetected:
                Boolean(
                    requestContext
                        .documentDetected
                ),

            documentCount:
                requestContext.documentCount,

            answerContextAvailable:
                Boolean(
                    requestContext.answerContext
                )
        },


        // ----------------------------------------------------
        // DOCUMENT KNOWLEDGE
        // ----------------------------------------------------

        documentKnowledge:
            requestContext.documentKnowledge,

        answerContext:
            requestContext.answerContext,

        requestContext:
            requestContext.context,


        // ----------------------------------------------------
        // FINAL STATUS
        // ----------------------------------------------------

        status:
            orchestrationResult?.status ||
            "completed"
    };
}


// ============================================================
// ORCHESTRATE ALIAS
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


    // --------------------------------------------------------
    // ORCHESTRATOR
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // KNOWLEDGE
    // --------------------------------------------------------

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
                ),

            brainKnowledgeBridge:
                true
        },


        orchestrator:
            orchestratorStatus,


        knowledge:
            knowledgeStatus,


        pipeline: [

            "user-request",

            "request-validation",

            "document-knowledge-retrieval",

            "knowledge-normalization",

            "brain-knowledge-augmentation",

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

            "brain-knowledge-augmentation",

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

            "AarHen Document Context Adapter",

            "AarHen Brain Knowledge Bridge"
        ],


        pipeline: [

            "User Request",

            "Input Validation",

            "Document Knowledge Retrieval",

            "Knowledge Normalization",

            "Brain Knowledge Augmentation",

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

    buildDocumentKnowledgeBlock,

    buildRequestContext,

    processRequest,

    orchestrate,

    getDocumentContext,

    health,

    getStatus
};
