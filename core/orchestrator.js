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

    // --------------------------------------------------------
    // Explicit research request from caller
    // --------------------------------------------------------

    if (
        context.research === true ||
        context.intent === "research"
    ) {

        return {

            required: true,

            reason:
                "Live research explicitly requested by context."
        };
    }


    // --------------------------------------------------------
    // Explicitly disable research
    // --------------------------------------------------------

    if (
        context.research === false
    ) {

        return {

            required: false,

            reason:
                "Live research explicitly disabled by context."
        };
    }


    // --------------------------------------------------------
    // Intent category
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Selected research skill
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Current/fresh information signals
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Research intent keywords
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Default
    // --------------------------------------------------------

    return {

        required: false,

        reason:
            "Live web research not required."
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
                    null
            };
        }

        return {

            success: true,

            query:
                request,

            research:
                result.research,

            context:
                result.context,

            provider:
                result.provider,

            sourceCount:
                result.sourceCount,

            confidence:
                result.confidence,

            verified:
                result.verified,

            verificationStatus:
                result.verificationStatus,

            status:
                result.status
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
                null
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

    if (!routing.selectedSkill) {

        return permissions.check(
            "execute_external_code"
        );
    }

    const category =
        routing
            .selectedSkill
            .category;

    if (
        category === "security"
    ) {

        return permissions.check(
            "security_testing_against_external_target"
        );
    }

    if (
        category === "coding"
    ) {

        return permissions.check(
            "execute_external_code"
        );
    }

    if (

        category === "finance" ||

        category === "calculation" ||

        category === "knowledge" ||

        category === "research" ||

        category === "data" ||

        category === "documents" ||

        category === "business"
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
                    ?.decision || null,

            managedRecall:
                brainResult
                    .memory
                    ?.managed || [],

            importantRecall:
                brainResult
                    .memory
                    ?.important || [],

            verifiedRecall:
                brainResult
                    .memory
                    ?.verified || []
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

    if (!decision) {

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
        context.remember === false
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
        context.remember === true
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
        context.autoRemember === true
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
        memoryAction.shouldStore !== true
    ) {

        return {

            success: true,

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
        context.remember === true
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
        typeof input !== "string"
    ) {

        return {

            success: false,

            error:
                "Invalid input."
        };
    }

    const request =
        input.trim();

    if (!request) {

        return {

            success: false,

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

    if (!brainResult.success) {

        return brainResult;
    }


    // --------------------------------------------------------
    // SKILL ROUTING
    // --------------------------------------------------------

    const routing =
        selectSkill(
            request
        );

    if (!routing.success) {

        return routing;
    }


    // --------------------------------------------------------
    // INTENT ANALYSIS
    // --------------------------------------------------------

    let intentResult =
        intent.analyzeIntent(
            request
        );

    if (!intentResult.success) {

        return intentResult;
    }


    // ========================================================
    // EXPLICIT CONTEXT INTENT OVERRIDE
    // ========================================================

    // The /research API sends:
    //
    // context.intent = "research"
    //
    // Normal /ask requests continue to use automatic
    // intent detection from core/intent.js.

    if (
        String(
            context.intent || ""
        )
            .toLowerCase() === "research"
    ) {

        intentResult = {

            ...intentResult,

            success: true,

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
    // LIVE WEB RESEARCH
    // --------------------------------------------------------

    let researchResult = {

        success: true,

        required:
            false,

        status:
            "research-not-required",

        research:
            null,

        context:
            null,

        reason:
            researchDecision.reason
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

        if (
            !researchResult.success
        ) {

            return {

                success: false,

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
    // FINAL RESULT
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
            researchResult,

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
