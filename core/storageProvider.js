// ============================================================
// AARHEN CORE V5
// DATABASE-READY STORAGE PROVIDER
// ============================================================

const storage =
    require("./storage");

// ============================================================
// PROVIDER CONFIGURATION
// ============================================================

const PROVIDER_NAME =
    process.env.AARHEN_STORAGE_PROVIDER ||
    "local-json";

const PROVIDER_VERSION =
    "1.0.0";

// ============================================================
// PROVIDER INFORMATION
// ============================================================

function getProviderInfo() {

    return {

        name:
            PROVIDER_NAME,

        version:
            PROVIDER_VERSION,

        type:
            "storage-provider",

        mode:
            PROVIDER_NAME ===
            "local-json"
                ? "local"
                : "external-ready",

        persistent:
            true,

        databaseReady:
            true,

        capabilities: [

            "read",

            "write",

            "add",

            "update",

            "find",

            "findById",

            "remove",

            "count",

            "health-check",

            "provider-switching"
        ],

        status:
            "active"
    };
}

// ============================================================
// READ
// ============================================================

function read() {

    return storage.read();
}

// ============================================================
// WRITE
// ============================================================

function write(
    data
) {

    return storage.write(
        data
    );
}

// ============================================================
// ADD
// ============================================================

function add(
    item
) {

    return storage.add(
        item
    );
}

// ============================================================
// UPDATE
// ============================================================

function update(
    id,
    changes = {}
) {

    return storage.update(
        id,
        changes
    );
}

// ============================================================
// FIND BY ID
// ============================================================

function findById(
    id
) {

    return storage.findById(
        id
    );
}

// ============================================================
// FIND
// ============================================================

function find(
    predicate
) {

    return storage.find(
        predicate
    );
}

// ============================================================
// REMOVE
// ============================================================

function remove(
    id
) {

    return storage.remove(
        id
    );
}

// ============================================================
// GET ALL
// ============================================================

function getAll() {

    return storage.getAll();
}

// ============================================================
// COUNT
// ============================================================

function count() {

    return storage.count();
}

// ============================================================
// GET INFO
// ============================================================

function getInfo() {

    return storage.getInfo();
}

// ============================================================
// HEALTH CHECK
// ============================================================

function healthCheck() {

    try {

        const result =
            storage.healthCheck();

        return {

            success:
                Boolean(
                    result.success
                ),

            healthy:
                Boolean(
                    result.healthy
                ),

            provider:
                getProviderInfo(),

            storage:
                result,

            status:
                result.healthy
                    ? "provider-online"
                    : "provider-error"
        };

    } catch (error) {

        return {

            success: false,

            healthy: false,

            provider:
                getProviderInfo(),

            error:
                error.message,

            status:
                "provider-error"
        };
    }
}

// ============================================================
// PROVIDER TEST
// ============================================================

function testProvider() {

    const testId =
        "provider_test_" +
        Date.now();

    const testMemory = {

        id:
            testId,

        type:
            "provider-test",

        title:
            "Storage Provider Test",

        category:
            "system-test",

        content:
            "AarHen storage provider test.",

        source:
            "storage-provider-test",

        verified:
            false,

        confidence:
            0.5,

        createdAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()
    };

    try {

        // ------------------------------------------
        // ADD
        // ------------------------------------------

        add(
            testMemory
        );

        // ------------------------------------------
        // FIND
        // ------------------------------------------

        const found =
            findById(
                testId
            );

        if (!found) {

            return {

                success: false,

                error:
                    "Provider test failed during find."
            };
        }

        // ------------------------------------------
        // UPDATE
        // ------------------------------------------

        const updated =
            update(
                testId,
                {
                    title:
                        "Storage Provider Test Updated"
                }
            );

        if (!updated) {

            return {

                success: false,

                error:
                    "Provider test failed during update."
            };
        }

        // ------------------------------------------
        // REMOVE
        // ------------------------------------------

        const removed =
            remove(
                testId
            );

        if (!removed) {

            return {

                success: false,

                error:
                    "Provider test failed during remove."
            };
        }

        // ------------------------------------------
        // HEALTH
        // ------------------------------------------

        const health =
            healthCheck();

        if (!health.healthy) {

            return {

                success: false,

                error:
                    "Provider health check failed."
            };
        }

        // ------------------------------------------
        // SUCCESS
        // ------------------------------------------

        return {

            success: true,

            provider:
                getProviderInfo(),

            operations: {

                add:
                    true,

                find:
                    true,

                update:
                    true,

                remove:
                    true,

                health:
                    true
            },

            status:
                "provider-test-passed"
        };

    } catch (error) {

        // ------------------------------------------
        // CLEANUP
        // ------------------------------------------

        try {

            remove(
                testId
            );

        } catch (
            cleanupError
        ) {

            // Ignore cleanup failure.
        }

        return {

            success: false,

            error:
                error.message,

            status:
                "provider-test-failed"
        };
    }
}

// ============================================================
// STORAGE MODE
// ============================================================

function getStorageMode() {

    return {

        success: true,

        provider:
            PROVIDER_NAME,

        mode:
            PROVIDER_NAME ===
            "local-json"
                ? "local-json"
                : "external",

        databaseReady:
            true,

        migrationReady:
            true,

        status:
            "ready"
    };
}

// ============================================================
// PROVIDER SWITCH CHECK
// ============================================================

function supportsProvider(
    providerName
) {

    const supportedProviders = [

        "local-json",

        "database",

        "cloud"
    ];

    return {

        success:
            supportedProviders.includes(
                String(
                    providerName || ""
                ).toLowerCase()
            ),

        provider:
            providerName,

        supported:
            supportedProviders.includes(
                String(
                    providerName || ""
                ).toLowerCase()
            ),

        availableProviders:
            supportedProviders
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    getProviderInfo,

    read,

    write,

    add,

    update,

    findById,

    find,

    remove,

    getAll,

    count,

    getInfo,

    healthCheck,

    testProvider,

    getStorageMode,

    supportsProvider
};
