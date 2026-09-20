// ============================================================
// AARHEN CORE V5
// STORAGE PROVIDER LAYER
// ============================================================

const storage =
    require("./storage");

// ============================================================
// PROVIDER INFORMATION
// ============================================================

function getProviderInfo() {

    return {

        name:
            "Local JSON Storage Provider",

        type:
            "local-json",

        version:
            "1.0.0",

        persistent:
            true,

        supports:

            [
                "read",
                "write",
                "add",
                "update",
                "find",
                "findById",
                "remove",
                "count"
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
    record
) {

    return storage.add(
        record
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
// STORAGE INFORMATION
// ============================================================

function getInfo() {

    return storage.getInfo();
}

// ============================================================
// HEALTH CHECK
// ============================================================

function healthCheck() {

    return storage.healthCheck();
}

// ============================================================
// PROVIDER TEST
// ============================================================

function testProvider() {

    try {

        const before =
            count();

        const testId =
            `provider_test_${Date.now()}`;

        add({

            id:
                testId,

            type:
                "system-test",

            title:
                "Storage Provider Test",

            content:
                "AarHen storage provider test record.",

            createdAt:
                new Date().toISOString()
        });

        const found =
            findById(
                testId
            );

        if (!found) {

            return {

                success: false,

                error:
                    "Provider could not read newly stored record."
            };
        }

        const updated =
            update(
                testId,
                {
                    testStatus:
                        "updated"
                }
            );

        if (!updated) {

            return {

                success: false,

                error:
                    "Provider update test failed."
            };
        }

        const removed =
            remove(
                testId
            );

        if (!removed) {

            return {

                success: false,

                error:
                    "Provider remove test failed."
            };
        }

        const after =
            count();

        return {

            success: true,

            provider:
                getProviderInfo(),

            recordsBefore:
                before,

            recordsAfter:
                after,

            operationsTested:
                [
                    "add",
                    "findById",
                    "update",
                    "remove"
                ],

            status:
                "provider-test-passed"
        };

    } catch (error) {

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

    testProvider

};
