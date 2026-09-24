// ============================================================
// AARHEN CORE V5
// AUTONOMOUS WORKER CONTROLLER
// ============================================================
// Version: 5.10.3
//
// Purpose:
// - Connect Autonomous Agent with Agent Worker
// - Route planned tasks into a Worker
// - Use Worker Provider for provider-aware execution
// - Preserve Planner + Manager + Runner safety
// - Support autonomous request execution
// - Support approval flow
// - Support worker-aware task status
// - Prepare AarHen for future multi-worker orchestration
//
// Architecture:
//
// User Request
//       ↓
// Autonomous Agent
//       ↓
// Agent Planner
//       ↓
// Agent Manager
//       ↓
// Autonomous Worker Controller
//       ↓
// Agent Worker
//       ↓
// Worker Provider
//       ↓
// Provider Bridge
//       ↓
// Provider Manager
//       ↓
// Agent Runner
//
// IMPORTANT:
// - Does NOT bypass Autonomous Agent.
// - Does NOT bypass Agent Planner.
// - Does NOT bypass Agent Manager.
// - Does NOT bypass Agent Worker.
// - Does NOT bypass Agent Runner.
// - Provider access remains controlled through Worker Provider.
// ============================================================


const autonomousAgent =
    require("./autonomousAgent");


const agentManager =
    require("./agentManager");


const agentWorker =
    require("./agentWorker");


const workerProvider =
    require("./workerProvider");


// ============================================================
// VERSION
// ============================================================

const AUTONOMOUS_WORKER_VERSION =
    "5.10.3";


// ============================================================
// INTERNAL STATE
// ============================================================

const agentWorkerBindings =
    new Map();


// ============================================================
// HELPERS
// ============================================================

function safeString(
    value
) {

    return String(
        value ?? ""
    ).trim();

}


function safeObject(
    value
) {

    return (
        value &&
        typeof value === "object"
    )
        ? value
        : {};

}


function safeArray(
    value
) {

    return Array.isArray(
        value
    )
        ? value
        : [];

}


