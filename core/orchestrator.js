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

    const result =
        router.route(input);

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
// PERMISSION CHECK
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
    // BRAIN
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
        selectSkill(request);

    if (!routing.success) {
        return routing;
    }

    // --------------------------------------------------------
    // INTENT
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
    // APPROVAL REQUIRED
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
    // EXECUTE SKILL
    // --------------------------------------------------------

    const execution =
        await executor.executeIntent(
            intentResult
        );

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

    orchestrationResult.response =
        responseEngine.createResponse(
            orchestrationResult
        );

    return orchestrationResult;
}

// ============================================================
// ALIAS
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

            "Memory Engine",

            "Verification Engine",

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

    getStatus
};
