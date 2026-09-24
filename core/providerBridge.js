// ============================================================
// AARHEN CORE V5
// PROVIDER BRIDGE
// ============================================================
// Version: 5.9.2
//
// Purpose:
// - Safe bridge between Provider Manager and higher-level
//   systems such as Agent Worker / Autonomous Agent
// - Centralize provider selection
// - Centralize provider availability checks
// - Execute provider-backed web research
// - Build normalized research context
// - Preserve provider fallback information
// - Preserve reusable research source counts
//
// Architecture:
//
// Autonomous Agent
//       ↓
// Agent Worker
//       ↓
// Provider Bridge
//       ↓
// Provider Manager
//       ↓
// Web Research Provider(s)
//
// IMPORTANT:
// This layer does NOT bypass Provider Manager.
// It only exposes a controlled interface to higher layers.
// ============================================================


const providerManager =
    require("../providers/providerManager");


// ============================================================
// VERSION
// ============================================================

const PROVIDER_BRIDGE_VERSION =
    "5.9.2";


// ============================================================
// HELPERS
// ============================================================

function safeString(value) {

    return String(
        value ?? ""
    ).trim();

}


function safeObject(value) {

    return (
        value &&
        typeof value === "object"
    )
        ? value
        : {};

}


function safeArray(value) {

    return Array.isArray(
        value
    )
        ? value
        : [];

}


function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(
            value
        );

    return Number.isFinite(
        number
    )
        ? number
        : fallback;

}


function clone(value) {

    if (
        value ===
        undefined
    ) {

        return undefined;

    }


    try {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    } catch {

        return value;

    }

}


// ============================================================
// NORMALIZE MAX SOURCES
// ============================================================

function normalizeMaxSources(
    value
) {

    return Math.max(

        1,

        Math.min(

            10,

            safeNumber(
                value,
                5
            )

        )

    );

}


// ============================================================
// PROVIDER STATUS
// ============================================================

function getStatus() {

    let managerStatus = null;


    try {

        if (
            typeof providerManager.getStatus ===
            "function"
        ) {

            managerStatus =
                providerManager.getStatus();

        }

    } catch {

        managerStatus =
            null;

    }


    return {

        success:
            true,

        version:
            PROVIDER_BRIDGE_VERSION,

        status:
            "active",

        providerManager: {

            connected:
                Boolean(
                    managerStatus &&
                    managerStatus.success ===
                    true
                ),

            version:
                managerStatus?.version ||
                null,

            status:
                managerStatus?.status ||
                null

        }

    };

}


// ============================================================
// GET PROVIDER
// ============================================================

function getProvider(
    type
) {

    const normalizedType =
        safeString(
            type
        )
            .toLowerCase();


    if (
        typeof providerManager.getProvider !==
        "function"
    ) {

        return {

            success:
                false,

            provider:
                normalizedType,

            error:
                "Provider Manager does not expose getProvider()."

        };

    }


    const provider =
        providerManager.getProvider(
            normalizedType
        );


    if (!provider) {

        return {

            success:
                false,

            provider:
                normalizedType,

            error:
                `Provider "${normalizedType}" was not found.`

        };

    }


    return {

        success:
            true,

        provider:
            normalizedType,

        instance:
            provider

    };

}


// ============================================================
// SELECT PROVIDER
// ============================================================

