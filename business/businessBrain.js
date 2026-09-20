// ============================================================
// AARHEN CORE V5
// BUSINESS BRAIN
// ============================================================

const heritage = require("./heritageAutoFinance");


// ------------------------------------------------------------
// Analyze a business request
// ------------------------------------------------------------

function analyzeRequest(input) {

    const text = String(input || "").trim();

    if (!text) {
        return {
            success: false,
            error: "Business request is empty."
        };
    }


    const customerType =
        heritage.identifyCustomerType(text);


    const serviceMatches =
        heritage.findService(text);


    return {

        success: true,

        request: text,

        business: heritage.BUSINESS.name,

        customerType,

        matchedServices: serviceMatches,

        intent: detectIntent(text),

        suggestedAction:
            suggestAction(customerType, serviceMatches)

    };
}


// ------------------------------------------------------------
// Detect business intent
// ------------------------------------------------------------

function detectIntent(text) {

    const value =
        String(text).toLowerCase();


    if (
        value.includes("loan") ||
        value.includes("finance") ||
        value.includes("funding")
    ) {
        return "vehicle_finance";
    }


    if (
        value.includes("insurance") ||
        value.includes("policy")
    ) {
        return "vehicle_insurance";
    }


    if (
        value.includes("refinance") ||
        value.includes("balance transfer") ||
        value.includes("existing loan")
    ) {
        return "loan_refinance";
    }


    if (
        value.includes("customer") ||
        value.includes("client") ||
        value.includes("lead")
    ) {
        return "customer_management";
    }


    if (
        value.includes("follow up") ||
        value.includes("followup") ||
        value.includes("call")
    ) {
        return "follow_up";
    }


    return "general_business";
}


// ------------------------------------------------------------
// Suggest next action
// ------------------------------------------------------------

function suggestAction(
    customerType,
    services
) {

    if (
        customerType === "General Enquiry" &&
        services.length === 0
    ) {
        return "Collect customer requirement.";
    }


    if (
        customerType === "Used Car Customer"
    ) {
        return "Collect used vehicle and loan details.";
    }


    if (
        customerType === "New Car Customer"
    ) {
        return "Collect new vehicle and loan requirement.";
    }


    if (
        customerType === "Commercial Vehicle Customer"
    ) {
        return "Collect commercial vehicle and business details.";
    }


    if (
        customerType === "Existing Vehicle Loan Customer"
    ) {
        return "Collect existing loan and refinance details.";
    }


    if (
        customerType === "Vehicle Insurance Customer"
    ) {
        return "Collect vehicle and insurance policy details.";
    }


    return "Collect customer requirement.";
}


// ------------------------------------------------------------
// Create structured lead
// ------------------------------------------------------------

function createLead(data = {}) {

    const enquiry =
        heritage.createEnquiry(data);


    return {

        success: true,

        lead: enquiry,

        source:
            "AarHen Business Brain",

        status:
            "new"

    };
}


// ------------------------------------------------------------
// Get business workflow
// ------------------------------------------------------------

function getWorkflow() {

    return heritage.BUSINESS.workflow;
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    analyzeRequest,

    detectIntent,

    suggestAction,

    createLead,

    getWorkflow

};
