// ============================================================
// AARHEN CORE V5
// RESPONSE ENGINE
// ============================================================

function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return String(value ?? "");
    }

    return number.toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

// ============================================================
// FINANCE RESPONSES
// ============================================================

function formatEMI(result) {

    if (!result || !result.success) {
        return "EMI calculation complete nahi ho saki.";
    }

    return (
        `Loan amount ₹${formatNumber(result.principal)}, ` +
        `${result.annualRate}% annual interest aur ` +
        `${result.years} years tenure ke hisaab se ` +
        `estimated EMI ₹${formatNumber(result.emi)} ` +
        `per month hai.`
    );
}

function formatSimpleInterest(result) {

    if (!result || !result.success) {
        return "Simple interest calculation complete nahi ho saki.";
    }

    return (
        `Principal ₹${formatNumber(result.principal)}, ` +
        `${result.annualRate}% interest aur ` +
        `${result.years} years ke hisaab se ` +
        `simple interest ₹${formatNumber(result.interest)} ` +
        `aur total amount ₹${formatNumber(result.totalAmount)} hai.`
    );
}

// ============================================================
// MISSING INPUT
// ============================================================

function formatMissingInput(missing = []) {

    if (!Array.isArray(missing) ||
        missing.length === 0) {

        return "Mujhe calculation complete karne ke liye required information chahiye.";
    }

    return (
        "Mujhe calculation complete karne ke liye " +
        missing.join(", ") +
        " chahiye."
    );
}

// ============================================================
// WEB RESEARCH RESPONSE
// ============================================================

function formatResearch(result) {

    if (!result) {
        return "Research result available nahi hai.";
    }

    if (
        result.executionStatus ===
        "research-error"
    ) {

        return (
            "Web research complete nahi ho saki. " +
            (result.result?.error ||
                "Research provider error.")
        );
    }

    const research =
        result.result || {};

    const answer =
        String(
            research.answer || ""
        ).trim();

    const sources =
        Array.isArray(research.results)
            ? research.results
            : [];

    const verification =
        research.verification || {};

    let response = "";

    if (answer) {

        response +=
            `🌐 Web Research Result\n\n${answer}`;
    } else {

        response +=
            "🌐 Web research complete hui, lekin provider ne direct summary nahi di.";
    }

    response +=
        `\n\n📚 Sources: ${sources.length}`;

    if (
        verification.verificationStatus
    ) {

        response +=
            `\n🔍 Verification: ${verification.verificationStatus}`;
    }

    if (
        research.learning &&
        research.learning.success
    ) {

        response +=
            "\n🧠 Verified information AarHen ki knowledge memory me learn ho gayi.";
    }

    if (sources.length > 0) {

        response +=
            "\n\nTop sources:";

        sources
            .slice(0, 5)
            .forEach(
                (source, index) => {

                    response +=
                        `\n${index + 1}. ${source.title}`;

                    if (source.url) {

                        response +=
                            ` — ${source.url}`;
                    }
                }
            );
    }

    return response;
}

// ============================================================
// GENERIC EXECUTION RESPONSE
// ============================================================

function formatExecution(execution) {

    if (!execution) {
        return "AarHen execution result available nahi hai.";
    }

    if (execution.needsInput) {

        return formatMissingInput(
            execution.missingParameters
        );
    }

    if (!execution.success) {

        return (
            "AarHen task complete nahi kar saka. " +
            (execution.error ||
                "Unknown execution error.")
        );
    }

    if (
        execution.category === "research"
    ) {

        return formatResearch(
            execution
        );
    }

    if (
        execution.category === "finance" &&
        execution.intent === "calculate_emi"
    ) {

        return formatEMI(
            execution.result
        );
    }

    if (
        execution.category === "finance" &&
        execution.intent === "simple_interest"
    ) {

        return formatSimpleInterest(
            execution.result
        );
    }

    if (
        execution.result &&
        typeof execution.result.message ===
            "string"
    ) {

        return execution.result.message;
    }

    return (
        "AarHen ne task successfully process kiya."
    );
}

// ============================================================
// MAIN RESPONSE CREATOR
// ============================================================

function createResponse(result = {}) {

    if (
        result.status ===
        "approval-required"
    ) {

        return (
            "Is action ko perform karne se pehle " +
            "aapki approval required hai."
        );
    }

    if (
        result.status ===
        "needs-user-input"
    ) {

        return formatMissingInput(
            result.execution?.missingParameters
        );
    }

    if (
        result.execution
    ) {

        return formatExecution(
            result.execution
        );
    }

    if (
        result.error
    ) {

        return result.error;
    }

    return (
        "AarHen ne request process kar li hai."
    );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    formatNumber,
    formatEMI,
    formatSimpleInterest,
    formatMissingInput,
    formatResearch,
    formatExecution,
    createResponse
};
