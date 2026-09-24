// ============================================================
// AARHEN CORE V5
// AGENT MANAGER
// ============================================================
// Version: 5.8.0
//
// Purpose:
// - Manage autonomous agents
// - Create and track tasks
// - Build multi-step execution plans
// - Handle approval requirements
// - Support pause / resume / stop
// - Track step execution
// - Support retries
// - Integrate with AarHen Permission & Safety Brain
//
// Important:
// This module does NOT directly execute arbitrary code.
// Execution is delegated to a controlled runner/executor.
// ============================================================

const permissions =
    require("./permissions");

const AGENT_MANAGER_VERSION =
    "5.8.0";


// ============================================================
// STATES
// ============================================================

const AGENT_STATES = Object.freeze({

    IDLE:
        "idle",

    READY:
        "ready",

    WORKING:
        "working",

    PAUSED:
        "paused",

    STOPPED:
        "stopped",

    COMPLETED:
        "completed",

    ERROR:
        "error"
});


const TASK_STATES = Object.freeze({

    CREATED:
        "created",

    PLANNING:
        "planning",

    WAITING_APPROVAL:
        "waiting_approval",

    READY:
        "ready",

    RUNNING:
        "running",

    PAUSED:
        "paused",

    STOPPED:
        "stopped",

    COMPLETED:
        "completed",

    FAILED:
        "failed",

    CANCELLED:
        "cancelled"
});


const STEP_STATES = Object.freeze({

    PENDING:
        "pending",

    WAITING_APPROVAL:
        "waiting_approval",

    RUNNING:
        "running",

    COMPLETED:
        "completed",

    FAILED:
        "failed",

    SKIPPED:
        "skipped",

    STOPPED:
        "stopped"
});


// ============================================================
// MEMORY STORE
// ============================================================
//
// Version 5.8.0 intentionally uses an in-memory store.
//
// This gives AarHen a stable Agent API first.
// Persistent storage will be connected later to the
// long-term memory / database layer.
// ============================================================

const agents =
    new Map();

const tasks =
    new Map();


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


