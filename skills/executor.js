// ============================================================
// AARHEN CORE V5
// CONTEXT-AWARE SKILL EXECUTOR
// ============================================================
// Version: 5.7.5
//
// Purpose:
// Execute routed skills while preserving:
// - Brain context
// - Memory
// - Knowledge
// - Research context
// - Document knowledge
// - Document RAG context
// - Document answer context
//
// Important:
// The executor does NOT perform a second web search.
// Research is consumed from orchestrator context.
//
// Document knowledge is consumed from the unified request
// pipeline and passed into execution context.
// ============================================================

const handlers =
    require("./handlers");

const research =
    require("../engines/research");

const EXECUTOR_VERSION =
    "5.7.5";


// ============================================================
// HELPERS
// ============================================================

function safeObject(value) {

    return (
        value &&
        typeof value ===
            "object"
    )
        ? value
        : {};
}


function safeArray(value) {

    return Array.isArray(value)
        ? value
        : [];
}


function safeString(value) {

    return String(
        value ?? ""
    ).trim();
}


// ============================================================
// EXECUTION CONTEXT
// ============================================================

function prepareContext(
    intentData = {}
) {

    const context =
        intentData.context ||
        {};

    const brain =
        context.brain ||
        {};

    const memory =
        brain.memory ||
        {};

    const knowledge =
        brain.knowledge ||
        {};

    const thinkingContext =
        brain.thinkingContext ||
        {};


    // --------------------------------------------------------
    // RESEARCH CONTEXT
    // --------------------------------------------------------

    const researchContext =
        context.research ||
        null;


    // --------------------------------------------------------
    // DOCUMENT CONTEXT
    // --------------------------------------------------------

    const documentContext =
        context.documentContext ||
        context.brain?.documentKnowledge ||
        null;


    const documentKnowledge =
        context.documentKnowledge ||
        context.brain?.knowledge
            ?.documentKnowledge ||
        documentContext
            ?.documentKnowledge ||
        [];


    const documentRag =
        context.documentRag ||
        context.brain?.knowledge
            ?.documentRag ||
        documentContext?.rag ||
        null;


    const documentDocuments =
        context.documentDocuments ||
        context.brain?.knowledge
            ?.documentDocuments ||
        documentContext?.documents ||
        {
            results: [],
            count: 0,
            available: false
        };


    const answerContext =
        context.answerContext ||
        context.brain?.knowledge
            ?.documentAnswerContext ||
        documentContext
            ?.answerContext ||
        "";


    const knowledgeContext =
        context.knowledgeContext ||
        context.brain?.knowledge
            ?.documentKnowledgeContext ||
        documentContext
            ?.knowledgeContext ||
        null;


    return {

        brain,

        memory,

        knowledge,

        thinkingContext,


        // ----------------------------------------------------
        // WEB RESEARCH
        // ----------------------------------------------------

        research:
            researchContext,


        // ----------------------------------------------------
        // DOCUMENT KNOWLEDGE
        // ----------------------------------------------------

        documentAware:
            context.documentAware === true ||
            context.brain?.documentAware === true,

        documentKnowledgeEnabled:
            context.documentKnowledgeEnabled !== false,

        documentKnowledge,

        documentRag,

        documentDocuments,

        documentContext,

        answerContext,

        knowledgeContext,


        // ----------------------------------------------------
        // ROUTING
        // ----------------------------------------------------

        selectedSkill:
            context.routing?.selectedSkill ||
            null,

        routing:
            context.routing ||
            null,

        intent:
            context.intent ||
            null
    };
}


// ============================================================
// CONTEXT SUMMARY
// ============================================================

