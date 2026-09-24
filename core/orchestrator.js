// ============================================================
// AARHEN CORE V5
// MASTER ORCHESTRATOR
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

        success: true,

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
        String(context.intent || "").toLowerCase() === "research"
    ) {

        return {

            required: true,

            reason:
                "Live research explicitly requested by context."
        };
    }


    if (
        context.research === false
    ) {

        return {

            required: false,

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
        category === "research"
    ) {

        return {

            required: true,

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
        skillCategory === "research" ||
        skillName.includes("research") ||
        skillName.includes("web-search") ||
        skillName.includes("web_search")
    ) {

        return {

            required: true,

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

    if (matchedSignal) {

        return {

            required: true,

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

    if (matchedKeyword) {

        return {

            required: true,

            reason:
                `Research keyword detected: ${matchedKeyword}.`
        };
    }


    return {

        required: false,

        reason:
            "Live web research not required."
    };
}


// ============================================================
// COLLECT RESEARCH SOURCES
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

    for (const candidate of candidates) {

        if (
            Array.isArray(candidate) &&
            candidate.length > 0
        ) {

            return candidate;
        }
    }

    return [];
}


// ============================================================
// NORMALIZE RESEARCH RESULT
// ============================================================

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
                (source, index) => {

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
                            typeof source.score === "number"
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
        rawResearch.verified === true ||
        result?.verified === true ||
        verification?.verified === true ||
        verificationStatus === "verified";


    if (verified) {

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
        typeof rawResearch.confidence === "number"
            ? rawResearch.confidence
            : typeof result?.confidence === "number"
                ? result.confidence
                : 0;


    if (
        confidence > 1
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
            rawResearch.success !== false &&
            result?.success !== false,

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
                rawResearch.previousKnowledgeAvailable ||
                result?.previousKnowledgeAvailable
            ),

        previousVerifiedKnowledgeAvailable:
            Boolean(
                rawResearch.previousVerifiedKnowledgeAvailable ||
                result?.previousVerifiedKnowledgeAvailable
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
            result.success !== true
        ) {

            return {

                success: false,

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
        // IMPORTANT:
        // Convert whatever Research API returns into one
        // stable research object.
        // ----------------------------------------------------

        const standardizedResearch =
            normalizeResearchResult(
                result,
                request
            );


        return {

            success: true,

            query:
                request,

            research:
                standardizedResearch,

            context:
                result.context ||
                standardizedResearch.raw?.context ||
                null,

            provider:
                standardizedResearch.provider,

            sources:
                standardizedResearch.sources,

            sourceCount:
                standardizedResearch.sourceCount,

            confidence:
                standardizedResearch.confidence,

            verified:
                standardizedResearch.verified,

            verificationStatus:
                standardizedResearch.verificationStatus,

            verification:
                standardizedResearch.verification,

            learning:
                standardizedResearch.learning,

            status:
                standardizedResearch.researchStatus
        };

    } catch (error) {

        return {

            success: false,

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


    const skill =
        routing.selectedSkill;


    if (
        skill.category === "coding"
    ) {

        return permissions.check(
            "execute_external_code"
        );
    }


    if (
        skill.category === "research"
    ) {

        return permissions.check(
            "web_access"
        );
    }


    return {

        allowed: true,

        requiresApproval: false,

        reason:
            "No special permission required."
    };
}


// ============================================================
// DETERMINE MEMORY ACTION
// ============================================================

function determineMemoryAction(
    brainResult,
    context = {}
) {

    if (
        context.remember === true
    ) {

        return {

            shouldStore: true,

            reason:
                "Explicit memory request.",

            mode:
                "explicit"
        };
    }


    if (
        context.remember === false
    ) {

        return {

            shouldStore: false,

            reason:
                "Memory storage explicitly disabled.",

            mode:
                "disabled"
        };
    }


    if (
        brainResult &&
        brainResult.memoryDecision
    ) {

        return {

            shouldStore:
                brainResult.memoryDecision.remember === true,

            reason:
                brainResult.memoryDecision.reason ||
                "Brain memory decision.",

            mode:
                "automatic"
        };
    }


    return {

        shouldStore: false,

        reason:
            "No memory decision available.",

        mode:
            "evaluate-only"
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
        memoryAction.shouldStore !== true
    ) {

        return {

            success: true,

            stored: false,

            status:
                "memory-not-written"
        };
    }


    try {

        const result =
            memoryManager.remember({

                content:
                    request,

                title:
                    context.memoryTitle ||
                    "AarHen Interaction Memory",

                category:
                    context.memoryCategory ||
                    "conversation",

                source:
                    context.memorySource ||
                    "orchestrator",

                importance:
                    context.memoryImportance ||
                    "normal",

                confidence:
                    brainResult?.confidence ||
                    0.60,

                verified:
                    Boolean(
                        brainResult?.verified
                    )
            });


        return {

            success: true,

            stored: true,

            status:
                result?.status ||
                "memory-stored",

            memoryId:
                result?.memoryId ||
                result?.id ||
                null,

            duplicate:
                Boolean(
                    result?.duplicate
                ),

            result
        };

    } catch (error) {

        return {

            success: false,

            stored: false,

            status:
                "memory-write-error",

            error:
                error.message
        };
    }
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

        brain:
            brainResult,

        routing,

        intent:
            intentResult,

        userContext:
            context,

        memory:
            brainResult?.memory ||
            null,

        knowledge:
            brainResult?.knowledge ||
            null
    };
}


// ============================================================
// MAIN PROCESS
// ============================================================

async function process(
    input,
    context = {}
) {

    const request =
        typeof input === "string"
            ? input
            : input?.request ||
              input?.query ||
              "";


    if (!request.trim()) {

        return {

            success: false,

            error:
                "AarHen requires a request.",

            status:
                "invalid-request"
        };
    }


    // --------------------------------------------------------
    // BRAIN
    // --------------------------------------------------------

    const brainResult =
        await Brain.think(
            request,
            context
        );


    // --------------------------------------------------------
    // ROUTING
    // --------------------------------------------------------

    const routing =
        selectSkill(
            request
        );


    // --------------------------------------------------------
    // INTENT
    // --------------------------------------------------------

    const intentResult =
        intent.analyzeIntent(
            request
        );


    // --------------------------------------------------------
    // RESEARCH DECISION
    // --------------------------------------------------------

    const researchDecision =
        shouldResearch(
            request,
            intentResult,
            routing,
            context
        );


    // --------------------------------------------------------
    // LIVE RESEARCH
    // --------------------------------------------------------

    let researchResult = {

        required:
            researchDecision.required,

        reason:
            researchDecision.reason,

        success:
            false,

        status:
            "not-researched",

        query:
            request,

        provider:
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

        verification:
            null,

        learning:
            null,

        research:
            null,

        context:
            null
    };


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

        researchResult.query =
            researchResult.query ||
            request;
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
    // MEMORY ACTION
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
                researchResult.verification ||
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

        success: true,

        stored:
            false,

        status:
            "memory-not-written",

        reason:
            "Memory storage not requested."
    };


    if (
        memoryAction.shouldStore === true
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


    // --------------------------------------------------------
    // APPROVAL REQUIRED
    // --------------------------------------------------------

    if (
        permission.requiresApproval
    ) {

        const approvalResult = {

            success: true,

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
    // EXECUTE SKILL
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

    const finalResearchResult =
        intentResult.category === "research" &&
        execution?.research
            ? {

                ...researchResult,

                ...execution.research,

                sources:
                    Array.isArray(
                        execution.research.sources
                    ) &&
                    execution.research.sources.length > 0

                        ? execution.research.sources

                        : researchResult.sources,

                sourceCount:
                    Array.isArray(
                        execution.research.sources
                    ) &&
                    execution.research.sources.length > 0

                        ? execution.research.sources.length

                        : researchResult.sourceCount
            }

            : researchResult;


    // --------------------------------------------------------
    // ORCHESTRATION RESULT
    // --------------------------------------------------------

    const orchestrationResult = {

        success:
            execution.success !== false,

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

    return {

        name:
            "AarHen Master Orchestrator",

        version:
            "5.0.0",

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

            "Research Engine",

            "Research Provider",

            "Tavily Web Search",

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
        }
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    process,

    orchestrate,

    selectSkill,

    shouldResearch,

    performResearch,

    determinePermission,

    determineMemoryAction,

    storeMemory,

    buildExecutionContext,

    getStatus
};
