// ============================================================
// AARHEN CORE V5
// REASONING CONTEXT ENGINE
// ============================================================

const Brain = require("./brain");
const router = require("../skills/router");
const intent = require("./intent");
const verification = require("./verification");


// ------------------------------------------------------------
// Build reasoning context
// ------------------------------------------------------------

function buildContext(
    input,
    options = {}
) {

    const request =
        String(input || "").trim();


    if (!request) {

        return {

            success: false,

            error:
                "Request is empty."

        };

    }


    // --------------------------------------------------------
    // Brain analysis
    // --------------------------------------------------------

    const brain =
        Brain.analyze(
            request,
            options
        );


    // --------------------------------------------------------
    // Skill routing
    // --------------------------------------------------------

    const routing =
        router.route(
            request
        );


    // --------------------------------------------------------
    // Intent analysis
    // --------------------------------------------------------

    const intentResult =
        intent.analyzeIntent(
            request
        );


    // --------------------------------------------------------
    // Related memory
    // --------------------------------------------------------

    const memories =
        Brain.recall(
            request,
            options.memoryLimit || 5
        );


    // --------------------------------------------------------
    // Verification summary
    // --------------------------------------------------------

    const verificationInfo =
        verification.verificationSummary(
            memories
        );


    // --------------------------------------------------------
    // Final context
    // --------------------------------------------------------

    return {

        success: true,

        request,

        language: {

            detected:
                brain.language,

            info:
                brain.languageInfo

        },


        skill: {

            selected:
                routing.selectedSkill,

            matches:
                routing.matches,

            status:
                routing.status

        },


        intent: {

            category:
                intentResult.category,

            name:
                intentResult.intent,

            parameters:
                intentResult.parameters

        },


        memory: {

            count:
                memories.length,

            items:
                memories

        },


        verification:
            verificationInfo,


        createdAt:
            new Date().toISOString()

    };

}


// ------------------------------------------------------------
// Create compact context
// ------------------------------------------------------------

function createCompactContext(
    input,
    options = {}
) {

    const context =
        buildContext(
            input,
            options
        );


    if (!context.success) {
        return context;
    }


    return {

        success: true,

        request:
            context.request,

        language:
            context.language.detected,

        skill:
            context.skill.selected
                ? context.skill.selected.name
                : null,

        intent:
            context.intent.name,

        parameters:
            context.intent.parameters,

        memoryCount:
            context.memory.count,

        verifiedMemoryCount:
            context.verification.verified,

        createdAt:
            context.createdAt

    };

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    buildContext,

    createCompactContext

};
