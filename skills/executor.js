// ============================================================
// AARHEN CORE V5
// SKILL EXECUTOR
// ============================================================

const handlers = require("./handlers");

function executeIntent(intentData = {}) {

    if (!intentData.success) {
        return {
            success: false,
            error: "Invalid intent data."
        };
    }

    const category =
        intentData.category || "general";

    const intent =
        intentData.intent || "unknown";

    const parameters =
        intentData.parameters || {};

    const engine =
        handlers.getEngine(category);

    if (!engine) {
        return {
            success: false,
            error: `No engine available for category: ${category}`,
            category,
            intent
        };
    }

    // --------------------------------------------------------
    // FINANCE
    // --------------------------------------------------------

    if (
        category === "finance" &&
        intent === "calculate_emi"
    ) {

        const missing = [];

        if (!parameters.amount) {
            missing.push("loan amount");
        }

        if (
            parameters.interestRate === undefined ||
            parameters.interestRate === null
        ) {
            missing.push("annual interest rate");
        }

        if (!parameters.years) {
            missing.push("loan tenure in years");
        }

        if (missing.length > 0) {
            return {
                success: false,
                needsInput: true,
                category,
                intent,
                parameters,
                missingParameters: missing,
                executionStatus: "waiting-for-input"
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
            executionStatus: "completed"
        };
    }

    // --------------------------------------------------------
    // SIMPLE INTEREST
    // --------------------------------------------------------

    if (
        category === "finance" &&
        intent === "simple_interest"
    ) {

        const missing = [];

        if (!parameters.amount) {
            missing.push("principal amount");
        }

        if (
            parameters.interestRate === undefined ||
            parameters.interestRate === null
        ) {
            missing.push("interest rate");
        }

        if (!parameters.years) {
            missing.push("time in years");
        }

        if (missing.length > 0) {
            return {
                success: false,
                needsInput: true,
                category,
                intent,
                parameters,
                missingParameters: missing,
                executionStatus: "waiting-for-input"
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
            executionStatus: "completed"
        };
    }

    // --------------------------------------------------------
    // RESEARCH
    // --------------------------------------------------------

    if (category === "research") {

        const result =
            engine.createResearchRequest({
                query: intentData.request,
                maxSources: 5,
                language: "auto"
            });

        return {
            success: result.success,
            category,
            intent,
            parameters,
            result,
            executionStatus:
                result.success
                    ? "research-request-created"
                    : "execution-error"
        };
    }

    // --------------------------------------------------------
    // KNOWLEDGE SEARCH
    // --------------------------------------------------------

    if (category === "knowledge") {

        const query =
            intentData.request || "";

        const result =
            engine.searchKnowledge(
                query,
                5
            );

        return {
            success: result.success,
            category,
            intent,
            parameters,
            result,
            executionStatus:
                result.success
                    ? "knowledge-search-completed"
                    : "execution-error"
        };
    }

    // --------------------------------------------------------
    // CALCULATOR
    // --------------------------------------------------------

    if (category === "calculation") {

        return {
            success: true,
            category,
            intent,
            parameters,
            result: {
                message:
                    "Calculator engine connected. Specific calculation parameters are required."
            },
            executionStatus:
                "calculation-engine-connected"
        };
    }

    // --------------------------------------------------------
    // CODING
    // --------------------------------------------------------

    if (category === "coding") {

        const result =
            engine.analyzeCode(
                intentData.request
            );

        return {
            success: result.success !== false,
            category,
            intent,
            parameters,
            result,
            executionStatus:
                "coding-analysis-completed"
        };
    }

    // --------------------------------------------------------
    // CYBERSECURITY
    // --------------------------------------------------------

    if (category === "security") {

        const result =
            engine.classifyRequest(
                intentData.request
            );

        return {
            success: result.success !== false,
            category,
            intent,
            parameters,
            result,
            executionStatus:
                "security-analysis-completed"
        };
    }

    // --------------------------------------------------------
    // DATA ANALYSIS
    // --------------------------------------------------------

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
            result,
            executionStatus:
                "data-engine-connected"
        };
    }

    // --------------------------------------------------------
    // DOCUMENTS
    // --------------------------------------------------------

    if (category === "documents") {

        const result =
            engine.getSupportedTypes();

        return {
            success: true,
            category,
            intent,
            parameters,
            result,
            executionStatus:
                "document-engine-connected"
        };
    }

    // --------------------------------------------------------
    // BUSINESS
    // --------------------------------------------------------

    if (category === "business") {

        const result =
            engine.analyzeRequest(
                intentData.request
            );

        return {
            success: result.success !== false,
            category,
            intent,
            parameters,
            result,
            executionStatus:
                "business-analysis-completed"
        };
    }

    // --------------------------------------------------------
    // DEFAULT
    // --------------------------------------------------------

    return {
        success: true,
        category,
        intent,
        parameters,
        result: {
            message:
                "Skill engine connected but no specific executor is defined yet."
        },
        executionStatus:
            "engine-connected"
    };
}

function getEngineFunctions(category) {

    const engine =
        handlers.getEngine(category);

    if (!engine) {
        return [];
    }

    return Object.keys(engine)
        .filter(
            key =>
                typeof engine[key] === "function"
        );
}

module.exports = {
    executeIntent,
    getEngineFunctions
};