function createId(
    prefix
) {

    return (
        prefix +
        "-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}


function now() {

    return new Date()
        .toISOString();
}


function normalizePriority(
    priority
) {

    const value =
        safeString(
            priority
        ).toLowerCase();

    if (
        value === "high" ||
        value === "urgent"
    ) {

        return value;
    }

    if (
        value === "low"
    ) {

        return "low";
    }

    return "normal";
}


function normalizeMaxRetries(
    value
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {

        return 0;
    }

    return Math.min(
        Math.floor(number),
        10
    );
}


function isTerminalTask(
    status
) {

    return [

        TASK_STATES.COMPLETED,
        TASK_STATES.FAILED,
        TASK_STATES.STOPPED,
        TASK_STATES.CANCELLED

    ].includes(
        status
    );
}


function isTerminalStep(
    status
) {

    return [

        STEP_STATES.COMPLETED,
        STEP_STATES.FAILED,
        STEP_STATES.SKIPPED,
        STEP_STATES.STOPPED

    ].includes(
        status
    );
}


// ============================================================
// PERMISSION RESOLUTION
// ============================================================

function resolveStepPermission(
    step = {}
) {

    const action =
        safeString(
            step.action
        ) ||
        "execute_external_code";

    const permission =
        permissions.check(
            action
        );

    return {

        action,

        policy:
            permission.policy,

        requiresApproval:
            permission.requiresApproval,

        approved:
            permission.requiresApproval !== true
    };
}


// ============================================================
// CREATE AGENT
// ============================================================

function createAgent(
    options = {}
) {

    const config =
        safeObject(
            options
        );

    const id =
        safeString(
            config.id
        ) ||
        createId(
            "agent"
        );

    if (
        agents.has(id)
    ) {

        return {

            success: false,

            error:
                "Agent already exists.",

            agent:
                null
        };
    }


    const timestamp =
        now();

    const agent = {

        id,

        name:
            safeString(
                config.name
            ) ||
            "AarHen Agent",

        description:
            safeString(
                config.description
            ),

        type:
            safeString(
                config.type
            ) ||
            "general",

        owner:
            safeString(
                config.owner
            ) ||
            "user",

        state:
            AGENT_STATES.IDLE,

        activeTaskId:
            null,

        taskIds: [],

        createdAt:
            timestamp,

        updatedAt:
            timestamp,

        metadata:
            safeObject(
                config.metadata
            )
    };


    agents.set(
        id,
        agent
    );


    return {

        success: true,

        agent:
            clone(
                agent
            )
    };
}


// ============================================================
// GET AGENT
// ============================================================

function getAgent(
    agentId
) {

    const id =
        safeString(
            agentId
        );

    const agent =
        agents.get(
            id
        );

    if (!agent) {

        return {

            success: false,

            error:
                "Agent not found.",

            agent:
                null
        };
    }


    return {

        success: true,

        agent:
            clone(
                agent
            )
    };
}


// ============================================================
// LIST AGENTS
// ============================================================

function listAgents() {

    return {

        success: true,

        agents:
            Array.from(
                agents.values()
            ).map(
                clone
            ),

        count:
            agents.size
    };
}


// ============================================================
// CREATE TASK
// ============================================================

function createTask(
    agentId,
    input,
    options = {}
) {

    const id =
        safeString(
            agentId
        );

    const agent =
        agents.get(
            id
        );

    if (!agent) {

        return {

            success: false,

            error:
                "Agent not found.",

            task:
                null
        };
    }


    const request =
        safeString(
            input
        );

    if (!request) {

        return {

            success: false,

            error:
                "Task request is required.",

            task:
                null
        };
    }


    const config =
        safeObject(
            options
        );


    const timestamp =
        now();

    const taskId =
        safeString(
            config.id
        ) ||
        createId(
            "task"
        );


    if (
        tasks.has(taskId)
    ) {

        return {

            success: false,

            error:
                "Task already exists.",

            task:
                null
        };
    }


    const task = {

        id:
            taskId,

        agentId:
            id,

        request,

        description:
            safeString(
                config.description
            ) ||
            request,

        status:
            TASK_STATES.CREATED,

        priority:
            normalizePriority(
                config.priority
            ),

        autonomy:
            config.autonomy === false
                ? false
                : true,

        approvalRequired:
            config.approvalRequired === true,

        approved:
            config.approved === true,

        stopRequested:
            false,

        pauseRequested:
            false,

        currentStepIndex:
            -1,

        currentStepId:
            null,

        steps: [],

        result:
            null,

        error:
            null,

        warnings: [],

        retries:
            0,

        maxRetries:
            normalizeMaxRetries(
                config.maxRetries
            ),

        context:
            safeObject(
                config.context
            ),

        metadata:
            safeObject(
                config.metadata
            ),

        createdAt:
            timestamp,

        updatedAt:
            timestamp,

        startedAt:
            null,

        completedAt:
            null,

        stoppedAt:
            null
    };


    tasks.set(
        taskId,
        task
    );


    agent.taskIds.push(
        taskId
    );

    agent.state =
        AGENT_STATES.READY;

    agent.updatedAt =
        timestamp;


    return {

        success: true,

        task:
            clone(
                task
            )
    };
}


// ============================================================
// GET TASK
// ============================================================

function getTask(
    taskId
) {

    const id =
        safeString(
            taskId
        );

    const task =
        tasks.get(
            id
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found.",

            task:
                null
        };
    }


    return {

        success: true,

        task:
            clone(
                task
            )
    };
}


// ============================================================
// LIST TASKS
// ============================================================

function listTasks(
    agentId = null
) {

    let list =
        Array.from(
            tasks.values()
        );


    if (
        safeString(
            agentId
        )
    ) {

        list =
            list.filter(
                task =>
                    task.agentId ===
                    safeString(
                        agentId
                    )
            );
    }


    return {

        success: true,

        tasks:
            list.map(
                clone
            ),

        count:
            list.length
    };
}


// ============================================================
// ADD STEP
// ============================================================

function addStep(
    taskId,
    step = {}
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found.",

            step:
                null
        };
    }


    if (
        isTerminalTask(
            task.status
        )
    ) {

        return {

            success: false,

            error:
                "Cannot add steps to a completed or stopped task.",

            step:
                null
        };
    }


    const input =
        safeObject(
            step
        );


    const description =
        safeString(
            input.description
        ) ||
        safeString(
            input.name
        ) ||
        safeString(
            input.title
        );


    if (!description) {

        return {

            success: false,

            error:
                "Step description is required.",

            step:
                null
        };
    }


    const index =
        task.steps.length;


    const permission =
        resolveStepPermission(
            input
        );


    const requiresApproval =
        input.requiresApproval === true ||
        permission.requiresApproval;


    const normalizedStep = {

        id:
            safeString(
                input.id
            ) ||
            createId(
                "step"
            ),

        index,

        name:
            safeString(
                input.name
            ) ||
            `Step ${index + 1}`,

        description,

        action:
            permission.action,

        policy:
            permission.policy,

        requiresApproval,

        approved:
            requiresApproval
                ? input.approved === true
                : true,

        status:
            requiresApproval &&
            input.approved !== true
                ? STEP_STATES.WAITING_APPROVAL
                : STEP_STATES.PENDING,

        retries:
            0,

        maxRetries:
            normalizeMaxRetries(
                input.maxRetries ??
                task.maxRetries
            ),

        input:
            safeObject(
                input.input
            ),

        result:
            null,

        error:
            null,

        metadata:
            safeObject(
                input.metadata
            ),

        createdAt:
            now(),

        startedAt:
            null,

        completedAt:
            null
    };


    task.steps.push(
        normalizedStep
    );

    task.updatedAt =
        now();


    if (
        normalizedStep
            .requiresApproval
    ) {

        task.approvalRequired =
            true;

        task.status =
            TASK_STATES.WAITING_APPROVAL;
    }


    return {

        success: true,

        step:
            clone(
                normalizedStep
            ),

        task:
            clone(
                task
            )
    };
}


