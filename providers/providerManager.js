// ============================================================
// AARHEN CORE V5
// PROVIDER MANAGER
// ============================================================
// Version: 5.9.0
//
// Purpose:
// - Central gateway for all AarHen providers
// - Provider health detection
// - Provider enable/disable control
// - Priority based provider selection
// - Safe fallback between providers
// - Standardized provider status
// - Future support for research / AI / voice / vision / storage
//
// IMPORTANT:
// This layer does not pretend a provider is connected.
// A provider must expose getProviderStatus() and report
// connected: true before it can be used.
// ============================================================

const researchProvider =
    require("./researchProvider");


// ============================================================
// VERSION
// ============================================================

const PROVIDER_MANAGER_VERSION =
    "5.9.0";


// ============================================================
// DEFAULT PROVIDER CONFIGURATION
// ============================================================

const DEFAULT_CONFIG = Object.freeze({

    research: {

        priority:
            10,

        enabled:
            true,

        providerType:
            "web-search"

    }

});


// ============================================================
// PROVIDER REGISTRY
// ============================================================

const providers = {

    research:
        researchProvider

};


// ============================================================
// PROVIDER CONFIGURATION
// ============================================================

const providerConfig = {

    research: {

        ...DEFAULT_CONFIG.research

    }

};


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


function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}


function normalizeType(type) {

    return safeString(
        type
    )
        .toLowerCase();

}


// ============================================================
// GET PROVIDER
// ============================================================

function getProvider(type) {

    const normalizedType =
        normalizeType(
            type
        );

    return (
        providers[
            normalizedType
        ] ||
        null
    );

}


// ============================================================
// GET PROVIDER CONFIG
// ============================================================

function getProviderConfig(type) {

    const normalizedType =
        normalizeType(
            type
        );

    return (
        providerConfig[
            normalizedType
        ] ||
        null
    );

}


// ============================================================
// PROVIDER HEALTH CHECK
// ============================================================

function getProviderHealth(
    type
) {

    const normalizedType =
        normalizeType(
            type
        );

    const provider =
        getProvider(
            normalizedType
        );

    const config =
        getProviderConfig(
            normalizedType
        );


    if (!provider) {

        return {

            success:
                true,

            provider:
                normalizedType,

            exists:
                false,

            enabled:
                false,

            connected:
                false,

            status:
                "provider-not-found"

        };

    }


    if (!config) {

        return {

            success:
                true,

            provider:
                normalizedType,

            exists:
                true,

            enabled:
                false,

            connected:
                false,

            status:
                "provider-config-missing"

        };

    }


    if (
        config.enabled !==
        true
    ) {

        return {

            success:
                true,

            provider:
                normalizedType,

            exists:
                true,

            enabled:
                false,

            connected:
                false,

            priority:
                config.priority,

            providerType:
                config.providerType ||
                "unknown",

            status:
                "disabled"

        };

    }


    if (
        typeof provider
            .getProviderStatus !==
        "function"
    ) {

        return {

            success:
                true,

            provider:
                normalizedType,

            exists:
                true,

            enabled:
                true,

            connected:
                false,

            priority:
                config.priority,

            providerType:
                config.providerType ||
                "unknown",

            status:
                "invalid-provider-status-api"

        };

    }


    try {

        const rawStatus =
            safeObject(
                provider.getProviderStatus()
            );


        return {

            success:
                true,

            provider:
                normalizedType,

            exists:
                true,

            enabled:
                true,

            connected:
                Boolean(
                    rawStatus.connected
                ),

            priority:
                config.priority,

            providerType:
                config.providerType ||
                rawStatus.providerType ||
                "unknown",

            status:
                rawStatus.status ||
                (
                    rawStatus.connected
                        ? "connected"
                        : "disconnected"
                ),

            providerName:
                rawStatus.provider ||
                normalizedType,

            capabilities:
                {

                    supportsSearch:
                        Boolean(
                            rawStatus.supportsSearch
                        ),

                    supportsSourceValidation:
                        Boolean(
                            rawStatus
                                .supportsSourceValidation
                        ),

                    supportsResultNormalization:
                        Boolean(
                            rawStatus
                                .supportsResultNormalization
                        )

                },

            rawStatus

        };

    } catch (error) {

        return {

            success:
                false,

            provider:
                normalizedType,

            exists:
                true,

            enabled:
                true,

            connected:
                false,

            priority:
                config.priority,

            providerType:
                config.providerType ||
                "unknown",

            status:
                "provider-health-check-failed",

            error:
                error.message ||
                "Provider health check failed."

        };

    }

}


