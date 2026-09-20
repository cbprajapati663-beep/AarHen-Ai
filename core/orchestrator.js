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

const memoryManager =
    require("./memoryManager");

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
        category === "security"
    ) {

        return permissions.check(
            "security_testing_against_external_target"
        );
    }

    if (
        category === "coding"
    ) {

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

        // ----------------------------------------------------
        // BRAIN
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // MEMORY MANAGEMENT
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // ROUTING
        // ----------------------------------------------------

        routing: {

            selectedSkill:
                routing
                    .selectedSkill,

            matches:
                routing
                    .matches
        },

        // ----------------------------------------------------
        // INTENT
        // ----------------------------------------------------

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
// DETERMINE MEMORY ACTION
// ============================================================

function determineMemoryAction(
    brainResult,
    context = {}
) {

    const decision =
        brainResult
            ?.memory
            ?.decision;

    // --------------------------------------------------------
    // NO DECISION
    // --------------------------------------------------------

    if (!decision) {

        return {

            action:
                "none",

            shouldStore:
                false,

            reason:
                "No memory decision available."
        };
    }

    // --------------------------------------------------------
    // USER EXPLICITLY DISABLES MEMORY
    // --------------------------------------------------------

    if (
        context.remember === false
    ) {

        return {

            action:
                "do-not-remember",

            shouldStore:
                false,

            reason:
                "Memory explicitly disabled by user."
        };
    }

    // --------------------------------------------------------
    // USER EXPLICITLY REQUESTS MEMORY
    // --------------------------------------------------------

    if (
        context.remember === true
    ) {

        return {

            action:
                "remember",

            shouldStore:
                true,

            automatic:
                false,

            reason:
                "User explicitly requested memory.",

            type:
                decision.type,

            importance:
                decision.importance,

            importanceScore:
                decision.importanceScore,

            confidence:
                decision.confidence
        };
    }

    // --------------------------------------------------------
    // AUTOMATIC MEMORY MODE
    // --------------------------------------------------------

    if (
        context.autoRemember === true
    ) {

        if (
            decision.shouldRemember
        ) {

            return {

                action:
                    "auto-remember",

                shouldStore:
                    true,

                automatic:
                    true,

                reason:
                    decision.reason,

                type:
                    decision.type,

                importance:
                    decision.importance,

                importanceScore:
                    decision.importanceScore,

                confidence:
                    decision.confidence
            };
        }

        return {

            action:
                "auto-skip",

            shouldStore:
                false,

            automatic:
                true,

            reason:
                decision.reason
        };
    }

    // --------------------------------------------------------
    // SAFE DEFAULT
    // --------------------------------------------------------

    return {

        action:
            "evaluate-only",

        shouldStore:
            false,

        automatic:
            false,

        reason:
            decision.reason,

        type:
            decision.type,

        importance:
            decision.importance,

        importanceScore:
            decision.importanceScore,

        confidence:
            decision.confidence
    };
}

// ============================================================
// STORE MEMORY
// ============================================================

function storeMemory(
    request,
    brainResult,
    memoryAction,
    context = {}
) {

    if (
        !memoryAction ||
        memoryAction.shouldStore !== true
    ) {

        return {

            success: true,

            stored:
                false,

            status:
                "memory-not-written",

            reason:
                memoryAction
                    ?.reason ||
                "Memory storage not requested."
        };
    }

    // --------------------------------------------------------
    // EXPLICIT USER MEMORY
    // --------------------------------------------------------

    if (
        context.remember === true
    ) {

        return memoryManager.remember({

            type:
                context.memoryType ||
                brainResult
                    ?.memory
                    ?.decision
                    ?.type,

            title:
                context.memoryTitle ||
                "AarHen User Memory",

            category:
                context.memoryCategory ||
                brainResult
                    ?.memory
                    ?.decision
                    ?.type ||
                "general",

            content:
                request,

            source:
                context.memorySource ||
                "user",

            importance:
                context.memoryImportance ||
                brainResult
                    ?.memory
                    ?.decision
                    ?.importance,

            confidence:
                typeof context.memoryConfidence ===
                "number"

                    ? context.memoryConfidence

                    : brainResult
                        ?.memory
                        ?.decision
                        ?.confidence,

            tags:
                Array.isArray(
                    context.memoryTags
                )
                    ? context.memoryTags
                    : [],

            verified:
                Boolean(
                    context.memoryVerified
                ),

            remember:
                true
        });
    }

    // --------------------------------------------------------
    // AUTOMATIC MEMORY
    // --------------------------------------------------------

    return memoryManager.autoRemember({

        type:
            brainResult
                ?.memory
                ?.decision
                ?.type,

        title:
            "AarHen Automatic Memory",

        category:
            brainResult
                ?.memory
                ?.decision
                ?.type ||
            "general",

        content:
            request,

        source:
            "automatic-memory",

        importance:
            brainResult
                ?.memory
                ?.decision
                ?.importance,

        confidence:
            brainResult
                ?.memory
                ?.decision
                ?.confidence,

        verified:
            false,

        remember:
            true
    });
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
        typeof input !== "string"
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
    // MEMORY ACTION DECISION
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
    // MEMORY WRITE
    // --------------------------------------------------------

    let memoryWrite = {

        success: true,

        stored:
            false,

        status:
            "memory-not-written",

        reason:
            "Memory storage not requested."
    };

    if (
        memoryAction.shouldStore === true
    ) {

        memoryWrite =
            storeMemory(

                request,

                brainResult,

                memoryAction,

                context
            );
    }

    executionContext
        .memoryWrite =
            memoryWrite;

    // --------------------------------------------------------
    // APPROVAL REQUIRED
    // --------------------------------------------------------

    if (
        permission.requiresApproval
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

            memoryWrite,

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

        memoryWrite,

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

            "Automatic Memory Writer",

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

            "Memory Write",

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

            automaticWrite:
                true,

            explicitRemember:
                true,

            explicitDisable:
                true,

            duplicateProtection:
                true,

            importanceTracking:
                true,

            confidenceTracking:
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

    storeMemory,

    buildExecutionContext,

    getStatus
};