// ============================================================
// ADD MULTIPLE STEPS
// ============================================================

function addSteps(
    taskId,
    steps = []
) {

    const list =
        safeArray(
            steps
        );

    const results = [];


    for (
        const step of list
    ) {

        const result =
            addStep(
                taskId,
                step
            );

        results.push(
            result
        );

        if (
            !result.success
        ) {

            return {

                success: false,

                results
            };
        }
    }


    return {

        success: true,

        results
    };
}


// ============================================================
// PLAN TASK
// ============================================================
//
// This method accepts a ready plan from a planner/Brain.
// It deliberately does not pretend to generate advanced
// reasoning by itself.
//
// A future planner engine can call this method.
// ============================================================

function planTask(
    taskId,
    plan = []
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        isTerminalTask(
            task.status
        )
    ) {

        return {

            success: false,

            error:
                "Cannot plan a terminal task."
        };
    }


    task.status =
        TASK_STATES.PLANNING;

    task.updatedAt =
        now();


    const list =
        safeArray(
            plan
        );


    if (
        list.length === 0
    ) {

        task.status =
            TASK_STATES.READY;

        return {

            success: true,

            task:
                clone(
                    task
                ),

            status:
                "empty-plan"
        };
    }


    const addResult =
        addSteps(
            task.id,
            list
        );


    if (
        !addResult.success
    ) {

        task.status =
            TASK_STATES.FAILED;

        task.error =
            "Task planning failed.";

        task.updatedAt =
            now();

        return {

            success: false,

            error:
                "Task planning failed.",

            task:
                clone(
                    task
                ),

            details:
                addResult
        };
    }


    const needsApproval =
        task.steps.some(
            step =>
                step.requiresApproval &&
                !step.approved
        );


    task.approvalRequired =
        needsApproval;


    task.status =
        needsApproval
            ? TASK_STATES.WAITING_APPROVAL
            : TASK_STATES.READY;

    task.updatedAt =
        now();


    return {

        success: true,

        task:
            clone(
                task
            )
    };
}


// ============================================================
// APPROVE TASK
// ============================================================

function approveTask(
    taskId
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        isTerminalTask(
            task.status
        )
    ) {

        return {

            success: false,

            error:
                "Task is already in a terminal state."
        };
    }


    task.approved =
        true;


    for (
        const step of task.steps
    ) {

        if (
            step.requiresApproval
        ) {

            step.approved =
                true;

            if (
                step.status ===
                STEP_STATES.WAITING_APPROVAL
            ) {

                step.status =
                    STEP_STATES.PENDING;
            }
        }
    }


    task.approvalRequired =
        false;

    task.status =
        TASK_STATES.READY;

    task.updatedAt =
        now();


    return {

        success: true,

        task:
            clone(
                task
            ),

        status:
            "approved"
    };
}


