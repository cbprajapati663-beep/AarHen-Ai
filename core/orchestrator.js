// ============================================================
// AARHEN CORE V5
// MASTER ORCHESTRATOR
// ============================================================

const Brain =
    require("./brain");

const router =
    require("../skills/router");

const intent =
    require("./intent");

const executor =
    require("../skills/executor");

const permissions =
    require("./permissions");

const responseEngine =
    require("./response");

// ============================================================
// SKILL SELECTION
// ============================================================

function selectSkill(input) {
    const result = router.route(input);

    if (!result.success) {
        return result;
    }

    return {
        success: true,
        selectedSkill: result.selectedSkill,
        matches: result.matches,
        status: result.status
    };
}

// ============================================================
// PERMISSION DECISION
// ============================================================

function determinePermission(intentResult, routing) {

    if (!routing.selectedSkill) {
        return permissions.check(
            "execute_external_code"
        );
    }

    const category =
        routing.selectedSkill.category;

    if (category === "security") {
        return permissions.check(
            "security_testing_against_external_target"
        );
    }

    if (category === "coding") {
        return permissions.check(
            "execute_external_code"
        );
    }

    if (
        category === "finance" ||
        category === "calculation" ||
        category === "knowledge" ||
        category === "research" ||
        category === "data" ||
        category === "documents" ||
        category === "business"
    ) {
        return permissions.check(
            "read_public_information"
        );
    }

    return permissions.check(
        "execute_external_code"
    );
}

// ============================================================
// BUILD EXECUTION CONTEXT
// ============================================================

function buildExecutionContext(
    brainResult,
    routing,
    intentResult,
    context = {}
) {
    return {
        ...context,

        brain: {
            request:
                brainResult.request,

            language:
                brainResult.language,

            memory:
                brainResult.memory,

            knowledge:
                brainResult.knowledge,

            thinkingContext:
                brainResult.thinkingContext
        },

        routing: {
            selectedSkill:
                routing.selectedSkill,

            matches:
                routing.matches
        },

        intent: {
            category:
                intentResult.category,

            intent:
                intentResult.intent,

            parameters:
                intentResult.parameters
        }
    };
}

// ============================================================
// MAIN PROCESS
// ============================================================

async function process(
    input,
    context = {}
) {

    if (
        !input ||
        typeof input !== "string"
    ) {
        return {
            success: false,
            error: "Invalid input."
        };
    }

    const request =
        input.trim();

    if (!request) {
        return {
            success: false,
            error: "Input is empty."
        };
    }

    // --------------------------------------------------------
    // 1. BRAIN THINKING
    // --------------------------------------------------------

    const brainResult =
        Brain.think(
            request,
            context
        );

    if (!brainResult.success) {
        return brainResult;
    }

    // --------------------------------------------------------
    // 2. SKILL ROUTING
    // --------------------------------------------------------

    const routing =
        selectSkill(request);

    if (!routing.success) {
        return routing;
    }

    // --------------------------------------------------------
    // 3. INTENT ANALYSIS
    // --------------------------------------------------------

    const intentResult =
        intent.analyzeIntent(
            request
        );

    if (!intentResult.success) {
        return intentResult;
    }

    // --------------------------------------------------------
    // 4. PERMISSION CHECK
    // --------------------------------------------------------

    const permission =
        determinePermission(
            intentResult,
            routing
        );

    // --------------------------------------------------------
    // 5. EXECUTION CONTEXT
    // --------------------------------------------------------

    const executionContext =
        buildExecutionContext(
            brainResult,
            routing,
            intentResult,
            context
        );

    // --------------------------------------------------------
    // 6. APPROVAL CHECK
    // --------------------------------------------------------

    if (permission.requiresApproval) {

        const approvalResult = {

            success: true,

            request,

            brain:
                brainResult,

            routing,

            intent:
                intentResult,

            permission,

            executionContext,

            execution: null,

            status:
                "approval-required",

            message:
                "AarHen requires user approval before performing this action.",

            timestamp:
                new Date().toISOString()
        };

        return {
            ...approvalResult,

            response:
                responseEngine.createResponse(
                    approvalResult
                )
        };
    }

    // --------------------------------------------------------
    // 7. EXECUTE SKILL
    // --------------------------------------------------------

    const execution =
        await executor.executeIntent(
            {
                ...intentResult,

                context:
                    executionContext
            }
        );

    // --------------------------------------------------------
    // 8. FINAL ORCHESTRATION RESULT
    // --------------------------------------------------------

    const orchestrationResult = {

        success: true,

        request,

        brain:
            brainResult,

        routing,

        intent:
            intentResult,

        permission,

        executionContext,

        execution,

        status:
            execution.success
                ? "completed"
                : execution.needsInput
                    ? "needs-user-input"
                    : "execution-error",

        timestamp:
            new Date().toISOString()
    };

    // --------------------------------------------------------
    // 9. RESPONSE GENERATION
    // --------------------------------------------------------

    orchestrationResult.response =
        responseEngine.createResponse(
            orchestrationResult
        );

    return orchestrationResult;
}

// ============================================================
// ORCHESTRATE ALIAS
// ============================================================

async function orchestrate(
    input,
    context = {}
) {
    return process(
        input,
        context
    );
}

// ============================================================
// STATUS
// ============================================================

function getStatus() {

    return {

        name:
            "AarHen Master Orchestrator",

        version:
            "5.0.0",

        status:
            "active",

        connectedLayers: [

            "Master Brain",

            "Language Engine",

            "Advanced Long-Term Memory",

            "RAG Knowledge Engine",

            "Verification Engine",

            "Continuous Learning Engine",

            "Permission & Safety Brain",

            "Skill Registry",

            "Skill Router",

            "Intent Engine",

            "Parameter Extraction",

            "Skill Executor",

            "Engine Handlers",

            "Research Provider",

            "Tavily Web Search",

            "Response Engine"
        ],

        workflow: [

            "Input",

            "Brain Analysis",

            "Memory Recall",

            "RAG Retrieval",

            "Skill Routing",

            "Intent Analysis",

            "Permission Check",

            "Context Injection",

            "Skill Execution",

            "Response Generation"
        ]
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    process,
    orchestrate,
    selectSkill,
    determinePermission,
    buildExecutionContext,
    getStatus
};