function createContextSummary(
    context = {}
) {

    const memoryItems =
        Array.isArray(
            context.memory?.related
        )
            ? context.memory.related
            : [];


    const verifiedMemoryItems =
        Array.isArray(
            context.memory?.verified
        )
            ? context.memory.verified
            : [];


    const knowledgeItems =
        Array.isArray(
            context.knowledge?.related
        )
            ? context.knowledge.related
            : [];


    const verifiedKnowledgeItems =
        Array.isArray(
            context.knowledge?.verified
        )
            ? context.knowledge.verified
            : [];


    const researchSources =
        Array.isArray(
            context.research?.sources
        )
            ? context.research.sources
            : [];


    const documentKnowledge =
        safeArray(
            context.documentKnowledge
        );


    const documentResults =
        safeArray(
            context.documentDocuments
                ?.results
        );


    const hasDocumentAnswer =
        Boolean(
            safeString(
                context.answerContext
            )
        );


    return {

        memoryCount:
            memoryItems.length,

        verifiedMemoryCount:
            verifiedMemoryItems.length,

        knowledgeCount:
            knowledgeItems.length,

        verifiedKnowledgeCount:
            verifiedKnowledgeItems.length,


        // ----------------------------------------------------
        // RESEARCH
        // ----------------------------------------------------

        researchSourceCount:
            researchSources.length,

        hasResearchContext:
            researchSources.length > 0,


        // ----------------------------------------------------
        // DOCUMENT KNOWLEDGE
        // ----------------------------------------------------

        documentKnowledgeCount:
            documentKnowledge.length,

        documentCount:
            Number(
                context.documentDocuments
                    ?.count
            ) ||
            documentResults.length,

        hasDocumentContext:
            Boolean(
                context.documentAware
            ) ||
            documentKnowledge.length > 0 ||
            documentResults.length > 0,

        hasDocumentAnswerContext:
            hasDocumentAnswer,


        // ----------------------------------------------------
        // GENERAL CONTEXT
        // ----------------------------------------------------

        hasContext:
            memoryItems.length > 0 ||
            knowledgeItems.length > 0 ||
            documentKnowledge.length > 0 ||
            documentResults.length > 0,

        hasVerifiedContext:
            verifiedMemoryItems.length > 0 ||
            verifiedKnowledgeItems.length > 0
    };
}


// ============================================================
// NORMALIZE RESEARCH SOURCES
// ============================================================

function normalizeResearchSources(
    sources = []
) {

    if (!Array.isArray(sources)) {

        return [];
    }


    return sources
        .map(
            (
                item,
                index
            ) => {

                if (!item) {

                    return null;
                }


                return {

                    id:
                        item.id ||
                        `research-source-${index + 1}`,

                    title:
                        item.title ||
                        "Untitled source",

                    url:
                        item.url ||
                        item.link ||
                        "",

                    publisher:
                        item.publisher ||
                        item.source ||
                        null,

                    publishedAt:
                        item.publishedAt ||
                        item.publishedDate ||
                        item.published_date ||
                        null,

                    content:
                        item.content ||
                        item.snippet ||
                        item.description ||
                        "",

                    snippet:
                        item.snippet ||
                        item.description ||
                        item.content ||
                        "",

                    score:
                        typeof item.score ===
                        "number"
                            ? item.score
                            : null
                };
            }
        )
        .filter(Boolean);
}


// ============================================================
// GET RESEARCH INPUT
// ============================================================
// The orchestrator performs the actual web search.
// The executor consumes that result.
// No second web search is performed here.
// ============================================================

function getResearchInput(
    context = {},
    intentData = {}
) {

    const researchContext =
        context.research ||
        {};


    const rawSources =
        Array.isArray(
            researchContext.sources
        )
            ? researchContext.sources
            : Array.isArray(
                researchContext.results
            )
                ? researchContext.results
                : [];


    const sources =
        normalizeResearchSources(
            rawSources
        );


    const query =
        researchContext.query ||
        intentData.request ||
        "";


    let confidence =
        typeof researchContext.confidence ===
        "number"
            ? researchContext.confidence
            : 0;


    if (
        confidence > 1
    ) {

        confidence =
            confidence / 100;
    }


    confidence =
        Math.max(
            0,
            Math.min(
                1,
                confidence
            )
        );


    const answer =
        researchContext.answer ||
        researchContext.summary ||
        researchContext.result?.answer ||
        researchContext.result?.summary ||
        "";


    const provider =
        researchContext.provider ||
        "research-provider";


    return {

        query,

        answer,

        sources,

        sourceCount:
            sources.length,

        confidence,

        provider,

        verificationStatus:
            researchContext.verificationStatus ||
            "review-required",

        verified:
            researchContext.verified === true,

        verification:
            researchContext.verification ||
            null,

        learning:
            researchContext.learning ||
            null,

        researchStatus:
            researchContext.researchStatus ||
            researchContext.status ||
            "review-required"
    };
}