// ============================================================
// APPROVE SINGLE STEP
// ============================================================

function approveStep(
    taskId,
    stepId
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    const step =
        task.steps.find(
            item =>
                item.id ===
                safeString(
                    stepId
                )
        );


    if (!step) {

        return {

            success: false,

            error:
                "Step not found."
        };
    }


    step.approved =
        true;


    if (
        step.status ===
        STEP_STATES.WAITING_APPROVAL
    ) {

        step.status =
            STEP_STATES.PENDING;
    }


    const stillWaiting =
        task.steps.some(
            item =>
                item.requiresApproval &&
                !item.approved
        );


    task.approvalRequired =
        stillWaiting;


    if (
        !stillWaiting &&
        task.status ===
        TASK_STATES.WAITING_APPROVAL
    ) {

        task.status =
            TASK_STATES.READY;
    }


    task.updatedAt =
        now();


    return {

        success: true,

        step:
            clone(
                step
            ),

        task:
            clone(
                task
            )
    };
}


// ============================================================
// START TASK
// ============================================================

function startTask(
    taskId
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    const agent =
        agents.get(
            task.agentId
        );


    if (!agent) {

        return {

            success: false,

            error:
                "Task agent not found."
        };
    }


    if (
        isTerminalTask(
            task.status
        )
    ) {

        return {

            success: false,

            error:
                "Task cannot be started from its current state."
        };
    }


    if (
        task.approvalRequired &&
        !task.approved
    ) {

        task.status =
            TASK_STATES.WAITING_APPROVAL;

        task.updatedAt =
            now();

        return {

            success: false,

            requiresApproval:
                true,

            status:
                TASK_STATES.WAITING_APPROVAL,

            error:
                "Task requires approval before execution."
        };
    }


    const waitingStep =
        task.steps.find(
            step =>
                step.requiresApproval &&
                !step.approved
        );


    if (
        waitingStep
    ) {

        task.status =
            TASK_STATES.WAITING_APPROVAL;

        task.updatedAt =
            now();

        return {

            success: false,

            requiresApproval:
                true,

            stepId:
                waitingStep.id,

            error:
                "A task step requires approval."
        };
    }


    task.status =
        TASK_STATES.RUNNING;

    task.stopRequested =
        false;

    task.pauseRequested =
        false;

    task.startedAt =
        task.startedAt ||
        now();

    task.updatedAt =
        now();


    agent.state =
        AGENT_STATES.WORKING;

    agent.activeTaskId =
        task.id;

    agent.updatedAt =
        now();


    return {

        success: true,

        task:
            clone(
                task
            ),

        agent:
            clone(
                agent
            )
    };
}


// ============================================================
// PAUSE TASK
// ============================================================

function pauseTask(
    taskId
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        isTerminalTask(
            task.status
        )
    ) {

        return {

            success: false,

            error:
                "Task is already stopped."
        };
    }


    task.pauseRequested =
        true;


    if (
        task.status ===
        TASK_STATES.RUNNING
    ) {

        task.status =
            TASK_STATES.PAUSED;
    }


    task.updatedAt =
        now();


    updateAgentStateFromTask(
        task
    );


    return {

        success: true,

        task:
            clone(
                task
            )
    };
}


// ============================================================
// RESUME TASK
// ============================================================

function resumeTask(
    taskId
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        task.status !==
        TASK_STATES.PAUSED
    ) {

        return {

            success: false,

            error:
                "Task is not paused."
        };
    }


    task.pauseRequested =
        false;

    task.status =
        TASK_STATES.RUNNING;

    task.updatedAt =
        now();


    updateAgentStateFromTask(
        task
    );


    return {

        success: true,

        task:
            clone(
                task
            )
    };
}


// ============================================================
// STOP TASK
// ============================================================

