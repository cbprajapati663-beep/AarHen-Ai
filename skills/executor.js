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

        // --------------------------------------------------------
        // IMPORTANT:
        // Preserve orchestrator research context.
        // This prevents executor from performing another web search.
        // --------------------------------------------------------

        research:
            context.research || null,

        selectedSkill:
            context.routing?.selectedSkill || null,

        routing:
            context.routing || null,

        intent:
            context.intent || null
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

    const researchSources =
        Array.isArray(
            context.research?.sources
        )
            ? context.research.sources
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

        researchSourceCount:
            researchSources.length,

        hasResearchContext:
            researchSources.length > 0,

        hasContext:
            memoryItems.length > 0 ||
            knowledgeItems.length > 0,

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
            (item, index) => {

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
                        typeof item.score === "number"
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
//
// The orchestrator performs the actual web search.
// The executor MUST consume that research result.
//
// No second web search is performed here.
// ============================================================

function getResearchInput(
    context = {},
    intentData = {}
) {

    const researchContext =
        context.research || {};

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
        typeof researchContext.confidence === "number"
            ? researchContext.confidence
            : 0;

    if (confidence > 1) {
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

    if (category === "research") {

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
        // If orchestrator did not provide sources,
        // fail safely instead of doing another search.
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

            if (sources.length >= 2) {

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

        let learningResult = null;

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
                verificationResult.verified === true,

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

        // ----------------------------------------------------
        // FINAL RESULT
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

    if (category === "knowledge") {

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

    if (category === "calculation") {

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

    if (category === "coding") {

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

    if (category === "security") {

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

    if (category === "data") {

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

    if (category === "documents") {

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

    if (category === "business") {

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
