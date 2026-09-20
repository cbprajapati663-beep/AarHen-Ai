// ============================================================
// AARHEN CORE V5
// SYSTEM TEST
// ============================================================

const AarHen =
    require("./core/orchestrator");


// ------------------------------------------------------------
// Test helper
// ------------------------------------------------------------

function runTest(
    title,
    input
) {

    console.log("");
    console.log("================================================");
    console.log(title);
    console.log("================================================");

    console.log(
        "INPUT:",
        input
    );


    const result =
        AarHen.process(
            input
        );


    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );


    return result;

}


// ------------------------------------------------------------
// Test 1 - EMI
// ------------------------------------------------------------

runTest(

    "TEST 1 - EMI",

    "5 lakh loan 12% 5 years EMI batao"

);


// ------------------------------------------------------------
// Test 2 - Missing information
// ------------------------------------------------------------

runTest(

    "TEST 2 - Missing Information",

    "5 lakh loan ka EMI batao"

);


// ------------------------------------------------------------
// Test 3 - Coding
// ------------------------------------------------------------

runTest(

    "TEST 3 - Coding",

    "JavaScript code analyze karo"

);


// ------------------------------------------------------------
// Test 4 - Research
// ------------------------------------------------------------

runTest(

    "TEST 4 - Research",

    "latest vehicle finance information search karo"

);


// ------------------------------------------------------------
// Test 5 - Business
// ------------------------------------------------------------

runTest(

    "TEST 5 - Heritage Business",

    "used car finance ka customer lead banana hai"

);


// ------------------------------------------------------------
// Test 6 - Security
// ------------------------------------------------------------

runTest(

    "TEST 6 - Security",

    "cybersecurity learning ke liye OWASP samjhao"

);


// ------------------------------------------------------------
// Test complete
// ------------------------------------------------------------

console.log("");
console.log("================================================");
console.log("AARHEN SYSTEM TEST COMPLETE");
console.log("================================================");
