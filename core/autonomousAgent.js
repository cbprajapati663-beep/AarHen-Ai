// ============================================================
// AARHEN CORE V5
// AUTONOMOUS AGENT CONTROLLER
// ============================================================
// Version: 5.8.3
//
// Purpose:
// - High-level autonomous agent controller
// - Connect Planner + Manager + Runner
// - Create agents
// - Plan tasks
// - Execute approved tasks
// - Handle approval flow
// - Pause / resume / stop tasks
// - Expose task status
// - Keep execution controlled
//
// Important:
// This layer does not bypass AarHen permissions.
// Every action still passes through Agent Runner safety
// checks and the Permission Brain.
// ============================================================

const agentManager =
    require("./agentManager");

const agentPlanner =
    require("./agentPlanner");

const agentRunner =
    require("./agentRunner");

const autonomousAgentVersion =
    "5.8.3";


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
// DEFAULT AGENT
// ============================================================

let defaultAgentId =
    null;


// ============================================================
// ENSURE DEFAULT AGENT
// ============================================================

function ensureDefaultAgent(
    options = {}
) {

    if (
        defaultAgentId
    ) {

        const existing =
            agentManager.getAgent(
                defaultAgentId
            );

        if (
            existing.success
        ) {

            return existing;
        }


        defaultAgentId =
            null;
    }


    const config =
        safeObject(
            options
        );


    const created =
        agentManager.createAgent({

            name:
                config.name ||
                "AarHen Autonomous Agent",

            description:
                config.description ||
                "Controlled autonomous agent for AarHen Core.",

            type:
                config.type ||
                "autonomous",

            owner:
                config.owner ||
                "user",

            metadata: {

                system:
                    "AarHen Core",

                autonomous:
                    true,

                ...safeObject(
                    config.metadata
                )

            }

        });


    if (
        created.success
    ) {

        defaultAgentId =
            created.agent.id;
    }


    return created;
}


// ============================================================
// CREATE AGENT
// ============================================================

function createAgent(
    options = {}
) {

    const result =
        agentManager.createAgent(
            options
        );


    if (
        result.success &&
        options?.default === true
    ) {

        defaultAgentId =
            result.agent.id;
    }


    return result;
}


// ============================================================
// SET DEFAULT AGENT
// ============================================================

function setDefaultAgent(
    agentId
) {

    const id =
        safeString(
            agentId
        );


    if (!id) {

        return {

            success: false,

            error:
                "Agent ID is required."
        };
    }


    const agent =
        agentManager.getAgent(
            id
        );


    if (
        !agent.success
    ) {

        return {

            success: false,

            error:
                "Cannot set default agent. Agent not found."
        };
    }


    defaultAgentId =
        id;


    return {

        success: true,

        defaultAgentId:
            id,

        agent:
            agent.agent

    };
}


// ============================================================
// GET DEFAULT AGENT
// ============================================================

function getDefaultAgent() {

    if (
        !defaultAgentId
    ) {

        return {

            success: false,

            error:
                "Default agent is not configured.",

            agent:
                null
        };
    }


    return agentManager.getAgent(
        defaultAgentId
    );
}


// ============================================================
// RESOLVE AGENT ID
// ============================================================

function resolveAgentId(
    agentId
) {

    const explicitId =
        safeString(
            agentId
        );


    if (
        explicitId
    ) {

        const existing =
            agentManager.getAgent(
                explicitId
            );


        if (
            existing.success
        ) {

            return {

                success: true,

                agentId:
                    explicitId,

                agent:
                    existing.agent

            };
        }


        return {

            success: false,

            error:
                "Specified agent was not found."
        };
    }


    const defaultAgent =
        ensureDefaultAgent();


    if (
        defaultAgent.success
    ) {

        return {

            success: true,

            agentId:
                defaultAgent.agent.id,

            agent:
                defaultAgent.agent

        };
    }


    return {

        success: false,

        error:
            defaultAgent.error ||
            "Unable to create default agent."
    };
}


// ============================================================
// PLAN REQUEST
// ============================================================

