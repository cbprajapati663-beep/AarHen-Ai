// ============================================================
// AARHEN CORE V5
// SKILL EXECUTOR
// ============================================================

const handlers = require("./handlers");


// ------------------------------------------------------------
// Execute a selected skill
// ------------------------------------------------------------

function execute(skill, input, options = {}) {

    if (!skill) {

        return {
            success: false,
            error: "No skill selected."
        };

    }


    const category =
        skill.category;


    const engine =
        handlers.getEngine(category);


    if (!engine) {

        return {

            success: false,

            error:
                `No engine available for skill category: ${category}`

        };

    }


    // --------------------------------------------------------
    // Safe execution mode
    // --------------------------------------------------------

    // At this stage AarHen does not guess which engine
    // function should receive arbitrary user text.
    //
    // Instead, return the available engine functions.
    // A higher reasoning layer will choose the exact function.

    const functions =
        Object.keys(engine)
            .filter(key =>
                typeof engine[key] === "function"
            );


    return {

        success: true,

        skill: {

            id:
                skill.id,

            name:
                skill.name,

            category:
                skill.category

        },

        input,

        availableFunctions:
            functions,

        executionStatus:
            "engine-ready",

        message:
            "Skill engine is connected and ready for function selection."

    };

}


// ------------------------------------------------------------
// Get engine functions
// ------------------------------------------------------------

function getEngineFunctions(category) {

    const engine =
        handlers.getEngine(category);


    if (!engine) {

        return {

            success: false,

            error:
                `Engine not found: ${category}`

        };

    }


    return {

        success: true,

        category,

        functions:
            Object.keys(engine)
                .filter(key =>
                    typeof engine[key] === "function"
                )

    };

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    execute,

    getEngineFunctions

};
