// ============================================================
// AARHEN CORE V5
// RESPONSE ENGINE
// ============================================================


// ------------------------------------------------------------
// Format number
// ------------------------------------------------------------

function formatNumber(value) {

    const number =
        Number(value);


    if (!Number.isFinite(number)) {
        return String(value);
    }


    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 2
        }
    );

}


// ------------------------------------------------------------
// Create EMI response
// ------------------------------------------------------------

function formatEMI(result) {

    if (
        !result ||
        !result.result
    ) {

        return {

            success: false,

            message:
                "EMI result is not available."

        };

    }


    const data =
        result.result;


    return {

        success: true,

        type:
            "finance",

        message:
            `Loan amount ₹${formatNumber(data.principal)} ke liye ${data.annualRate}% annual interest aur ${data.years} years tenure par estimated EMI ₹${formatNumber(data.monthlyEMI)} per month hai.`,

        details: {

            loanAmount:
                data.principal,

            interestRate:
                data.annualRate,

            tenureYears:
                data.years,

            monthlyEMI:
                data.monthlyEMI,

            totalPayment:
                data.totalPayment,

            totalInterest:
                data.totalInterest

        }

    };

}


// ------------------------------------------------------------
// Format simple interest
// ------------------------------------------------------------

function formatSimpleInterest(result) {

    if (
        !result ||
        !result.result
    ) {

        return {

            success: false,

            message:
                "Interest result is not available."

        };

    }


    const data =
        result.result;


    return {

        success: true,

        type:
            "finance",

        message:
            `₹${formatNumber(data.principal)} par ${data.annualRate}% annual rate aur ${data.years} years ke liye simple interest ₹${formatNumber(data.interest)} hai. Total amount ₹${formatNumber(data.totalAmount)} hoga.`,

        details:
            data

    };

}


// ------------------------------------------------------------
// Format missing input
// ------------------------------------------------------------

function formatMissingInput(result) {

    const missing =
        result.missingParameters || [];


    return {

        success: true,

        type:
            "needs-input",

        message:
            `Mujhe calculation complete karne ke liye ${missing.join(", ")} chahiye.`,

        missingParameters:
            missing

    };

}


// ------------------------------------------------------------
// Format generic execution result
// ------------------------------------------------------------

function formatExecution(result) {

    if (!result) {

        return {

            success: false,

            message:
                "No execution result available."

        };

    }


    if (
        result.needsInput
    ) {

        return formatMissingInput(
            result
        );

    }


    if (
        !result.success
    ) {

        return {

            success: false,

            type:
                "error",

            message:
                result.error ||
                "Request could not be completed."

        };

    }


    if (
        result.intent ===
        "calculate_emi"
    ) {

        return formatEMI(
            result
        );

    }


    if (
        result.intent ===
        "simple_interest"
    ) {

        return formatSimpleInterest(
            result
        );

    }


    return {

        success: true,

        type:
            "general",

        message:
            result.message ||
            "Request processed successfully.",

        data:
            result

    };

}


// ------------------------------------------------------------
// Create final response
// ------------------------------------------------------------

function createResponse(
    orchestrationResult
) {

    if (
        !orchestrationResult
    ) {

        return {

            success: false,

            message:
                "AarHen received no result."

        };

    }


    if (
        orchestrationResult.status ===
        "approval-required"
    ) {

        return {

            success: true,

            type:
                "approval-required",

            message:
                orchestrationResult.message,

            permission:
                orchestrationResult.permission

        };

    }


    return formatExecution(
        orchestrationResult.execution
    );

}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    formatNumber,

    formatEMI,

    formatSimpleInterest,

    formatMissingInput,

    formatExecution,

    createResponse

};