// ============================================================
// DOCUMENT CONTEXT SUMMARY
// ============================================================

function getDocumentContextSummary(
    context = {}
) {

    const documentKnowledge =
        safeArray(
            context.documentKnowledge
        );


    const documentResults =
        safeArray(
            context.documentDocuments
                ?.results
        );


    return {

        enabled:
            context.documentKnowledgeEnabled !== false,

        aware:
            context.documentAware === true,

        knowledgeCount:
            documentKnowledge.length,

        documentCount:
            Number(
                context.documentDocuments
                    ?.count
            ) ||
            documentResults.length,

        ragAvailable:
            Boolean(
                context.documentRag
            ),

        answerContextAvailable:
            Boolean(
                safeString(
                    context.answerContext
                )
            ),

        detected:
            documentKnowledge.length > 0 ||
            documentResults.length > 0
    };
}


// ============================================================
// MAIN EXECUTOR
// ============================================================

async function executeIntent(
    intentData = {}
) {

    if (
        !intentData.success
    ) {

        return {

            success: false,

            error:
                "Invalid intent data."
        };
    }


    const category =
        intentData.category ||
        "general";


    const intent =
        intentData.intent ||
        "unknown";


    const parameters =
        intentData.parameters ||
        {};


    const context =
        prepareContext(
            intentData
        );


    const contextSummary =
        createContextSummary(
            context
        );


    const documentSummary =
        getDocumentContextSummary(
            context
        );


    const engine =
        handlers.getEngine(
            category
        );


    if (!engine) {

        return {

            success: false,

            error:
                `No engine available for category: ${category}`,

            category,

            intent,

            contextSummary,

            documentContext:
                documentSummary
        };
    }


    // ========================================================
    // FINANCE - EMI
    // ========================================================

    if (
        category === "finance" &&
        intent === "calculate_emi"
    ) {

        const missing = [];


        if (
            !parameters.amount
        ) {

            missing.push(
                "loan amount"
            );
        }


        if (
            parameters.interestRate ===
                undefined ||
            parameters.interestRate ===
                null
        ) {

            missing.push(
                "annual interest rate"
            );
        }


        if (
            !parameters.years
        ) {

            missing.push(
                "loan tenure in years"
            );
        }


        if (
            missing.length > 0
        ) {

            return {

                success: false,

                needsInput: true,

                category,

                intent,

                parameters,

                missingParameters:
                    missing,

                contextSummary,

                documentContext:
                    documentSummary,

                executionStatus:
                    "waiting-for-input"
            };
        }


        const result =
            engine.calculateEMI(
                parameters.amount,
                parameters.interestRate,
                parameters.years
            );


        return {

            success: true,

            category,

            intent,

            parameters,

            result,

            contextSummary,

            documentContext:
                documentSummary,

            executionStatus:
                "completed"
        };
    }


    // ========================================================
    // FINANCE - SIMPLE INTEREST
    // ========================================================

    if (
        category === "finance" &&
        intent === "simple_interest"
    ) {

        const missing = [];


        if (
            !parameters.amount
        ) {

            missing.push(
                "principal amount"
            );
        }


        if (
            parameters.interestRate ===
                undefined ||
            parameters.interestRate ===
                null
        ) {

            missing.push(
                "interest rate"
            );
        }


        if (
            !parameters.years
        ) {

            missing.push(
                "time in years"
            );
        }


        if (
            missing.length > 0
        ) {

            return {

                success: false,

                needsInput: true,

                category,

                intent,

                parameters,

                missingParameters:
                    missing,

                contextSummary,

                documentContext:
                    documentSummary,

                executionStatus:
                    "waiting-for-input"
            };
        }


        const result =
            engine.calculateSimpleInterest(
                parameters.amount,
                parameters.interestRate,
                parameters.years
            );


        return {

            success: true,

            category,

            intent,

            parameters,

            result,

            contextSummary,

            documentContext:
                documentSummary,

            executionStatus:
                "completed"
        };
    }


    // ========================================================
    // WEB RESEARCH
    // ========================================================

    if (
        category === "research"
    ) {

        // ----------------------------------------------------
        // IMPORTANT:
        // DO NOT call handlers.searchWeb() here.
        //
        // The orchestrator already performed live research
        // and injected the result into context.research.
        // ----------------------------------------------------

        const researchInput =
            getResearchInput(
                context,
                intentData
            );


        const query =
            researchInput.query;


        const sources =
            researchInput.sources;


        // ----------------------------------------------------
        // Empty research protection
        // ----------------------------------------------------

        if (
            !Array.isArray(sources) ||
            sources.length === 0
        ) {

            return {

                success: false,

                category,

                intent,

                parameters,

                contextSummary,

                documentContext:
                    documentSummary,

                result: {

                    success: false,

                    query,

                    sources: [],

                    sourceCount: 0,

                    confidence:
                        researchInput.confidence,

                    verificationStatus:
                        "not-verified",

                    error:
                        "No research sources were provided by the research orchestrator."
                },

                research: {

                    success: false,

                    query,

                    sources: [],

                    sourceCount: 0,

                    confidence:
                        researchInput.confidence,

                    verificationStatus:
                        "not-verified",

                    verified: false,

                    provider:
                        researchInput.provider,

                    error:
                        "Research source context is empty."
                },

                executionStatus:
                    "research-source-error"
            };
        }


        // ----------------------------------------------------
        // Provider confidence
        // ----------------------------------------------------

        let providerConfidence =
            researchInput.confidence;


        if (
            providerConfidence <= 0
        ) {

            if (
                sources.length >= 2
            ) {

                providerConfidence =
                    0.80;

            } else if (
                sources.length === 1
            ) {

                providerConfidence =
                    0.60;
            }
        }


        providerConfidence =
            Math.max(
                0,
                Math.min(
                    1,
                    providerConfidence
                )
            );


        // ----------------------------------------------------
        // Create research result
        // ----------------------------------------------------

        const researchResult =
            research.createResearchResult({

                query,

                sources,

                summary:
                    researchInput.answer ||
                    "",

                confidence:
                    providerConfidence
            });


        // ----------------------------------------------------
        // Verify research
        // ----------------------------------------------------

        const verificationResult =
            research.verifyResearch({

                result:
                    researchResult,

                sourceCount:
                    sources.length,

                confidence:
                    researchResult.confidence,

                notes:
                    "Verification based on research sources supplied by the orchestrator."
            });


        // ----------------------------------------------------
        // Learning
        // ----------------------------------------------------

        let learningResult =
            null;


        if (
            verificationResult.verified &&
            researchResult.summary
        ) {

            learningResult =
                research.learnVerifiedResearch({

                    title:
                        `Web Research: ${query}`,

                    query,

                    summary:
                        researchResult.summary,

                    sources,

                    category:
                        "web-research",

                    confidence:
                        verificationResult.confidence
                });
        }


        // ----------------------------------------------------
        // Final verification status
        // ----------------------------------------------------

        let verificationStatus =
            "review-required";


        if (
            verificationResult.verified
        ) {

            verificationStatus =
                "verified";

        } else if (
            sources.length > 0
        ) {

            verificationStatus =
                "partially-verified";
        }


        // ----------------------------------------------------
        // STANDARDIZED RESEARCH OBJECT
        // ----------------------------------------------------

        const standardizedResearch = {

            success: true,

            query,

            answer:
                researchInput.answer ||
                researchResult.summary ||
                "",

            sources,

            sourceCount:
                sources.length,

            confidence:
                researchResult.confidence,

            verificationStatus,

            verified:
                verificationResult.verified ===
                true,

            provider:
                researchInput.provider,

            verification:
                verificationResult,

            learning:
                learningResult,

            responseTime:
                null,

            previousKnowledgeAvailable:
                contextSummary.hasContext,

            previousVerifiedKnowledgeAvailable:
                contextSummary.hasVerifiedContext,

            researchStatus:
                verificationResult.verified
                    ? "verified"
                    : "review-required"
        };


        return {

            success: true,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            research:
                standardizedResearch,

            result:
                standardizedResearch,

            executionStatus:
                verificationResult.verified
                    ? (
                        learningResult &&
                        learningResult.success
                            ? "research-verified-and-learned"
                            : "research-verified-learning-failed"
                    )
                    : "research-completed-review-required"
        };
    }


    // ========================================================
    // KNOWLEDGE / RAG
    // ========================================================

    if (
        category === "knowledge"
    ) {

        const query =
            intentData.request ||
            "";


        const result =
            engine.searchKnowledge(
                query,
                5
            );


        return {

            success:
                result.success,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            result,

            executionStatus:
                result.success
                    ? "knowledge-search-completed"
                    : "execution-error"
        };
    }


    // ========================================================
    // CALCULATOR
    // ========================================================

    if (
        category === "calculation"
    ) {

        return {

            success: true,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            result: {

                message:
                    "Calculator engine connected. Specific calculation parameters are required."
            },

            executionStatus:
                "calculation-engine-connected"
        };
    }


    // ========================================================
    // CODING
    // ========================================================

    if (
        category === "coding"
    ) {

        const result =
            engine.analyzeCode(
                intentData.request
            );


        return {

            success:
                result.success !== false,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            result,

            executionStatus:
                "coding-analysis-completed"
        };
    }


    // ========================================================
    // CYBERSECURITY
    // ========================================================

    if (
        category === "security"
    ) {

        const result =
            engine.classifyRequest(
                intentData.request
            );


        return {

            success:
                result.success !== false,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            result,

            executionStatus:
                "security-analysis-completed"
        };
    }


    // ========================================================
    // DATA ANALYSIS
    // ========================================================

    if (
        category === "data"
    ) {

        const result =
            engine.createSummary
                ? engine.createSummary(
                    []
                )
                : {

                    message:
                        "Data Analysis Engine connected."
                };


        return {

            success: true,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            result,

            executionStatus:
                "data-engine-connected"
        };
    }


    // ========================================================
    // DOCUMENTS
    // ========================================================

    if (
        category === "documents"
    ) {

        const result =
            engine.getSupportedTypes();


        return {

            success: true,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            result,

            executionStatus:
                "document-engine-connected"
        };
    }


    // ========================================================
    // HERITAGE AUTO FINANCE BUSINESS
    // ========================================================

    if (
        category === "business"
    ) {

        const result =
            engine.analyzeRequest(
                intentData.request
            );


        return {

            success:
                result.success !== false,

            category,

            intent,

            parameters,

            contextSummary,

            documentContext:
                documentSummary,

            result,

            executionStatus:
                "business-analysis-completed"
        };
    }


    // ========================================================
    // DEFAULT
    // ========================================================

    return {

        success: true,

        category,

        intent,

        parameters,

        contextSummary,

        documentContext:
            documentSummary,

        result: {

            message:
                "Skill engine connected but no specific executor is defined yet."
        },

        executionStatus:
            "engine-connected"
    };
}


