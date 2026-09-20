// ============================================================
// AARHEN CORE V5
// INTENT + PARAMETER ENGINE
// ============================================================


// ------------------------------------------------------------
// Extract numbers from text
// ------------------------------------------------------------

function extractNumbers(text) {

    const matches =
        String(text || "")
            .match(/[\d,]+(?:\.\d+)?/g) || [];


    return matches.map(value =>
        Number(value.replace(/,/g, ""))
    );
}


// ------------------------------------------------------------
// Detect financial intent
// ------------------------------------------------------------

function detectFinanceIntent(text) {

    const value =
        String(text || "").toLowerCase();


    if (
        value.includes("emi") ||
        value.includes("monthly installment")
    ) {
        return "calculate_emi";
    }


    if (
        value.includes("refinance") ||
        value.includes("balance transfer")
    ) {
        return "compare_refinance";
    }


    if (
        value.includes("loan amount") &&
        value.includes("emi")
    ) {
        return "calculate_loan_from_emi";
    }


    if (
        value.includes("simple interest")
    ) {
        return "simple_interest";
    }


    return null;
}


// ------------------------------------------------------------
// Detect calculator intent
// ------------------------------------------------------------

function detectCalculatorIntent(text) {

    const value =
        String(text || "").toLowerCase();


    if (
        value.includes("percentage") ||
        value.includes("%")
    ) {
        return "percentage";
    }


    if (
        value.includes("average")
    ) {
        return "average";
    }


    if (
        value.includes("calculate") ||
        value.includes("+") ||
        value.includes("-") ||
        value.includes("*") ||
        value.includes("/")
    ) {
        return "calculate";
    }


    return null;
}


// ------------------------------------------------------------
// Detect coding intent
// ------------------------------------------------------------

function detectCodingIntent(text) {

    const value =
        String(text || "").toLowerCase();


    if (
        value.includes("code") ||
        value.includes("coding") ||
        value.includes("javascript") ||
        value.includes("python") ||
        value.includes("html") ||
        value.includes("debug")
    ) {
        return "coding";
    }


    return null;
}


// ------------------------------------------------------------
// Detect research intent
// ------------------------------------------------------------

function detectResearchIntent(text) {

    const value =
        String(text || "").toLowerCase();


    if (
        value.includes("latest") ||
        value.includes("search") ||
        value.includes("research") ||
        value.includes("internet") ||
        value.includes("online") ||
        value.includes("news")
    ) {
        return "web_research";
    }


    return null;
}


// ------------------------------------------------------------
// Detect business intent
// ------------------------------------------------------------

function detectBusinessIntent(text) {

    const value =
        String(text || "").toLowerCase();


    if (
        value.includes("heritage") ||
        value.includes("customer") ||
        value.includes("lead") ||
        value.includes("used car finance") ||
        value.includes("new car finance") ||
        value.includes("vehicle insurance") ||
        value.includes("commercial vehicle")
    ) {
        return "business_request";
    }


    return null;
}


// ------------------------------------------------------------
// Detect overall intent
// ------------------------------------------------------------

function detectIntent(text) {

    const financeIntent =
        detectFinanceIntent(text);

    if (financeIntent) {
        return {
            category: "finance",
            intent: financeIntent
        };
    }


    const calculatorIntent =
        detectCalculatorIntent(text);

    if (calculatorIntent) {
        return {
            category: "calculation",
            intent: calculatorIntent
        };
    }


    const codingIntent =
        detectCodingIntent(text);

    if (codingIntent) {
        return {
            category: "coding",
            intent: codingIntent
        };
    }


    const researchIntent =
        detectResearchIntent(text);

    if (researchIntent) {
        return {
            category: "research",
            intent: researchIntent
        };
    }


    const businessIntent =
        detectBusinessIntent(text);

    if (businessIntent) {
        return {
            category: "business",
            intent: businessIntent
        };
    }


    return {

        category: "general",

        intent:
            "general_request"

    };

}


// ------------------------------------------------------------
// Extract common financial parameters
// ------------------------------------------------------------

function extractFinanceParameters(text) {

    const value =
        String(text || "")
            .toLowerCase();


    const numbers =
        extractNumbers(value);


    let rate = null;
    let years = null;
    let amount = null;


    // Interest rate

    const rateMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:%|percent|percentage)/
        );


    if (rateMatch) {

        rate =
            Number(rateMatch[1]);

    }


    // Tenure in years

    const yearMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:year|years|yr|yrs)/
        );


    if (yearMatch) {

        years =
            Number(yearMatch[1]);

    }


    // Loan amount

    const lakhMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)/
        );


    if (lakhMatch) {

        amount =
            Number(lakhMatch[1]) * 100000;

    }


    const croreMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)/
        );


    if (croreMatch) {

        amount =
            Number(croreMatch[1]) * 10000000;

    }


    // If no lakh/crore found,
    // use the first number as amount
    if (
        amount === null &&
        numbers.length > 0
    ) {

        amount =
            numbers[0];

    }


    return {

        amount,

        rate,

        years,

        numbers

    };

}


// ------------------------------------------------------------
// Build complete intent object
// ------------------------------------------------------------

function analyzeIntent(text) {

    const detected =
        detectIntent(text);


    let parameters = {};


    if (
        detected.category === "finance"
    ) {

        parameters =
            extractFinanceParameters(text);

    }


    return {

        success: true,

        request:
            String(text || ""),

        category:
            detected.category,

        intent:
            detected.intent,

        parameters

    };

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    extractNumbers,

    detectFinanceIntent,

    detectCalculatorIntent,

    detectCodingIntent,

    detectResearchIntent,

    detectBusinessIntent,

    detectIntent,

    extractFinanceParameters,

    analyzeIntent

};
