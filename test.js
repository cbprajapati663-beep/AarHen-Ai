// ============================================================
// AARHEN CORE V5
// COMPLETE SYSTEM TEST
// ============================================================

const assert = require("assert");


// ============================================================
// IMPORTS
// ============================================================

const brain =
    require("./core/brain");

const memory =
    require("./core/memory");

const memoryManager =
    require("./core/memoryManager");

const learning =
    require("./core/learning");

const research =
    require("./engines/research");

const verification =
    require("./core/verification");

const executor =
    require("./skills/executor");

const orchestrator =
    require("./core/orchestrator");

const providerManager =
    require("./providers/providerManager");


// ============================================================
// TEST HELPERS
// ============================================================

let passed = 0;
let failed = 0;

function green(message) {

    passed++;

    console.log(
        `\x1b[32mGREEN\x1b[0m ${message}`
    );
}


function red(message) {

    failed++;

    console.log(
        `\x1b[31mRED\x1b[0m ${message}`
    );
}


function test(
    name,
    condition
) {

    try {

        assert.ok(
            condition,
            name
        );

        green(name);

    } catch (error) {

        red(
            `${name} -> ${error.message}`
        );
    }
}


function section(title) {

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(title);

    console.log(
        "============================================================"
    );
}


// ============================================================
// START
// ============================================================

console.log("");
console.log(
    "============================================================"
);

console.log(
    "AARHEN CORE V5 - COMPLETE SYSTEM TEST"
);

console.log(
    "============================================================"
);


// ============================================================
// MODULE LOAD TEST
// ============================================================

section(
    "1. MODULE LOAD TEST"
);

test(
    "Brain module loaded",
    Boolean(brain)
);

test(
    "Memory module loaded",
    Boolean(memory)
);

test(
    "Memory Manager loaded",
    Boolean(memoryManager)
);

test(
    "Learning Engine loaded",
    Boolean(learning)
);

test(
    "Research Engine loaded",
    Boolean(research)
);

test(
    "Verification Engine loaded",
    Boolean(verification)
);

test(
    "Executor loaded",
    Boolean(executor)
);

test(
    "Orchestrator loaded",
    Boolean(orchestrator)
);

test(
    "Provider Manager loaded",
    Boolean(providerManager)
);


// ============================================================
// BRAIN TEST
// ============================================================

section(
    "2. BRAIN TEST"
);

try {

    const brainResult =
        brain.think(
            "Explain how vehicle finance works."
        );

    test(
        "Brain think() returns result",
        Boolean(brainResult)
    );

    test(
        "Brain result has success/status information",
        typeof brainResult === "object"
    );

} catch (error) {

    red(
        `Brain test -> ${error.message}`
    );
}


// ============================================================
// MEMORY TEST
// ============================================================

section(
    "3. MEMORY TEST"
);

try {

    const memoryResult =
        memory.remember({

            type:
                "test-memory",

            title:
                "AarHen Test Memory",

            category:
                "testing",

            content:
                "AarHen memory system test information.",

            source:
                "system-test",

            verified:
                true,

            confidence:
                0.95
        });

    test(
        "Memory can store information",
        Boolean(
            memoryResult &&
            memoryResult.id
        )
    );

    test(
        "Memory fingerprint created",
        Boolean(
            memoryResult &&
            memoryResult.fingerprint
        )
    );

    const duplicateMemory =
        memory.remember({

            type:
                "test-memory",

            title:
                "AarHen Test Memory",

            category:
                "testing",

            content:
                "AarHen memory system test information.",

            source:
                "system-test",

            verified:
                true,

            confidence:
                0.95
        });

    test(
        "Memory duplicate protection works",
        duplicateMemory &&
        duplicateMemory.duplicate === true
    );

} catch (error) {

    red(
        `Memory test -> ${error.message}`
    );
}


// ============================================================
// MEMORY MANAGER TEST
// ============================================================

section(
    "4. MEMORY MANAGER TEST"
);

