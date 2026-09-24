// ============================================================
// AARHEN CORE V5
// AGENT PLANNER
// ============================================================
// Version: 5.8.1
//
// Purpose:
// - Convert a user request into a controlled agent plan
// - Use AarHen intent detection
// - Use existing skill routing
// - Use Permission & Safety Brain
// - Build safe multi-step task plans
// - Pass plans to Agent Manager
//
// Important:
// This module creates plans only.
// It does NOT execute actions.
// ============================================================

const intent =
    require("./intent");

const router =
    require("../skills/router");

const permissions =
    require("./permissions");

const agentManager =
    require("./agentManager");


const AGENT_PLANNER_VERSION =
    "5.8.1";


// ============================================================
// HELPERS
// ============================================================

function safeObject(value) {

    return (
        value &&
        typeof value === "object"
    )
        ? value
        : {};
}


function safeArray(value) {

    return Array.isArray(value)
        ? value
        : [];
}


function safeString(value) {

    return String(
        value ?? ""
    ).trim();
}


function normalizeLimit(
    value,
    fallback = 10,
    maximum = 25
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number <= 0
    ) {

        return fallback;
    }

    return Math.min(
        Math.floor(number),
        maximum
    );
}


// ============================================================
// ACTION PERMISSION
// ============================================================

function getActionPermission(
    action
) {

    const result =
        permissions.check(
            action
        );

    return {

        action,

        policy:
            result.policy,

        requiresApproval:
            result.requiresApproval,

        approved:
            result.requiresApproval !== true
    };
}


// ============================================================
// CREATE STEP
// ============================================================

function createStep(
    name,
    description,
    action,
    input = {},
    options = {}
) {

    const config =
        safeObject(
            options
        );


    const permission =
        getActionPermission(
            action
        );


    const requiresApproval =
        config.requiresApproval === true ||
        permission.requiresApproval;


    return {

        name:
            safeString(
                name
            ),

        description:
            safeString(
                description
            ),

        action,

        input:
            safeObject(
                input
            ),

        requiresApproval,

        approved:
            requiresApproval
                ? config.approved === true
                : true,

        maxRetries:
            Number(
                config.maxRetries
            ) >= 0
                ? Math.min(
                    Math.floor(
                        Number(
                            config.maxRetries
                        )
                    ),
                    10
                )
                : 0,

        metadata: {

            planner:
                "AarHen Agent Planner",

            plannerVersion:
                AGENT_PLANNER_VERSION,

            permissionPolicy:
                permission.policy,

            ...safeObject(
                config.metadata
            )
        }

    };
}


// ============================================================
// BUILD PLAN FROM INTENT
// ============================================================

