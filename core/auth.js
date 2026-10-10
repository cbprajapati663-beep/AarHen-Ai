// ============================================================
// AARHEN CORE V5
// AUTHENTICATION & API SECURITY
// ============================================================

const { timingSafeEqual } = require("node:crypto");

function getApiKey() {
    return process.env.AARHEN_API_KEY || "";
}

function isConfigured() {
    return Boolean(getApiKey());
}

function verifyApiKey(providedKey) {
    const configuredKey = getApiKey();

    // In development mode, success means the check ran, not that the
    // caller is authenticated. Callers must inspect authenticated.
    if (!configuredKey) {
        return {
            success: true,
            authenticated: false,
            mode: "development",
            message: "API authentication is not configured."
        };
    }

    let valid = false;
    if (typeof providedKey === "string" && providedKey.length > 0) {
        const provided = Buffer.from(providedKey, "utf8");
        const configured = Buffer.from(configuredKey, "utf8");

        // timingSafeEqual requires equal-length buffers.
        if (provided.length === configured.length) {
            valid = timingSafeEqual(provided, configured);
        }
    }

    return {
        success: valid,
        authenticated: valid,
        mode: "protected",
        message: valid ? "Authentication successful." : "Invalid API key."
    };
}

function authenticate(request) {
    const headers = request?.headers || {};
    const authorization = headers.authorization || "";
    const bearerKey = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";
    const headerKey = headers["x-aarhen-api-key"] || "";

    return verifyApiKey(bearerKey || headerKey);
}

module.exports = {
    getApiKey,
    isConfigured,
    verifyApiKey,
    authenticate
};
