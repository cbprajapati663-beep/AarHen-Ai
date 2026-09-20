// ============================================================
// AARHEN CORE V5
// MASTER ORCHESTRATOR
// ============================================================

const Brain = require("./brain");
const router = require("../skills/router");
const intent = require("./intent");
const executor = require("../skills/executor");


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
// Process complete request
// ------------------------------------------------------------

function orchestrate(input, context = {}) {

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
        intent.analyzeIntent(request);


    if (!intentResult.success) {
        return intentResult;
    }


    // --------------------------------------------------------
    // 4. Engine Execution
    // --------------------------------------------------------

    const execution =
        executor.executeIntent(
            intentResult
        );


    // --------------------------------------------------------
    // 5. Final orchestration result
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

    getStatus

};
