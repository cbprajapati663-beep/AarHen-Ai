// ============================================================
// AARHEN CORE V5
// AGENT RUNNER
// ============================================================
// Version: 5.8.2
//
// Purpose:
// - Execute Agent Manager tasks through controlled runners
// - Connect Agent Manager with existing Skill Executor
// - Re-check permissions before every action
// - Convert planned agent steps into existing AarHen intents
// - Preserve task context
// - Prevent uncontrolled arbitrary execution
// - Provide safe custom action handlers
//
// Important:
// This module does NOT directly execute arbitrary JavaScript.
// Every action is permission-checked before execution.
// ============================================================

const agentManager =
    require("./agentManager");

const executor =
    require("../skills/executor");

const permissions =
    require("./permissions");

const intent =
    require("./intent");

const AGENT_RUNNER_VERSION =
    "5.8.2";


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


function clone(value) {

    if (
        value === undefined
    ) {

        return undefined;
    }


    try {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    } catch {

        return value;
    }
}


// ============================================================
// ACTION → INTENT MAPPING
// ============================================================
//
// These mappings connect Agent steps with AarHen's
// existing Skill Executor.
//
// ============================================================

const ACTION_MAP = Object.freeze({

    calculate: {

        category:
            "calculation",

        intent:
            "calculate"

    },

    search_knowledge: {

        category:
            "knowledge",

        intent:
            "knowledge_search"

    },

    read_public_information: {

        category:
            "research",

        intent:
            "web_research"

    },

    execute_external_code: {

        category:
            "coding",

        intent:
            "coding"

    },

    security_testing_against_external_target: {

        category:
            "security",

        intent:
            "security_request"

    },

    send_message: {

        category:
            "general",

        intent:
            "send_message"

    },

    send_email: {

        category:
            "general",

        intent:
            "send_email"

    },

    write_file: {

        category:
            "general",

        intent:
            "write_file"

    },

    delete_file: {

        category:
            "general",

        intent:
            "delete_file"

    }

});


// ============================================================
// CUSTOM ACTION REGISTRY
// ============================================================

const customActions =
    new Map();


// ============================================================
// REGISTER CUSTOM ACTION
// ============================================================
//
// A custom action must still be permission checked.
//
// The handler receives:
//
// {
//   task,
//   step,
//   context,
//   permission
// }
//
// and must return:
//
// {
//   success: true,
//   ...result
// }
//
// ============================================================

function registerAction(
    action,
    handler,
    options = {}
) {

    const name =
        safeString(
            action
        );


    if (!name) {

        return {

            success: false,

            error:
                "Action name is required."
        };
    }


    if (
        typeof handler !==
        "function"
    ) {

        return {

            success: false,

            error:
                "Action handler must be a function."
        };
    }


    const config =
        safeObject(
            options
        );


    const permission =
        permissions.check(
            name
        );


    customActions.set(
        name,
        {

            handler,

            permission,

            description:
                safeString(
                    config.description
                ),

            metadata:
                safeObject(
                    config.metadata
                )

        }
    );


    return {

        success: true,

        action:
            name,

        policy:
            permission.policy,

        requiresApproval:
            permission.requiresApproval
    };
}


// ============================================================
// UNREGISTER CUSTOM ACTION
// ============================================================

function unregisterAction(
    action
) {

    const name =
        safeString(
            action
        );


    if (
        !customActions.has(
            name
        )
    ) {

        return {

            success: false,

            error:
                "Action is not registered."
        };
    }


    customActions.delete(
        name
    );


    return {

        success: true,

        action:
            name
    };
}


// ============================================================
// LIST ACTIONS
// ============================================================