// ============================================================
// PROVIDER AVAILABLE
// ============================================================

function isProviderAvailable(
    type
) {

    const health =
        getProviderHealth(
            type
        );


    return Boolean(
        health.exists &&
        health.enabled &&
        health.connected
    );

}


// ============================================================
// LIST PROVIDERS
// ============================================================

function listProviders() {

    return Object.keys(
        providers
    )
        .map(
            type =>
                getProviderHealth(
                    type
                )
        )
        .sort(
            (
                a,
                b
            ) =>
                safeNumber(
                    a.priority
                ) -
                safeNumber(
                    b.priority
                )
        );

}


// ============================================================
// GET AVAILABLE PROVIDERS
// ============================================================

function getAvailableProviders() {

    return listProviders()
        .filter(
            provider =>
                provider.exists &&
                provider.enabled &&
                provider.connected
        );

}


// ============================================================
// SELECT PROVIDER
// ============================================================

function selectProvider(
    type
) {

    const requestedType =
        normalizeType(
            type
        );


    if (requestedType) {

        if (
            isProviderAvailable(
                requestedType
            )
        ) {

            return {

                success:
                    true,

                requestedProvider:
                    requestedType,

                selectedProvider:
                    requestedType,

                fallbackUsed:
                    false

            };

        }


        return {

            success:
                false,

            requestedProvider:
                requestedType,

            selectedProvider:
                null,

            fallbackUsed:
                false,

            error:
                `Requested provider "${requestedType}" is not available.`

        };

    }


    const available =
        getAvailableProviders();


    if (
        available.length ===
        0
    ) {

        return {

            success:
                false,

            requestedProvider:
                null,

            selectedProvider:
                null,

            fallbackUsed:
                false,

            error:
                "No enabled and connected provider is available."

        };

    }


    const selected =
        available[0];


    return {

        success:
            true,

        requestedProvider:
            null,

        selectedProvider:
            selected.provider,

        fallbackUsed:
            false,

        priority:
            selected.priority

    };

}


// ============================================================
// SEARCH WEB
// ============================================================
//
// Compatibility preserved:
// searchWeb({ query, maxSources })
//
// New:
// searchWeb({
//   query,
//   maxSources,
//   provider
// })
//
// When no provider is specified, the lowest priority number
// among connected providers is selected.
//
// If a selected provider fails, the manager tries the next
// connected provider automatically.
// ============================================================

