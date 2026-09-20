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

        const query =
            intentData.request;

        const searchResult =
            await handlers.searchWeb({
                query,
                maxSources: 5
            });

        if (!searchResult.success) {

            return {

                success: false,

                category,

                intent,

                parameters,

                contextSummary,

                result:
                    searchResult,

                executionStatus:
                    "research-error"
            };
        }

        const sources =
            (searchResult.results || [])
                .map(item => ({

                    title:
                        item.title,

                    url:
                        item.url,

                    publisher:
                        item.publisher,

                    publishedAt:
                        item.publishedAt
                }));

        const researchResult =
            research.createResearchResult({

                query,

                sources,

                summary:
                    searchResult.answer || "",

                confidence:
                    sources.length >= 2
                        ? 0.8
                        : sources.length === 1
                            ? 0.6
                            : 0
            });

        const verificationResult =
            research.verifyResearch({

                result:
                    researchResult,

                sourceCount:
                    sources.length,

                confidence:
                    researchResult.confidence,

                notes:
                    "Verification based on available research sources."
            });

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

        return {

            success: true,

            category,

            intent,

            parameters,

            contextSummary,

            result: {

                provider:
                    searchResult.provider,

                query:
                    searchResult.query,

                answer:
                    searchResult.answer || "",

                results:
                    searchResult.results || [],

                sourceCount:
                    searchResult.sourceCount || 0,

                responseTime:
                    searchResult.responseTime || null,

                verification:
                    verificationResult,

                learning:
                    learningResult,

                previousKnowledgeAvailable:
                    contextSummary.hasContext,

                previousVerifiedKnowledgeAvailable:
                    contextSummary.hasVerifiedContext,

                researchStatus:
                    verificationResult.verified
                        ? "verified"
                        : "review-required"
            },

            executionStatus:
                verificationResult.verified
                    ? "research-verified-and-learned"
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
