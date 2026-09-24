// ============================================================
// AARHEN CORE V5
// MASTER ORCHESTRATOR
// ============================================================
//
// Version: 5.0.0
//
// Purpose:
// - Main AarHen request orchestration layer
// - Connect Brain, Memory, RAG, Research, Routing, Intent,
//   Permissions, Executor and Response systems
// - Support controlled Autonomous Worker execution
// - Preserve existing non-autonomous execution behavior
//
// Autonomous integration:
//
// Normal:
// Input
//   ↓
// Master Brain
//   ↓
// Routing
//   ↓
// Intent
//   ↓
// Research
//   ↓
// Permission
//   ↓
// Skill Executor
//   ↓
// Response
//
// Autonomous:
// Input
//   ↓
// Master Brain
//   ↓
// Routing
//   ↓
// Intent
//   ↓
// Research
//   ↓
// Permission / Memory Context
//   ↓
// Autonomous Worker
//   ↓
// Agent Planner
//   ↓
// Agent Manager
//   ↓
// Agent Worker
//   ↓
// Worker Provider
//   ↓
// Provider Bridge
//   ↓
// Provider Manager
//   ↓
// Agent Runner
//   ↓
// Response
//
// IMPORTANT:
// - Existing normal execution remains intact.
// - Autonomous mode is opt-in through context.autonomous=true.
// - Autonomous execution does not bypass permissions.
// - Protected external actions remain approval-controlled.
// ============================================================


const Brain =
    require("./brain");


const router =
    require("../skills/router");


const intent =
    require("./intent");


const executor =
    require("../skills/executor");


const permissions =
    require("./permissions");


const responseEngine =
    require("./response");


const memoryManager =
    require("./memoryManager");


const researchApi =
    require("./researchApi");


const autonomousWorker =
    require("./autonomousWorker");


// ============================================================
// VERSION
// ============================================================

const ORCHESTRATOR_VERSION =
    "5.0.0";


// ============================================================
// SELECT SKILL
// ============================================================

function selectSkill(input) {

    const result =
        router.route(
            input
        );

    if (!result.success) {

        return result;
    }

    return {

        success:
            true,

        selectedSkill:
            result.selectedSkill,

        matches:
            result.matches,

        status:
            result.status
    };
}


// ============================================================
// DETECT WHETHER LIVE RESEARCH IS REQUIRED
// ============================================================

function shouldResearch(
    request,
    intentResult = {},
    routing = {},
    context = {}
) {

    if (
        context.research === true ||
        String(
            context.intent || ""
        ).toLowerCase() ===
            "research"
    ) {

        return {

            required:
                true,

            reason:
                "Live research explicitly requested by context."
        };
    }


    if (
        context.research === false
    ) {

        return {

            required:
                false,

            reason:
                "Live research explicitly disabled by context."
        };
    }


    const category =
        String(
            intentResult.category || ""
        )
            .toLowerCase();


    if (
        category ===
        "research"
    ) {

        return {

            required:
                true,

            reason:
                "Intent category requires web research."
        };
    }


    const selectedSkill =
        routing
            ?.selectedSkill;


    const skillCategory =
        String(
            selectedSkill
                ?.category || ""
        )
            .toLowerCase();


    const skillName =
        String(
            selectedSkill
                ?.name ||
            selectedSkill
                ?.id ||
            ""
        )
            .toLowerCase();


    if (
        skillCategory ===
            "research" ||
        skillName.includes(
            "research"
        ) ||
        skillName.includes(
            "web-search"
        ) ||
        skillName.includes(
            "web_search"
        )
    ) {

        return {

            required:
                true,

            reason:
                "Research skill selected by router."
        };
    }


    const cleanRequest =
        String(
            request || ""
        )
            .toLowerCase();


    const researchSignals = [

        "latest",
        "current",
        "currently",
        "today",
        "tonight",
        "this week",
        "this month",
        "recent",
        "recently",
        "news",
        "update",
        "updates",
        "newest",
        "live",
        "real time",
        "realtime",
        "search web",
        "search the web",
        "search internet",
        "search online",
        "look up",
        "lookup",
        "on internet",
        "from internet",
        "from web",
        "online information",
        "latest information"

    ];


    const matchedSignal =
        researchSignals.find(
            signal =>
                cleanRequest.includes(
                    signal
                )
        );


    if (
        matchedSignal
    ) {

        return {

            required:
                true,

            reason:
                `Fresh-web signal detected: ${matchedSignal}.`
        };
    }


    const researchKeywords = [

        "research",
        "web research",
        "web search",
        "internet search",
        "online search"

    ];


    const matchedKeyword =
        researchKeywords.find(
            keyword =>
                cleanRequest.includes(
                    keyword
                )
        );


    if (
        matchedKeyword
    ) {

        return {

            required:
                true,

            reason:
                `Research keyword detected: ${matchedKeyword}.`
        };
    }


    return {

        required:
            false,

        reason:
            "Live web research not required."
    };
}