async function searchWeb({

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

            providerConnected:
                false,

            providerRequired:
                true,

            results:
                [],

            attemptedProviders:
                [],

            error:
                "Research query is required."

        };

    }


    const normalizedMaxSources =
        Math.max(
            1,
            Math.min(
                safeNumber(
                    maxSources,
                    5
                ),
                10
            )
        );


    // --------------------------------------------------------
    // Requested provider
    // --------------------------------------------------------

    if (
        normalizeType(
            provider
        )
    ) {

        const requestedProvider =
            normalizeType(
                provider
            );


        if (
            !isProviderAvailable(
                requestedProvider
            )
        ) {

            return {

                success:
                    false,

                providerConnected:
                    false,

                providerRequired:
                    true,

                provider:
                    requestedProvider,

                results:
                    [],

                attemptedProviders:
                    [
                        requestedProvider
                    ],

                error:
                    `Requested provider "${requestedProvider}" is not available.`

            };

        }


        const selected =
            getProvider(
                requestedProvider
            );


        try {

            const result =
                await selected.search({

                    query:
                        normalizedQuery,

                    maxSources:
                        normalizedMaxSources

                });


            return {

                ...safeObject(
                    result
                ),

                provider:
                    result?.provider ||
                    requestedProvider,

                providerType:
                    getProviderConfig(
                        requestedProvider
                    )?.providerType ||
                    null,

                attemptedProviders:
                    [
                        requestedProvider
                    ],

                fallbackUsed:
                    false

            };

        } catch (error) {

            return {

                success:
                    false,

                providerConnected:
                    true,

                provider:
                    requestedProvider,

                providerRequired:
                    true,

                results:
                    [],

                attemptedProviders:
                    [
                        requestedProvider
                    ],

                fallbackUsed:
                    false,

                error:
                    error.message ||
                    `Provider "${requestedProvider}" search failed.`

            };

        }

    }


    // --------------------------------------------------------
    // Automatic priority routing
    // --------------------------------------------------------

    const availableProviders =
        getAvailableProviders();


    if (
        availableProviders.length ===
        0
    ) {

        return {

            success:
                false,

            providerConnected:
                false,

            providerRequired:
                true,

            results:
                [],

            attemptedProviders:
                [],

            fallbackUsed:
                false,

            error:
                "No enabled and connected web research provider is available."

        };

    }


    const attemptedProviders =
        [];


    let lastError =
        null;


    for (
        let index = 0;
        index <
        availableProviders.length;
        index++
    ) {

        const providerInfo =
            availableProviders[
                index
            ];


        const type =
            providerInfo.provider;


        const providerInstance =
            getProvider(
                type
            );


        attemptedProviders.push(
            type
        );


        if (
            !providerInstance ||
            typeof providerInstance.search !==
                "function"
        ) {

            lastError =
                `Provider "${type}" does not implement search().`;

            continue;

        }


        try {

            const result =
                await providerInstance.search({

                    query:
                        normalizedQuery,

                    maxSources:
                        normalizedMaxSources

                });


            if (
                result &&
                result.success ===
                    true
            ) {

                return {

                    ...result,

                    provider:
                        result.provider ||
                        type,

                    providerType:
                        providerInfo.providerType,

                    attemptedProviders:
                        [
                            ...attemptedProviders
                        ],

                    fallbackUsed:
                        index >
                        0,

                    providerManagerVersion:
                        PROVIDER_MANAGER_VERSION

                };

            }


            lastError =
                result?.error ||
                `Provider "${type}" returned an unsuccessful result.`;

        } catch (error) {

            lastError =
                error.message ||
                `Provider "${type}" search failed.`;

        }

    }


    return {

        success:
            false,

        providerConnected:
            true,

        providerRequired:
            true,

        results:
            [],

        attemptedProviders:
            [
                ...attemptedProviders
            ],

        fallbackUsed:
            attemptedProviders.length >
            1,

        error:
            lastError ||
            "All available providers failed.",

        providerManagerVersion:
            PROVIDER_MANAGER_VERSION

    };

}


// ============================================================
// REGISTER PROVIDER
// ============================================================

function registerProvider(
    type,
    provider,
    options = {}
) {

    const normalizedType =
        normalizeType(
            type
        );


    if (
        !normalizedType
    ) {

        return {

            success:
                false,

            error:
                "Provider type is required."

        };

    }


    if (!provider) {

        return {

            success:
                false,

            error:
                "Provider instance is required."

        };

    }


    if (
        typeof provider.search !==
            "function" ||
        typeof provider.getProviderStatus !==
            "function"
    ) {

        return {

            success:
                false,

            error:
                "Provider must implement search() and getProviderStatus()."

        };

    }


    const config =
        safeObject(
            options
        );


    const priority =
        Math.max(
            0,
            safeNumber(
                config.priority,
                100
            )
        );


    const enabled =
        config.enabled !==
        false;


    const providerType =
        safeString(
            config.providerType
        ) ||
        safeString(
            provider
                .getProviderStatus()
                ?.providerType
        ) ||
        "unknown";


    providers[
        normalizedType
    ] =
        provider;


    providerConfig[
        normalizedType
    ] = {

        priority,

        enabled,

        providerType

    };


    return {

        success:
            true,

        provider:
            normalizedType,

        status:
            "registered",

        enabled,

        priority,

        providerType

    };

}


