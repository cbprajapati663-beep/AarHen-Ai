// ============================================================
// AARHEN CORE V5
// SKILL HANDLERS
// ============================================================

const finance =
    require("../engines/finance");

const calculator =
    require("../engines/calculator");

const knowledge =
    require("../engines/knowledge");

const research =
    require("../engines/research");

const coding =
    require("../engines/coding");

const cybersecurity =
    require("../engines/cybersecurity");

const dataAnalysis =
    require("../engines/dataAnalysis");

const documents =
    require("../engines/documents");

const business =
    require("../business/businessBrain");

const providerManager =
    require("../providers/providerManager");

const HANDLERS = {
    finance,
    calculator,
    knowledge,
    research,
    coding,
    cybersecurity,
    "data-analysis": dataAnalysis,
    documents,
    business,

    // Research provider access
    providers: providerManager
};

function getEngine(category) {
    return HANDLERS[category] || null;
}

function hasEngine(category) {
    return Boolean(
        HANDLERS[category]
    );
}

function getAvailableEngines() {
    return Object.keys(HANDLERS);
}

function getResearchProvider() {
    return providerManager.getProvider(
        "research"
    );
}

function getResearchProviderStatus() {
    return providerManager.getStatus();
}

async function searchWeb({
    query,
    maxSources = 5
} = {}) {

    return providerManager.searchWeb({
        query,
        maxSources
    });
}

module.exports = {
    HANDLERS,
    getEngine,
    hasEngine,
    getAvailableEngines,
    getResearchProvider,
    getResearchProviderStatus,
    searchWeb
};