try {

    const managerResult =
        memoryManager.remember({

            type:
                "test-memory-manager",

            title:
                "AarHen Memory Manager Test",

            category:
                "testing",

            content:
                "Testing the advanced memory manager duplicate protection.",

            source:
                "system-test",

            confidence:
                0.90,

            verified:
                true,

            remember:
                true
        });

    test(
        "Memory Manager stores information",
        Boolean(
            managerResult &&
            managerResult.memoryId
        )
    );

    test(
        "Memory Manager exposes duplicate flag",
        Object.prototype.hasOwnProperty.call(
            managerResult,
            "duplicate"
        )
    );

} catch (error) {

    red(
        `Memory Manager test -> ${error.message}`
    );
}


// ============================================================
// LEARNING TEST
// ============================================================

section(
    "5. LEARNING ENGINE TEST"
);

const learningTitle =
    "AarHen Learning Duplicate Safety Test";

const learningContent =
    "AarHen learns that verified knowledge should be stored safely and duplicate knowledge should not create another memory record.";

let firstLearning = null;
let secondLearning = null;

try {

    firstLearning =
        learning.learn({

            title:
                learningTitle,

            content:
                learningContent,

            category:
                "knowledge",

            source:
                "system-test",

            confidence:
                0.90,

            verified:
                false,

            learn:
                true
        });

    test(
        "First learning succeeds",
        firstLearning &&
        firstLearning.success === true
    );

    test(
        "First learning stores knowledge",
        firstLearning &&
        firstLearning.learned === true
    );

    test(
        "First learning returns memory ID",
        Boolean(
            firstLearning &&
            firstLearning.memoryId
        )
    );

    test(
        "First learning reports newly learned",
        firstLearning &&
        firstLearning.newlyLearned === true
    );

} catch (error) {

    red(
        `First learning test -> ${error.message}`
    );
}


// ============================================================
// DUPLICATE LEARNING TEST
// ============================================================

section(
    "6. DUPLICATE LEARNING TEST"
);

try {

    secondLearning =
        learning.learn({

            title:
                learningTitle,

            content:
                learningContent,

            category:
                "knowledge",

            source:
                "system-test",

            confidence:
                0.90,

            verified:
                false,

            learn:
                true
        });

    test(
        "Second learning call succeeds",
        secondLearning &&
        secondLearning.success === true
    );

    test(
        "Duplicate knowledge is detected",
        secondLearning &&
        secondLearning.duplicate === true
    );

    test(
        "Duplicate knowledge is not marked newly learned",
        secondLearning &&
        secondLearning.newlyLearned === false
    );

    test(
        "Duplicate status is already-learned",
        secondLearning &&
        secondLearning.status === "already-learned"
    );

    test(
        "Duplicate keeps original memory ID",
        firstLearning &&
        secondLearning &&
        firstLearning.memoryId ===
            secondLearning.memoryId
    );

} catch (error) {

    red(
        `Duplicate learning test -> ${error.message}`
    );
}


// ============================================================
// KNOWLEDGE SEARCH TEST
// ============================================================

section(
    "7. KNOWLEDGE SEARCH TEST"
);

try {

    const searchResult =
        learning.searchLearnedKnowledge(
            "verified knowledge",
            10
        );

    test(
        "Knowledge search returns result object",
        Boolean(searchResult)
    );

    test(
        "Knowledge search succeeds",
        searchResult &&
        searchResult.success === true
    );

    test(
        "Knowledge search returns results array",
        searchResult &&
        Array.isArray(searchResult.results)
    );

} catch (error) {

    red(
        `Knowledge search test -> ${error.message}`
    );
}


// ============================================================
// GET LEARNED KNOWLEDGE TEST
// ============================================================

section(
    "8. GET LEARNED KNOWLEDGE TEST"
);

try {

    const learnedKnowledge =
        learning.getLearnedKnowledge(100);

    test(
        "Get learned knowledge succeeds",
        learnedKnowledge &&
        learnedKnowledge.success === true
    );

    test(
        "Get learned knowledge returns results array",
        learnedKnowledge &&
        Array.isArray(
            learnedKnowledge.results
        )
    );

} catch (error) {

    red(
        `Get learned knowledge test -> ${error.message}`
    );
}