// ============================================================
// NORMALIZE RESEARCH SOURCES
// ============================================================

function collectResearchSources(
    result
) {

    const candidates = [

        result?.sources,

        result?.results,

        result?.research?.sources,

        result?.research?.results,

        result?.result?.sources,

        result?.result?.results,

        result?.raw?.sources,

        result?.raw?.results,

        result?.research?.raw?.sources,

        result?.research?.raw?.results,

        result?.result?.raw?.sources,

        result?.result?.raw?.results,

        result?.data?.sources,

        result?.data?.results

    ];


    for (
        const candidate of
        candidates
    ) {

        if (
            Array.isArray(
                candidate
            ) &&
            candidate.length > 0
        ) {

            return candidate;
        }
    }


    return [];
}


function normalizeResearchResult(
    result,
    request
) {

    const rawResearch =
        result?.research ||
        result?.result ||
        result ||
        {};


    // --------------------------------------------------------
    // SOURCE COLLECTION
    // --------------------------------------------------------

    let sources =
        collectResearchSources(
            result
        );


    // --------------------------------------------------------
    // NORMALIZE SOURCES
    // --------------------------------------------------------

    sources =
        sources
            .filter(Boolean)
            .map(
                (
                    source,
                    index
                ) => {

                    return {

                        id:
                            source.id ||
                            `research-source-${index + 1}`,

                        title:
                            source.title ||
                            source.name ||
                            `Research Source ${index + 1}`,

                        url:
                            source.url ||
                            source.link ||
                            "",

                        content:
                            source.content ||
                            source.text ||
                            source.snippet ||
                            "",

                        snippet:
                            source.snippet ||
                            source.content ||
                            source.text ||
                            "",

                        score:
                            typeof source.score ===
                            "number"

                                ? source.score

                                : null,

                        publishedDate:
                            source.publishedDate ||
                            source.published_at ||
                            source.date ||
                            null
                    };
                }
            );


    // --------------------------------------------------------
    // VERIFICATION
    // --------------------------------------------------------

    const verification =
        rawResearch.verification ||
        result?.verification ||
        null;


    let verificationStatus =
        rawResearch.verificationStatus ||
        result?.verificationStatus ||
        verification?.verificationStatus ||
        verification?.status ||
        null;


    const verified =
        rawResearch.verified ===
            true ||
        result?.verified ===
            true ||
        verification?.verified ===
            true ||
        verificationStatus ===
            "verified";


    if (
        verified
    ) {

        verificationStatus =
            "verified";

    } else if (
        !verificationStatus
    ) {

        verificationStatus =
            "review";
    }


    // --------------------------------------------------------
    // CONFIDENCE
    // --------------------------------------------------------

    let confidence =
        typeof rawResearch.confidence ===
        "number"

            ? rawResearch.confidence

            : typeof result?.confidence ===
              "number"

                ? result.confidence

                : 0;


    if (
        confidence >
        1
    ) {

        confidence =
            confidence / 100;
    }


    confidence =
        Math.max(
            0,
            Math.min(
                1,
                confidence
            )
        );


    // --------------------------------------------------------
    // SOURCE COUNT
    // --------------------------------------------------------

    const sourceCount =
        sources.length ||
        Number(
            rawResearch.sourceCount ||
            result?.sourceCount ||
            0
        );


    // --------------------------------------------------------
    // ANSWER
    // --------------------------------------------------------

    const answer =
        rawResearch.answer ||
        rawResearch.summary ||
        result?.answer ||
        result?.summary ||
        "";


    // --------------------------------------------------------
    // PROVIDER
    // --------------------------------------------------------

    const provider =
        rawResearch.provider ||
        result?.provider ||
        "tavily";


    // --------------------------------------------------------
    // LEARNING
    // --------------------------------------------------------

    const learning =
        rawResearch.learning ||
        result?.learning ||
        null;


    // --------------------------------------------------------
    // RESEARCH STATUS
    // --------------------------------------------------------

    const researchStatus =
        rawResearch.researchStatus ||
        rawResearch.status ||
        result?.researchStatus ||
        result?.status ||
        (
            verified

                ? "verified"

                : "review"
        );


    // --------------------------------------------------------
    // FINAL STANDARDIZED OBJECT
    // --------------------------------------------------------

    return {

        success:
            rawResearch.success !==
                false &&
            result?.success !==
                false,

        query:
            rawResearch.query ||
            result?.query ||
            request,

        answer,

        sources,

        sourceCount,

        confidence,

        verificationStatus,

        verified,

        provider,

        verification,

        learning,

        researchStatus,

        previousKnowledgeAvailable:
            Boolean(
                rawResearch
                    .previousKnowledgeAvailable ||
                result
                    ?.previousKnowledgeAvailable
            ),

        previousVerifiedKnowledgeAvailable:
            Boolean(
                rawResearch
                    .previousVerifiedKnowledgeAvailable ||
                result
                    ?.previousVerifiedKnowledgeAvailable
            ),

        memoryId:
            rawResearch.memoryId ||
            result?.memoryId ||
            learning?.memoryId ||
            null,

        raw:
            rawResearch

    };
}