function stopTask(
    taskId,
    reason = "Stopped by user."
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        isTerminalTask(
            task.status
        )
    ) {

        return {

            success: true,

            task:
                clone(
                    task
                ),

            status:
                "already-terminal"
        };
    }


    task.stopRequested =
        true;

    task.status =
        TASK_STATES.STOPPED;

    task.stoppedAt =
        now();

    task.completedAt =
        null;

    task.error =
        safeString(
            reason
        ) ||
        "Task stopped.";


    for (
        const step of task.steps
    ) {

        if (
            !isTerminalStep(
                step.status
            )
        ) {

            step.status =
                STEP_STATES.STOPPED;
        }
    }


    task.updatedAt =
        now();


    updateAgentStateFromTask(
        task
    );


    return {

        success: true,

        task:
            clone(
                task
            )
    };
}


// ============================================================
// CANCEL TASK
// ============================================================

function cancelTask(
    taskId,
    reason = "Task cancelled."
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        isTerminalTask(
            task.status
        )
    ) {

        return {

            success: false,

            error:
                "Task is already in a terminal state."
        };
    }


    task.status =
        TASK_STATES.CANCELLED;

    task.error =
        safeString(
            reason
        ) ||
        "Task cancelled.";

    task.updatedAt =
        now();


    updateAgentStateFromTask(
        task
    );


    return {

        success: true,

        task:
            clone(
                task
            )
    };
}


// ============================================================
// GET NEXT EXECUTABLE STEP
// ============================================================

function getNextStep(
    taskId
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found.",

            step:
                null
        };
    }


    if (
        task.status !==
        TASK_STATES.RUNNING
    ) {

        return {

            success: false,

            error:
                "Task is not running.",

            step:
                null
        };
    }


    if (
        task.stopRequested
    ) {

        return {

            success: false,

            error:
                "Task stop has been requested.",

            step:
                null
        };
    }


    if (
        task.pauseRequested
    ) {

        return {

            success: false,

            error:
                "Task is paused.",

            step:
                null
        };
    }


    const step =
        task.steps.find(
            item =>
                item.status ===
                STEP_STATES.PENDING &&
                (
                    !item.requiresApproval ||
                    item.approved
                )
        );


    if (!step) {

        return {

            success: true,

            step:
                null,

            done:
                true
        };
    }


    return {

        success: true,

        step:
            clone(
                step
            ),

        done:
            false
    };
}


// ============================================================
// START STEP
// ============================================================

function startStep(
    taskId,
    stepId
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    const step =
        task.steps.find(
            item =>
                item.id ===
                safeString(
                    stepId
                )
        );


    if (!step) {

        return {

            success: false,

            error:
                "Step not found."
        };
    }


    if (
        step.requiresApproval &&
        !step.approved
    ) {

        step.status =
            STEP_STATES.WAITING_APPROVAL;

        task.approvalRequired =
            true;

        task.status =
            TASK_STATES.WAITING_APPROVAL;

        task.updatedAt =
            now();


        return {

            success: false,

            requiresApproval:
                true,

            error:
                "Step requires approval."
        };
    }


    if (
        task.stopRequested
    ) {

        return {

            success: false,

            stopped:
                true,

            error:
                "Task stop has been requested."
        };
    }


    if (
        task.pauseRequested
    ) {

        return {

            success: false,

            paused:
                true,

            error:
                "Task is paused."
        };
    }


    step.status =
        STEP_STATES.RUNNING;

    step.startedAt =
        now();

    task.currentStepIndex =
        step.index;

    task.currentStepId =
        step.id;

    task.status =
        TASK_STATES.RUNNING;

    task.updatedAt =
        now();


    return {

        success: true,

        step:
            clone(
                step
            ),

        task:
            clone(
                task
            )
    };
}


// ============================================================
// COMPLETE STEP
// ============================================================

function completeStep(
    taskId,
    stepId,
    result = null
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    const step =
        task.steps.find(
            item =>
                item.id ===
                safeString(
                    stepId
                )
        );


    if (!step) {

        return {

            success: false,

            error:
                "Step not found."
        };
    }


    step.status =
        STEP_STATES.COMPLETED;

    step.result =
        result;

    step.error =
        null;

    step.completedAt =
        now();

    task.updatedAt =
        now();


    const remaining =
        task.steps.some(
            item =>
                !isTerminalStep(
                    item.status
                )
        );


    if (!remaining) {

        task.status =
            TASK_STATES.COMPLETED;

        task.result =
            buildTaskResult(
                task
            );

        task.completedAt =
            now();

        task.currentStepId =
            null;


        updateAgentStateFromTask(
            task
        );
    }


    return {

        success: true,

        step:
            clone(
                step
            ),

        task:
            clone(
                task
            ),

        taskCompleted:
            task.status ===
            TASK_STATES.COMPLETED
    };
}