function planRequest(
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
                "Request is required."
        };
    }


    return agentPlanner.planRequest(

        cleanRequest,

        options

    );
}


// ============================================================
// CREATE TASK
// ============================================================

function createTask(
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
                "Request is required."
        };
    }


    const resolved =
        resolveAgentId(
            options.agentId
        );


    if (
        !resolved.success
    ) {

        return resolved;
    }


    const plannerOptions = {

        ...safeObject(
            options
        )

    };


    delete plannerOptions.agentId;


    const planned =
        agentPlanner.createPlannedTask(

            resolved.agentId,

            cleanRequest,

            plannerOptions

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
                "Unable to create planned task.",

            agent:
                resolved.agent,

            planned

        };
    }


    return {

        success: true,

        stage:
            planned.task.status ===
            agentManager.TASK_STATES.WAITING_APPROVAL

                ? "approval"

                : "planned",

        agent:
            resolved.agent,

        task:
            planned.task,

        plan:
            planned.plan,

        analysis:
            planned.analysis

    };
}


// ============================================================
// EXECUTE TASK
// ============================================================

async function executeTask(
    taskId,
    options = {}
) {

    const id =
        safeString(
            taskId
        );


    if (!id) {

        return {

            success: false,

            error:
                "Task ID is required."
        };
    }


    const task =
        agentManager.getTask(
            id
        );


    if (
        !task.success
    ) {

        return task;
    }


    if (
        task.task.status ===
        agentManager.TASK_STATES.WAITING_APPROVAL
    ) {

        return {

            success: true,

            stage:
                "approval",

            waitingApproval:
                true,

            task:
                task.task
        };
    }


    if (
        task.task.status ===
        agentManager.TASK_STATES.STOPPED
    ) {

        return {

            success: false,

            stage:
                "stopped",

            error:
                "Task is stopped.",

            task:
                task.task

        };
    }


    const result =
        await agentRunner.runTask(

            id,

            {

                ...safeObject(
                    options
                )

            }

        );


    return {

        success:
            result.success,

        stage:
            "execution",

        runner:
            result,

        task:
            result.task ||
            task.task

    };
}


// ============================================================
// CREATE + EXECUTE
// ============================================================
//
// Main high-level API.
//
// ============================================================

async function executeRequest(
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
                "Request is required."
        };
    }


    const created =
        createTask(

            cleanRequest,

            options

        );


    if (
        !created.success
    ) {

        return created;
    }


    if (
        created.task.status ===
        agentManager.TASK_STATES.WAITING_APPROVAL
    ) {

        return {

            success: true,

            stage:
                "approval",

            waitingApproval:
                true,

            request:
                cleanRequest,

            agent:
                created.agent,

            task:
                created.task,

            plan:
                created.plan,

            analysis:
                created.analysis

        };
    }


    const executionOptions = {

        ...safeObject(
            options
        )

    };


    delete executionOptions.agentId;


    const execution =
        await executeTask(

            created.task.id,

            executionOptions

        );


    return {

        success:
            execution.success,

        stage:
            execution.stage,

        request:
            cleanRequest,

        agent:
            created.agent,

        task:
            execution.task ||
            created.task,

        plan:
            created.plan,

        analysis:
            created.analysis,

        execution:
            execution.runner ||
            null

    };
}


// ============================================================
// APPROVE TASK
// ============================================================

function approveTask(
    taskId
) {

    const result =
        agentManager.approveTask(
            taskId
        );


    return {

        success:
            result.success,

        stage:
            result.success
                ? "approved"
                : "approval-error",

        result,

        task:
            result.task ||
            null

    };
}


// ============================================================
// APPROVE + EXECUTE
// ============================================================

async function approveAndExecute(
    taskId,
    options = {}
) {

    const approval =
        approveTask(
            taskId
        );


    if (
        !approval.success
    ) {

        return approval;
    }


    const execution =
        await executeTask(

            taskId,

            options

        );


    return {

        success:
            execution.success,

        stage:
            execution.stage,

        approval,

        execution,

        task:
            execution.task ||
            null

    };
}