// ============================================================
// PERFORM LIVE RESEARCH
// ============================================================

async function performResearch(
    request,
    context = {}
) {

    const maxSources =
        Number(
            context.maxResearchSources
        ) || 5;


    const language =
        context.researchLanguage ||
        "auto";


    try {

        const result =
            await researchApi.searchWeb({

                query:
                    request,

                maxSources,

                language
            });


        if (
            !result ||
            result.success !==
                true
        ) {

            return {

                success:
                    false,

                query:
                    request,

                error:
                    result?.error ||
                    "Live web research failed.",

                status:
                    result?.status ||
                    "research-failed",

                research:
                    null,

                context:
                    null,

                sources:
                    [],

                sourceCount:
                    0,

                confidence:
                    0,

                verified:
                    false,

                verificationStatus:
                    "failed"
            };
        }


        // ----------------------------------------------------
        // Convert Research API output to stable object
        // ----------------------------------------------------

        const standardizedResearch =
            normalizeResearchResult(
                result,
                request
            );


        return {

            success:
                true,

            query:
                request,

            research:
                standardizedResearch,

            context:
                result.context ||
                standardizedResearch
                    .raw
                    ?.context ||
                null,

            provider:
                standardizedResearch
                    .provider,

            sources:
                standardizedResearch
                    .sources,

            sourceCount:
                standardizedResearch
                    .sourceCount,

            confidence:
                standardizedResearch
                    .confidence,

            verified:
                standardizedResearch
                    .verified,

            verificationStatus:
                standardizedResearch
                    .verificationStatus,

            verification:
                standardizedResearch
                    .verification,

            learning:
                standardizedResearch
                    .learning,

            status:
                standardizedResearch
                    .researchStatus
        };

    } catch (error) {

        return {

            success:
                false,

            query:
                request,

            error:
                error.message,

            status:
                "research-error",

            research:
                null,

            context:
                null,

            sources:
                [],

            sourceCount:
                0,

            confidence:
                0,

            verified:
                false,

            verificationStatus:
                "error"
        };
    }
}


// ============================================================
// DETERMINE PERMISSION
// ============================================================

function determinePermission(
    intentResult,
    routing
) {

    if (
        !routing.selectedSkill
    ) {

        return permissions.check(
            "execute_external_code"
        );
    }


    const category =
        routing
            .selectedSkill
            .category;


    if (
        category ===
        "security"
    ) {

        return permissions.check(
            "security_testing_against_external_target"
        );
    }


    if (
        category ===
        "coding"
    ) {

        return permissions.check(
            "execute_external_code"
        );
    }


    if (

        category ===
            "finance" ||

        category ===
            "calculation" ||

        category ===
            "knowledge" ||

        category ===
            "research" ||

        category ===
            "data" ||

        category ===
            "documents" ||

        category ===
            "business"

    ) {

        return permissions.check(
            "read_public_information"
        );
    }


    return permissions.check(
        "execute_external_code"
    );
}


// ============================================================
// BUILD EXECUTION CONTEXT
// ============================================================