function buildPlan(
    request,
    intentResult = {},
    routingResult = {},
    options = {}
) {

    const cleanRequest =
        safeString(
            request
        );

    if (!cleanRequest) {

        return {

            success: false,

            error:
                "Request is required.",

            plan:
                []
        };
    }


    const detectedIntent =
        safeObject(
            intentResult
        );


    const detectedRouting =
        safeObject(
            routingResult
        );


    const category =
        safeString(
            detectedIntent.category
        ).toLowerCase() ||
        "general";


    const intentName =
        safeString(
            detectedIntent.intent
        ) ||
        "general_request";


    const selectedSkill =
        safeObject(
            detectedRouting.selectedSkill
        );


    const parameters =
        safeObject(
            detectedIntent.parameters
        );


    const context =
        safeObject(
            options.context
        );


    const maxSteps =
        normalizeLimit(
            options.maxSteps,
            10,
            25
        );


    const plan = [];


    // ========================================================
    // FINANCE
    // ========================================================

    if (
        category === "finance"
    ) {

        plan.push(

            createStep(

                "Analyze finance request",

                "Analyze the financial request and identify the required calculation or finance operation.",

                "read_public_information",

                {

                    request:
                        cleanRequest,

                    intent:
                        intentName,

                    parameters

                }

            )

        );


        plan.push(

            createStep(

                "Process finance result",

                "Process the requested finance calculation or vehicle-finance information.",

                intentName === "calculate_emi" ||
                intentName === "calculate_loan_from_emi" ||
                intentName === "simple_interest"
                    ? "calculate"
                    : "search_knowledge",

                {

                    request:
                        cleanRequest,

                    intent:
                        intentName,

                    parameters

                }

            )

        );
    }


    // ========================================================
    // CALCULATION
    // ========================================================

    else if (
        category === "calculation"
    ) {

        plan.push(

            createStep(

                "Calculate request",

                "Perform the requested mathematical calculation.",

                "calculate",

                {

                    request:
                        cleanRequest,

                    intent:
                        intentName

                }

            )

        );
    }


    // ========================================================
    // RESEARCH
    // ========================================================

    else if (
        category === "research"
    ) {

        plan.push(

            createStep(

                "Research request",

                "Gather current public information relevant to the user's request.",

                "read_public_information",

                {

                    request:
                        cleanRequest,

                    intent:
                        intentName

                }

            )

        );


        plan.push(

            createStep(

                "Verify research",

                "Review the gathered information and prepare a verified research result.",

                "read_public_information",

                {

                    request:
                        cleanRequest,

                    verification:
                        true

                }

            )

        );
    }


    // ========================================================
    // KNOWLEDGE
    // ========================================================

    else if (
        category === "knowledge"
    ) {

        plan.push(

            createStep(

                "Search AarHen knowledge",

                "Search saved AarHen knowledge for relevant information.",

                "search_knowledge",

                {

                    request:
                        cleanRequest

                }

            )

        );
    }


    // ========================================================
    // DOCUMENTS
    // ========================================================

    else if (
        category === "documents"
    ) {

        plan.push(

            createStep(

                "Read document knowledge",

                "Retrieve relevant information from the available document knowledge layer.",

                "search_knowledge",

                {

                    request:
                        cleanRequest,

                    documentAware:
                        true

                }

            )

        );


        plan.push(

            createStep(

                "Prepare document answer",

                "Build an answer using the retrieved document knowledge and RAG context.",

                "search_knowledge",

                {

                    request:
                        cleanRequest,

                    documentAnswer:
                        true

                }

            )

        );
    }


    // ========================================================
    // BUSINESS
    // ========================================================

    else if (
        category === "business"
    ) {

        plan.push(

            createStep(

                "Analyze business request",

                "Analyze the business request using AarHen business knowledge.",

                "search_knowledge",

                {

                    request:
                        cleanRequest,

                    business:
                        true

                }

            )

        );


        plan.push(

            createStep(

                "Prepare business result",

                "Prepare a structured result using available business knowledge and context.",

                "search_knowledge",

                {

                    request:
                        cleanRequest,

                    business:
                        true,

                    selectedSkill:
                        selectedSkill.name ||
                        null

                }

            )

        );
    }


    // ========================================================
    // DATA
    // ========================================================

    else if (
        category === "data"
    ) {

        plan.push(

            createStep(

                "Analyze data request",

                "Analyze the requested dataset or data operation.",

                "execute_external_code",

                {

                    request:
                        cleanRequest

                }

            )

        );
    }


    // ========================================================
    // CODING
    // ========================================================

    else if (
        category === "coding"
    ) {

        plan.push(

            createStep(

                "Analyze coding request",

                "Analyze the programming request and identify the required code operation.",

                "execute_external_code",

                {

                    request:
                        cleanRequest

                }

            )

        );


        plan.push(

            createStep(

                "Prepare coding result",

                "Prepare the requested code or debugging result.",

                "execute_external_code",

                {

                    request:
                        cleanRequest

                }

            )
        );
    }


    // ========================================================
    // SECURITY
    // ========================================================

    else if (
        category === "security"
    ) {

        plan.push(

            createStep(

                "Review security request",

                "Review the cybersecurity request under AarHen safety controls.",

                "security_testing_against_external_target",

                {

                    request:
                        cleanRequest

                }

            )

        );
    }


    // ========================================================
    // GENERAL
    // ========================================================

    else {

        plan.push(

            createStep(

                "Understand request",

                "Analyze the user's request and determine the appropriate next action.",

                "search_knowledge",

                {

                    request:
                        cleanRequest

                }

            )

        );
    }


    // ========================================================
    // LIMIT PLAN
    // ========================================================

    const limitedPlan =
        plan.slice(
            0,
            maxSteps
        );


    // ========================================================
    // PLAN METADATA
    // ========================================================

    const approvalRequired =
        limitedPlan.some(
            step =>
                step.requiresApproval &&
                !step.approved
        );


    return {

        success:
            true,

        request:
            cleanRequest,

        category,

        intent:
            intentName,

        selectedSkill:
            selectedSkill.name ||
            null,

        plan:
            limitedPlan,

        stepCount:
            limitedPlan.length,

        approvalRequired,

        autonomous:
            options.autonomous !== false,

        context,

        planner:
            {

                name:
                    "AarHen Agent Planner",

                version:
                    AGENT_PLANNER_VERSION

            }

    };
}


