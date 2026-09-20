// ============================================================
// AARHEN CORE V5
// MASTER ORCHESTRATOR
// ============================================================

const Brain = require("./brain");
const router = require("../skills/router");
const intent = require("./intent");
const executor = require("../skills/executor");
const permissions = require("./permissions");
const responseEngine = require("./response");


// ------------------------------------------------------------
// Select skill
// ------------------------------------------------------------

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


// ------------------------------------------------------------
// Determine required permission
// ------------------------------------------------------------

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


// ------------------------------------------------------------
// Process complete AarHen request
// ------------------------------------------------------------

function process(
    input,
    context = {}
) {

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


    // --------------------------------------------------------
    // 1. Master Brain
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
    // 2. Skill Router
    // --------------------------------------------------------

    const routing =
        selectSkill(request);


    if (!routing.success) {
        return routing;
    }


    // --------------------------------------------------------
    // 3. Intent Engine
    // --------------------------------------------------------

    const intentResult =
        intent.analyzeIntent(
            request
        );


    if (!intentResult.success) {
        return intentResult;
    }


    // --------------------------------------------------------
    // 4. Permission Check
    // --------------------------------------------------------

    const permission =
        determinePermission(
            intentResult,
            routing
        );


    // --------------------------------------------------------
    // 5. Approval Required
    // --------------------------------------------------------

    if (
        permission.requiresApproval
    ) {

        const approvalResult = {

            success: true,

            request,

            brain: brainResult,

            routing,

            intent: intentResult,

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
    // 6. Execute Engine
    // --------------------------------------------------------

    const execution =
        executor.executeIntent(
            intentResult
        );


    // --------------------------------------------------------
    // 7. Build orchestration result
    // --------------------------------------------------------

    const orchestrationResult = {

        success: true,

        request,

        brain: brainResult,

        routing,

        intent: intentResult,

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


    // --------------------------------------------------------
    // 8. Generate user response
    // --------------------------------------------------------

    orchestrationResult.response =
        responseEngine.createResponse(
            orchestrationResult
        );


    return orchestrationResult;

}


// ------------------------------------------------------------
// Backward-compatible orchestrate function
// ------------------------------------------------------------

function orchestrate(
    input,
    context = {}
) {

    return process(
        input,
        context
    );

}


// ------------------------------------------------------------
// Get orchestrator status
// ------------------------------------------------------------

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

            "Response Engine"

        ]

    };

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    process,

    orchestrate,

    selectSkill,

    determinePermission,

    getStatus

};
