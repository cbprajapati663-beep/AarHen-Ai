// ============================================================
// AARHEN CORE V5
// Finance Engine
// ============================================================


// ------------------------------------------------------------
// EMI Calculator
// ------------------------------------------------------------

function calculateEMI(principal, annualRate, years) {

    const P = Number(principal);
    const annual = Number(annualRate);
    const Y = Number(years);

    if (!Number.isFinite(P) || P <= 0) {
        throw new Error("Invalid loan principal.");
    }

    if (!Number.isFinite(annual) || annual < 0) {
        throw new Error("Invalid annual interest rate.");
    }

    if (!Number.isFinite(Y) || Y <= 0) {
        throw new Error("Invalid loan tenure.");
    }


    const months = Math.round(Y * 12);
    const monthlyRate = annual / 12 / 100;

    let emi;

    // Zero-interest loan
    if (monthlyRate === 0) {

        emi = P / months;

    } else {

        emi =
            P *
            monthlyRate *
            Math.pow(1 + monthlyRate, months) /
            (Math.pow(1 + monthlyRate, months) - 1);
    }


    const totalPayment = emi * months;
    const totalInterest = totalPayment - P;


    return {

        principal: P,

        annualRate: annual,

        years: Y,

        months,

        monthlyEMI: Number(emi.toFixed(2)),

        totalPayment: Number(totalPayment.toFixed(2)),

        totalInterest: Number(totalInterest.toFixed(2))

    };
}


// ------------------------------------------------------------
// Refinance Comparison
// ------------------------------------------------------------

function compareRefinance({

    outstandingLoan,
    currentRate,
    newRate,
    remainingYears

}) {

    const oldLoan = calculateEMI(
        outstandingLoan,
        currentRate,
        remainingYears
    );

    const newLoan = calculateEMI(
        outstandingLoan,
        newRate,
        remainingYears
    );


    return {

        outstandingLoan: Number(outstandingLoan),

        currentLoan: oldLoan,

        newLoan,

        monthlySaving: Number(
            (oldLoan.monthlyEMI - newLoan.monthlyEMI)
                .toFixed(2)
        ),

        totalSaving: Number(
            (oldLoan.totalPayment - newLoan.totalPayment)
                .toFixed(2)
        )

    };
}


// ------------------------------------------------------------
// Calculate maximum loan from EMI
// ------------------------------------------------------------

function calculateLoanFromEMI(
    monthlyEMI,
    annualRate,
    years
) {

    const EMI = Number(monthlyEMI);
    const annual = Number(annualRate);
    const Y = Number(years);

    if (!Number.isFinite(EMI) || EMI <= 0) {
        throw new Error("Invalid monthly EMI.");
    }

    if (!Number.isFinite(annual) || annual < 0) {
        throw new Error("Invalid annual interest rate.");
    }

    if (!Number.isFinite(Y) || Y <= 0) {
        throw new Error("Invalid loan tenure.");
    }


    const months = Math.round(Y * 12);
    const monthlyRate = annual / 12 / 100;

    let principal;

    if (monthlyRate === 0) {

        principal = EMI * months;

    } else {

        principal =
            EMI *
            (
                (Math.pow(1 + monthlyRate, months) - 1) /
                (
                    monthlyRate *
                    Math.pow(1 + monthlyRate, months)
                )
            );
    }


    return {

        monthlyEMI: EMI,

        annualRate: annual,

        years: Y,

        months,

        estimatedLoanAmount: Number(
            principal.toFixed(2)
        )

    };
}


// ------------------------------------------------------------
// Simple interest calculator
// ------------------------------------------------------------

function calculateSimpleInterest(
    principal,
    annualRate,
    years
) {

    const P = Number(principal);
    const R = Number(annualRate);
    const T = Number(years);

    if (P <= 0 || R < 0 || T <= 0) {
        throw new Error("Invalid financial parameters.");
    }


    const interest =
        P * R * T / 100;


    return {

        principal: P,

        annualRate: R,

        years: T,

        interest: Number(interest.toFixed(2)),

        totalAmount: Number(
            (P + interest).toFixed(2)
        )

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    calculateEMI,

    compareRefinance,

    calculateLoanFromEMI,

    calculateSimpleInterest

};