// ============================================================
// ENABLE / DISABLE PROVIDER
// ============================================================

function setProviderEnabled(
    type,
    enabled
) {

    const normalizedType =
        normalizeType(
            type
        );


    if (
        !providers[
            normalizedType
        ]
    ) {

        return {

            success:
                false,

            error:
                `Provider "${normalizedType}" is not registered.`

        };

    }


    providerConfig[
        normalizedType
    ] =
        {

            ...providerConfig[
                normalizedType
            ],

            enabled:
                enabled ===
                true

        };


    return {

        success:
            true,

        provider:
            normalizedType,

        enabled:
            providerConfig[
                normalizedType
            ].enabled,

        status:
            providerConfig[
                normalizedType
            ].enabled
                ? "enabled"
                : "disabled"

    };

}


// ============================================================
// SET PROVIDER PRIORITY
// ============================================================

function setProviderPriority(
    type,
    priority
) {

    const normalizedType =
        normalizeType(
            type
        );


    if (
        !providers[
            normalizedType
        ]
    ) {

        return {

            success:
                false,

            error:
                `Provider "${normalizedType}" is not registered.`

        };

    }


    const normalizedPriority =
        Math.max(
            0,
            safeNumber(
                priority,
                100
            )
        );


    providerConfig[
        normalizedType
    ] =
        {

            ...providerConfig[
                normalizedType
            ],

            priority:
                normalizedPriority

        };


    return {

        success:
            true,

        provider:
            normalizedType,

        priority:
            normalizedPriority,

        status:
            "priority-updated"

    };

}


// ============================================================
// UNREGISTER PROVIDER
// ============================================================

function unregisterProvider(
    type
) {

    const normalizedType =
        normalizeType(
            type
        );


    if (
        !providers[
            normalizedType
        ]
    ) {

        return {

            success:
                false,

            error:
                `Provider "${normalizedType}" is not registered.`

        };

    }


    delete providers[
        normalizedType
    ];


    delete providerConfig[
        normalizedType
    ];


    return {

        success:
            true,

        provider:
            normalizedType,

        status:
            "unregistered"

    };

}


// ============================================================
// PROVIDER STATUS
// ============================================================

function getStatus() {

    const providerList =
        listProviders();


    const availableProviders =
        providerList.filter(
            item =>
                item.exists &&
                item.enabled &&
                item.connected
        );


    return {

        success:
            true,

        version:
            PROVIDER_MANAGER_VERSION,

        status:
            "active",

        providerCount:
            providerList.length,

        connectedProviderCount:
            availableProviders.length,

        availableProviders:
            availableProviders.map(
                item =>
                    item.provider
            ),

        primaryProvider:
            availableProviders.length >
            0
                ? availableProviders[0]
                    .provider
                : null,

        fallbackRouting:
            true,

        providers:
            providerList

    };

}


// ============================================================
// RESET
// ============================================================
//
// Keeps the built-in research provider.
// Removes dynamically registered providers.
//

function reset() {

    for (
        const type of
        Object.keys(
            providers
        )
    ) {

        if (
            type !==
            "research"
        ) {

            delete providers[
                type
            ];

            delete providerConfig[
                type
            ];

        }

    }


    providerConfig.research = {

        ...DEFAULT_CONFIG.research

    };


    return {

        success:
            true,

        status:
            "reset",

        version:
            PROVIDER_MANAGER_VERSION

    };

}


// ============================================================
// MODULE EXPORTS
// ============================================================

module.exports = {

    PROVIDER_MANAGER_VERSION,

    getProvider,

    getProviderConfig,

    getProviderHealth,

    isProviderAvailable,

    listProviders,

    getAvailableProviders,

    selectProvider,

    searchWeb,

    registerProvider,

    setProviderEnabled,

    setProviderPriority,

    unregisterProvider,

    getStatus,

    reset

};