function buildExecutionContext(
    brainResult,
    routing,
    intentResult,
    context = {}
) {

    return {

        ...context,

        brain: {

            request:
                brainResult.request,

            language:
                brainResult.language,

            memory:
                brainResult.memory,

            knowledge:
                brainResult.knowledge,

            thinkingContext:
                brainResult
                    .thinkingContext
        },

        memoryManagement: {

            decision:
                brainResult
                    .memory
                    ?.decision ||
                null,

            managedRecall:
                brainResult
                    .memory
                    ?.managed ||
                [],

            importantRecall:
                brainResult
                    .memory
                    ?.important ||
                [],

            verifiedRecall:
                brainResult
                    .memory
                    ?.verified ||
                []
        },

        routing: {

            selectedSkill:
                routing
                    .selectedSkill,

            matches:
                routing
                    .matches
        },

        intent: {

            category:
                intentResult
                    .category,

            intent:
                intentResult
                    .intent,

            parameters:
                intentResult
                    .parameters
        }
    };
}


// ============================================================
// DETERMINE MEMORY ACTION
// ============================================================

function determineMemoryAction(
    brainResult,
    context = {}
) {

    const decision =
        brainResult
            ?.memory
            ?.decision;


    if (
        !decision
    ) {

        return {

            action:
                "none",

            shouldStore:
                false,

            reason:
                "No memory decision available."
        };
    }


    if (
        context.remember ===
        false
    ) {

        return {

            action:
                "do-not-remember",

            shouldStore:
                false,

            reason:
                "Memory explicitly disabled by user."
        };
    }


    if (
        context.remember ===
        true
    ) {

        return {

            action:
                "remember",

            shouldStore:
                true,

            automatic:
                false,

            reason:
                "User explicitly requested memory.",

            type:
                decision.type,

            importance:
                decision.importance,

            importanceScore:
                decision.importanceScore,

            confidence:
                decision.confidence
        };
    }


    if (
        context.autoRemember ===
        true
    ) {

        if (
            decision.shouldRemember
        ) {

            return {

                action:
                    "auto-remember",

                shouldStore:
                    true,

                automatic:
                    true,

                reason:
                    decision.reason,

                type:
                    decision.type,

                importance:
                    decision.importance,

                importanceScore:
                    decision.importanceScore,

                confidence:
                    decision.confidence
            };
        }


        return {

            action:
                "auto-skip",

            shouldStore:
                false,

            automatic:
                true,

            reason:
                decision.reason
        };
    }


    return {

        action:
            "evaluate-only",

        shouldStore:
            false,

        automatic:
            false,

        reason:
            decision.reason,

        type:
            decision.type,

        importance:
            decision.importance,

        importanceScore:
            decision.importanceScore,

        confidence:
            decision.confidence
    };
}


// ============================================================
// STORE MEMORY
// ============================================================

function storeMemory(
    request,
    brainResult,
    memoryAction,
    context = {}
) {

    if (
        !memoryAction ||
        memoryAction.shouldStore !==
            true
    ) {

        return {

            success:
                true,

            stored:
                false,

            status:
                "memory-not-written",

            reason:
                memoryAction
                    ?.reason ||
                "Memory storage not requested."
        };
    }


    if (
        context.remember ===
        true
    ) {

        return memoryManager.remember({

            type:
                context.memoryType ||
                brainResult
                    ?.memory
                    ?.decision
                    ?.type,

            title:
                context.memoryTitle ||
                "AarHen User Memory",

            category:
                context.memoryCategory ||
                brainResult
                    ?.memory
                    ?.decision
                    ?.type ||
                "general",

            content:
                request,

            source:
                context.memorySource ||
                "user",

            importance:
                context.memoryImportance ||
                brainResult
                    ?.memory
                    ?.decision
                    ?.importance,

            confidence:
                typeof context.memoryConfidence ===
                "number"

                    ? context.memoryConfidence

                    : brainResult
                        ?.memory
                        ?.decision
                        ?.confidence,

            tags:
                Array.isArray(
                    context.memoryTags
                )

                    ? context.memoryTags

                    : [],

            verified:
                Boolean(
                    context.memoryVerified
                ),

            remember:
                true
        });
    }


    return memoryManager.autoRemember({

        type:
            brainResult
                ?.memory
                ?.decision
                ?.type,

        title:
            "AarHen Automatic Memory",

        category:
            brainResult
                ?.memory
                ?.decision
                ?.type ||
            "general",

        content:
            request,

        source:
            "automatic-memory",

        importance:
            brainResult
                ?.memory
                ?.decision
                ?.importance,

        confidence:
            brainResult
                ?.memory
                ?.decision
                ?.confidence,

        verified:
            false,

        remember:
            true
    });
}