function selectProvider(
    type = null
) {

    if (
        typeof providerManager.selectProvider !==
        "function"
    ) {

        return {

            success:
                false,

            error:
                "Provider Manager does not expose selectProvider()."

        };

    }


    try {

        return {

            ...providerManager.selectProvider(
                type
            ),

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    } catch (error) {

        return {

            success:
                false,

            selectedProvider:
                null,

            error:
                error.message ||
                "Provider selection failed.",

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }

}


// ============================================================
// AVAILABLE PROVIDERS
// ============================================================

function getAvailableProviders() {

    if (
        typeof providerManager.getAvailableProviders !==
        "function"
    ) {

        return {

            success:
                false,

            providers:
                [],

            error:
                "Provider Manager does not expose getAvailableProviders()."

        };

    }


    try {

        const providers =
            providerManager.getAvailableProviders();


        return {

            success:
                true,

            count:
                Array.isArray(
                    providers
                )
                    ? providers.length
                    : 0,

            providers:
                clone(
                    safeArray(
                        providers
                    )
                ),

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    } catch (error) {

        return {

            success:
                false,

            providers:
                [],

            count:
                0,

            error:
                error.message ||
                "Unable to read available providers.",

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }

}


// ============================================================
// PROVIDER HEALTH
// ============================================================

function getProviderHealth(
    type
) {

    if (
        typeof providerManager.getProviderHealth !==
        "function"
    ) {

        return {

            success:
                false,

            error:
                "Provider Manager does not expose getProviderHealth()."

        };

    }


    try {

        return {

            ...providerManager.getProviderHealth(
                type
            ),

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    } catch (error) {

        return {

            success:
                false,

            provider:
                safeString(
                    type
                )
                    .toLowerCase(),

            connected:
                false,

            error:
                error.message ||
                "Provider health check failed.",

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }

}


// ============================================================
// SEARCH
// ============================================================
//
// Controlled provider-backed search.
// No provider implementation is called directly.
// ============================================================

async function search({
    query,
    maxSources = 5,
    provider = null
} = {}) {

    const normalizedQuery =
        safeString(
            query
        );


    if (!normalizedQuery) {

        return {

            success:
                false,

            query:
                "",

            results:
                [],

            sourceCount:
                0,

            error:
                "Research query is required.",

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }


    if (
        typeof providerManager.searchWeb !==
        "function"
    ) {

        return {

            success:
                false,

            query:
                normalizedQuery,

            results:
                [],

            sourceCount:
                0,

            error:
                "Provider Manager does not expose searchWeb().",

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }


    const normalizedMaxSources =
        normalizeMaxSources(
            maxSources
        );


    try {

        const result =
            await providerManager.searchWeb({

                query:
                    normalizedQuery,

                maxSources:
                    normalizedMaxSources,

                provider:
                    provider ||
                    null

            });


        return {

            ...safeObject(
                result
            ),

            success:
                result?.success ===
                true,

            query:
                normalizedQuery,

            results:
                safeArray(
                    result?.results
                ),

            sourceCount:
                safeArray(
                    result?.results
                ).length,

            provider:
                result?.provider ||
                provider ||
                null,

            attemptedProviders:
                safeArray(
                    result?.attemptedProviders
                ),

            fallbackUsed:
                result?.fallbackUsed ===
                true,

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    } catch (error) {

        return {

            success:
                false,

            query:
                normalizedQuery,

            results:
                [],

            sourceCount:
                0,

            provider:
                provider ||
                null,

            attemptedProviders:
                [],

            fallbackUsed:
                false,

            error:
                error.message ||
                "Provider-backed search failed.",

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }

}


// ============================================================
// BUILD RESEARCH CONTEXT
// ============================================================
//
// Converts provider search output into a context object that
// higher-level systems can safely pass through task execution.
//
// ============================================================

async function prepareResearchContext({
    query,
    maxSources = 5,
    provider = null,
    existingContext = null
} = {}) {

    const existing =
        safeObject(
            existingContext
        );


    // --------------------------------------------------------
    // Existing usable research context
    // --------------------------------------------------------

    const existingSources =
        Array.isArray(
            existing.sources
        )
            ? existing.sources
            : Array.isArray(
                existing.results
            )
                ? existing.results
                : [];


    if (
        existingSources.length >
        0
    ) {

        const existingProvider =
            existing.provider ||
            provider ||
            null;


        const existingProviderType =
            existing.providerType ||
            null;


        const existingSourceCount =
            safeNumber(
                existing.sourceCount,
                existingSources.length
            );


        return {

            success:
                true,

            source:
                "existing-context",

            query:
                safeString(
                    existing.query ||
                    query
                ),

            context: {

                ...clone(
                    existing
                ),

                sources:
                    clone(
                        existingSources
                    ),

                results:
                    clone(
                        existingSources
                    ),

                sourceCount:
                    existingSources.length,

                provider:
                    existingProvider,

                providerType:
                    existingProviderType

            },

            provider:
                existingProvider,

            providerType:
                existingProviderType,

            attemptedProviders:
                safeArray(
                    existing.attemptedProviders
                ),

            fallbackUsed:
                existing.fallbackUsed ===
                true,

            searched:
                false,

            sourceCount:
                existingSources.length,

            existingSourceCount,

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }


    // --------------------------------------------------------
    // New provider search
    // --------------------------------------------------------

    const searchResult =
        await search({

            query,

            maxSources,

            provider

        });


    if (
        !searchResult.success
    ) {

        return {

            success:
                false,

            source:
                "provider-search",

            query:
                searchResult.query ||
                safeString(
                    query
                ),

            context:
                null,

            provider:
                searchResult.provider ||
                provider ||
                null,

            providerType:
                searchResult.providerType ||
                null,

            attemptedProviders:
                safeArray(
                    searchResult.attemptedProviders
                ),

            fallbackUsed:
                searchResult.fallbackUsed ===
                true,

            searched:
                true,

            sourceCount:
                0,

            error:
                searchResult.error ||
                "Unable to build research context.",

            bridgeVersion:
                PROVIDER_BRIDGE_VERSION

        };

    }


    const sources =
        safeArray(
            searchResult.results
        );


    const context = {

        query:
            searchResult.query,

        sources:
            clone(
                sources
            ),

        results:
            clone(
                sources
            ),

        answer:
            searchResult.answer ||
            searchResult.summary ||
            "",

        summary:
            searchResult.summary ||
            searchResult.answer ||
            "",

        provider:
            searchResult.provider ||
            provider ||
            null,

        providerType:
            searchResult.providerType ||
            null,

        attemptedProviders:
            clone(
                safeArray(
                    searchResult.attemptedProviders
                )
            ),

        fallbackUsed:
            searchResult.fallbackUsed ===
            true,

        sourceCount:
            sources.length,

        confidence:
            safeNumber(
                searchResult.confidence,
                0
            ),

        verificationRequired:
            true

    };


    return {

        success:
            true,

        source:
            "provider-search",

        query:
            searchResult.query,

        context,

        provider:
            context.provider,

        providerType:
            context.providerType,

        attemptedProviders:
            clone(
                context.attemptedProviders
            ),

        fallbackUsed:
            context.fallbackUsed,

        searched:
            true,

        sourceCount:
            context.sourceCount,

        bridgeVersion:
            PROVIDER_BRIDGE_VERSION

    };

}


// ============================================================
// CHECK CONNECTION
// ============================================================

function isConnected() {

    const status =
        getStatus();


    return Boolean(
        status.success &&
        status.providerManager?.connected ===
        true
    );

}


// ============================================================
// RESET
// ============================================================
//
// Provider Bridge itself is stateless.
// Provider Manager remains the owner of provider state.
//

function reset() {

    return {

        success:
            true,

        version:
            PROVIDER_BRIDGE_VERSION,

        status:
            "provider-bridge-reset",

        providerManagerStatePreserved:
            true

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    PROVIDER_BRIDGE_VERSION,

    getStatus,

    isConnected,

    getProvider,

    selectProvider,

    getAvailableProviders,

    getProviderHealth,

    search,

    prepareResearchContext,

    reset

};
