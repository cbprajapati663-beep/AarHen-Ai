// ============================================================
// AARHEN CORE V5
// CONTEXT-AWARE SKILL EXECUTOR
// ============================================================

const handlers =
    require("./handlers");

const research =
    require("../engines/research");


// ============================================================
// EXECUTION CONTEXT
// ============================================================

function prepareContext(intentData = {}) {

    const context =
        intentData.context || {};

    const brain =
        context.brain || {};

    const memory =
        brain.memory || {};

    const knowledge =
        brain.knowledge || {};

    const thinkingContext =
        brain.thinkingContext || {};

    return {

        brain,

        memory,

        knowledge,

        thinkingContext,

        selectedSkill:
            context.routing?.selectedSkill || null,

        routing:
            context.routing || null,

        intent:
            context.intent || null,

        // ----------------------------------------------------
        // IMPORTANT:
        // Preserve research context injected by orchestrator.
        // ----------------------------------------------------

        research:
            context.research || null
    };
}


// ============================================================
// CONTEXT SUMMARY
// ============================================================

function createContextSummary(context = {}) {

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

    return {

        memoryCount:
            memoryItems.length,

        verifiedMemoryCount:
            verifiedMemoryItems.length,

        knowledgeCount:
            knowledgeItems.length,

        verifiedKnowledgeCount:
            verifiedKnowledgeItems.length,

        hasContext:
            memoryItems.length > 0 ||
            knowledgeItems.length > 0,

        hasVerifiedContext:
            verifiedMemoryItems.length > 0 ||
            verifiedKnowledgeItems.length > 0
    };
}


// ============================================================
// RESEARCH SOURCE NORMALIZATION
// ============================================================

function normalizeResearchSources(
    rawSources = []
) {

    if (!Array.isArray(rawSources)) {
        return [];
    }

    return rawSources
        .filter(Boolean)
        .map(
            (item, index) => {

                return {

                    id:
                        item.id ||
                        `research-source-${index + 1}`,

                    title:
                        item.title ||
                        item.name ||
                        `Research Source ${index + 1}`,

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
                        item.published_at ||
                        null,

                    content:
                        item.content ||
                        item.text ||
                        item.snippet ||
                        item.description ||
                        "",

                    snippet:
                        item.snippet ||
                        item.description ||
                        item.content ||
                        item.text ||
                        "",

                    score:
                        typeof item.score === "number"
                            ? item.score
                            : null
                };
            }
        );
}


// ============================================================
// RESEARCH CONTEXT EXTRACTION
// ============================================================

function getResearchInput(
    context = {},
    intentData = {}
) {

    const researchContext =
        context.research || {};

    // --------------------------------------------------------
    // Research object may exist in:
    //
    // context.research.result
    // context.research
    // intentData.research
    // --------------------------------------------------------

    const nestedResult =
        researchContext.result ||
        researchContext.research ||
        intentData.research ||
        null;

    let rawSources = [];

    if (
        Array.isArray(
            researchContext.sources
        )
    ) {

        rawSources =
            researchContext.sources;

    } else if (
        Array.isArray(
            nestedResult?.sources
        )
    ) {

        rawSources =
            nestedResult.sources;

    } else if (
        Array.isArray(
            nestedResult?.results
        )
    ) {

        rawSources =
            nestedResult.results;
    }


    const sources =
        normalizeResearchSources(
            rawSources
        );


    const query =
        researchContext.query ||
        nestedResult?.query ||
        intentData.request ||
        "";


    const answer =
        researchContext.answer ||
        nestedResult?.answer ||
        nestedResult?.summary ||
        "";


    const provider =
        researchContext.provider ||
        nestedResult?.provider ||
        "research-provider";


    const suppliedConfidence =
        typeof researchContext.confidence === "number"
            ? researchContext.confidence
            : typeof nestedResult?.confidence === "number"
                ? nestedResult.confidence
                : 0;


    return {

        query,

        answer,

        provider,

        sources,

        sourceCount:
            sources.length,

        confidence:
            Math.max(
                0,
                Math.min(
                    1,
                    suppliedConfidence
                )
            ),

        previousKnowledgeAvailable:
            Boolean(
                researchContext.previousKnowledgeAvailable ||
                nestedResult?.previousKnowledgeAvailable
            ),

        previousVerifiedKnowledgeAvailable:
            Boolean(
                researchContext.previousVerifiedKnowledgeAvailable ||
                nestedResult?.previousVerifiedKnowledgeAvailable
            )
    };
}


// ============================================================
// MAIN EXECUTOR
// ============================================================

