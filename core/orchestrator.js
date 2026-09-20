// ============================================================
// AARHEN CORE V5
// MASTER ORCHESTRATOR
// ============================================================

const Brain = require("./brain");
const router = require("../skills/router");
const intent = require("./intent");
const executor = require("../skills/executor");
const permissions = require("./permissions");


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


    // Security-related external testing

    if (
        category === "security" &&
        intentResult.intent !== "general_request"
    ) {

        return permissions.check(
            "security_testing_against_external_target"
        );

    }


    // Coding execution is not automatically allowed

    if (
        category === "coding"
    ) {

        return permissions.check(
            "execute_external_code"
        );

    }


    // Normal calculation/knowledge work

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
// Process complete request
// ------------------------------------------------------------

function orchestrate(
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
    // 3. Intent Analysis
    // --------------------------------------------------------

    const intentResult =
        intent.analyzeIntent(
            request
        );


    if (!intentResult.success) {
        return intentResult;
    }


    // --------------------------------------------------------
    // 4. Permission check
    // --------------------------------------------------------

    const permission =
        determinePermission(
            intentResult,
            routing
        );


    // --------------------------------------------------------
    // 5. Stop if approval is required
    // --------------------------------------------------------

    if (
        permission.requiresApproval
    ) {

        return {

            success: true,

            request,

            brain: {

                language:
                    brainResult.language,

                languageInfo:
                    brainResult.languageInfo,

                memory:
                    brainResult.memory

            },

            routing: {

                selectedSkill:
                    routing.selectedSkill,

                matches:
                    routing.matches,

                status:
                    routing.status

            },

            intent: {

                category:
                    intentResult.category,

                intent:
                    intentResult.intent,

                parameters:
                    intentResult.parameters

            },

            permission: {

                action:
                    permission.action,

                policy:
                    permission.policy,

                requiresApproval:
                    true

            },

            execution: null,

            status:
                "approval-required",

            message:
                "AarHen requires user approval before performing this action.",

            timestamp:
                new Date().toISOString()

        };

    }


    // --------------------------------------------------------
    // 6. Engine execution
    // --------------------------------------------------------

    const execution =
        executor.executeIntent(
            intentResult
        );


    // --------------------------------------------------------
    // 7. Final result
    // --------------------------------------------------------

    return {

        success: true,

        request,

        brain: {

            language:
                brainResult.language,

            languageInfo:
                brainResult.languageInfo,

            memory:
                brainResult.memory

        },


        routing: {

            selectedSkill:
                routing.selectedSkill,

            matches:
                routing.matches,

            status:
                routing.status

        },


        intent: {

            category:
                intentResult.category,

            intent:
                intentResult.intent,

            parameters:
                intentResult.parameters

        },


        permission: {

            action:
                permission.action,

            policy:
                permission.policy,

            requiresApproval:
                permission.requiresApproval

        },


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

            "Engine Handlers"

        ]

    };

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    orchestrate,

    selectSkill,

    determinePermission,

    getStatus

};