// ============================================================
// DETECT AUTONOMOUS MODE
// ============================================================
//
// Autonomous mode is intentionally opt-in.
//
// Normal orchestrator requests continue to use the existing
// direct Executor pipeline.
//
// ============================================================

function shouldUseAutonomousWorker(
    context = {}
) {

    return (
        context &&
        context.autonomous ===
        true
    );
}


// ============================================================
// PREPARE AUTONOMOUS EXECUTION CONTEXT
// ============================================================
//
// The current orchestrator context is passed into the
// Autonomous Worker.
//
// This is important because:
// - Brain context is preserved.
// - Memory context is preserved.
// - Knowledge context is preserved.
// - Existing live research is preserved.
// - Worker Provider can reuse existing research context.
// - Unnecessary duplicate web searches are avoided.
// ============================================================

function buildAutonomousWorkerOptions(
    executionContext,
    context = {}
) {

    const autonomousOptions = {

        ...context,

        context: {

            ...executionContext

        }

    };


    // --------------------------------------------------------
    // Preserve autonomous flag inside worker context
    // --------------------------------------------------------

    autonomousOptions.context
        .autonomous =
            true;


    return autonomousOptions;
}


// ============================================================
// EXECUTE THROUGH AUTONOMOUS WORKER
// ============================================================

async function executeAutonomousWorker(
    request,
    executionContext,
    context = {}
) {

    if (
        !autonomousWorker ||
        typeof autonomousWorker
            .executeRequest !==
            "function"
    ) {

        return {

            success:
                false,

            stage:
                "autonomous-worker",

            error:
                "Autonomous Worker is unavailable."

        };
    }


    const options =
        buildAutonomousWorkerOptions(

            executionContext,

            context

        );


    try {

        const result =
            await autonomousWorker
                .executeRequest(

                    request,

                    options

                );


        return {

            success:
                result?.success ===
                    true,

            stage:
                result?.stage ||
                "autonomous-execution",

            autonomous:
                true,

            workerVersion:
                autonomousWorker
                    .AUTONOMOUS_WORKER_VERSION ||
                null,

            task:
                result?.task ||
                null,

            worker:
                result?.worker ||
                null,

            provider:
                result?.provider ||
                null,

            execution:
                result?.execution ||
                null,

            workerStatus:
                result?.workerStatus ||
                null,

            waitingApproval:
                result?.waitingApproval ===
                    true,

            result:
                result || null,

            error:
                result?.error ||
                null
        };

    } catch (error) {

        return {

            success:
                false,

            stage:
                "autonomous-worker-error",

            autonomous:
                true,

            workerVersion:
                autonomousWorker
                    .AUTONOMOUS_WORKER_VERSION ||
                null,

            error:
                error.message ||
                "Autonomous Worker execution failed.",

            task:
                null,

            worker:
                null,

            provider:
                null,

            execution:
                null,

            workerStatus:
                null
        };
    }
}


// ============================================================
// BUILD AUTONOMOUS RESULT
// ============================================================

function buildAutonomousOrchestrationResult(
    request,
    brainResult,
    routing,
    intentResult,
    permission,
    memoryAction,
    memoryWrite,
    researchResult,
    executionContext,
    autonomousExecution
) {

    const waitingApproval =
        autonomousExecution
            ?.waitingApproval ===
        true;


    const autonomousSuccess =
        autonomousExecution
            ?.success ===
        true;


    let status =
        "execution-error";


    if (
        waitingApproval
    ) {

        status =
            "approval-required";

    } else if (
        autonomousSuccess
    ) {

        status =
            "completed";

    } else if (
        autonomousExecution
            ?.execution
            ?.needsInput
    ) {

        status =
            "needs-user-input";
    }


    return {

        success:
            autonomousSuccess ||
            waitingApproval,

        request,

        brain:
            brainResult,

        routing,

        intent:
            intentResult,

        permission,

        memoryAction,

        memoryWrite,

        research:
            researchResult,

        executionContext,

        autonomous: {

            enabled:
                true,

            workerVersion:
                autonomousExecution
                    ?.workerVersion ||
                null,

            stage:
                autonomousExecution
                    ?.stage ||
                null,

            task:
                autonomousExecution
                    ?.task ||
                null,

            worker:
                autonomousExecution
                    ?.worker ||
                null,

            provider:
                autonomousExecution
                    ?.provider ||
                null,

            workerStatus:
                autonomousExecution
                    ?.workerStatus ||
                null,

            waitingApproval:
                waitingApproval,

            execution:
                autonomousExecution
                    ?.execution ||
                null
        },

        execution:
            autonomousExecution,

        status,

        timestamp:
            new Date().toISOString()

    };
}


