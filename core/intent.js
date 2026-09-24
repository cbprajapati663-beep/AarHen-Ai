// ============================================================
// AARHEN CORE V5
// INTENT + PARAMETER ENGINE
// ============================================================
// Version: 5.8.2
//
// Purpose:
// - Detect user intent
// - Detect finance intent
// - Detect calculator intent
// - Detect coding intent
// - Detect research intent
// - Detect business intent
// - Detect document intent
// - Detect knowledge intent
// - Detect cybersecurity intent
// - Detect data-analysis intent
// - Extract common parameters
// ============================================================


// ------------------------------------------------------------
// Extract numbers from text
// ------------------------------------------------------------

function extractNumbers(text) {

    const matches =
        String(text || "")
            .match(/[\d,]+(?:\.\d+)?/g) || [];


    return matches.map(value =>
        Number(
            value.replace(/,/g, "")
        )
    );
}


// ------------------------------------------------------------
// Detect financial intent
// ------------------------------------------------------------

function detectFinanceIntent(text) {

    const value =
        String(text || "")
            .toLowerCase();


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
        String(text || "")
            .toLowerCase();


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
        String(text || "")
            .toLowerCase();


    if (
        value.includes("code") ||
        value.includes("coding") ||
        value.includes("javascript") ||
        value.includes("python") ||
        value.includes("html") ||
        value.includes("css") ||
        value.includes("program") ||
        value.includes("debug") ||
        value.includes("programming")
    ) {

        return "coding";
    }


    return null;
}


// ------------------------------------------------------------
// Detect cybersecurity intent
// ------------------------------------------------------------

function detectSecurityIntent(text) {

    const value =
        String(text || "")
            .toLowerCase();


    if (
        value.includes("cybersecurity") ||
        value.includes("cyber security") ||
        value.includes("network security") ||
        value.includes("security vulnerability") ||
        value.includes("vulnerability") ||
        value.includes("owasp") ||
        value.includes("secure coding") ||
        value.includes("penetration test") ||
        value.includes("security test") ||
        value.includes("security testing")
    ) {

        return "security_request";
    }


    return null;
}


// ------------------------------------------------------------
// Detect document intent
// ------------------------------------------------------------

function detectDocumentIntent(text) {

    const value =
        String(text || "")
            .toLowerCase();


    if (
        value.includes("pdf") ||
        value.includes("document") ||
        value.includes("docx") ||
        value.includes("file") ||
        value.includes("read document") ||
        value.includes("read my document") ||
        value.includes("uploaded document") ||
        value.includes("upload document") ||
        value.includes("uploaded file") ||
        value.includes("read file") ||
        value.includes("from my document")
    ) {

        return "document_search";
    }


    return null;
}


// ------------------------------------------------------------
// Detect knowledge intent
// ------------------------------------------------------------

function detectKnowledgeIntent(text) {

    const value =
        String(text || "")
            .toLowerCase();


    if (
        value.includes("what do you know") ||
        value.includes("what have you learned") ||
        value.includes("what did you learn") ||
        value.includes("search knowledge") ||
        value.includes("saved knowledge") ||
        value.includes("remembered information") ||
        value.includes("aarhen knowledge") ||
        value.includes("knowledge base") ||
        value.includes("knowledge")
    ) {

        return "knowledge_search";
    }


    return null;
}


// ------------------------------------------------------------
// Detect research intent
// ------------------------------------------------------------

function detectResearchIntent(text) {

    const value =
        String(text || "")
            .toLowerCase();


    if (
        value.includes("latest") ||
        value.includes("current") ||
        value.includes("recent") ||
        value.includes("search") ||
        value.includes("research") ||
        value.includes("internet") ||
        value.includes("online") ||
        value.includes("news") ||
        value.includes("look up") ||
        value.includes("lookup") ||
        value.includes("web search") ||
        value.includes("search the web")
    ) {

        return "web_research";
    }


    return null;
}


// ------------------------------------------------------------
// Detect data-analysis intent
// ------------------------------------------------------------

function detectDataIntent(text) {

    const value =
        String(text || "")
            .toLowerCase();


    if (
        value.includes("data analysis") ||
        value.includes("analyze data") ||
        value.includes("analyse data") ||
        value.includes("dataset") ||
        value.includes("csv") ||
        value.includes("excel") ||
        value.includes("statistics") ||
        value.includes("data report") ||
        value.includes("analyze this data") ||
        value.includes("analyse this data")
    ) {

        return "data_analysis";
    }


    return null;
}