// ============================================================
// FAIL STEP
// ============================================================

function failStep(
    taskId,
    stepId,
    error
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    const step =
        task.steps.find(
            item =>
                item.id ===
                safeString(
                    stepId
                )
        );


    if (!step) {

        return {

            success: false,

            error:
                "Step not found."
        };
    }


    step.retries += 1;

    step.error =
        safeString(
            error
        ) ||
        "Step failed.";


    if (
        step.retries <=
        step.maxRetries
    ) {

        step.status =
            STEP_STATES.PENDING;

        task.retries += 1;

        task.status =
            TASK_STATES.RUNNING;

    } else {

        step.status =
            STEP_STATES.FAILED;

        task.status =
            TASK_STATES.FAILED;

        task.error =
            step.error;
    }


    task.updatedAt =
        now();


    updateAgentStateFromTask(
        task
    );


    return {

        success: true,

        step:
            clone(
                step
            ),

        task:
            clone(
                task
            ),

        retryAvailable:
            step.status ===
            STEP_STATES.PENDING
    };
}


// ============================================================
// SKIP STEP
// ============================================================

function skipStep(
    taskId,
    stepId,
    reason = "Step skipped."
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    const step =
        task.steps.find(
            item =>
                item.id ===
                safeString(
                    stepId
                )
        );


    if (!step) {

        return {

            success: false,

            error:
                "Step not found."
        };
    }


    if (
        isTerminalStep(
            step.status
        )
    ) {

        return {

            success: false,

            error:
                "Step is already in a terminal state."
        };
    }


    step.status =
        STEP_STATES.SKIPPED;

    step.error =
        safeString(
            reason
        );

    step.completedAt =
        now();

    task.updatedAt =
        now();


    return {

        success: true,

        step:
            clone(
                step
            ),

        task:
            clone(
                task
            )
    };
}


// ============================================================
// EXECUTE NEXT STEP
// ============================================================
//
// `runner` is supplied by the controlled execution layer.
//
// Example runner signature:
//
// async ({ task, step }) => {
//     return { success: true, data: ... };
// }
//
// The Agent Manager never executes arbitrary code by itself.
// ============================================================

async function executeNextStep(
    taskId,
    runner
) {

    const task =
        tasks.get(
            safeString(
                taskId
            )
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        typeof runner !==
        "function"
    ) {

        return {

            success: false,

            error:
                "A controlled runner function is required."
        };
    }


    const next =
        getNextStep(
            task.id
        );


    if (!next.success) {

        return next;
    }


    if (
        next.done
    ) {

        task.status =
            TASK_STATES.COMPLETED;

        task.result =
            buildTaskResult(
                task
            );

        task.completedAt =
            now();

        task.updatedAt =
            now();


        updateAgentStateFromTask(
            task
        );


        return {

            success: true,

            done:
                true,

            task:
                clone(
                    task
                )
        };
    }


    const stepId =
        next.step.id;


    const start =
        startStep(
            task.id,
            stepId
        );


    if (!start.success) {

        return start;
    }


    const currentStep =
        task.steps.find(
            step =>
                step.id ===
                stepId
        );


    try {

        const result =
            await runner({

                task:
                    clone(
                        task
                    ),

                step:
                    clone(
                        currentStep
                    ),

                permission:
                    resolveStepPermission(
                        currentStep
                    )
            });


        if (
            !result ||
            result.success !== true
        ) {

            const failure =
                failStep(
                    task.id,
                    stepId,
                    result?.error ||
                    "Step execution failed."
                );

            return {

                success: false,

                executed:
                    true,

                result:
                    result || null,

                failure
            };
        }


        const completed =
            completeStep(
                task.id,
                stepId,
                result
            );


        return {

            success: true,

            executed:
                true,

            step:
                completed.step,

            task:
                completed.task,

            done:
                completed.taskCompleted
        };

    } catch (error) {

        const failure =
            failStep(
                task.id,
                stepId,
                error.message
            );


        return {

            success: false,

            executed:
                true,

            error:
                error.message,

            failure
        };
    }
}