// ============================================================
// PROCESS REQUEST
// ============================================================

async function process(
    input,
    context = {}
) {

    // --------------------------------------------------------
    // INPUT VALIDATION
    // --------------------------------------------------------

    if (
        !input ||
        typeof input !==
            "string"
    ) {

        return {

            success:
                false,

            error:
                "Invalid input."
        };
    }


    const request =
        input.trim();


    if (
        !request
    ) {

        return {

            success:
                false,

            error:
                "Input is empty."
        };
    }


    // --------------------------------------------------------
    // MASTER BRAIN
    // --------------------------------------------------------

    const brainResult =
        Brain.think(
            request,
            context
        );


    if (
        !brainResult.success
    ) {

        return brainResult;
    }


    // --------------------------------------------------------
    // SKILL ROUTING
    // --------------------------------------------------------

    const routing =
        selectSkill(
            request
        );


    if (
        !routing.success
    ) {

        return routing;
    }


    // --------------------------------------------------------
    // INTENT ANALYSIS
    // --------------------------------------------------------

    let intentResult =
        intent.analyzeIntent(
            request
        );


    if (
        !intentResult.success
    ) {

        return intentResult;
    }


    // --------------------------------------------------------
    // EXPLICIT CONTEXT INTENT OVERRIDE
    // --------------------------------------------------------

    if (
        String(
            context.intent || ""
        )
            .toLowerCase() ===
        "research"
    ) {

        intentResult = {

            ...intentResult,

            success:
                true,

            category:
                "research",

            intent:
                "web_research",

            parameters: {

                ...(
                    intentResult.parameters ||
                    {}
                ),

                maxSources:
                    Number(
                        context.maxResearchSources
                    ) || 5
            }
        };
    }


    // --------------------------------------------------------
    // LIVE WEB RESEARCH DECISION
    // --------------------------------------------------------

    const researchDecision =
        shouldResearch(

            request,

            intentResult,

            routing,

            context

        );


    // --------------------------------------------------------
    // DEFAULT RESEARCH RESULT
    // --------------------------------------------------------

    let researchResult = {

        success:
            true,

        required:
            false,

        status:
            "research-not-required",

        research:
            null,

        context:
            null,

        sources:
            [],

        sourceCount:
            0,

        confidence:
            0,

        verified:
            false,

        verificationStatus:
            "not-researched",

        reason:
            researchDecision.reason

    };


    // --------------------------------------------------------
    // LIVE WEB RESEARCH
    // --------------------------------------------------------

    if (
        researchDecision.required
    ) {

        researchResult =
            await performResearch(

                request,

                context

            );


        researchResult.required =
            true;


        researchResult.reason =
            researchDecision.reason;


        if (
            !researchResult.success
        ) {

            return {

                success:
                    false,

                request,

                brain:
                    brainResult,

                routing,

                intent:
                    intentResult,

                research:
                    researchResult,

                status:
                    "research-failed",

                error:
                    researchResult.error,

                message:
                    "AarHen could not complete the required live web research.",

                timestamp:
                    new Date().toISOString()
            };
        }
    }


    // --------------------------------------------------------
    // PERMISSION
    // --------------------------------------------------------

    const permission =
        determinePermission(

            intentResult,

            routing

        );


    // --------------------------------------------------------
    // MEMORY ACTION DECISION
    // --------------------------------------------------------

    const memoryAction =
        determineMemoryAction(

            brainResult,

            context

        );


    // --------------------------------------------------------
    // EXECUTION CONTEXT
    // --------------------------------------------------------

    const executionContext =
        buildExecutionContext(

            brainResult,

            routing,

            intentResult,

            context

        );


    executionContext
        .memoryAction =
            memoryAction;


    // --------------------------------------------------------
    // RESEARCH CONTEXT INJECTION
    // --------------------------------------------------------

    executionContext
        .research = {

            required:
                researchResult.required,

            reason:
                researchResult.reason,

            success:
                researchResult.success,

            status:
                researchResult.status,

            query:
                researchResult.query ||
                request,

            provider:
                researchResult.provider ||
                null,

            sources:
                researchResult.sources ||
                [],

            sourceCount:
                researchResult.sourceCount ||
                0,

            confidence:
                researchResult.confidence ||
                0,

            verified:
                Boolean(
                    researchResult.verified
                ),

            verificationStatus:
                researchResult
                    .verificationStatus ||
                "not-researched",

            verification:
                researchResult
                    .verification ||
                null,

            learning:
                researchResult.learning ||
                null,

            result:
                researchResult.research ||
                null,

            context:
                researchResult.context ||
                null
        };


    // --------------------------------------------------------
    // MEMORY WRITE
    // --------------------------------------------------------

    let memoryWrite = {

        success:
            true,

        stored:
            false,

        status:
            "memory-not-written",

        reason:
            "Memory storage not requested."

    };


    if (
        memoryAction.shouldStore ===
        true
    ) {

        memoryWrite =
            storeMemory(

                request,

                brainResult,

                memoryAction,

                context

            );
    }


    executionContext
        .memoryWrite =
            memoryWrite;


    // ========================================================
    // AUTONOMOUS WORKER MODE
    // ========================================================
    //
    // IMPORTANT:
    // This is placed BEFORE the existing direct-executor
    // approval/execution block so that Autonomous Worker owns
    // the full Agent Planner → Manager → Worker → Runner flow.
    //
    // Existing non-autonomous behavior remains unchanged.
    //
    // ========================================================

    if (
        shouldUseAutonomousWorker(
            context
        )
    ) {

        const autonomousExecution =
            await executeAutonomousWorker(

                request,

                executionContext,

                context

            );


        const autonomousResult =
            buildAutonomousOrchestrationResult(

                request,

                brainResult,

                routing,

                intentResult,

                permission,

                memoryAction,

                memoryWrite,

                researchResult,

                executionContext,

                autonomousExecution

            );


        autonomousResult.response =
            responseEngine
                .createResponse(
                    autonomousResult
                );


        return autonomousResult;
    }


    // --------------------------------------------------------
    // EXISTING APPROVAL REQUIRED
    // --------------------------------------------------------

    if (
        permission.requiresApproval
    ) {

        const approvalResult = {

            success:
                true,

            request,

            brain:
                brainResult,

            routing,

            intent:
                intentResult,

            permission,

            memoryAction,

            memoryWrite,

            research:
                researchResult,

            executionContext,

            execution:
                null,

            status:
                "approval-required",

            message:
                "AarHen requires user approval before performing this action.",

            timestamp:
                new Date().toISOString()
        };


        return {

            ...approvalResult,

            response:
                responseEngine
                    .createResponse(
                        approvalResult
                    )
        };
    }


    // --------------------------------------------------------
    // EXISTING SKILL EXECUTION
    // --------------------------------------------------------

    const execution =
        await executor
            .executeIntent({

                ...intentResult,

                context:
                    executionContext
            });


    // --------------------------------------------------------
    // FINAL RESEARCH RESULT
    // --------------------------------------------------------
    //
    // Prefer executor standardized research output when
    // available, while preserving orchestrator metadata.
    //
    // --------------------------------------------------------

    const finalResearchResult =
        intentResult.category ===
            "research" &&
        execution?.research

            ? {

                ...researchResult,

                ...execution.research,

                sources:
                    Array.isArray(
                        execution.research
                            .sources
                    ) &&
                    execution.research
                        .sources.length >
                        0

                        ? execution.research
                            .sources

                        : researchResult
                            .sources,

                sourceCount:
                    Array.isArray(
                        execution.research
                            .sources
                    ) &&
                    execution.research
                        .sources.length >
                        0

                        ? execution.research
                            .sources.length

                        : researchResult
                            .sourceCount

            }

            : researchResult;


    // --------------------------------------------------------
    // FINAL RESULT
    // --------------------------------------------------------

    const orchestrationResult = {

        success:
            execution.success !==
                false,

        request,

        brain:
            brainResult,

        routing,

        intent:
            intentResult,

        permission,

        memoryAction,

        memoryWrite,

        research:
            finalResearchResult,

        executionContext,

        execution,

        autonomous: {

            enabled:
                false,

            workerVersion:
                autonomousWorker
                    ?.AUTONOMOUS_WORKER_VERSION ||
                null
        },

        status:

            execution.success

                ? "completed"

                : execution.needsInput

                    ? "needs-user-input"

                    : "execution-error",

        timestamp:
            new Date().toISOString()

    };


    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    orchestrationResult.response =
        responseEngine
            .createResponse(
                orchestrationResult
            );


    return orchestrationResult;
}