// ============================================================
// VERIFIED LEARNING TEST
// ============================================================

section(
    "9. VERIFIED LEARNING TEST"
);

const verifiedTitle =
    "AarHen Verified Learning Test";

const verifiedContent =
    "This is a verified knowledge record used to test AarHen's protected learning pipeline.";

let verifiedLearning = null;

try {

    verifiedLearning =
        learning.learnVerified({

            title:
                verifiedTitle,

            content:
                verifiedContent,

            category:
                "research",

            source:
                "system-test",

            confidence:
                0.95,

            verified:
                true,

            approved:
                true
        });

    test(
        "Verified learning succeeds",
        verifiedLearning &&
        verifiedLearning.success === true
    );

    test(
        "Verified learning is marked verified",
        verifiedLearning &&
        verifiedLearning.verified === true
    );

    test(
        "Verified learning returns memory ID",
        Boolean(
            verifiedLearning &&
            verifiedLearning.memoryId
        )
    );

} catch (error) {

    red(
        `Verified learning test -> ${error.message}`
    );
}


// ============================================================
// VERIFIED DUPLICATE TEST
// ============================================================

section(
    "10. VERIFIED DUPLICATE TEST"
);

try {

    const verifiedDuplicate =
        learning.learnVerified({

            title:
                verifiedTitle,

            content:
                verifiedContent,

            category:
                "research",

            source:
                "system-test",

            confidence:
                0.95,

            verified:
                true,

            approved:
                true
        });

    test(
        "Verified duplicate call succeeds",
        verifiedDuplicate &&
        verifiedDuplicate.success === true
    );

    test(
        "Verified duplicate is detected",
        verifiedDuplicate &&
        verifiedDuplicate.duplicate === true
    );

    test(
        "Verified duplicate is not newly learned",
        verifiedDuplicate &&
        verifiedDuplicate.newlyLearned === false
    );

} catch (error) {

    red(
        `Verified duplicate test -> ${error.message}`
    );
}


// ============================================================
// VERIFIED LEARNING SAFETY TEST
// ============================================================

section(
    "11. VERIFIED LEARNING SAFETY"
);

try {

    const unsafeVerifiedLearning =
        learning.learnVerified({

            title:
                "Unsafe Verification Test",

            content:
                "This knowledge must not bypass the verification and approval requirements.",

            category:
                "testing",

            source:
                "system-test",

            confidence:
                0.95,

            verified:
                false,

            approved:
                false
        });

    test(
        "Unverified learning is rejected",
        unsafeVerifiedLearning &&
        unsafeVerifiedLearning.success === false
    );

    test(
        "Verification protection is active",
        unsafeVerifiedLearning &&
        (
            unsafeVerifiedLearning.status ===
                "verification-required" ||
            unsafeVerifiedLearning.status ===
                "approval-required"
        )
    );

} catch (error) {

    red(
        `Verified safety test -> ${error.message}`
    );
}


// ============================================================
// LEARNING STATUS TEST
// ============================================================

section(
    "12. LEARNING STATUS TEST"
);

try {

    const status =
        learning.getLearningStatus();

    test(
        "Learning status available",
        Boolean(status)
    );

    test(
        "Learning engine active",
        status &&
        status.status === "active"
    );

    test(
        "Duplicate-safe learning capability exists",
        status &&
        Array.isArray(status.capabilities) &&
        status.capabilities.includes(
            "duplicate-safe-learning"
        )
    );

} catch (error) {

    red(
        `Learning status test -> ${error.message}`
    );
}


// ============================================================
// RESEARCH ENGINE TEST
// ============================================================

section(
    "13. RESEARCH ENGINE TEST"
);

