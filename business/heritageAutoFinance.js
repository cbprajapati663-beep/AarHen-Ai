// ============================================================
// AARHEN CORE V5
// HERITAGE AUTO FINANCE BRAIN
// ============================================================

const BUSINESS = {

    name: "Heritage Auto Finance",

    industry: "Vehicle Finance & Insurance Assistance",

    services: [
        "New Car Finance",
        "Used Car Finance",
        "Commercial Vehicle Finance",
        "Vehicle Loan Refinance",
        "Vehicle Insurance Assistance"
    ],

    customerTypes: [
        "New Car Customer",
        "Used Car Customer",
        "Commercial Vehicle Customer",
        "Existing Vehicle Loan Customer",
        "Vehicle Insurance Customer"
    ],

    workflow: [
        "Customer Enquiry",
        "Customer Details",
        "Vehicle Details",
        "Loan Requirement",
        "Document Collection",
        "Application Processing",
        "Lender Review",
        "Approval",
        "Disbursement",
        "Insurance Assistance",
        "Follow-up"
    ],

    communicationChannels: [
        "WhatsApp",
        "Phone",
        "Facebook",
        "Instagram",
        "Website"
    ]
};


// ------------------------------------------------------------
// Get complete business information
// ------------------------------------------------------------

function getBusinessInfo() {

    return BUSINESS;
}


// ------------------------------------------------------------
// Get services
// ------------------------------------------------------------

function getServices() {

    return BUSINESS.services;
}


// ------------------------------------------------------------
// Find matching service
// ------------------------------------------------------------

function findService(query) {

    const text = String(query || "").toLowerCase();

    const matches = BUSINESS.services.filter(service =>
        service.toLowerCase().includes(text) ||
        text.includes(service.toLowerCase())
    );

    return matches;
}


// ------------------------------------------------------------
// Identify customer type
// ------------------------------------------------------------

function identifyCustomerType(query) {

    const text = String(query || "").toLowerCase();

    if (
        text.includes("used car") ||
        text.includes("second hand") ||
        text.includes("old car")
    ) {
        return "Used Car Customer";
    }

    if (
        text.includes("new car") ||
        text.includes("new vehicle")
    ) {
        return "New Car Customer";
    }

    if (
        text.includes("commercial") ||
        text.includes("truck") ||
        text.includes("tempo") ||
        text.includes("pickup") ||
        text.includes("bus")
    ) {
        return "Commercial Vehicle Customer";
    }

    if (
        text.includes("refinance") ||
        text.includes("balance transfer") ||
        text.includes("existing loan")
    ) {
        return "Existing Vehicle Loan Customer";
    }

    if (
        text.includes("insurance") ||
        text.includes("policy")
    ) {
        return "Vehicle Insurance Customer";
    }

    return "General Enquiry";
}


// ------------------------------------------------------------
// Create basic enquiry structure
// ------------------------------------------------------------

function createEnquiry(data = {}) {

    return {

        enquiryId:
            `HAF-${Date.now()}`,

        createdAt:
            new Date().toISOString(),

        customerName:
            data.customerName || "",

        mobile:
            data.mobile || "",

        customerType:
            data.customerType || "General Enquiry",

        vehicleModel:
            data.vehicleModel || "",

        vehicleType:
            data.vehicleType || "",

        loanAmount:
            Number(data.loanAmount || 0),

        service:
            data.service || "",

        status:
            "new",

        notes:
            data.notes || ""

    };
}


// ------------------------------------------------------------
// Suggest next workflow step
// ------------------------------------------------------------

function getNextWorkflowStep(status) {

    const steps = BUSINESS.workflow;

    const currentIndex =
        steps.findIndex(
            step =>
                step.toLowerCase() ===
                String(status || "").toLowerCase()
        );

    if (currentIndex === -1) {

        return steps[0];
    }

    return steps[currentIndex + 1] || "Completed";
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    BUSINESS,

    getBusinessInfo,

    getServices,

    findService,

    identifyCustomerType,

    createEnquiry,

    getNextWorkflowStep

};
