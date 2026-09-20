// ============================================================
// AARHEN CORE V5
// CALCULATOR ENGINE
// ============================================================


// ------------------------------------------------------------
// Basic arithmetic
// ------------------------------------------------------------

function calculate(a, operator, b) {

    const x = Number(a);
    const y = Number(b);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("Invalid numbers.");
    }


    switch (operator) {

        case "+":
            return x + y;

        case "-":
            return x - y;

        case "*":
            return x * y;

        case "/":

            if (y === 0) {
                throw new Error("Cannot divide by zero.");
            }

            return x / y;

        case "%":
            return x % y;

        default:
            throw new Error(
                "Unsupported operator."
            );
    }
}


// ------------------------------------------------------------
// Percentage
// ------------------------------------------------------------

function percentage(value, percent) {

    const number = Number(value);
    const rate = Number(percent);

    if (
        !Number.isFinite(number) ||
        !Number.isFinite(rate)
    ) {
        throw new Error("Invalid percentage values.");
    }

    return number * rate / 100;
}


// ------------------------------------------------------------
// Percentage increase
// ------------------------------------------------------------

function increaseByPercent(value, percent) {

    return Number(value) +
        percentage(value, percent);
}


// ------------------------------------------------------------
// Percentage decrease
// ------------------------------------------------------------

function decreaseByPercent(value, percent) {

    return Number(value) -
        percentage(value, percent);
}


// ------------------------------------------------------------
// Average
// ------------------------------------------------------------

function average(numbers) {

    if (!Array.isArray(numbers) || numbers.length === 0) {
        throw new Error("Numbers array is required.");
    }

    const values = numbers.map(Number);

    if (values.some(value => !Number.isFinite(value))) {
        throw new Error("Invalid number in array.");
    }

    const total =
        values.reduce(
            (sum, value) => sum + value,
            0
        );

    return total / values.length;
}


// ------------------------------------------------------------
// Round number
// ------------------------------------------------------------

function round(value, decimals = 2) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        throw new Error("Invalid number.");
    }

    const factor =
        Math.pow(10, Number(decimals));

    return Math.round(number * factor) / factor;
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    calculate,

    percentage,

    increaseByPercent,

    decreaseByPercent,

    average,

    round

};
