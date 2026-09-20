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
// SELECT SKILL
// ============================================================

function selectSkill(input) {

    const result =
        router.route(
            input
        );

    if (!result.success) {
        return result;
    }

    return {

        success: true,

        selectedSkill:
            result.selectedSkill,

        matches:
            result.matches,

        status:
            result.status
    };
}

// ============================================================
// DETERMINE PERMISSION
// ============================================================

function determinePermission(
    intentResult,
    routing
) {

    if (!routing.selectedSkill) {

        return permissions.check(
            "execute_external_code"
        );
    }

    const category =
        routing
            .selectedSkill
            .category;

    if (
        category ===
        "security"
    ) {

        return permissions.check(
            "security_testing_against_external_target"
        );
    }

    if (
        category ===
        "coding"
    ) {

        return permissions.check(
            "execute_external_code"
        );
    }

    if (

        category ===
            "finance" ||

        category ===
            "calculation" ||

        category ===
            "knowledge" ||

        category ===
            "research" ||

        category ===
            "data" ||

        category ===
            "documents" ||

        category ===
            "business"
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

        // ------------------------------------------
        // BRAIN
        // ------------------------------------------

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
                brainResult
                    .thinkingContext
        },

        // ------------------------------------------
        // MEMORY MANAGEMENT
        // ------------------------------------------

        memoryManagement: {

            decision:
                brainResult
                    .memory
                    ?.decision || null,

            managedRecall:
                brainResult
                    .memory
                    ?.managed || [],

            importantRecall:
                brainResult
                    .memory
                    ?.important || [],

            verifiedRecall:
                brainResult
                    .memory
                    ?.verified || []
        },

        // ------------------------------------------
        // ROUTING
        // ------------------------------------------

        routing: {

            selectedSkill:
                routing
                    .selectedSkill,

            matches:
                routing
                    .matches
        },

        // ------------------------------------------
        // INTENT
        // ------------------------------------------

        intent: {

            category:
                intentResult
                    .category,

            intent:
                intentResult
                    .intent,

            parameters:
                intentResult
                    .parameters
        }
    };
}

// ============================================================
// MEMORY ACTION DECISION
// ============================================================

function determineMemoryAction(
    brainResult,
    context = {}
) {

    const decision =
        brainResult
            ?.memory
            ?.decision;

    if (!decision) {

        return {

            action:
                "none",

            reason:
                "No memory decision available."
        };
    }

    // --------------------------------------------------------
    // EXPLICIT USER REQUEST
    // --------------------------------------------------------

    if (
        context.remember === true
    ) {

        return {

            action:
                "remember",

            reason:
                "User explicitly requested memory."
        };
    }

    // --------------------------------------------------------
    // EXPLICIT DISABLE
    // --------------------------------------------------------

    if (
        context.remember === false
    ) {

        return {

            action:
                "do-not-remember",

            reason:
                "Memory explicitly disabled."
        };
    }

    // --------------------------------------------------------
    // AUTOMATIC MEMORY MODE
    // --------------------------------------------------------

    if (
        context.autoRemember === true &&
        decision.shouldRemember
    ) {

        return {

            action:
                "remember",

            reason:
                decision.reason,

            type:
                decision.type,

            importance:
                decision.importance,

            confidence:
                decision.confidence
        };
    }

    // --------------------------------------------------------
    // DEFAULT
    // --------------------------------------------------------

    return {

        action:
            "evaluate-only",

        reason:
            decision.reason,

        type:
            decision.type,

        importance:
            decision.importance,

        confidence:
            decision.confidence
    };
}

// ============================================================
// PROCESS REQUEST
// ============================================================

async function process(
    input,
    context = {}
) {

    // --------------------------------------------------------
    // INPUT VALIDATION
    // --------------------------------------------------------

    if (
        !input ||
        typeof input !==
            "string"
    ) {

        return {

            success: false,

            error:
                "Invalid input."
        };
    }

    const request =
        input.trim();

    if (!request) {

        return {

            success: false,

            error:
                "Input is empty."
        };
    }

    // --------------------------------------------------------
    // MASTER BRAIN
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
    // SKILL ROUTING
    // --------------------------------------------------------

    const routing =
        selectSkill(
            request
        );

    if (!routing.success) {

        return routing;
    }

    // --------------------------------------------------------
    // INTENT ANALYSIS
    // --------------------------------------------------------

    const intentResult =
        intent.analyzeIntent(
            request
        );

    if (!intentResult.success) {

        return intentResult;
    }

    // --------------------------------------------------------
    // PERMISSION
    // --------------------------------------------------------

    const permission =
        determinePermission(
            intentResult,
            routing
        );

    // --------------------------------------------------------
    // MEMORY ACTION
    // --------------------------------------------------------

    const memoryAction =
        determineMemoryAction(
            brainResult,
            context
        );

    // --------------------------------------------------------
    // EXECUTION CONTEXT
    // --------------------------------------------------------

    const executionContext =
        buildExecutionContext(

            brainResult,

            routing,

            intentResult,

            context
        );

    executionContext
        .memoryAction =
            memoryAction;

    // --------------------------------------------------------
    // APPROVAL REQUIRED
    // --------------------------------------------------------

    if (
        permission
            .requiresApproval
    ) {

        const approvalResult = {

            success: true,

            request,

            brain:
                brainResult,

            routing,

            intent:
                intentResult,

            permission,

            memoryAction,

            executionContext,

            execution:
                null,

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
                responseEngine
                    .createResponse(
                        approvalResult
                    )
        };
    }

    // --------------------------------------------------------
    // EXECUTE SKILL
    // --------------------------------------------------------

    const execution =
        await executor
            .executeIntent({

                ...intentResult,

                context:
                    executionContext
            });

    // --------------------------------------------------------
    // FINAL RESULT
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

        memoryAction,

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
    // RESPONSE
    // --------------------------------------------------------

    orchestrationResult.response =
        responseEngine
            .createResponse(
                orchestrationResult
            );

    return orchestrationResult;
}

// ============================================================
// ORCHESTRATE
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
// ORCHESTRATOR STATUS
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

            "Advanced Memory Manager",

            "Memory Decision Engine",

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

            "Memory Management",

            "Memory Decision",

            "RAG Retrieval",

            "Skill Routing",

            "Intent Analysis",

            "Permission Check",

            "Context Injection",

            "Skill Execution",

            "Response Generation"
        ],

        memorySystem: {

            manager:
                "Advanced Memory Manager",

            decision:
                "Automatic Memory Decision",

            explicitRemember:
                true,

            explicitForget:
                true,

            automaticMode:
                "opt-in",

            safeDefault:
                "evaluate-only"
        }
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

    determineMemoryAction,

    buildExecutionContext,

    getStatus
};