// ============================================================
// PAUSE
// ============================================================

function pauseTask(
    taskId
) {

    const result =
        agentManager.pauseTask(
            taskId
        );


    return {

        success:
            result.success,

        stage:
            result.success
                ? "paused"
                : "pause-error",

        result,

        task:
            result.task ||
            null

    };
}


// ============================================================
// RESUME
// ============================================================

async function resumeTask(
    taskId,
    options = {}
) {

    const resumed =
        agentManager.resumeTask(
            taskId
        );


    if (
        !resumed.success
    ) {

        return {

            success: false,

            stage:
                "resume-error",

            result:
                resumed,

            task:
                resumed.task ||
                null

        };
    }


    const execution =
        await executeTask(

            taskId,

            options

        );


    return {

        success:
            execution.success,

        stage:
            execution.stage,

        resume:
            resumed,

        execution,

        task:
            execution.task ||
            resumed.task ||
            null

    };
}


// ============================================================
// STOP
// ============================================================

function stopTask(
    taskId,
    reason
) {

    const result =
        agentManager.stopTask(

            taskId,

            reason ||
            "Stopped by user."

        );


    return {

        success:
            result.success,

        stage:
            result.success
                ? "stopped"
                : "stop-error",

        result,

        task:
            result.task ||
            null

    };
}


// ============================================================
// CANCEL
// ============================================================

function cancelTask(
    taskId,
    reason
) {

    const result =
        agentManager.cancelTask(

            taskId,

            reason ||
            "Task cancelled."

        );


    return {

        success:
            result.success,

        stage:
            result.success
                ? "cancelled"
                : "cancel-error",

        result,

        task:
            result.task ||
            null

    };
}


// ============================================================
// TASK STATUS
// ============================================================

function getTaskStatus(
    taskId
) {

    return agentRunner.getTaskStatus(
        taskId
    );
}


// ============================================================
// AGENT STATUS
// ============================================================

function getAgentStatus(
    agentId
) {

    return agentManager.getAgent(
        agentId
    );
}


// ============================================================
// LIST AGENTS
// ============================================================

function listAgents() {

    return agentManager.listAgents();
}


// ============================================================
// LIST TASKS
// ============================================================

function listTasks(
    agentId = null
) {

    return agentManager.listTasks(
        agentId
    );
}


// ============================================================
// SYSTEM STATUS
// ============================================================

function getStatus() {

    const manager =
        agentManager.getStatus();


    const planner =
        agentPlanner.getStatus();


    const runner =
        agentRunner.getStatus();


    return {

        success: true,

        version:
            autonomousAgentVersion,

        name:
            "AarHen Autonomous Agent Controller",

        status:
            "active",

        defaultAgentId,

        systems: {

            agentManager: {

                connected:
                    manager.success ===
                    true,

                version:
                    manager.version ||
                    null

            },

            agentPlanner: {

                connected:
                    planner.success ===
                    true,

                version:
                    planner.version ||
                    null

            },

            agentRunner: {

                connected:
                    runner.success ===
                    true,

                version:
                    runner.version ||
                    null

            }

        }

    };
}


// ============================================================
// RESET
// ============================================================
//
// Reset agent state and runner custom actions.
//
// ============================================================

function reset() {

    const manager =
        agentManager.reset();


    const runner =
        agentRunner.reset();


    defaultAgentId =
        null;


    return {

        success:
            manager.success &&
            runner.success,

        agentManager:
            manager,

        agentRunner:
            runner,

        status:
            "autonomous-agent-reset"

    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    AUTONOMOUS_AGENT_VERSION:
        autonomousAgentVersion,

    createAgent,

    setDefaultAgent,

    getDefaultAgent,

    planRequest,

    createTask,

    executeTask,

    executeRequest,

    approveTask,

    approveAndExecute,

    pauseTask,

    resumeTask,

    stopTask,

    cancelTask,

    getTaskStatus,

    getAgentStatus,

    listAgents,

    listTasks,

    getStatus,

    reset

};
