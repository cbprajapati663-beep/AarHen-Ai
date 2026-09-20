// ============================================================
// AARHEN CORE V5
// SKILL EXECUTOR
// ============================================================

const handlers = require("./handlers");


// ------------------------------------------------------------
// Execute intent
// ------------------------------------------------------------

function executeIntent(intentData) {

    if (!intentData || !intentData.success) {

        return {
            success: false,
            error: "Invalid intent data."
        };

    }


    const category =
        intentData.category;


    const intent =
        intentData.intent;


    const parameters =
        intentData.parameters || {};


    const engine =
        handlers.getEngine(category);


    if (!engine) {

        return {

            success: false,

            error:
                `Engine not found for category: ${category}`

        };

    }


    // --------------------------------------------------------
    // Finance engine
    // --------------------------------------------------------

    if (
        category === "finance"
    ) {

        try {

            if (
                intent === "calculate_emi"
            ) {

                if (
                    parameters.amount === null ||
                    parameters.rate === null ||
                    parameters.years === null
                ) {

                    return {

                        success: false,

                        needsInput: true,

                        intent,

                        missingParameters: [

                            parameters.amount === null
                                ? "loan amount"
                                : null,

                            parameters.rate === null
                                ? "interest rate"
                                : null,

                            parameters.years === null
                                ? "loan tenure"
                                : null

                        ].filter(Boolean)

                    };

                }


                const result =
                    engine.calculateEMI(

                        parameters.amount,

                        parameters.rate,

                        parameters.years

                    );


                return {

                    success: true,

                    category,

                    intent,

                    parameters,

                    result,

                    executionStatus:
                        "completed"

                };

            }


            if (
                intent === "simple_interest"
            ) {

                if (
                    parameters.amount === null ||
                    parameters.rate === null ||
                    parameters.years === null
                ) {

                    return {

                        success: false,

                        needsInput: true,

                        intent,

                        missingParameters: [

                            parameters.amount === null
                                ? "principal"
                                : null,

                            parameters.rate === null
                                ? "interest rate"
                                : null,

                            parameters.years === null
                                ? "years"
                                : null

                        ].filter(Boolean)

                    };

                }


                const result =
                    engine.calculateSimpleInterest(

                        parameters.amount,

                        parameters.rate,

                        parameters.years

                    );


                return {

                    success: true,

                    category,

                    intent,

                    parameters,

                    result,

                    executionStatus:
                        "completed"

                };

            }

        }

        catch (error) {

            return {

                success: false,

                category,

                intent,

                error:
                    error.message

            };

        }

    }


    // --------------------------------------------------------
    // No executable function yet
    // --------------------------------------------------------

    return {

        success: true,

        category,

        intent,

        parameters,

        executionStatus:
            "engine-connected",

        message:
            "Intent recognized. Specific execution handler is not yet implemented."

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

    executeIntent,

    getEngineFunctions

};
