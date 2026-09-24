// ============================================================
// AARHEN CORE V5
// SKILL HANDLERS
// ============================================================
// Version: 5.8.3
//
// Purpose:
// Central registry for AarHen skill engines.
//
// Important:
// Category names used by Intent / Router / Executor / Agent
// layers must resolve to the correct engine here.
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


// ============================================================
// HANDLER REGISTRY
// ============================================================
//
// IMPORTANT:
// Some layers use "calculation" while the original engine
// name is "calculator".
//
// Some layers use "data" while the engine registry originally
// used "data-analysis".
//
// Both aliases are intentionally supported.
// ============================================================

const HANDLERS = {

    // --------------------------------------------------------
    // Core engines
    // --------------------------------------------------------

    finance,

    calculator,

    calculation:
        calculator,

    knowledge,

    research,

    coding,

    cybersecurity,

    security:
        cybersecurity,

    // --------------------------------------------------------
    // Data
    // --------------------------------------------------------

    "data-analysis":
        dataAnalysis,

    data:
        dataAnalysis,

    // --------------------------------------------------------
    // Documents
    // --------------------------------------------------------

    documents,

    // --------------------------------------------------------
    // Business
    // --------------------------------------------------------

    business,

    // --------------------------------------------------------
    // Research provider access
    // --------------------------------------------------------

    providers:
        providerManager
};


// ============================================================
// ENGINE ACCESS
// ============================================================

function getEngine(
    category
) {

    const key =
        String(
            category || ""
        )
            .trim()
            .toLowerCase();


    return (
        HANDLERS[key] ||
        null
    );
}


// ============================================================
// ENGINE EXISTENCE
// ============================================================

function hasEngine(
    category
) {

    return Boolean(
        getEngine(
            category
        )
    );
}


// ============================================================
// AVAILABLE ENGINES
// ============================================================

function getAvailableEngines() {

    return Object.keys(
        HANDLERS
    );
}


// ============================================================
// RESEARCH PROVIDER
// ============================================================

function getResearchProvider() {

    return providerManager.getProvider(
        "research"
    );
}


// ============================================================
// RESEARCH PROVIDER STATUS
// ============================================================

function getResearchProviderStatus() {

    return providerManager.getStatus();
}


// ============================================================
// WEB SEARCH
// ============================================================

async function searchWeb({
    query,
    maxSources = 5
} = {}) {

    if (
        !query ||
        typeof query !== "string"
    ) {

        return {

            success:
                false,

            error:
                "Research query is required.",

            sources:
                [],

            sourceCount:
                0,

            confidence:
                0,

            verificationStatus:
                "not-verified"
        };
    }


    try {

        const providerResult =
            await providerManager.searchWeb({

                query,

                maxSources

            });


        // ----------------------------------------------------
        // Normalize provider response
        // ----------------------------------------------------

        const rawSources =
            Array.isArray(
                providerResult?.sources
            )

                ? providerResult.sources

                : Array.isArray(
                    providerResult?.results
                )

                    ? providerResult.results

                    : [];


        const sources =
            rawSources.map(
                (
                    source,
                    index
                ) => {

                    return {

                        id:
                            source.id ||
                            `research-source-${index + 1}`,

                        title:
                            source.title ||
                            source.name ||
                            "Untitled source",

                        url:
                            source.url ||
                            source.link ||
                            "",

                        content:
                            source.content ||
                            source.snippet ||
                            source.description ||
                            "",

                        snippet:
                            source.snippet ||
                            source.description ||
                            source.content ||
                            "",

                        score:
                            typeof source.score ===
                            "number"

                                ? source.score

                                : null,

                        publishedDate:
                            source.publishedDate ||
                            source.published_date ||
                            null

                    };

                }
            );


        // ----------------------------------------------------
        // Confidence
        // ----------------------------------------------------

        let confidence =
            0;


        if (
            typeof providerResult?.confidence ===
            "number"
        ) {

            confidence =
                providerResult.confidence;

        } else if (
            sources.length >= 2
        ) {

            confidence =
                0.80;

        } else if (
            sources.length === 1
        ) {

            confidence =
                0.60;
        }


        confidence =
            Math.max(
                0,
                Math.min(
                    1,
                    confidence
                )
            );


        // ----------------------------------------------------
        // Verification status
        // ----------------------------------------------------

        let verificationStatus =
            "not-verified";


        if (
            providerResult?.verificationStatus
        ) {

            verificationStatus =
                providerResult.verificationStatus;

        } else if (
            sources.length >= 2 &&
            confidence >= 0.80
        ) {

            verificationStatus =
                "verified";

        } else if (
            sources.length >= 1 &&
            confidence >= 0.60
        ) {

            verificationStatus =
                "partially-verified";
        }


        // ----------------------------------------------------
        // Standardized response
        // ----------------------------------------------------

        return {

            success:
                providerResult?.success !== false,

            query,

            sources,

            sourceCount:
                sources.length,

            confidence,

            verificationStatus,

            provider:
                providerResult?.provider ||
                "research-provider",

            answer:
                providerResult?.answer ||
                providerResult?.summary ||
                null,

            raw:
                providerResult ||
                null

        };

    } catch (error) {

        return {

            success:
                false,

            query,

            error:
                error.message ||
                "Web research failed.",

            sources:
                [],

            sourceCount:
                0,

            confidence:
                0,

            verificationStatus:
                "not-verified"

        };
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    HANDLERS,

    getEngine,

    hasEngine,

    getAvailableEngines,

    getResearchProvider,

    getResearchProviderStatus,

    searchWeb

};