function listActions() {

    const builtIn =
        Object.keys(
            ACTION_MAP
        ).map(
            action => {

                const permission =
                    permissions.check(
                        action
                    );


                return {

                    action,

                    type:
                        "built-in",

                    category:
                        ACTION_MAP[action]
                            .category,

                    intent:
                        ACTION_MAP[action]
                            .intent,

                    policy:
                        permission.policy,

                    requiresApproval:
                        permission.requiresApproval

                };
            }
        );


    const custom =
        Array.from(
            customActions.entries()
        ).map(
            ([action, config]) => ({

                action,

                type:
                    "custom",

                policy:
                    config.permission
                        .policy,

                requiresApproval:
                    config.permission
                        .requiresApproval,

                description:
                    config.description

            })
        );


    return {

        success: true,

        actions:
            [
                ...builtIn,
                ...custom
            ],

        count:
            builtIn.length +
            custom.length
    };
}


// ============================================================
// RESOLVE PERMISSION
// ============================================================

function resolvePermission(
    step = {}
) {

    const action =
        safeString(
            step.action
        ) ||
        "execute_external_code";


    return permissions.check(
        action
    );
}


// ============================================================
// VERIFY STEP APPROVAL
// ============================================================

function verifyApproval(
    step = {},
    permission = {}
) {

    if (
        permission.policy !==
        "ASK"
    ) {

        return {

            approved: true,

            requiresApproval:
                false
        };
    }


    return {

        approved:
            step.approved === true,

        requiresApproval:
            true
    };
}


// ============================================================
// BUILD EXECUTOR INTENT
// ============================================================

function buildExecutorIntent(
    task,
    step,
    context = {}
) {

    const action =
        safeString(
            step.action
        );


    const mapped =
        ACTION_MAP[action];


    if (!mapped) {

        return {

            success: false,

            error:
                `No built-in intent mapping exists for action: ${action}`,

            intentData:
                null
        };
    }


    const stepInput =
        safeObject(
            step.input
        );


    const request =
        safeString(
            stepInput.request
        ) ||
        safeString(
            task.request
        );


    const detected =
        request
            ? intent.analyzeIntent(
                request
            )
            : null;


    const parameters =
        safeObject(
            detected?.parameters
        );


    const mergedParameters = {

        ...parameters,

        ...safeObject(
            stepInput.parameters
        )

    };


    // --------------------------------------------------------
    // For explicitly mapped actions, preserve the planned
    // category and intent instead of allowing generic keyword
    // detection to silently change the execution path.
    // --------------------------------------------------------

    const intentData = {

        success:
            true,

        request,

        category:
            mapped.category,

        intent:
            mapped.intent,

        parameters:
            mergedParameters,

        context: {

            ...safeObject(
                context
            ),

            taskId:
                task.id,

            agentId:
                task.agentId,

            agentStepId:
                step.id,

            agentAction:
                action
        }

    };


    return {

        success: true,

        intentData
    };
}


// ============================================================
// EXECUTE BUILT-IN ACTION
// ============================================================

async function executeBuiltIn(
    task,
    step,
    context
) {

    const executorIntent =
        buildExecutorIntent(
            task,
            step,
            context
        );


    if (
        !executorIntent.success
    ) {

        return executorIntent;
    }


    const action =
        safeString(
            step.action
        );


    // --------------------------------------------------------
    // Research protection
    // --------------------------------------------------------
    //
    // The Skill Executor expects research context for a
    // research step. It does not perform a second search.
    //
    // Therefore this runner only executes a research action
    // when research context is already available.
    // --------------------------------------------------------

    if (
        action ===
        "read_public_information"
    ) {

        const researchContext =
            safeObject(
                context
            ).research;


        if (
            !researchContext ||
            (
                !Array.isArray(
                    researchContext.sources
                ) &&
                !Array.isArray(
                    researchContext.results
                )
            )
        ) {

            return {

                success: false,

                action,

                error:
                    "Research context is required before the agent can execute a public-information step.",

                executionStatus:
                    "research-context-required"
            };
        }
    }


    try {

        const result =
            await executor.executeIntent(
                executorIntent.intentData
            );


        return {

            success:
                result?.success !== false,

            action,

            result:
                result || null,

            executionStatus:
                result?.executionStatus ||
                "executor-completed"

        };

    } catch (error) {

        return {

            success: false,

            action,

            error:
                error.message ||
                "Built-in action execution failed.",

            executionStatus:
                "executor-error"
        };
    }
}


