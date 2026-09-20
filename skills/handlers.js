// ============================================================
// AARHEN CORE V5
// SKILL ENGINE HANDLERS
// ============================================================

const finance = require("../engines/finance");
const calculator = require("../engines/calculator");
const knowledge = require("../engines/knowledge");
const research = require("../engines/research");
const coding = require("../engines/coding");
const cybersecurity = require("../engines/cybersecurity");
const dataAnalysis = require("../engines/dataAnalysis");
const documents = require("../engines/documents");
const business = require("../business/businessBrain");


// ------------------------------------------------------------
// Engine registry
// ------------------------------------------------------------

const HANDLERS = {

    finance,

    calculator,

    knowledge,

    research,

    coding,

    cybersecurity,

    "data-analysis": dataAnalysis,

    documents,

    business

};


// ------------------------------------------------------------
// Get engine
// ------------------------------------------------------------

function getEngine(category) {

    return HANDLERS[category] || null;
}


// ------------------------------------------------------------
// Check engine availability
// ------------------------------------------------------------

function hasEngine(category) {

    return Boolean(
        HANDLERS[category]
    );
}


// ------------------------------------------------------------
// Get available engines
// ------------------------------------------------------------

function getAvailableEngines() {

    return Object.keys(HANDLERS);
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    HANDLERS,

    getEngine,

    hasEngine,

    getAvailableEngines

};