// ============================================================
// ANALYZE REQUEST
// ============================================================

function analyzeRequest(
    request
) {

    const cleanRequest =
        safeString(
            request
        );

    if (!cleanRequest) {

        return {

            success: false,

            error:
                "Request is required."
        };
    }


    const intentResult =
        intent.analyzeIntent(
            cleanRequest
        );


    const routingResult =
        router.route(
            cleanRequest
        );


    return {

        success: true,

        request:
            cleanRequest,

        intent:
            intentResult,

        routing:
            routingResult

    };
}


// ============================================================
// PLAN REQUEST
// ============================================================

function planRequest(
    request,
    options = {}
) {

    const analysis =
        analyzeRequest(
            request
        );


    if (
        !analysis.success
    ) {

        return analysis;
    }


    return buildPlan(

        request,

        analysis.intent,

        analysis.routing,

        options

    );
}


// ============================================================
// CREATE PLANNED TASK
// ============================================================
//
// Creates an Agent Manager task and immediately attaches
// the generated plan.
//
// No execution happens here.
// ============================================================

function createPlannedTask(
    agentId,
    request,
    options = {}
) {

    const cleanRequest =
        safeString(
            request
        );

    if (!cleanRequest) {

        return {

            success: false,

            error:
                "Request is required.",

            task:
                null,

            plan:
                null
        };
    }


    const config =
        safeObject(
            options
        );


    const createdTask =
        agentManager.createTask(

            agentId,

            cleanRequest,

            {

                ...config,

                autonomy:
                    config.autonomy !== false

            }

        );


    if (
        !createdTask.success
    ) {

        return {

            success: false,

            error:
                createdTask.error ||
                "Agent task creation failed.",

            task:
                null,

            plan:
                null
        };
    }


    const planned =
        planRequest(

            cleanRequest,

            config

        );


    if (
        !planned.success
    ) {

        return {

            success: false,

            error:
                planned.error ||
                "Agent planning failed.",

            task:
                createdTask.task,

            plan:
                null
        };
    }


    const planResult =
        agentManager.planTask(

            createdTask.task.id,

            planned.plan

        );


    if (
        !planResult.success
    ) {

        return {

            success: false,

            error:
                planResult.error ||
                "Agent Manager rejected the plan.",

            task:
                planResult.task ||
                createdTask.task,

            plan:
                planned

        };
    }


    return {

        success: true,

        task:
            planResult.task,

        plan:
            planned,

        analysis:
            {

                intent:
                    planned.intent,

                category:
                    planned.category,

                selectedSkill:
                    planned.selectedSkill

            }

    };
}


// ============================================================
// GET PLAN SUMMARY
// ============================================================

function getPlanSummary(
    planResult = {}
) {

    const result =
        safeObject(
            planResult
        );


    const plan =
        safeArray(
            result.plan
        );


    return {

        success:
            result.success === true,

        plannerVersion:
            AGENT_PLANNER_VERSION,

        request:
            result.request ||
            "",

        category:
            result.category ||
            null,

        intent:
            result.intent ||
            null,

        selectedSkill:
            result.selectedSkill ||
            null,

        stepCount:
            plan.length,

        approvalRequired:
            plan.some(
                step =>
                    step.requiresApproval &&
                    !step.approved
            ),

        approvedSteps:
            plan.filter(
                step =>
                    step.approved === true
            ).length,

        pendingApprovalSteps:
            plan.filter(
                step =>
                    step.requiresApproval &&
                    !step.approved
            ).length,

        actions:
            plan.map(
                step =>
                    step.action
            )
    };
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    const agentStatus =
        agentManager.getStatus();


    return {

        success: true,

        version:
            AGENT_PLANNER_VERSION,

        status:
            "active",

        agentManager:

            {

                connected:
                    agentStatus.success === true,

                version:
                    agentStatus.version ||
                    null

            },

        intentSystem:

            {

                connected:
                    typeof intent.analyzeIntent ===
                    "function"

            },

        routerSystem:

            {

                connected:
                    typeof router.route ===
                    "function"

            },

        permissionSystem:

            {

                connected:
                    typeof permissions.check ===
                    "function"

            }

    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    AGENT_PLANNER_VERSION,

    createStep,

    getActionPermission,

    analyzeRequest,

    buildPlan,

    planRequest,

    createPlannedTask,

    getPlanSummary,

    getStatus

};