function clone(
    value
) {

    if (
        value ===
        undefined
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
// GET EXISTING WORKER FOR AGENT
// ============================================================

function findWorkerForAgent(
    agentId
) {

    const normalizedAgentId =
        safeString(
            agentId
        );


    if (
        !normalizedAgentId
    ) {

        return null;

    }


    const boundWorkerId =
        agentWorkerBindings.get(
            normalizedAgentId
        );


    if (
        boundWorkerId
    ) {

        const existing =
            agentWorker.getWorker(
                boundWorkerId
            );


        if (
            existing.success &&
            existing.worker?.agentId ===
                normalizedAgentId &&
            existing.worker?.status !==
                agentWorker.WORKER_STATES.STOPPED
        ) {

            return existing.worker;

        }


        agentWorkerBindings.delete(
            normalizedAgentId
        );

    }


    const list =
        agentWorker.listWorkers();


    if (
        !list.success
    ) {

        return null;

    }


    const matching =
        safeArray(
            list.workers
        ).find(
            worker =>
                worker.agentId ===
                normalizedAgentId &&
                worker.status !==
                    agentWorker.WORKER_STATES.STOPPED
        );


    if (
        matching
    ) {

        agentWorkerBindings.set(
            normalizedAgentId,
            matching.id
        );

        return matching;

    }


    return null;

}


// ============================================================
// ENSURE WORKER FOR AGENT
// ============================================================

function ensureWorkerForAgent(
    agentId,
    options = {}
) {

    const normalizedAgentId =
        safeString(
            agentId
        );


    if (
        !normalizedAgentId
    ) {

        return {

            success:
                false,

            error:
                "Agent ID is required."

        };

    }


    const existing =
        findWorkerForAgent(
            normalizedAgentId
        );


    if (
        existing
    ) {

        return {

            success:
                true,

            created:
                false,

            worker:
                clone(
                    existing
                )

        };

    }


    const config =
        safeObject(
            options
        );


    const created =
        agentWorker.createWorker({

            name:
                safeString(
                    config.workerName
                ) ||
                `AarHen Worker - ${normalizedAgentId}`,

            agentId:
                normalizedAgentId,

            metadata: {

                autonomous:
                    true,

                agentId:
                    normalizedAgentId,

                ...safeObject(
                    config.metadata
                )

            }

        });


    if (
        !created.success
    ) {

        return {

            success:
                false,

            error:
                created.error ||
                "Unable to create worker."

        };

    }


    agentWorkerBindings.set(
        normalizedAgentId,
        created.worker.id
    );


    return {

        success:
            true,

        created:
            true,

        worker:
            clone(
                created.worker
            )

    };

}


// ============================================================
// GET WORKER FOR TASK
// ============================================================

function getWorkerForTask(
    task
) {

    const agentId =
        safeString(
            task?.agentId
        );


    if (
        !agentId
    ) {

        return {

            success:
                false,

            error:
                "Task agent ID is missing."

        };

    }


    return ensureWorkerForAgent(
        agentId
    );

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


    if (
        !id
    ) {

        return {

            success:
                false,

            error:
                "Task ID is required."

        };

    }


    return agentManager.getTask(
        id
    );

}


// ============================================================
// ASSIGN TASK TO WORKER
// ============================================================

function assignTask(
    workerId,
    taskId
) {

    return agentWorker.assignTask(
        workerId,
        taskId
    );

}


// ============================================================
// CREATE AUTONOMOUS TASK
// ============================================================
//
// Autonomous Agent remains responsible for planning.
//
// This controller does not create raw tasks directly.
// ============================================================

function createTask(
    request,
    options = {}
) {

    const cleanRequest =
        safeString(
            request
        );


    if (
        !cleanRequest
    ) {

        return {

            success:
                false,

            error:
                "Request is required."

        };

    }


    const result =
        autonomousAgent.createTask(

            cleanRequest,

            safeObject(
                options
            )

        );


    return result;

}


// ============================================================
// CREATE + ASSIGN
// ============================================================
//
// Flow:
//
// Request
//   ↓
// Autonomous Agent
//   ↓
// Planner
//   ↓
// Agent Manager
//   ↓
// Worker
//
// No execution occurs here.
// ============================================================

function createAndAssign(
    request,
    options = {}
) {

    const created =
        createTask(
            request,
            options
        );


    if (
        !created.success
    ) {

        return created;

    }


    const task =
        created.task;


    if (
        !task?.id
    ) {

        return {

            success:
                false,

            stage:
                "task-resolution",

            error:
                "Autonomous task ID is missing.",

            created

        };

    }


    const workerResult =
        getWorkerForTask(
            task
        );


    if (
        !workerResult.success
    ) {

        return {

            success:
                false,

            stage:
                "worker-creation",

            task,

            created,

            error:
                workerResult.error ||
                "Unable to resolve worker."

        };

    }


    const assignment =
        assignTask(

            workerResult.worker.id,

            task.id

        );


    if (
        !assignment.success
    ) {

        return {

            success:
                false,

            stage:
                "worker-assignment",

            task,

            worker:
                workerResult.worker,

            created,

            error:
                assignment.error ||
                "Unable to assign task to worker."

        };

    }


    return {

        success:
            true,

        stage:
            task.status ===
            agentManager.TASK_STATES.WAITING_APPROVAL

                ? "approval"

                : "assigned",

        waitingApproval:
            task.status ===
            agentManager.TASK_STATES.WAITING_APPROVAL,

        created,

        task,

        worker:
            workerResult.worker,

        assignment

    };

}


// ============================================================
// EXECUTE ASSIGNED TASK
// ============================================================
//
// Provider-aware execution is delegated to Worker Provider.
//
// ============================================================

async function executeAssignedTask(
    workerId,
    taskId,
    options = {}
) {

    const cleanWorkerId =
        safeString(
            workerId
        );


    const cleanTaskId =
        safeString(
            taskId
        );


    if (
        !cleanWorkerId
    ) {

        return {

            success:
                false,

            error:
                "Worker ID is required."

        };

    }


    if (
        !cleanTaskId
    ) {

        return {

            success:
                false,

            error:
                "Task ID is required."

        };

    }


    const taskResult =
        getTask(
            cleanTaskId
        );


    if (
        !taskResult.success
    ) {

        return taskResult;

    }


    const task =
        taskResult.task;


    if (
        task.status ===
        agentManager.TASK_STATES.WAITING_APPROVAL
    ) {

        return {

            success:
                true,

            stage:
                "approval",

            waitingApproval:
                true,

            task,
            
            workerId:
                cleanWorkerId

        };

    }


    if (
        !workerProvider ||
        typeof workerProvider.runTask !==
        "function"
    ) {

        return {

            success:
                false,

            stage:
                "worker-provider",

            error:
                "Worker Provider is unavailable.",

            task

        };

    }


    const result =
        await workerProvider.runTask(

            cleanWorkerId,

            cleanTaskId,

            {

                ...safeObject(
                    options
                ),

                context:
                    safeObject(
                        options.context
                    )

            }

        );


    return {

        success:
            result.success ===
            true,

        stage:
            result.stage ||
            "execution",

        task:
            result.task ||
            task,

        worker:
            result.worker ||
            null,

        execution:
            result.execution ||
            null,

        provider:
            result.provider ||
            null,

        workerStatus:
            result.workerStatus ||
            null,

        result

    };

}


// ============================================================
// EXECUTE REQUEST
// ============================================================
//
// Main high-level autonomous + worker API.
//
// ============================================================

async function executeRequest(
    request,
    options = {}
) {

    const assignment =
        createAndAssign(

            request,

            options

        );


    if (
        !assignment.success
    ) {

        return assignment;

    }


    if (
        assignment.waitingApproval
    ) {

        return {

            success:
                true,

            stage:
                "approval",

            waitingApproval:
                true,

            request:
                safeString(
                    request
                ),

            created:
                assignment.created,

            task:
                assignment.task,

            worker:
                assignment.worker,

            assignment:
                assignment.assignment

        };

    }


    const execution =
        await executeAssignedTask(

            assignment.worker.id,

            assignment.task.id,

            options

        );


    return {

        success:
            execution.success,

        stage:
            execution.stage,

        request:
            safeString(
                request
            ),

        task:
            execution.task ||
            assignment.task,

        worker:
            execution.worker ||
            assignment.worker,

        provider:
            execution.provider ||
            null,

        execution:
            execution.execution ||
            null,

        assignment,
        
        workerStatus:
            execution.workerStatus ||
            null

    };

}


// ============================================================
// APPROVE TASK
// ============================================================

function approveTask(
    taskId
) {

    return autonomousAgent.approveTask(
        taskId
    );

}


// ============================================================
// APPROVE + EXECUTE
// ============================================================

async function approveAndExecute(
    taskId,
    options = {}
) {

    const taskResult =
        getTask(
            taskId
        );


    if (
        !taskResult.success
    ) {

        return taskResult;

    }


    const task =
        taskResult.task;


    const workerResult =
        getWorkerForTask(
            task
        );


    if (
        !workerResult.success
    ) {

        return workerResult;

    }


    const approval =
        autonomousAgent.approveTask(
            taskId
        );


    if (
        !approval.success
    ) {

        return {

            success:
                false,

            stage:
                "approval",

            approval,

            task:
                task,

            worker:
                workerResult.worker

        };

    }


    // --------------------------------------------------------
    // Ensure task is assigned to this worker.
    // --------------------------------------------------------

    const latestTaskResult =
        getTask(
            taskId
        );


    const latestTask =
        latestTaskResult.success
            ? latestTaskResult.task
            : task;


    const workerQueue =
        agentWorker.getQueue(
            workerResult.worker.id
        );


    const alreadyAssigned =
        workerQueue.success &&
        (
            workerQueue.activeTaskId ===
                taskId ||
            workerQueue.queue.includes(
                taskId
            )
        );


    let assignment =
        null;


    if (
        !alreadyAssigned
    ) {

        assignment =
            assignTask(

                workerResult.worker.id,

                taskId

            );


        if (
            !assignment.success
        ) {

            return {

                success:
                    false,

                stage:
                    "worker-assignment",

                approval,

                task:
                    latestTask,

                worker:
                    workerResult.worker,

                assignment,

                error:
                    assignment.error ||
                    "Unable to assign approved task."

            };

        }

    }


    const execution =
        await executeAssignedTask(

            workerResult.worker.id,

            taskId,

            options

        );


    return {

        success:
            execution.success,

        stage:
            execution.stage,

        approval,

        assignment,

        execution,

        task:
            execution.task ||
            latestTask,

        worker:
            execution.worker ||
            workerResult.worker,

        provider:
            execution.provider ||
            null

    };

}


// ============================================================
// PAUSE TASK
// ============================================================

function pauseTask(
    taskId
) {

    return autonomousAgent.pauseTask(
        taskId
    );

}


// ============================================================
// RESUME TASK
// ============================================================

async function resumeTask(
    taskId,
    options = {}
) {

    const taskResult =
        getTask(
            taskId
        );


    if (
        !taskResult.success
    ) {

        return taskResult;

    }


    const workerResult =
        getWorkerForTask(
            taskResult.task
        );


    if (
        !workerResult.success
    ) {

        return workerResult;

    }


    const resumed =
        autonomousAgent.resumeTask(
            taskId
        );


    if (
        !resumed.success
    ) {

        return resumed;

    }


    const workerQueue =
        agentWorker.getQueue(
            workerResult.worker.id
        );


    const alreadyAssigned =
        workerQueue.success &&
        (
            workerQueue.activeTaskId ===
                taskId ||
            workerQueue.queue.includes(
                taskId
            )
        );


    let assignment =
        null;


    if (
        !alreadyAssigned
    ) {

        assignment =
            assignTask(

                workerResult.worker.id,

                taskId

            );


        if (
            !assignment.success
        ) {

            return {

                success:
                    false,

                stage:
                    "worker-assignment",

                resume:
                    resumed,

                assignment,

                error:
                    assignment.error ||
                    "Unable to reassign resumed task."

            };

        }

    }


    const execution =
        await executeAssignedTask(

            workerResult.worker.id,

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

        assignment,

        execution,

        task:
            execution.task ||
            null,

        worker:
            execution.worker ||
            workerResult.worker,

        provider:
            execution.provider ||
            null

    };

}


// ============================================================
// STOP TASK
// ============================================================

function stopTask(
    taskId,
    reason
) {

    const result =
        autonomousAgent.stopTask(

            taskId,

            reason

        );


    return result;

}


// ============================================================
// CANCEL TASK
// ============================================================

function cancelTask(
    taskId,
    reason
) {

    const result =
        autonomousAgent.cancelTask(

            taskId,

            reason

        );


    return result;

}


// ============================================================
// TASK STATUS
// ============================================================

function getTaskStatus(
    taskId
) {

    const taskResult =
        getTask(
            taskId
        );


    if (
        !taskResult.success
    ) {

        return taskResult;

    }


    const task =
        taskResult.task;


    const workerResult =
        getWorkerForTask(
            task
        );


    if (
        !workerResult.success
    ) {

        return {

            success:
                true,

            taskId:
                task.id,

            agentId:
                task.agentId,

            taskStatus:
                task.status,

            worker:
                null,

            workerStatus:
                null,

            providerRequired:
                workerProvider.taskNeedsProvider(
                    task
                )

        };

    }


    const worker =
        workerResult.worker;


    const providerStatus =
        workerProvider.getTaskStatus(
            task.id
        );


    return {

        success:
            true,

        taskId:
            task.id,

        agentId:
            task.agentId,

        taskStatus:
            task.status,

        workerId:
            worker.id,

        workerStatus:
            worker.status,

        activeTaskId:
            worker.activeTaskId,

        queue:
            safeArray(
                worker.queue
            ),

        provider:
            providerStatus,

        autonomousWorkerVersion:
            AUTONOMOUS_WORKER_VERSION

    };

}


// ============================================================
// LIST TASKS
// ============================================================

function listTasks(
    agentId = null
) {

    return autonomousAgent.listTasks(
        agentId
    );

}


// ============================================================
// LIST WORKERS
// ============================================================

function listWorkers() {

    return agentWorker.listWorkers();

}


// ============================================================
// LIST AGENTS
// ============================================================

function listAgents() {

    return autonomousAgent.listAgents();

}


// ============================================================
// SYSTEM STATUS
// ============================================================

function getStatus() {

    const autonomousStatus =
        autonomousAgent.getStatus();


    const workerStatus =
        agentWorker.getStatus();


    const providerStatus =
        workerProvider.getStatus();


    return {

        success:
            true,

        version:
            AUTONOMOUS_WORKER_VERSION,

        name:
            "AarHen Autonomous Worker Controller",

        status:
            "active",

        systems: {

            autonomousAgent: {

                connected:
                    autonomousStatus.success ===
                    true,

                version:
                    autonomousStatus.version ||
                    null

            },

            agentWorker: {

                connected:
                    workerStatus.success ===
                    true,

                version:
                    workerStatus.version ||
                    null,

                status:
                    workerStatus.status ||
                    null

            },

            workerProvider: {

                connected:
                    providerStatus.success ===
                    true,

                version:
                    providerStatus.version ||
                    null,

                status:
                    providerStatus.status ||
                    null,

                integration:
                    providerStatus.integration ===
                    true

            }

        },

        bindingCount:
            agentWorkerBindings.size

    };

}


// ============================================================
// RESET
// ============================================================

function reset() {

    agentWorkerBindings.clear();


    return {

        success:
            true,

        version:
            AUTONOMOUS_WORKER_VERSION,

        status:
            "autonomous-worker-reset",

        workerStatePreserved:
            true,

        autonomousStatePreserved:
            true

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    AUTONOMOUS_WORKER_VERSION,

    getTask,

    ensureWorkerForAgent,

    findWorkerForAgent,

    getWorkerForTask,

    assignTask,

    createTask,

    createAndAssign,

    executeAssignedTask,

    executeRequest,

    approveTask,

    approveAndExecute,

    pauseTask,

    resumeTask,

    stopTask,

    cancelTask,

    getTaskStatus,

    listTasks,

    listWorkers,

    listAgents,

    getStatus,

    reset

};