// ============================================================
// EXECUTE CUSTOM ACTION
// ============================================================

async function executeCustomAction(
    task,
    step,
    context,
    registered
) {

    if (
        !registered ||
        typeof registered.handler !==
        "function"
    ) {

        return {

            success: false,

            error:
                "Custom action handler is not available."
        };
    }


    try {

        const result =
            await registered.handler({

                task:
                    clone(
                        task
                    ),

                step:
                    clone(
                        step
                    ),

                context:
                    clone(
                        context
                    ),

                permission:
                    clone(
                        registered.permission
                    )

            });


        return {

            success:
                result?.success !== false,

            action:
                step.action,

            result:
                result || null,

            executionStatus:
                result?.executionStatus ||
                "custom-action-completed"

        };

    } catch (error) {

        return {

            success: false,

            action:
                step.action,

            error:
                error.message ||
                "Custom action failed.",

            executionStatus:
                "custom-action-error"
        };
    }
}


// ============================================================
// DEFAULT RUNNER
// ============================================================

function createRunner(
    baseContext = {}
) {

    const context =
        safeObject(
            baseContext
        );


    return async function runner({
        task,
        step,
        permission
    }) {

        // ----------------------------------------------------
        // SAFETY RE-CHECK
        // ----------------------------------------------------

        const effectivePermission =
            resolvePermission(
                step
            );


        if (
            effectivePermission.policy ===
            "ASK" &&
            step.approved !== true
        ) {

            return {

                success: false,

                requiresApproval:
                    true,

                action:
                    step.action,

                error:
                    "Action requires approval before execution.",

                executionStatus:
                    "approval-required"
            };
        }


        // ----------------------------------------------------
        // STOP PROTECTION
        // ----------------------------------------------------

        if (
            task.stopRequested ===
            true
        ) {

            return {

                success: false,

                stopped: true,

                error:
                    "Task stop was requested.",

                executionStatus:
                    "task-stopped"
            };
        }


        // ----------------------------------------------------
        // PAUSE PROTECTION
        // ----------------------------------------------------

        if (
            task.pauseRequested ===
            true
        ) {

            return {

                success: false,

                paused: true,

                error:
                    "Task is paused.",

                executionStatus:
                    "task-paused"
            };
        }


        // ----------------------------------------------------
        // CUSTOM ACTION
        // ----------------------------------------------------

        if (
            customActions.has(
                step.action
            )
        ) {

            return executeCustomAction(

                task,

                step,

                {

                    ...context,

                    taskContext:
                        task.context || {},

                    stepInput:
                        step.input || {}

                },

                customActions.get(
                    step.action
                )

            );
        }


        // ----------------------------------------------------
        // BUILT-IN ACTION
        // ----------------------------------------------------

        if (
            ACTION_MAP[
                step.action
            ]
        ) {

            return executeBuiltIn(

                task,

                step,

                {

                    ...context,

                    taskContext:
                        task.context || {},

                    stepInput:
                        step.input || {}

                }

            );
        }


        // ----------------------------------------------------
        // UNKNOWN ACTION
        // ----------------------------------------------------

        return {

            success: false,

            action:
                step.action,

            error:
                `No controlled runner is registered for action: ${step.action}`,

            executionStatus:
                "unknown-action"
        };
    };
}


// ============================================================
// RUN TASK
// ============================================================

async function runTask(
    taskId,
    options = {}
) {

    const config =
        safeObject(
            options
        );


    const context =
        safeObject(
            config.context
        );


    const runner =
        typeof config.runner ===
        "function"

            ? config.runner

            : createRunner(
                context
            );


    const result =
        await agentManager.runTask(

            taskId,

            runner,

            {

                maxIterations:
                    config.maxIterations ||
                    100

            }

        );


    return {

        success:
            result.success === true,

        runnerVersion:
            AGENT_RUNNER_VERSION,

        result,

        task:
            result.task ||
            null

    };
}


// ============================================================
// CREATE + RUN TASK
// ============================================================
//
// Convenience method:
//
// 1. Agent Manager task create
// 2. Planner attaches plan
// 3. Runner executes
//
// Planner is injected by caller so this module does not
// create a circular dependency automatically.
// ============================================================