async function executeIntent(
    intentData = {}
) {

    if (!intentData.success) {

        return {
            success: false,
            error:
                "Invalid intent data."
        };
    }

    const category =
        intentData.category || "general";

    const intent =
        intentData.intent || "unknown";

    const parameters =
        intentData.parameters || {};

    const context =
        prepareContext(
            intentData
        );

    const contextSummary =
        createContextSummary(
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
            contextSummary
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

        if (!parameters.amount) {
            missing.push(
                "loan amount"
            );
        }

        if (
            parameters.interestRate === undefined ||
            parameters.interestRate === null
        ) {
            missing.push(
                "annual interest rate"
            );
        }

        if (!parameters.years) {
            missing.push(
                "loan tenure in years"
            );
        }

        if (missing.length > 0) {

            return {
                success: false,
                needsInput: true,
                category,
                intent,
                parameters,
                missingParameters:
                    missing,
                contextSummary,
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

        if (!parameters.amount) {
            missing.push(
                "principal amount"
            );
        }

        if (
            parameters.interestRate === undefined ||
            parameters.interestRate === null
        ) {
            missing.push(
                "interest rate"
            );
        }

        if (!parameters.years) {
            missing.push(
                "time in years"
            );
        }

        if (missing.length > 0) {

            return {
                success: false,
                needsInput: true,
                category,
                intent,
                parameters,
                missingParameters:
                    missing,
                contextSummary,
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
        // IMPORTANT ARCHITECTURE RULE
        // ----------------------------------------------------
        //
        // The Master Orchestrator is responsible for live
        // web research.
        //
        // The Executor must NOT perform a second web search.
        //
        // It consumes the already-collected research context,
        // verifies it, and learns only when verification passes.
        // ----------------------------------------------------

        const researchInput =
            getResearchInput(
                context,
                intentData
            );


        const query =
            researchInput.query ||
            intentData.request ||
            "";


        const sources =
            researchInput.sources;


        // ----------------------------------------------------
        // Research source validation
        // ----------------------------------------------------

        if (
            sources.length === 0
        ) {

            return {

                success: false,

                category,

                intent,

                parameters,

                contextSummary,

                research: {

                    success: false,

                    query,

                    sources: [],

                    sourceCount: 0,

                    confidence:
                        researchInput.confidence,

                    verificationStatus:
                        "not-verified",

                    verified:
                        false,

                    learning:
                        null,

                    error:
                        "No research sources were available in the execution context."
                },

                result: {

                    success: false,

                    message:
                        "Research was requested, but no source records reached the executor."
                },

                executionStatus:
                    "research-source-error"
            };
        }


        // ----------------------------------------------------
        // Create Research Result
        // ----------------------------------------------------

        const researchResult =
            research.createResearchResult({

                query,

                sources,

                summary:
                    researchInput.answer,

                confidence:
                    researchInput.confidence
            });


        // ----------------------------------------------------
        // Verify Research
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
                    "Verification based on the research sources collected by the Master Orchestrator."
            });


        // ----------------------------------------------------
        // Learning
        // ----------------------------------------------------

        let learningResult = null;


        if (
            verificationResult.verified &&
            researchResult.summary
        ) {

            // ------------------------------------------------
            // IMPORTANT:
            // learnVerifiedResearch() requires the research
            // record to explicitly carry verified state.
            // ------------------------------------------------

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
                        verificationResult.confidence,

                    verified:
                        true,

                    approved:
                        true,

                    learn:
                        true
                });
        }


        // ----------------------------------------------------
        // Final Verification Status
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
        // Learning Status
        // ----------------------------------------------------

        let learningStatus =
            "not-learned";


        if (
            verificationResult.verified &&
            learningResult
        ) {

            learningStatus =
                "learned";
        }


        // ----------------------------------------------------
        // Memory ID
        // ----------------------------------------------------

        const memoryId =
            learningResult?.memoryId ||
            null;


        // ----------------------------------------------------
        // STANDARDIZED RESEARCH OBJECT
        // ----------------------------------------------------

        const standardizedResearch = {

            success: true,

            query,

            answer:
                researchResult.summary ||
                researchInput.answer ||
                "",

            sources,

            sourceCount:
                sources.length,

            confidence:
                researchResult.confidence,

            verificationStatus,

            verified:
                Boolean(
                    verificationResult.verified
                ),

            provider:
                researchInput.provider,

            verification:
                verificationResult,

            learning:
                learningResult,

            learningStatus,

            memoryId,

            previousKnowledgeAvailable:
                researchInput
                    .previousKnowledgeAvailable,

            previousVerifiedKnowledgeAvailable:
                researchInput
                    .previousVerifiedKnowledgeAvailable,

            researchStatus:
                verificationResult.verified
                    ? (
                        learningResult
                            ? "research-verified-and-learned"
                            : "research-verified-learning-failed"
                    )
                    : "research-completed-review-required"
        };


        // ----------------------------------------------------
        // FINAL EXECUTION RESULT
        // ----------------------------------------------------

        return {

            success: true,

            category,

            intent,

            parameters,

            contextSummary,

            research:
                standardizedResearch,

            result:
                standardizedResearch,

            executionStatus:
                verificationResult.verified
                    ? (
                        learningResult
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
            intentData.request || "";

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
                ? engine.createSummary([])
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

    return Object.keys(engine)
        .filter(
            key =>
                typeof engine[key] ===
                "function"
        );
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    executeIntent,

    getEngineFunctions,

    prepareContext,

    createContextSummary
};