// ============================================================
// ENGINE FUNCTIONS
// ============================================================

function getEngineFunctions(
    category
) {

    const engine =
        handlers.getEngine(
            category
        );


    if (!engine) {

        return [];
    }


    return Object.keys(
        engine
    )
        .filter(
            key =>
                typeof engine[key] ===
                "function"
        );
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    let handlerStatus =
        null;


    try {

        handlerStatus = {

            available:
                Boolean(
                    handlers
                ),

            status:
                "active"
        };

    } catch (error) {

        handlerStatus = {

            available: false,

            status:
                "error",

            error:
                error.message
        };
    }


    return {

        success: true,

        name:
            "AarHen Context-Aware Skill Executor",

        version:
            EXECUTOR_VERSION,

        status:
            "active",


        capabilities: [

            "context-aware-execution",

            "brain-context",

            "memory-context",

            "knowledge-context",

            "research-context",

            "document-knowledge-context",

            "document-rag-context",

            "document-answer-context",

            "document-context-summary",

            "skill-engine-routing",

            "finance-execution",

            "research-execution",

            "knowledge-execution",

            "coding-analysis",

            "security-analysis",

            "data-analysis",

            "document-engine-access",

            "business-analysis",

            "safe-context-preservation"
        ],


        researchSystem: {

            connected:
                true,

            secondSearch:
                false,

            sourceConsumedFrom:
                "orchestrator.context.research"
        },


        documentSystem: {

            connected:
                true,

            knowledgeConsumedFrom:
                "requestPipeline.context",

            ragSupported:
                true,

            answerContextSupported:
                true,

            contextPreserved:
                true
        },


        handlers:
            handlerStatus
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    EXECUTOR_VERSION,

    executeIntent,

    getEngineFunctions,

    prepareContext,

    createContextSummary,

    getResearchInput,

    getDocumentContextSummary,

    getStatus
};
