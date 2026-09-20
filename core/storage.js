// ============================================================
// AARHEN CORE V5
// PERSISTENT STORAGE ABSTRACTION
// ============================================================

const fs =
    require("fs");

const path =
    require("path");

// ============================================================
// STORAGE CONFIGURATION
// ============================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const STORAGE_FILE =
    path.join(
        DATA_DIR,
        "memory.json"
    );

// ============================================================
// ENSURE STORAGE
// ============================================================

function ensureStorage() {

    if (
        !fs.existsSync(
            DATA_DIR
        )
    ) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }

    if (
        !fs.existsSync(
            STORAGE_FILE
        )
    ) {
        fs.writeFileSync(
            STORAGE_FILE,
            "[]",
            "utf8"
        );
    }
}

// ============================================================
// READ STORAGE
// ============================================================

function read() {

    ensureStorage();

    try {

        const content =
            fs.readFileSync(
                STORAGE_FILE,
                "utf8"
            );

        if (!content.trim()) {
            return [];
        }

        const data =
            JSON.parse(
                content
            );

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        throw new Error(
            `Storage read failed: ${error.message}`
        );
    }
}

// ============================================================
// WRITE STORAGE
// ============================================================

function write(
    data
) {

    ensureStorage();

    if (
        !Array.isArray(data)
    ) {
        throw new Error(
            "Storage data must be an array."
        );
    }

    const temporaryFile =
        `${STORAGE_FILE}.tmp`;

    try {

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(
                data,
                null,
                2
            ),
            "utf8"
        );

        fs.renameSync(
            temporaryFile,
            STORAGE_FILE
        );

        return true;

    } catch (error) {

        if (
            fs.existsSync(
                temporaryFile
            )
        ) {
            fs.unlinkSync(
                temporaryFile
            );
        }

        throw new Error(
            `Storage write failed: ${error.message}`
        );
    }
}

// ============================================================
// ADD RECORD
// ============================================================

function add(
    record
) {

    const data =
        read();

    data.push(
        record
    );

    write(
        data
    );

    return record;
}

// ============================================================
// UPDATE RECORD
// ============================================================

function update(
    id,
    changes = {}
) {

    const data =
        read();

    const index =
        data.findIndex(
            item =>
                item &&
                item.id === id
        );

    if (index === -1) {
        return null;
    }

    data[index] = {

        ...data[index],

        ...changes,

        updatedAt:
            new Date().toISOString()
    };

    write(
        data
    );

    return data[index];
}

// ============================================================
// FIND RECORD
// ============================================================

function findById(
    id
) {

    const data =
        read();

    return (
        data.find(
            item =>
                item &&
                item.id === id
        ) ||
        null
    );
}

// ============================================================
// FIND RECORDS
// ============================================================

function find(
    predicate
) {

    const data =
        read();

    if (
        typeof predicate !==
        "function"
    ) {
        return data;
    }

    return data.filter(
        predicate
    );
}

// ============================================================
// REMOVE RECORD
// ============================================================

function remove(
    id
) {

    const data =
        read();

    const filtered =
        data.filter(
            item =>
                !(
                    item &&
                    item.id === id
                )
        );

    if (
        filtered.length ===
        data.length
    ) {
        return false;
    }

    write(
        filtered
    );

    return true;
}

// ============================================================
// GET ALL
// ============================================================

function getAll() {

    return read();
}

// ============================================================
// COUNT
// ============================================================

function count() {

    return read().length;
}

// ============================================================
// CLEAR
// ============================================================

function clear() {

    write([]);

    return true;
}

// ============================================================
// STORAGE INFORMATION
// ============================================================

function getInfo() {

    ensureStorage();

    let size = 0;

    try {

        size =
            fs.statSync(
                STORAGE_FILE
            ).size;

    } catch (error) {

        size = 0;
    }

    return {

        success: true,

        provider:
            "local-json",

        file:
            STORAGE_FILE,

        exists:
            fs.existsSync(
                STORAGE_FILE
            ),

        recordCount:
            count(),

        sizeBytes:
            size,

        writable:
            true,

        status:
            "active"
    };
}

// ============================================================
// HEALTH CHECK
// ============================================================

function healthCheck() {

    try {

        ensureStorage();

        const data =
            read();

        return {

            success: true,

            healthy: true,

            provider:
                "local-json",

            recordCount:
                data.length,

            status:
                "storage-online"
        };

    } catch (error) {

        return {

            success: false,

            healthy: false,

            provider:
                "local-json",

            error:
                error.message,

            status:
                "storage-error"
        };
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    read,

    write,

    add,

    update,

    findById,

    find,

    remove,

    getAll,

    count,

    clear,

    getInfo,

    healthCheck,

    ensureStorage

};
