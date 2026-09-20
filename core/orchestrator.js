// AARHEN CORE V5
// Master Orchestrator
// Controls which engine should handle a request.

const Brain = require("./brain");

function orchestrate(input, context = {}) {

    if (!input || typeof input !== "string") {
        return {
            success: false,
            error: "Invalid input."
        };
    }

    const request = input.trim();

    return Brain.think(request, context);
}

module.exports = {
    orchestrate
};
