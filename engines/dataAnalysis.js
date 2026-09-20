// ============================================================
// AARHEN CORE V5
// DATA ANALYSIS BRAIN
// ============================================================


// ------------------------------------------------------------
// Basic dataset information
// ------------------------------------------------------------

function inspectData(data) {

    if (!Array.isArray(data)) {
        return {
            success: false,
            error: "Data must be an array."
        };
    }

    if (data.length === 0) {
        return {
            success: true,
            rows: 0,
            columns: []
        };
    }


    const columns = [
        ...new Set(
            data.flatMap(row =>
                row && typeof row === "object"
                    ? Object.keys(row)
                    : []
            )
        )
    ];


    return {

        success: true,

        rows: data.length,

        columns,

        columnCount:
            columns.length

    };
}


// ------------------------------------------------------------
// Numeric statistics
// ------------------------------------------------------------

function statistics(values) {

    const numbers = values
        .map(Number)
        .filter(Number.isFinite);


    if (numbers.length === 0) {
        return {
            success: false,
            error: "No numeric values found."
        };
    }


    const sorted = [...numbers].sort(
        (a, b) => a - b
    );


    const total =
        numbers.reduce(
            (sum, value) => sum + value,
            0
        );


    const average =
        total / numbers.length;


    const middle =
        Math.floor(sorted.length / 2);


    const median =
        sorted.length % 2 === 0
            ? (sorted[middle - 1] + sorted[middle]) / 2
            : sorted[middle];


    return {

        success: true,

        count:
            numbers.length,

        total:
            Number(total.toFixed(2)),

        average:
            Number(average.toFixed(2)),

        median:
            Number(median.toFixed(2)),

        minimum:
            sorted[0],

        maximum:
            sorted[sorted.length - 1]

    };
}


// ------------------------------------------------------------
// Group data by a field
// ------------------------------------------------------------

function groupBy(data, field) {

    if (!Array.isArray(data)) {
        throw new Error("Data must be an array.");
    }


    const groups = {};


    for (const row of data) {

        const key =
            String(row?.[field] ?? "Unknown");


        if (!groups[key]) {
            groups[key] = [];
        }


        groups[key].push(row);
    }


    return groups;
}


// ------------------------------------------------------------
// Count values
// ------------------------------------------------------------

function countBy(data, field) {

    const groups =
        groupBy(data, field);


    const result = {};


    for (const key of Object.keys(groups)) {

        result[key] =
            groups[key].length;
    }


    return result;
}


// ------------------------------------------------------------
// Filter data
// ------------------------------------------------------------

function filterData(data, field, value) {

    if (!Array.isArray(data)) {
        throw new Error("Data must be an array.");
    }


    return data.filter(row =>
        String(row?.[field] ?? "")
            .toLowerCase() ===
        String(value ?? "")
            .toLowerCase()
    );
}


// ------------------------------------------------------------
// Find top records by numeric field
// ------------------------------------------------------------

function topBy(data, field, limit = 5) {

    if (!Array.isArray(data)) {
        throw new Error("Data must be an array.");
    }


    return [...data]
        .sort(
            (a, b) =>
                Number(b?.[field] || 0) -
                Number(a?.[field] || 0)
        )
        .slice(0, Number(limit));
}


// ------------------------------------------------------------
// Create analysis summary
// ------------------------------------------------------------

function createSummary(data) {

    const inspection =
        inspectData(data);


    if (!inspection.success) {
        return inspection;
    }


    return {

        success: true,

        summary: {
            totalRows:
                inspection.rows,

            totalColumns:
                inspection.columnCount,

            columns:
                inspection.columns
        },

        message:
            "Dataset inspected successfully."

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    inspectData,

    statistics,

    groupBy,

    countBy,

    filterData,

    topBy,

    createSummary

};