// ============================================================
// RUN TASK
// ============================================================
//
// This repeatedly invokes the controlled runner until:
// - task completes
// - task pauses
// - task stops
// - task waits for approval
// - task fails
// ============================================================

async function runTask(
    taskId,
    runner,
    options = {}
) {

    const start =
        startTask(
            taskId
        );


    if (!start.success) {

        return start;
    }


    const maxIterations =
        Number(
            safeObject(
                options
            ).maxIterations
        ) || 100;


    let iterations =
        0;


    while (
        iterations <
        maxIterations
    ) {

        iterations += 1;


        const task =
            tasks.get(
                safeString(
                    taskId
                )
            );


        if (!task) {

            return {

                success: false,

                error:
                    "Task not found during execution."
            };
        }


        if (
            task.status ===
            TASK_STATES.PAUSED
        ) {

            return {

                success: true,

                paused:
                    true,

                task:
                    clone(
                        task
                    )
            };
        }


        if (
            task.status ===
            TASK_STATES.STOPPED
        ) {

            return {

                success: true,

                stopped:
                    true,

                task:
                    clone(
                        task
                    )
            };
        }


        if (
            task.status ===
            TASK_STATES.WAITING_APPROVAL
        ) {

            return {

                success: true,

                waitingApproval:
                    true,

                task:
                    clone(
                        task
                    )
            };
        }


        if (
            task.status ===
            TASK_STATES.FAILED
        ) {

            return {

                success: false,

                failed:
                    true,

                task:
                    clone(
                        task
                    )
            };
        }


        if (
            task.status ===
            TASK_STATES.COMPLETED
        ) {

            return {

                success: true,

                completed:
                    true,

                task:
                    clone(
                        task
                    )
            };
        }


        const result =
            await executeNextStep(
                task.id,
                runner
            );


        if (
            result.task?.status ===
            TASK_STATES.COMPLETED
        ) {

            return {

                success: true,

                completed:
                    true,

                iterations,

                task:
                    result.task
            };
        }


        if (
            result.task?.status ===
            TASK_STATES.FAILED
        ) {

            return {

                success: false,

                failed:
                    true,

                iterations,

                task:
                    result.task
            };
        }


        if (
            !result.success
        ) {

            const latest =
                tasks.get(
                    task.id
                );

            if (
                latest &&
                latest.status ===
                TASK_STATES.FAILED
            ) {

                return {

                    success: false,

                    failed:
                        true,

                    iterations,

                    task:
                        clone(
                            latest
                        )
                };
            }
        }
    }


    return {

        success: false,

        error:
            "Maximum execution iterations reached.",

        task:
            clone(
                tasks.get(
                    safeString(
                        taskId
                    )
                )
            )
    };
}


// ============================================================
// UPDATE AGENT STATE
// ============================================================

function updateAgentStateFromTask(
    task
) {

    const agent =
        agents.get(
            task.agentId
        );

    if (!agent) {

        return;
    }


    if (
        task.status ===
        TASK_STATES.RUNNING
    ) {

        agent.state =
            AGENT_STATES.WORKING;

        agent.activeTaskId =
            task.id;

    } else if (
        task.status ===
        TASK_STATES.PAUSED
    ) {

        agent.state =
            AGENT_STATES.PAUSED;

        agent.activeTaskId =
            task.id;

    } else if (
        task.status ===
        TASK_STATES.STOPPED ||
        task.status ===
        TASK_STATES.CANCELLED
    ) {

        agent.state =
            AGENT_STATES.STOPPED;

        agent.activeTaskId =
            null;

    } else if (
        task.status ===
        TASK_STATES.COMPLETED
    ) {

        agent.state =
            AGENT_STATES.COMPLETED;

        agent.activeTaskId =
            null;

    } else if (
        task.status ===
        TASK_STATES.FAILED
    ) {

        agent.state =
            AGENT_STATES.ERROR;

        agent.activeTaskId =
            null;

    } else {

        agent.state =
            AGENT_STATES.READY;

        agent.activeTaskId =
            task.id;
    }


    agent.updatedAt =
        now();
}