try {

    const researchInput = {

        query:
            "AarHen research verification test",

        answer:
            "AarHen research test answer.",

        sources: [

            {
                id:
                    "test-source-1",

                title:
                    "Test Source One",

                url:
                    "https://example.com/source-one",

                content:
                    "Test source one contains supporting information."
            },

            {
                id:
                    "test-source-2",

                title:
                    "Test Source Two",

                url:
                    "https://example.com/source-two",

                content:
                    "Test source two independently supports the information."
            }
        ],

        confidence:
            0.90
    };

    const researchResult =
        research.createResearchResult(
            researchInput
        );

    test(
        "Research result created",
        Boolean(researchResult)
    );

    test(
        "Research has sources",
        researchResult &&
        Array.isArray(
            researchResult.sources
        ) &&
        researchResult.sources.length >= 2
    );

    const verifiedResult =
        research.verifyResearch(
            researchResult
        );

    test(
        "Research verification returns result",
        Boolean(verifiedResult)
    );

    test(
        "Research reaches verified state",
        verifiedResult &&
        verifiedResult.verified === true
    );

} catch (error) {

    red(
        `Research engine test -> ${error.message}`
    );
}


// ============================================================
// EXECUTOR TEST
// ============================================================

section(
    "14. EXECUTOR TEST"
);

try {

    test(
        "Executor exposes executeIntent()",
        typeof executor.executeIntent ===
            "function"
    );

} catch (error) {

    red(
        `Executor test -> ${error.message}`
    );
}


// ============================================================
// ORCHESTRATOR TEST
// ============================================================

section(
    "15. ORCHESTRATOR TEST"
);

try {

    test(
        "Orchestrator exposes process()",
        typeof orchestrator.process ===
            "function"
    );

    test(
        "Orchestrator exposes orchestrate()",
        typeof orchestrator.orchestrate ===
            "function"
    );

    const orchestratorStatus =
        orchestrator.getStatus();

    test(
        "Orchestrator status available",
        Boolean(orchestratorStatus)
    );

    test(
        "Orchestrator is active",
        orchestratorStatus &&
        orchestratorStatus.status ===
            "active"
    );

} catch (error) {

    red(
        `Orchestrator test -> ${error.message}`
    );
}


// ============================================================
// PROVIDER MANAGER TEST
// ============================================================

section(
    "16. PROVIDER MANAGER TEST"
);

try {

    const providerStatus =
        providerManager.getStatus();

    test(
        "Provider Manager status available",
        Boolean(providerStatus)
    );

} catch (error) {

    red(
        `Provider Manager test -> ${error.message}`
    );
}


// ============================================================
// LIVE RESEARCH TEST
// ============================================================

section(
    "17. LIVE RESEARCH TEST"
);

if (
    process.env.RUN_LIVE_RESEARCH_TEST ===
    "true"
) {

    console.log(
        "Live research test enabled."
    );

    (async () => {

        try {

            const liveResult =
                await orchestrator.orchestrate(
                    "What is the latest information about electric vehicles?",
                    {
                        intent:
                            "research"
                    }
                );

            test(
                "Live research orchestration completed",
                Boolean(liveResult)
            );

            test(
                "Live research result contains research data",
                Boolean(
                    liveResult &&
                    liveResult.research
                )
            );

            test(
                "Live research returns sources",
                Boolean(
                    liveResult &&
                    liveResult.research &&
                    Array.isArray(
                        liveResult.research.sources
                    )
                )
            );

        } catch (error) {

            red(
                `Live research test -> ${error.message}`
            );

        } finally {

            finishTests();

        }

    })();

} else {

    console.log(
        "Live research test skipped."
    );

    console.log(
        "Set RUN_LIVE_RESEARCH_TEST=true to enable it."
    );

    finishTests();
}


// ============================================================
// FINAL RESULT
// ============================================================

function finishTests() {

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "AARHEN TEST SUMMARY"
    );

    console.log(
        "============================================================"
    );

    console.log(
        `GREEN: ${passed}`
    );

    console.log(
        `RED:   ${failed}`
    );

    console.log(
        "============================================================"
    );

    if (failed > 0) {

        console.log(
            "\x1b[31mTEST RESULT: RED\x1b[0m"
        );

        process.exitCode = 1;

    } else {

        console.log(
            "\x1b[32mTEST RESULT: GREEN\x1b[0m"
        );

        process.exitCode = 0;
    }

    console.log(
        "============================================================"
    );
}