async function createAndRunTask(
    planner,
    agentId,
    request,
    options = {}
) {

    if (
        !planner ||
        typeof planner.createPlannedTask !==
        "function"
    ) {

        return {

            success: false,

            error:
                "A valid Agent Planner is required."
        };
    }


    const planned =
        planner.createPlannedTask(

            agentId,

            request,

            options

        );


    if (
        !planned.success
    ) {

        return {

            success: false,

            stage:
                "planning",

            error:
                planned.error ||
                "Agent planning failed.",

            planned

        };
    }


    const taskId =
        planned.task?.id;


    if (!taskId) {

        return {

            success: false,

            stage:
                "task-creation",

            error:
                "Planned task ID is missing.",

            planned

        };
    }


    if (
        planned.task.status ===
        agentManager.TASK_STATES.WAITING_APPROVAL
    ) {

        return {

            success: true,

            waitingApproval:
                true,

            stage:
                "approval",

            task:
                planned.task,

            plan:
                planned.plan

        };
    }


    const run =
        await runTask(

            taskId,

            options

        );


    return {

        success:
            run.success,

        stage:
            "execution",

        planning:
            planned,

        execution:
            run,

        task:
            run.task ||
            planned.task

    };
}


// ============================================================
// GET TASK EXECUTION STATUS
// ============================================================

function getTaskStatus(
    taskId
) {

    const result =
        agentManager.getTask(
            taskId
        );


    if (
        !result.success
    ) {

        return result;
    }


    const task =
        result.task;


    const completedSteps =
        safeArray(
            task.steps
        )
            .filter(
                step =>
                    step.status ===
                    agentManager.STEP_STATES.COMPLETED
            )
            .length;


    const failedSteps =
        safeArray(
            task.steps
        )
            .filter(
                step =>
                    step.status ===
                    agentManager.STEP_STATES.FAILED
            )
            .length;


    const pendingSteps =
        safeArray(
            task.steps
        )
            .filter(
                step =>
                    step.status ===
                    agentManager.STEP_STATES.PENDING
            )
            .length;


    return {

        success: true,

        runnerVersion:
            AGENT_RUNNER_VERSION,

        taskId:
            task.id,

        agentId:
            task.agentId,

        status:
            task.status,

        currentStepIndex:
            task.currentStepIndex,

        currentStepId:
            task.currentStepId,

        totalSteps:
            task.steps.length,

        completedSteps,

        failedSteps,

        pendingSteps,

        approvalRequired:
            task.approvalRequired,

        stopRequested:
            task.stopRequested,

        pauseRequested:
            task.pauseRequested

    };
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    const managerStatus =
        agentManager.getStatus();


    const executorStatus =
        typeof executor.getStatus ===
        "function"
            ? executor.getStatus()
            : null;


    return {

        success: true,

        version:
            AGENT_RUNNER_VERSION,

        status:
            "active",

        agentManager: {

            connected:
                managerStatus.success ===
                true,

            version:
                managerStatus.version ||
                null

        },

        skillExecutor: {

            connected:
                Boolean(
                    executorStatus &&
                    executorStatus.success ===
                    true
                ),

            version:
                executorStatus?.version ||
                null

        },

        permissionSystem: {

            connected:
                typeof permissions.check ===
                "function"

        },

        actionCount:
            listActions().count,

        customActionCount:
            customActions.size

    };
}


// ============================================================
// RESET
// ============================================================
//
// Primarily useful for tests.
// Does not reset Agent Manager itself.
// ============================================================

function reset() {

    customActions.clear();


    return {

        success: true,

        status:
            "agent-runner-reset"
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    AGENT_RUNNER_VERSION,

    ACTION_MAP,

    registerAction,

    unregisterAction,

    listActions,

    resolvePermission,

    verifyApproval,

    buildExecutorIntent,

    createRunner,

    runTask,

    createAndRunTask,

    getTaskStatus,

    getStatus,

    reset

};
