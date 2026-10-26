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

const { createOpenAIVoiceProvider } =
    require("../core/openaiVoiceProvider");

const { createOpenAIVisionProvider } =
    require("../core/openaiVisionProvider");

const voiceProvider =
    createOpenAIVoiceProvider();

const visionProvider =
    createOpenAIVisionProvider();


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

    },

    voice: {

        priority:
            20,

        enabled:
            true,

        providerType:
            "speech"

    },

    vision: {

        priority:
            30,

        enabled:
            true,

        providerType:
            "vision"

    }

});


// ============================================================
// PROVIDER REGISTRY
// ============================================================

const providers = {

    research:
        researchProvider,

    voice:
        voiceProvider,

    vision:
        visionProvider

};


// ============================================================
// PROVIDER CONFIGURATION
// ============================================================

const providerConfig = {

    research: {

        ...DEFAULT_CONFIG.research

    },

    voice: {

        ...DEFAULT_CONFIG.voice

    },

    vision: {

        ...DEFAULT_CONFIG.vision

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


// Bound provider calls so a hung integration cannot block fallback routing forever.
// A timed-out provider may still finish in the background if it ignores cancellation.
const DEFAULT_SEARCH_TIMEOUT_MS = 15000;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 30000;
const MAX_CIRCUIT_COOLDOWN_MS = 300000;
const providerFailureState = new Map();

function getCircuitConfig(type) {
    const config = getProviderConfig(type) || {};
    const threshold = Number(config.failureThreshold);
    const cooldown = Number(config.circuitCooldownMs);
    return {
        failureThreshold: Number.isFinite(threshold) && threshold >= 1
            ? Math.min(Math.floor(threshold), 20)
            : DEFAULT_FAILURE_THRESHOLD,
        cooldownMs: Number.isFinite(cooldown) && cooldown > 0
            ? Math.min(Math.floor(cooldown), MAX_CIRCUIT_COOLDOWN_MS)
            : DEFAULT_CIRCUIT_COOLDOWN_MS
    };
}

function getCircuitState(type) {
    const key = normalizeType(type);
    const state = providerFailureState.get(key) || { failures: 0, openUntil: 0, halfOpenProbe: false };
    const now = Date.now();
    const open = state.openUntil > now;
    const halfOpen = Boolean(state.openUntil && !open);
    return {
        provider: key,
        failures: state.failures,
        open,
        openUntil: state.openUntil || null,
        status: open ? "open" : halfOpen ? (state.halfOpenProbe ? "half-open-probe-active" : "half-open") : "closed"
    };
}

// After cooldown, allow only one request to probe a provider. Other concurrent
// requests skip it until that probe succeeds or fails and updates the circuit.
function acquireCircuitPermit(type) {
    const key = normalizeType(type);
    const state = providerFailureState.get(key);
    if (!state || !state.openUntil) return { allowed: true, halfOpen: false };
    const now = Date.now();
    if (state.openUntil > now) return { allowed: false, halfOpen: false };
    if (state.halfOpenProbe) return { allowed: false, halfOpen: true };
    state.halfOpenProbe = true;
    providerFailureState.set(key, state);
    return { allowed: true, halfOpen: true };
}

function recordProviderFailure(type) {
    const key = normalizeType(type);
    const config = getCircuitConfig(key);
    const state = providerFailureState.get(key) || { failures: 0, openUntil: 0, halfOpenProbe: false };
    const wasHalfOpenProbe = state.halfOpenProbe === true;
    state.halfOpenProbe = false;
    state.failures += 1;
    if (wasHalfOpenProbe || state.failures >= config.failureThreshold) {
        state.openUntil = Date.now() + config.cooldownMs;
    }
    providerFailureState.set(key, state);
    return getCircuitState(key);
}

function recordProviderSuccess(type) {
    providerFailureState.set(normalizeType(type), { failures: 0, openUntil: 0, halfOpenProbe: false });
    return getCircuitState(type);
}

function getSearchTimeoutMs(type) {
    const configured = Number(getProviderConfig(type)?.searchTimeoutMs);
    if (!Number.isFinite(configured) || configured <= 0) {
        return DEFAULT_SEARCH_TIMEOUT_MS;
    }
    return Math.max(1, Math.min(configured, 120000));
}

function searchWithTimeout(providerInstance, type, args) {
    const timeoutMs = getSearchTimeoutMs(type);
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const error = new Error(
                `Provider "${type}" search timed out after ${timeoutMs}ms.`
            );
            error.code = "PROVIDER_TIMEOUT";
            reject(error);
        }, timeoutMs);

        Promise.resolve()
            .then(() => providerInstance.search(args))
            .then(
                result => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(result);
                },
                error => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                }
            );
    });
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
                        ),

                    supportsTranscription:
                        Boolean(rawStatus.supportsTranscription),

                    supportsSpeechSynthesis:
                        Boolean(rawStatus.supportsSpeechSynthesis),

                    supportsVisionAnalysis:
                        Boolean(rawStatus.supportsVisionAnalysis)

                },

            rawStatus,

            circuitBreaker: getCircuitState(normalizedType)

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
                provider.connected &&
                typeof getProvider(provider.provider)?.search === "function"
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


        const selected =
            getProvider(
                requestedProvider
            );

        if (!selected || typeof selected.search !== "function") {
            return {
                success: false,
                providerConnected: false,
                providerRequired: true,
                provider: requestedProvider,
                results: [],
                attemptedProviders: [requestedProvider],
                fallbackUsed: false,
                error: `Requested provider "${requestedProvider}" does not support web search.`,
                providerManagerVersion: PROVIDER_MANAGER_VERSION
            };
        }

        const circuitPermit = acquireCircuitPermit(requestedProvider);
        if (!circuitPermit.allowed) {
            const circuit = getCircuitState(requestedProvider);
            return {
                success: false,
                providerConnected: false,
                providerRequired: true,
                provider: requestedProvider,
                results: [],
                attemptedProviders: [requestedProvider],
                fallbackUsed: false,
                circuitOpen: true,
                circuitOpenUntil: circuit.openUntil,
                error: `Provider "${requestedProvider}" circuit is open after repeated failures; retry after cooldown.`,
                providerManagerVersion: PROVIDER_MANAGER_VERSION
            };
        }

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

        try {

            const result =
                await searchWithTimeout(selected, requestedProvider, {

                    query:
                        normalizedQuery,

                    maxSources:
                        normalizedMaxSources

                });


            if (result && result.success === true) {
                recordProviderSuccess(requestedProvider);
            } else {
                recordProviderFailure(requestedProvider);
            }

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
                    false,

                providerManagerVersion:
                    PROVIDER_MANAGER_VERSION

            };

        } catch (error) {

            recordProviderFailure(requestedProvider);
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

        const circuitPermit = acquireCircuitPermit(type);
        if (!circuitPermit.allowed) {
            lastError = `Provider "${type}" circuit is open or another recovery probe is active.`;
            continue;
        }

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
                await searchWithTimeout(providerInstance, type, {

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
                recordProviderSuccess(type);

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


            recordProviderFailure(type);
            lastError =
                result?.error ||
                `Provider "${type}" returned an unsuccessful result.`;

        } catch (error) {

            recordProviderFailure(type);
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


    // Built-in providers are managed by DEFAULT_CONFIG and must not be
    // replaced through the dynamic registration API. This prevents an
    // accidental or untrusted registration from hijacking core routing.
    if (
        Object.prototype.hasOwnProperty.call(
            DEFAULT_CONFIG,
            normalizedType
        )
    ) {
        return {
            success: false,
            provider: normalizedType,
            error: `Built-in provider "${normalizedType}" cannot be replaced through registerProvider().`
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

    const requestedTimeout = Number(config.searchTimeoutMs);
    const searchTimeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
        ? Math.max(1, Math.min(requestedTimeout, 120000))
        : DEFAULT_SEARCH_TIMEOUT_MS;
    const requestedThreshold = Number(config.failureThreshold);
    const failureThreshold = Number.isFinite(requestedThreshold) && requestedThreshold >= 1
        ? Math.min(Math.floor(requestedThreshold), 20)
        : DEFAULT_FAILURE_THRESHOLD;
    const requestedCooldown = Number(config.circuitCooldownMs);
    const circuitCooldownMs = Number.isFinite(requestedCooldown) && requestedCooldown > 0
        ? Math.min(Math.floor(requestedCooldown), MAX_CIRCUIT_COOLDOWN_MS)
        : DEFAULT_CIRCUIT_COOLDOWN_MS;


    providers[
        normalizedType
    ] =
        provider;


    providerConfig[
        normalizedType
    ] = {

        priority,

        enabled,

        providerType,

        searchTimeoutMs,

        failureThreshold,

        circuitCooldownMs

    };

    providerFailureState.delete(normalizedType);


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
    providerFailureState.delete(normalizedType);


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

    providerFailureState.clear();

    for (
        const type of
        Object.keys(
            providers
        )
    ) {

        if (
            type !== "research" &&
            type !== "voice" &&
            type !== "vision"
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

    providerConfig.voice = {

        ...DEFAULT_CONFIG.voice

    };

    providerConfig.vision = {

        ...DEFAULT_CONFIG.vision

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
