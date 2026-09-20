// ============================================================
// AARHEN CORE V5
// MASTER ORCHESTRATOR
// ============================================================

const Brain = require("./brain");
const router = require("../skills/router");


// ------------------------------------------------------------
// Route request to the correct skill
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
// Orchestrate AarHen request
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


    // Step 1: Brain analysis

    const brainResult =
        Brain.think(
            request,
            context
        );


    if (!brainResult.success) {
        return brainResult;
    }


    // Step 2: Skill routing

    const routing =
        selectSkill(request);


    if (!routing.success) {
        return routing;
    }


    // Step 3: Build orchestration result

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

        nextAction:
            routing.selectedSkill
                ? `Use ${routing.selectedSkill.name} skill`
                : "Use general reasoning",

        status:
            "orchestration-complete",

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

        flow: [

            "Receive Request",

            "Brain Analysis",

            "Language Detection",

            "Memory Recall",

            "Skill Routing",

            "Engine Selection",

            "Response Generation"

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
