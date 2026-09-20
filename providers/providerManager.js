// ============================================================
// AARHEN CORE V5
// PROVIDER MANAGER
// ============================================================

const researchProvider =
    require("./researchProvider");

const providers = {
    research: researchProvider
};

function getProvider(type) {
    return providers[type] || null;
}

function isProviderAvailable(type) {
    const provider = getProvider(type);

    if (!provider ||
        typeof provider.getProviderStatus !== "function") {
        return false;
    }

    const status =
        provider.getProviderStatus();

    return Boolean(status.connected);
}

async function searchWeb({
    query,
    maxSources = 5
} = {}) {

    const provider =
        getProvider("research");

    if (!provider) {
        return {
            success: false,
            error: "Research provider not found."
        };
    }

    if (!isProviderAvailable("research")) {
        return {
            success: false,
            providerConnected: false,
            providerRequired: true,
            results: [],
            error:
                "No connected web research provider is available."
        };
    }

    return provider.search({
        query,
        maxSources
    });
}

function getStatus() {

    const result = {};

    for (const [name, provider] of
        Object.entries(providers)) {

        if (
            provider &&
            typeof provider.getProviderStatus ===
                "function"
        ) {
            result[name] =
                provider.getProviderStatus();
        } else {
            result[name] = {
                connected: false,
                status: "invalid-provider"
            };
        }
    }

    return {
        success: true,
        providers: result
    };
}

function registerProvider(
    type,
    provider
) {

    if (!type || !provider) {
        return {
            success: false,
            error:
                "Provider type and provider are required."
        };
    }

    if (
        typeof provider.search !== "function" ||
        typeof provider.getProviderStatus !==
            "function"
    ) {
        return {
            success: false,
            error:
                "Provider must implement search() and getProviderStatus()."
        };
    }

    providers[type] = provider;

    return {
        success: true,
        provider: type,
        status: "registered"
    };
}

module.exports = {
    getProvider,
    isProviderAvailable,
    searchWeb,
    getStatus,
    registerProvider
};
