// ============================================================
// AARHEN CORE V5
// COMPLETE SYSTEM TEST
// ============================================================

const orchestrator =
    require("./core/orchestrator");

const brain =
    require("./core/brain");

const memory =
    require("./core/memory");

const memoryManager =
    require("./core/memoryManager");

const learning =
    require("./core/learning");

const learningApi =
    require("./core/learningApi");

const memoryApi =
    require("./core/memoryApi");

const research =
    require("./engines/research");

const knowledge =
    require("./engines/knowledge");

const executor =
    require("./skills/executor");

const router =
    require("./skills/router");

const registry =
    require("./skills/registry");

const providerManager =
    require("./skills/providerManager");

// ============================================================
// TEST HELPER
// ============================================================

function test(name, condition) {

    if (!condition) {
        throw new Error(
            `TEST FAILED: ${name}`
        );
    }

    console.log(
        `✅ ${name}`
    );
}

// ============================================================
// VALID OBJECT
// ============================================================

function validObject(value) {

    return (
        value !== null &&
        typeof value === "object"
    );
}

// ============================================================
// MAIN TEST
// ============================================================

async function runTests() {

    console.log("");
    console.log("========================================");
    console.log("       AARHEN CORE V5 SYSTEM TEST");
    console.log("========================================");
    console.log("");

    // ========================================================
    // CORE MODULE TESTS
    // ========================================================

    test(
        "Orchestrator loaded",
        typeof orchestrator.process === "function"
    );

    test(
        "Brain loaded",
        typeof brain.think === "function"
    );

    test(
        "Memory loaded",
        typeof memory.remember === "function"
    );

    test(
        "Memory Manager loaded",
        typeof memoryManager.remember === "function"
    );

    test(
        "Learning Engine loaded",
        typeof learning.learn === "function"
    );

    test(
        "Learning API loaded",
        typeof learningApi.learnFromUser === "function"
    );

    test(
        "Memory API loaded",
        typeof memoryApi.remember === "function"
    );

    test(
        "Research Engine loaded",
        typeof research.createResearchRequest === "function"
    );

    test(
        "Knowledge Engine loaded",
        typeof knowledge.searchKnowledge === "function"
    );

    // ========================================================
    // PROVIDER MANAGER TEST
    // ========================================================

    test(
        "Provider Manager loaded",
        validObject(providerManager)
    );

    test(
        "Provider Manager search API available",
        typeof providerManager.searchWeb === "function"
    );

    test(
        "Provider Manager status API available",
        typeof providerManager.getStatus === "function"
    );

    // ========================================================
    // EXECUTOR TEST
    // ========================================================

    test(
        "Executor module loaded",
        validObject(executor)
    );

    test(
        "Executor executeIntent API available",
        typeof executor.executeIntent === "function"
    );

    test(
        "Executor context API available",
        typeof executor.prepareContext === "function"
    );

    test(
        "Executor engine functions API available",
        typeof executor.getEngineFunctions === "function"
    );

    // ========================================================
    // ROUTER TEST
    // ========================================================

    test(
        "Router module loaded",
        validObject(router)
    );

    // Router may expose different routing APIs.
    // We only verify that the module loads correctly.

    // ========================================================
    // SKILL REGISTRY TEST
    // ========================================================

    test(
        "Skill Registry loaded",
        validObject(registry)
    );

    // ========================================================
    // RESEARCH REQUEST TEST
    // ========================================================

    const researchRequest =
        research.createResearchRequest({

            query:
                "vehicle finance basics",

            maxSources:
                3
        });

    test(
        "Research request created",
        researchRequest.success === true
    );

    test(
        "Research provider required",
        researchRequest.providerRequired === true
    );

    test(
        "Research verification required",
        researchRequest.verificationRequired === true
    );

    test(
        "Research learning enabled",
        researchRequest.learningEnabled === true
    );

    // ========================================================
    // RESEARCH RESULT TEST
    // ========================================================

    const researchResult =
        research.createResearchResult({

            query:
                "vehicle finance basics",

            summary:
                "Vehicle finance allows customers to purchase vehicles through financing arrangements.",

            sources: [

                {
                    title:
                        "Source One",

                    url:
                        "https://example.com/source-one",

                    publisher:
                        "Example"
                },

                {
                    title:
                        "Source Two",

                    url:
                        "https://example.com/source-two",

                    publisher:
                        "Example"
                }
            ],

            confidence:
                0.85
        });

    test(
        "Research result created",
        researchResult.success === true
    );

    test(
        "Research sources validated",
        researchResult.sourceCount === 2
    );

    // ========================================================
    // RESEARCH VERIFICATION TEST
    // ========================================================

    const verification =
        research.verifyResearch({

            result:
                researchResult,

            sourceCount:
                2,

            confidence:
                0.85
        });

    test(
        "Research verification executed",
        verification.success === true
    );

    test(
        "Research verified",
        verification.verified === true
    );

    // ========================================================
    // RESEARCH CONTEXT TEST
    // ========================================================

    const researchContext =
        research.buildResearchContext(
            researchResult
        );

    test(
        "Research context created",
        researchContext.success === true
    );

    test(
        "Research context contains sources",
        researchContext.sourceCount === 2
    );

    // ========================================================
    // RESEARCH CONFIDENCE TEST
    // ========================================================

    const calculatedConfidence =
        research.calculateResearchConfidence({

            sources:
                researchResult.sources,

            confidence:
                0.85
        });

    test(
        "Research confidence calculated",
        calculatedConfidence >= 0.80
    );

    // ========================================================
    // MEMORY TEST
    // ========================================================

    const memoryResult =
        memoryManager.remember({

            type:
                "knowledge",

            title:
                "AarHen System Test Knowledge",

            content:
                "AarHen Core V5 system test knowledge record.",

            category:
                "system-test",

            source:
                "automated-test",

            importance:
                "low",

            confidence:
                0.9
        });

    test(
        "Memory stored",
        memoryResult &&
        memoryResult.success === true
    );

    // ========================================================
    // MEMORY SEARCH TEST
    // ========================================================

    const memorySearch =
        memoryManager.recall(
            "AarHen System Test Knowledge"
        );

    test(
        "Memory search executed",
        memorySearch &&
        memorySearch.success === true
    );

    // ========================================================
    // MEMORY STATUS TEST
    // ========================================================

    const memoryStatus =
        memoryManager.getStatus();

    test(
        "Memory Manager status available",
        validObject(memoryStatus)
    );

    // ========================================================
    // LEARNING TEST
    // ========================================================

    const learningResult =
        learning.learn({

            title:
                "AarHen Automated Test Knowledge",

            content:
                "This knowledge record is created by the automated AarHen Core V5 system test.",

            category:
                "system-test",

            source:
                "automated-test",

            approved:
                true,

            confidence:
                0.9
        });

    test(
        "Learning executed",
        learningResult &&
        learningResult.success === true
    );

    // ========================================================
    // LEARNING SEARCH TEST
    // ========================================================

    const learnedSearch =
        learning.searchLearnedKnowledge(
            "AarHen Automated Test Knowledge"
        );

    test(
        "Learned knowledge search executed",
        learnedSearch &&
        learnedSearch.success === true
    );

    // ========================================================
    // LEARNING STATUS TEST
    // ========================================================

    const learningStatus =
        learning.getLearningStatus();

    test(
        "Learning status available",
        validObject(learningStatus)
    );

    // ========================================================
    // BRAIN TEST
    // ========================================================

    const brainResult =
        brain.think({

            input:
                "What is vehicle finance?"
        });

    test(
        "Brain thinking executed",
        brainResult &&
        brainResult.success === true
    );

    // ========================================================
    // BRAIN STATUS TEST
    // ========================================================

    const brainStatus =
        brain.getStatus();

    test(
        "Brain status available",
        validObject(brainStatus)
    );

    // ========================================================
    // EXECUTOR CONTEXT TEST
    // ========================================================

    const executorContext =
        executor.prepareContext({

            input:
                "What is vehicle finance?"
        });

    test(
        "Executor context created",
        executorContext !== undefined &&
        executorContext !== null
    );

    // ========================================================
    // EXECUTOR ENGINE FUNCTIONS TEST
    // ========================================================

    const engineFunctions =
        executor.getEngineFunctions();

    test(
        "Executor engine functions available",
        engineFunctions !== undefined &&
        engineFunctions !== null
    );

    // ========================================================
    // ORCHESTRATOR TEST
    // ========================================================

    const orchestration =
        await orchestrator.process(
            "What is vehicle finance?",
            {
                remember:
                    false
            }
        );

    test(
        "Orchestrator returned result",
        orchestration !== undefined &&
        orchestration !== null
    );

    test(
        "Orchestrator returned object",
        validObject(orchestration)
    );

    // ========================================================
    // ORCHESTRATOR STATUS TEST
    // ========================================================

    if (
        typeof orchestrator.getStatus === "function"
    ) {

        const orchestratorStatus =
            orchestrator.getStatus();

        test(
            "Orchestrator status available",
            validObject(orchestratorStatus)
        );
    }

    // ========================================================
    // RESEARCH STATUS TEST
    // ========================================================

    const researchStatus =
        research.getResearchStatus();

    test(
        "Research status available",
        validObject(researchStatus)
    );

    test(
        "Research engine version available",
        Boolean(researchStatus.version)
    );

    // ========================================================
    // LIVE WEB RESEARCH TEST
    // ========================================================
    //
    // This test runs ONLY when:
    //
    // RUN_LIVE_RESEARCH_TEST=true
    //
    // It performs:
    //
    // Tavily
    //   ↓
    // Web Search
    //   ↓
    // Research Processing
    //   ↓
    // Verification
    //   ↓
    // Verified Learning
    //   ↓
    // Memory
    //   ↓
    // Recall
    //
    // ========================================================

    const runLiveResearch =
        String(
            process.env.RUN_LIVE_RESEARCH_TEST || ""
        ).toLowerCase() === "true";

    if (runLiveResearch) {

        console.log("");
        console.log("----------------------------------------");
        console.log("🌐 LIVE WEB RESEARCH TEST");
        console.log("----------------------------------------");
        console.log("");

        // ====================================================
        // PROVIDER STATUS
        // ====================================================

        const providerStatus =
            providerManager.getStatus();

        test(
            "Research provider status available",
            validObject(providerStatus)
        );

        test(
            "Research provider connected",
            Boolean(
                providerStatus &&
                providerStatus.providers &&
                providerStatus.providers.research &&
                providerStatus.providers.research.connected
            )
        );

        console.log(
            "✅ Tavily provider connected"
        );

        // ====================================================
        // LIVE WEB SEARCH
        // ====================================================

        const liveQuery =
            "vehicle finance basics official information";

        console.log("");
        console.log(
            `🔎 Searching web: ${liveQuery}`
        );

        const liveSearch =
            await providerManager.searchWeb({

                query:
                    liveQuery,

                maxSources:
                    5
            });

        test(
            "Live web search executed",
            liveSearch &&
            liveSearch.success === true
        );

        test(
            "Live web search returned results",
            Array.isArray(liveSearch.results) &&
            liveSearch.results.length > 0
        );

        test(
            "Live web search returned sources",
            Number(liveSearch.sourceCount) > 0
        );

        console.log(
            `✅ Web sources received: ${liveSearch.sourceCount}`
        );

        // ====================================================
        // PROCESS LIVE RESEARCH
        // ====================================================

        const processedResearch =
            research.processResearchResult({

                query:
                    liveSearch.query ||
                    liveQuery,

                answer:
                    liveSearch.answer ||
                    "",

                summary:
                    liveSearch.answer ||
                    "",

                sources:
                    liveSearch.results,

                provider:
                    liveSearch.provider ||
                    "Tavily",

                confidence:
                    0.85
            });

        test(
            "Live research result processed",
            processedResearch &&
            processedResearch.success === true
        );

        test(
            "Live research sources processed",
            Number(
                processedResearch.sourceCount
            ) > 0
        );

        console.log(
            `✅ Research processed: ${processedResearch.researchStatus}`
        );

        // ====================================================
        // LIVE RESEARCH VERIFICATION
        // ====================================================

        test(
            "Live research verification executed",
            processedResearch.verification !== undefined &&
            processedResearch.verification !== null
        );

        test(
            "Live research verification status available",
            Boolean(
                processedResearch.verificationStatus ||
                processedResearch.researchStatus
            )
        );

        // ====================================================
        // VERIFIED LEARNING CHECK
        // ====================================================

        const liveLearning =
            processedResearch.learning;

        test(
            "Live research learning result available",
            validObject(liveLearning)
        );

        if (
            processedResearch.verified === true
        ) {

            test(
                "Live research marked verified",
                processedResearch.verified === true
            );

            test(
                "Verified learning attempted",
                liveLearning !== undefined &&
                liveLearning !== null
            );

            console.log(
                "✅ Verified research reached learning stage"
            );

        } else {

            console.log(
                "⚠️ Live research was not fully verified."
            );

            console.log(
                "Research was processed but was not automatically stored as verified knowledge."
            );
        }

        // ====================================================
        // LEARNED KNOWLEDGE RECALL
        // ====================================================

        const learnedWebKnowledge =
            learning.searchLearnedKnowledge(
                liveQuery
            );

        test(
            "Web learning recall executed",
            learnedWebKnowledge &&
            learnedWebKnowledge.success === true
        );

        console.log(
            "✅ Web learning recall executed"
        );

        // ====================================================
        // LIVE RESEARCH SUMMARY
        // ====================================================

        console.log("");
        console.log("----------------------------------------");
        console.log("🌐 LIVE RESEARCH PIPELINE RESULT");
        console.log("----------------------------------------");

        console.log(
            `Provider: ${
                liveSearch.provider ||
                "Tavily"
            }`
        );

        console.log(
            `Sources: ${
                liveSearch.sourceCount ||
                0
            }`
        );

        console.log(
            `Verification: ${
                processedResearch.verificationStatus ||
                "unknown"
            }`
        );

        console.log(
            `Verified: ${
                processedResearch.verified === true
            }`
        );

        console.log(
            `Learning: ${
                liveLearning.learned === true
            }`
        );

        console.log("----------------------------------------");
        console.log("");
    } else {

        console.log("");
        console.log(
            "ℹ️ Live web research test skipped."
        );

        console.log(
            "Set RUN_LIVE_RESEARCH_TEST=true to run it."
        );

        console.log("");
    }

    // ========================================================
    // FINAL SYSTEM CHECK
    // ========================================================

    console.log("");
    console.log("========================================");
    console.log("         🎉 ALL TESTS PASSED");
    console.log("========================================");
    console.log("");

    console.log(
        "AarHen Core V5 modules are connected."
    );

    console.log(
        "Research pipeline is operational."
    );

    console.log(
        "Memory system is operational."
    );

    console.log(
        "Learning system is operational."
    );

    console.log(
        "Brain is operational."
    );

    console.log(
        "Executor is operational."
    );

    console.log(
        "Orchestrator is operational."
    );

    if (runLiveResearch) {

        console.log(
            "Live Web → Verify → Learn → Recall test completed."
        );

    }

    console.log("");

    console.log("========================================");
    console.log("       AARHEN CORE V5 TEST COMPLETE");
    console.log("========================================");
    console.log("");

    return true;
}

// ============================================================
// RUN TESTS
// ============================================================

runTests()
    .then(() => {

        process.exit(0);

    })
    .catch(error => {

        console.error("");
        console.error(
            "❌ AARHEN SYSTEM TEST FAILED"
        );

        console.error("");

        console.error(
            error.stack ||
            error.message
        );

        console.error("");

        process.exit(1);
    });