// ------------------------------------------------------------
// Detect business intent
// ------------------------------------------------------------

function detectBusinessIntent(text) {

    const value =
        String(text || "")
            .toLowerCase();


    if (
        value.includes("heritage") ||
        value.includes("heritage auto finance") ||
        value.includes("auto finance") ||
        value.includes("customer") ||
        value.includes("lead") ||
        value.includes("used car finance") ||
        value.includes("used car") ||
        value.includes("new car finance") ||
        value.includes("vehicle insurance") ||
        value.includes("commercial vehicle") ||
        value.includes("commercial vehicle finance") ||
        value.includes("vehicle finance business")
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

    if (
        financeIntent
    ) {

        return {

            category:
                "finance",

            intent:
                financeIntent
        };
    }


    const calculatorIntent =
        detectCalculatorIntent(text);

    if (
        calculatorIntent
    ) {

        return {

            category:
                "calculation",

            intent:
                calculatorIntent
        };
    }


    const codingIntent =
        detectCodingIntent(text);

    if (
        codingIntent
    ) {

        return {

            category:
                "coding",

            intent:
                codingIntent
        };
    }


    const securityIntent =
        detectSecurityIntent(text);

    if (
        securityIntent
    ) {

        return {

            category:
                "security",

            intent:
                securityIntent
        };
    }


    const documentIntent =
        detectDocumentIntent(text);

    if (
        documentIntent
    ) {

        return {

            category:
                "documents",

            intent:
                documentIntent
        };
    }


    const knowledgeIntent =
        detectKnowledgeIntent(text);

    if (
        knowledgeIntent
    ) {

        return {

            category:
                "knowledge",

            intent:
                knowledgeIntent
        };
    }


    const researchIntent =
        detectResearchIntent(text);

    if (
        researchIntent
    ) {

        return {

            category:
                "research",

            intent:
                researchIntent
        };
    }


    const dataIntent =
        detectDataIntent(text);

    if (
        dataIntent
    ) {

        return {

            category:
                "data",

            intent:
                dataIntent
        };
    }


    const businessIntent =
        detectBusinessIntent(text);

    if (
        businessIntent
    ) {

        return {

            category:
                "business",

            intent:
                businessIntent
        };
    }


    return {

        category:
            "general",

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
        extractNumbers(
            value
        );


    let rate = null;
    let years = null;
    let amount = null;


    // --------------------------------------------------------
    // Interest rate
    // --------------------------------------------------------

    const rateMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:%|percent|percentage)/
        );


    if (
        rateMatch
    ) {

        rate =
            Number(
                rateMatch[1]
            );
    }


    // --------------------------------------------------------
    // Tenure in years
    // --------------------------------------------------------

    const yearMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:year|years|yr|yrs)/
        );


    if (
        yearMatch
    ) {

        years =
            Number(
                yearMatch[1]
            );
    }


    // --------------------------------------------------------
    // Loan amount in lakh
    // --------------------------------------------------------

    const lakhMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)/
        );


    if (
        lakhMatch
    ) {

        amount =
            Number(
                lakhMatch[1]
            ) *
            100000;
    }


    // --------------------------------------------------------
    // Loan amount in crore
    // --------------------------------------------------------

    const croreMatch =
        value.match(
            /(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)/
        );


    if (
        croreMatch
    ) {

        amount =
            Number(
                croreMatch[1]
            ) *
            10000000;
    }


    // --------------------------------------------------------
    // If no lakh/crore found,
    // use first number as amount
    // --------------------------------------------------------

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
        detectIntent(
            text
        );


    let parameters = {};


    if (
        detected.category ===
        "finance"
    ) {

        parameters =
            extractFinanceParameters(
                text
            );
    }


    return {

        success:
            true,

        request:
            String(
                text || ""
            ),

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

    detectSecurityIntent,

    detectDocumentIntent,

    detectKnowledgeIntent,

    detectResearchIntent,

    detectDataIntent,

    detectBusinessIntent,

    detectIntent,

    extractFinanceParameters,

    analyzeIntent

};
