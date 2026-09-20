// ============================================================
// AARHEN CORE V5
// AUTHENTICATION & API SECURITY
// ============================================================


// ------------------------------------------------------------
// Get API key from environment
// ------------------------------------------------------------

function getApiKey() {

    return process.env.AARHEN_API_KEY || "";

}


// ------------------------------------------------------------
// Check whether authentication is configured
// ------------------------------------------------------------

function isConfigured() {

    return Boolean(
        getApiKey()
    );

}


// ------------------------------------------------------------
// Verify API key
// ------------------------------------------------------------

function verifyApiKey(providedKey) {

    const configuredKey =
        getApiKey();


    // Development mode:
    // authentication is not configured yet.

    if (!configuredKey) {

        return {

            success: true,

            authenticated: false,

            mode: "development",

            message:
                "API authentication is not configured."

        };

    }


    const valid =
        typeof providedKey === "string" &&
        providedKey === configuredKey;


    return {

        success: valid,

        authenticated: valid,

        mode: "protected",

        message:
            valid
                ? "Authentication successful."
                : "Invalid API key."

    };

}


// ------------------------------------------------------------
// Create authentication result
// ------------------------------------------------------------

function authenticate(request) {

    const headerKey =
        request?.headers?.["x-aarhen-api-key"] || "";


    return verifyApiKey(
        headerKey
    );

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    getApiKey,

    isConfigured,

    verifyApiKey,

    authenticate

};