// ============================================================
// BUILD TASK RESULT
// ============================================================

function buildTaskResult(
    task
) {

    return {

        taskId:
            task.id,

        agentId:
            task.agentId,

        request:
            task.request,

        status:
            task.status,

        completedSteps:
            task.steps
                .filter(
                    step =>
                        step.status ===
                        STEP_STATES.COMPLETED
                )
                .length,

        totalSteps:
            task.steps.length,

        steps:
            task.steps.map(
                step => ({

                    id:
                        step.id,

                    name:
                        step.name,

                    description:
                        step.description,

                    status:
                        step.status,

                    result:
                        step.result
                })
            ),

        completedAt:
            task.completedAt
    };
}


// ============================================================
// DELETE TASK
// ============================================================

function deleteTask(
    taskId
) {

    const id =
        safeString(
            taskId
        );

    const task =
        tasks.get(
            id
        );

    if (!task) {

        return {

            success: false,

            error:
                "Task not found."
        };
    }


    if (
        task.status ===
        TASK_STATES.RUNNING
    ) {

        return {

            success: false,

            error:
                "Running task cannot be deleted. Stop it first."
        };
    }


    tasks.delete(
        id
    );


    const agent =
        agents.get(
            task.agentId
        );


    if (agent) {

        agent.taskIds =
            agent.taskIds.filter(
                item =>
                    item !== id
            );

        if (
            agent.activeTaskId ===
            id
        ) {

            agent.activeTaskId =
                null;
        }

        agent.updatedAt =
            now();
    }


    return {

        success: true,

        deleted:
            id
    };
}


// ============================================================
// DELETE AGENT
// ============================================================

function deleteAgent(
    agentId
) {

    const id =
        safeString(
            agentId
        );

    const agent =
        agents.get(
            id
        );

    if (!agent) {

        return {

            success: false,

            error:
                "Agent not found."
        };
    }


    if (
        agent.activeTaskId
    ) {

        return {

            success: false,

            error:
                "Agent has an active task. Stop the task first."
        };
    }


    for (
        const taskId of agent.taskIds
    ) {

        tasks.delete(
            taskId
        );
    }


    agents.delete(
        id
    );


    return {

        success: true,

        deleted:
            id
    };
}


// ============================================================
// RESET STORE
// ============================================================
//
// Primarily useful for tests.
// ============================================================

function reset() {

    agents.clear();
    tasks.clear();


    return {

        success: true,

        status:
            "agent-store-reset"
    };
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    const taskList =
        Array.from(
            tasks.values()
        );


    return {

        success: true,

        version:
            AGENT_MANAGER_VERSION,

        agents:
            agents.size,

        tasks:
            tasks.size,

        runningTasks:
            taskList.filter(
                task =>
                    task.status ===
                    TASK_STATES.RUNNING
            ).length,

        pausedTasks:
            taskList.filter(
                task =>
                    task.status ===
                    TASK_STATES.PAUSED
            ).length,

        waitingApprovalTasks:
            taskList.filter(
                task =>
                    task.status ===
                    TASK_STATES.WAITING_APPROVAL
            ).length,

        completedTasks:
            taskList.filter(
                task =>
                    task.status ===
                    TASK_STATES.COMPLETED
            ).length,

        failedTasks:
            taskList.filter(
                task =>
                    task.status ===
                    TASK_STATES.FAILED
            ).length
    };
}


// ============================================================
// CLONE
// ============================================================

function clone(
    value
) {

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
// EXPORTS
// ============================================================

module.exports = {

    AGENT_MANAGER_VERSION,

    AGENT_STATES,

    TASK_STATES,

    STEP_STATES,

    createAgent,

    getAgent,

    listAgents,

    createTask,

    getTask,

    listTasks,

    addStep,

    addSteps,

    planTask,

    approveTask,

    approveStep,

    startTask,

    pauseTask,

    resumeTask,

    stopTask,

    cancelTask,

    getNextStep,

    startStep,

    completeStep,

    failStep,

    skipStep,

    executeNextStep,

    runTask,

    deleteTask,

    deleteAgent,

    getStatus,

    reset
};