// ============================================================
// ORCHESTRATE
// ============================================================

async function orchestrate(
    input,
    context = {}
) {

    return process(
        input,
        context
    );
}


// ============================================================
// ORCHESTRATOR STATUS
// ============================================================

function getStatus() {

    const autonomousStatus =
        autonomousWorker &&
        typeof autonomousWorker
            .getStatus ===
            "function"

            ? autonomousWorker.getStatus()

            : null;


    return {

        name:
            "AarHen Master Orchestrator",

        version:
            ORCHESTRATOR_VERSION,

        status:
            "active",

        connectedLayers: [

            "Master Brain",

            "Language Engine",

            "Advanced Long-Term Memory",

            "Advanced Memory Manager",

            "Automatic Memory Writer",

            "Memory Decision Engine",

            "RAG Knowledge Engine",

            "Verification Engine",

            "Continuous Learning Engine",

            "Permission & Safety Brain",

            "Skill Registry",

            "Skill Router",

            "Intent Engine",

            "Parameter Extraction",

            "Skill Executor",

            "Engine Handlers",

            "Research API",

            "Research Provider",

            "Provider Manager",

            "Provider Bridge",

            "Worker Provider",

            "Agent Runner",

            "Agent Worker",

            "Agent Manager",

            "Agent Planner",

            "Autonomous Agent",

            "Autonomous Worker",

            "Response Engine"

        ],

        workflow: [

            "Input",

            "Brain Analysis",

            "Memory Recall",

            "Memory Management",

            "Memory Decision",

            "Live Research Decision",

            "Live Web Research",

            "Source Collection",

            "Source Normalization",

            "Research Context Injection",

            "RAG Retrieval",

            "Skill Routing",

            "Intent Analysis",

            "Permission Check",

            "Context Injection",

            "Memory Write",

            "Autonomous Mode Check",

            "Autonomous Worker",

            "Agent Planning",

            "Agent Manager",

            "Agent Worker",

            "Worker Provider",

            "Provider Bridge",

            "Provider Manager",

            "Agent Runner",

            "Skill Execution",

            "Response Generation"

        ],

        researchSystem: {

            enabled:
                true,

            liveWebSearch:
                true,

            provider:
                "Tavily",

            automaticDecision:
                true,

            explicitResearch:
                true,

            currentInformationDetection:
                true,

            sourceCollection:
                true,

            sourceNormalization:
                true,

            confidenceTracking:
                true,

            verificationRequired:
                true,

            researchFailureProtection:
                true
        },

        memorySystem: {

            manager:
                "Advanced Memory Manager",

            decision:
                "Automatic Memory Decision",

            automaticWrite:
                true,

            explicitRemember:
                true,

            explicitDisable:
                true,

            duplicateProtection:
                true,

            importanceTracking:
                true,

            confidenceTracking:
                true,

            automaticMode:
                "opt-in",

            safeDefault:
                "evaluate-only"
        },

        autonomousSystem: {

            enabled:
                true,

            mode:
                "opt-in",

            activation:
                "context.autonomous === true",

            connected:
                Boolean(
                    autonomousStatus &&
                    autonomousStatus
                        .success ===
                    true
                ),

            version:
                autonomousStatus
                    ?.version ||
                autonomousWorker
                    ?.AUTONOMOUS_WORKER_VERSION ||
                null,

            status:
                autonomousStatus
                    ?.status ||
                null,

            agent:
                autonomousStatus
                    ?.systems
                    ?.autonomousAgent ||
                null,

            worker:
                autonomousStatus
                    ?.systems
                    ?.agentWorker ||
                null,

            workerProvider:
                autonomousStatus
                    ?.systems
                    ?.workerProvider ||
                null

        }

    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    ORCHESTRATOR_VERSION,

    process,

    orchestrate,

    selectSkill,

    shouldResearch,

    performResearch,

    determinePermission,

    determineMemoryAction,

    storeMemory,

    buildExecutionContext,

    shouldUseAutonomousWorker,

    buildAutonomousWorkerOptions,

    executeAutonomousWorker,

    buildAutonomousOrchestrationResult,

    getStatus

};
