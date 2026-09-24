// ============================================================
// AARHEN CORE V5
// AGENT WORKER
// ============================================================
// Version: 5.10.1
//
// Purpose:
// - Provide a controlled worker layer above Agent Runner
// - Queue agent tasks
// - Execute tasks sequentially
// - Track worker state
// - Support pause / resume / stop / cancel
// - Preserve task execution status
// - Prevent duplicate worker execution
// - Prepare AarHen for future multi-worker execution
//
// Architecture:
//
// Autonomous Agent
//       ↓
// Agent Manager
//       ↓
// Agent Worker
//       ↓
// Agent Runner
//
// IMPORTANT:
// Worker never bypasses Agent Manager or Agent Runner.
// All task execution remains permission-controlled.
// ============================================================

const agentManager =
    require("./agentManager");


const agentRunner =
    require("./agentRunner");


// ============================================================
// VERSION
// ============================================================

const AGENT_WORKER_VERSION =
    "5.10.1";


// ============================================================
// WORKER STATES
// ============================================================

const WORKER_STATES = Object.freeze({

    IDLE:
        "idle",

    RUNNING:
        "running",

    WAITING_APPROVAL:
        "waiting-approval",

    PAUSED:
        "paused",

    STOPPED:
        "stopped",

    ERROR:
        "error"

});


// ============================================================
// INTERNAL REGISTRY
// ============================================================

const workers =
    new Map();


// ============================================================
// ID GENERATOR
// ============================================================

let workerSequence =
    0;


function createId(
    prefix = "worker"
) {

    workerSequence += 1;

    return (
        `${prefix}-${Date.now()}-${workerSequence}`
    );

}


// ============================================================
// HELPERS
// ============================================================

function safeString(value) {

    return String(
        value ?? ""
    ).trim();

}


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


function now() {

    return new Date()
        .toISOString();

}


// ============================================================
// CREATE WORKER
// ============================================================

function createWorker(
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
            "worker"
        );


    if (
        workers.has(id)
    ) {

        return {

            success:
                false,

            error:
                `Worker "${id}" already exists.`

        };

    }


    const worker = {

        id,

        name:
            safeString(
                config.name
            ) ||
            `AarHen Worker ${workers.size + 1}`,

        agentId:
            safeString(
                config.agentId
            ) ||
            null,

        status:
            WORKER_STATES.IDLE,

        queue:
            [],

        activeTaskId:
            null,

        totalRuns:
            0,

        successfulRuns:
            0,

        failedRuns:
            0,

        completedTasks:
            0,

        waitingApprovalTasks:
            0,

        pausedTasks:
            0,

        stoppedTasks:
            0,

        lastResult:
            null,

        lastError:
            null,

        createdAt:
            now(),

        updatedAt:
            now(),

        metadata:
            clone(
                safeObject(
                    config.metadata
                )
            )

    };


    workers.set(
        id,
        worker
    );


    return {

        success:
            true,

        worker:
            clone(
                worker
            )

    };

}


// ============================================================
// GET WORKER
// ============================================================

function getWorker(
    workerId
) {

    const id =
        safeString(
            workerId
        );


    const worker =
        workers.get(
            id
        );


    if (!worker) {

        return {

            success:
                false,

            error:
                "Worker not found."

        };

    }


    return {

        success:
            true,

        worker:
            clone(
                worker
            )

    };

}


// ============================================================
// LIST WORKERS
// ============================================================

function listWorkers() {

    return {

        success:
            true,

        count:
            workers.size,

        workers:
            Array.from(
                workers.values()
            )
                .map(
                    worker =>
                        clone(
                            worker
                        )
                )

    };

}


// ============================================================
// ENSURE DEFAULT WORKER
// ============================================================

function ensureDefaultWorker() {

    for (
        const worker of
        workers.values()
    ) {

        if (
            worker.metadata?.default ===
            true
        ) {

            return {

                success:
                    true,

                worker:
                    clone(
                        worker
                    ),

                created:
                    false

            };

        }

    }


    const created =
        createWorker({

            name:
                "AarHen Default Worker",

            metadata: {

                default:
                    true

            }

        });


    return {

        success:
            created.success,

        worker:
            created.worker ||
            null,

        created:
            true

    };

}


// ============================================================
// GET DEFAULT WORKER
// ============================================================

function getDefaultWorker() {

    for (
        const worker of
        workers.values()
    ) {

        if (
            worker.metadata?.default ===
            true
        ) {

            return {

                success:
                    true,

                worker:
                    clone(
                        worker
                    )

            };

        }

    }


    return ensureDefaultWorker();

}


// ============================================================
// RESOLVE WORKER
// ============================================================

function resolveWorker(
    workerId
) {

    const id =
        safeString(
            workerId
        );


    if (!id) {

        const defaultWorker =
            getDefaultWorker();


        if (
            !defaultWorker.success
        ) {

            return defaultWorker;

        }


        return {

            success:
                true,

            worker:
                workers.get(
                    defaultWorker.worker.id
                )

        };

    }


    const worker =
        workers.get(
            id
        );


    if (!worker) {

        return {

            success:
                false,

            error:
                "Worker not found."

        };

    }


    return {

        success:
            true,

        worker

    };

}


// ============================================================
// ASSIGN TASK
// ============================================================

function assignTask(
    workerId,
    taskId
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    const normalizedTaskId =
        safeString(
            taskId
        );


    if (!normalizedTaskId) {

        return {

            success:
                false,

            error:
                "Task ID is required."

        };

    }


    const taskResult =
        agentManager.getTask(
            normalizedTaskId
        );


    if (
        !taskResult.success
    ) {

        return {

            success:
                false,

            error:
                taskResult.error ||
                "Task not found."

        };

    }


    const task =
        taskResult.task;


    // --------------------------------------------------------
    // Worker → Agent binding
    // --------------------------------------------------------

    if (
        worker.agentId &&
        task.agentId &&
        worker.agentId !==
        task.agentId
    ) {

        return {

            success:
                false,

            error:
                "Task agent does not match the worker's bound agent."

        };

    }


    // --------------------------------------------------------
    // Prevent duplicate queue entries
    // --------------------------------------------------------

    if (
        worker.activeTaskId ===
        normalizedTaskId ||
        worker.queue.includes(
            normalizedTaskId
        )
    ) {

        return {

            success:
                false,

            error:
                "Task is already assigned to this worker."

        };

    }


    // --------------------------------------------------------
    // Terminal tasks cannot be assigned
    // --------------------------------------------------------

    if (
        task.status ===
        agentManager.TASK_STATES.COMPLETED ||
        task.status ===
        agentManager.TASK_STATES.FAILED ||
        task.status ===
        agentManager.TASK_STATES.STOPPED ||
        task.status ===
        agentManager.TASK_STATES.CANCELLED
    ) {

        return {

            success:
                false,

            error:
                "A terminal task cannot be assigned to a worker."

        };

    }


    // --------------------------------------------------------
    // Stopped worker cannot accept new work
    // --------------------------------------------------------

    if (
        worker.status ===
        WORKER_STATES.STOPPED
    ) {

        return {

            success:
                false,

            stopped:
                true,

            error:
                "Stopped worker cannot accept new tasks."

        };

    }


    worker.queue.push(
        normalizedTaskId
    );


    worker.updatedAt =
        now();


    return {

        success:
            true,

        workerId:
            worker.id,

        taskId:
            normalizedTaskId,

        queueLength:
            worker.queue.length,

        status:
            "task-assigned"

    };

}


// ============================================================
// QUEUE TASK ALIAS
// ============================================================

function enqueueTask(
    workerId,
    taskId
) {

    return assignTask(
        workerId,
        taskId
    );

}


// ============================================================
// REMOVE TASK FROM QUEUE
// ============================================================

function removeTaskFromQueue(
    worker,
    taskId
) {

    const normalizedTaskId =
        safeString(
            taskId
        );


    if (
        !normalizedTaskId
    ) {

        return false;

    }


    const index =
        worker.queue.indexOf(
            normalizedTaskId
        );


    if (
        index === -1
    ) {

        return false;

    }


    worker.queue.splice(
        index,
        1
    );


    return true;

}


// ============================================================
// RUN ASSIGNED TASK
// ============================================================

async function runAssignedTask(
    workerId,
    options = {}
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    // --------------------------------------------------------
    // Prevent concurrent execution
    // --------------------------------------------------------

    if (
        worker.status ===
        WORKER_STATES.RUNNING
    ) {

        return {

            success:
                false,

            error:
                "Worker is already running a task."

        };

    }


    // --------------------------------------------------------
    // Worker pause state
    // --------------------------------------------------------

    if (
        worker.status ===
        WORKER_STATES.PAUSED
    ) {

        return {

            success:
                false,

            paused:
                true,

            error:
                "Worker is paused."

        };

    }


    // --------------------------------------------------------
    // Worker stop state
    // --------------------------------------------------------

    if (
        worker.status ===
        WORKER_STATES.STOPPED
    ) {

        return {

            success:
                false,

            stopped:
                true,

            error:
                "Worker is stopped."

        };

    }


    // --------------------------------------------------------
    // No queued tasks
    // --------------------------------------------------------

    if (
        worker.queue.length ===
        0
    ) {

        worker.status =
            WORKER_STATES.IDLE;

        worker.activeTaskId =
            null;

        worker.updatedAt =
            now();


        return {

            success:
                true,

            idle:
                true,

            message:
                "Worker queue is empty.",

            worker:
                clone(
                    worker
                )

        };

    }


    const taskId =
        worker.queue[0];


    const taskBefore =
        agentManager.getTask(
            taskId
        );


    if (
        !taskBefore.success
    ) {

        removeTaskFromQueue(
            worker,
            taskId
        );


        worker.failedRuns +=
            1;

        worker.lastError =
            "Queued task could not be found.";

        worker.status =
            WORKER_STATES.ERROR;

        worker.updatedAt =
            now();


        return {

            success:
                false,

            error:
                "Queued task could not be found.",

            worker:
                clone(
                    worker
                )

        };

    }


    // --------------------------------------------------------
    // Activate worker
    // --------------------------------------------------------

    worker.activeTaskId =
        taskId;

    worker.status =
        WORKER_STATES.RUNNING;

    worker.totalRuns +=
        1;

    worker.updatedAt =
        now();


    // --------------------------------------------------------
    // Execute through Agent Runner
    // --------------------------------------------------------

    let execution;


    try {

        execution =
            await agentRunner.runTask(

                taskId,

                {

                    ...safeObject(
                        options
                    ),

                    context: {

                        workerId:
                            worker.id,

                        workerName:
                            worker.name,

                        ...safeObject(
                            options.context
                        )

                    }

                }

            );

    } catch (error) {

        execution = {

            success:
                false,

            error:
                error.message ||
                "Worker task execution failed."

        };

    }


    // --------------------------------------------------------
    // Re-read task
    // --------------------------------------------------------

    const latestResult =
        agentManager.getTask(
            taskId
        );


    const latestTask =
        latestResult.success
            ? latestResult.task
            : null;


    // --------------------------------------------------------
    // Determine result state
    // --------------------------------------------------------

    if (
        latestTask?.status ===
        agentManager.TASK_STATES.COMPLETED
    ) {

        removeTaskFromQueue(
            worker,
            taskId
        );


        worker.status =
            WORKER_STATES.IDLE;

        worker.activeTaskId =
            null;

        worker.successfulRuns +=
            1;

        worker.completedTasks +=
            1;

        worker.lastError =
            null;

    } else if (
        latestTask?.status ===
        agentManager.TASK_STATES.WAITING_APPROVAL
    ) {

        worker.status =
            WORKER_STATES.WAITING_APPROVAL;

        worker.waitingApprovalTasks +=
            1;

        worker.lastError =
            null;

    } else if (
        latestTask?.status ===
        agentManager.TASK_STATES.PAUSED
    ) {

        worker.status =
            WORKER_STATES.PAUSED;

        worker.pausedTasks +=
            1;

        worker.lastError =
            null;

    } else if (
        latestTask?.status ===
        agentManager.TASK_STATES.STOPPED
    ) {

        removeTaskFromQueue(
            worker,
            taskId
        );


        worker.status =
            WORKER_STATES.STOPPED;

        worker.activeTaskId =
            null;

        worker.stoppedTasks +=
            1;

        worker.lastError =
            null;

    } else if (
        latestTask?.status ===
        agentManager.TASK_STATES.CANCELLED
    ) {

        removeTaskFromQueue(
            worker,
            taskId
        );


        worker.status =
            WORKER_STATES.IDLE;

        worker.activeTaskId =
            null;

        worker.lastError =
            null;

    } else if (
        latestTask?.status ===
        agentManager.TASK_STATES.FAILED
    ) {

        removeTaskFromQueue(
            worker,
            taskId
        );


        worker.status =
            WORKER_STATES.ERROR;

        worker.activeTaskId =
            null;

        worker.failedRuns +=
            1;

        worker.lastError =
            latestTask.error ||
            execution.error ||
            "Task execution failed.";

    } else if (
        execution?.success ===
        true
    ) {

        worker.status =
            WORKER_STATES.IDLE;

        worker.activeTaskId =
            null;

        worker.successfulRuns +=
            1;

        worker.lastError =
            null;

    } else {

        worker.status =
            WORKER_STATES.ERROR;

        worker.activeTaskId =
            null;

        worker.failedRuns +=
            1;

        worker.lastError =
            execution?.error ||
            "Worker execution did not complete.";

    }


    worker.lastResult =
        clone(
            execution
        );

    worker.updatedAt =
        now();


    return {

        success:
            execution?.success ===
            true,

        worker:
            clone(
                worker
            ),

        execution:
            clone(
                execution
            ),

        task:
            clone(
                latestTask
            ),

        workerStatus:
            worker.status

    };

}


// ============================================================
// RUN QUEUE
// ============================================================

async function runQueue(
    workerId,
    options = {}
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    const maxTasks =
        Math.max(
            1,
            Number(
                safeObject(
                    options
                ).maxTasks
            ) || 100
        );


    const results =
        [];


    let processed =
        0;


    while (
        processed <
        maxTasks &&
        worker.queue.length >
        0
    ) {

        processed +=
            1;


        const result =
            await runAssignedTask(

                worker.id,

                options

            );


        results.push(
            clone(
                result
            )
        );


        if (
            !result.success
        ) {

            break;

        }


        if (
            result.workerStatus ===
                WORKER_STATES.WAITING_APPROVAL ||
            result.workerStatus ===
                WORKER_STATES.PAUSED ||
            result.workerStatus ===
                WORKER_STATES.STOPPED ||
            result.workerStatus ===
                WORKER_STATES.ERROR
        ) {

            break;

        }

    }


    return {

        success:
            true,

        worker:
            clone(
                worker
            ),

        processed,

        results

    };

}


// ============================================================
// PAUSE WORKER
// ============================================================

function pauseWorker(
    workerId
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    if (
        worker.status ===
        WORKER_STATES.STOPPED
    ) {

        return {

            success:
                false,

            stopped:
                true,

            error:
                "Stopped worker cannot be paused."

        };

    }


    if (
        worker.activeTaskId
    ) {

        const result =
            agentManager.pauseTask(
                worker.activeTaskId
            );


        if (
            result.success
        ) {

            worker.status =
                WORKER_STATES.PAUSED;

            worker.updatedAt =
                now();

        }


        return {

            ...result,

            worker:
                clone(
                    worker
                )

        };

    }


    worker.status =
        WORKER_STATES.PAUSED;

    worker.updatedAt =
        now();


    return {

        success:
            true,

        paused:
            true,

        worker:
            clone(
                worker
            )

    };

}


// ============================================================
// RESUME WORKER
// ============================================================

function resumeWorker(
    workerId
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    if (
        worker.status ===
        WORKER_STATES.STOPPED
    ) {

        return {

            success:
                false,

            stopped:
                true,

            error:
                "Stopped worker cannot be resumed."

        };

    }


    if (
        worker.activeTaskId
    ) {

        const result =
            agentManager.resumeTask(
                worker.activeTaskId
            );


        if (
            result.success
        ) {

            worker.status =
                WORKER_STATES.IDLE;

            worker.updatedAt =
                now();

        }


        return {

            ...result,

            worker:
                clone(
                    worker
                )

        };

    }


    if (
        worker.status !==
        WORKER_STATES.PAUSED
    ) {

        return {

            success:
                true,

            worker:
                clone(
                    worker
                ),

            status:
                worker.status

        };

    }


    worker.status =
        WORKER_STATES.IDLE;

    worker.updatedAt =
        now();


    return {

        success:
            true,

        resumed:
            true,

        worker:
            clone(
                worker
            )

    };

}


// ============================================================
// STOP WORKER
// ============================================================
//
// Important fix in v5.10.1:
// Preserve the active task ID before clearing it so the task
// can be removed correctly from the worker queue.
// ============================================================

function stopWorker(
    workerId
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    if (
        worker.status ===
        WORKER_STATES.STOPPED
    ) {

        return {

            success:
                true,

            stopped:
                true,

            worker:
                clone(
                    worker
                ),

            status:
                "already-stopped"

        };

    }


    // --------------------------------------------------------
    // Capture active task ID BEFORE clearing it
    // --------------------------------------------------------

    const activeTaskId =
        safeString(
            worker.activeTaskId
        );


    if (
        activeTaskId
    ) {

        const result =
            agentManager.stopTask(
                activeTaskId
            );


        if (
            result.success
        ) {

            removeTaskFromQueue(
                worker,
                activeTaskId
            );


            worker.status =
                WORKER_STATES.STOPPED;

            worker.activeTaskId =
                null;

            worker.stoppedTasks +=
                1;

            worker.lastError =
                null;

            worker.lastResult =
                clone(
                    result
                );

            worker.updatedAt =
                now();

        }


        return {

            ...result,

            stopped:
                result.success ===
                true,

            worker:
                clone(
                    worker
                )

        };

    }


    // --------------------------------------------------------
    // Stop worker with no active task
    //
    // Queued tasks are intentionally preserved so stop does
    // not silently delete pending work.
    // --------------------------------------------------------

    worker.status =
        WORKER_STATES.STOPPED;

    worker.updatedAt =
        now();


    return {

        success:
            true,

        stopped:
            true,

        worker:
            clone(
                worker
            ),

        status:
            "worker-stopped"

    };

}


// ============================================================
// CANCEL ACTIVE TASK
// ============================================================

function cancelWorkerTask(
    workerId
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    if (
        !worker.activeTaskId
    ) {

        return {

            success:
                false,

            error:
                "Worker has no active task."

        };

    }


    const taskId =
        worker.activeTaskId;


    const result =
        agentManager.cancelTask(
            taskId
        );


    if (
        result.success
    ) {

        removeTaskFromQueue(
            worker,
            taskId
        );

        worker.activeTaskId =
            null;

        worker.status =
            WORKER_STATES.IDLE;

        worker.lastResult =
            clone(
                result
            );

        worker.lastError =
            null;

        worker.updatedAt =
            now();

    }


    return {

        ...result,

        worker:
            clone(
                worker
            )

    };

}


// ============================================================
// GET WORKER QUEUE
// ============================================================

function getQueue(
    workerId
) {

    const resolved =
        resolveWorker(
            workerId
        );


    if (
        !resolved.success
    ) {

        return resolved;

    }


    const worker =
        resolved.worker;


    return {

        success:
            true,

        workerId:
            worker.id,

        activeTaskId:
            worker.activeTaskId,

        status:
            worker.status,

        queue:
            [
                ...worker.queue
            ],

        queueLength:
            worker.queue.length

    };

}


// ============================================================
// GET WORKER STATUS
// ============================================================

function getStatus() {

    const workerList =
        Array.from(
            workers.values()
        );


    return {

        success:
            true,

        version:
            AGENT_WORKER_VERSION,

        status:
            "active",

        workerCount:
            workerList.length,

        runningWorkers:
            workerList.filter(
                worker =>
                    worker.status ===
                    WORKER_STATES.RUNNING
            ).length,

        waitingApprovalWorkers:
            workerList.filter(
                worker =>
                    worker.status ===
                    WORKER_STATES.WAITING_APPROVAL
            ).length,

        pausedWorkers:
            workerList.filter(
                worker =>
                    worker.status ===
                    WORKER_STATES.PAUSED
            ).length,

        stoppedWorkers:
            workerList.filter(
                worker =>
                    worker.status ===
                    WORKER_STATES.STOPPED
            ).length,

        queuedTasks:
            workerList.reduce(
                (
                    total,
                    worker
                ) =>
                    total +
                    worker.queue.length,
                0
            ),

        activeTasks:
            workerList.filter(
                worker =>
                    Boolean(
                        worker.activeTaskId
                    )
            ).length,

        agentManagerConnected:
            typeof agentManager.runTask ===
            "function" &&
            typeof agentManager.getTask ===
            "function",

        agentRunnerConnected:
            typeof agentRunner.runTask ===
            "function"

    };

}


// ============================================================
// DELETE WORKER
// ============================================================

function deleteWorker(
    workerId
) {

    const id =
        safeString(
            workerId
        );


    const worker =
        workers.get(
            id
        );


    if (!worker) {

        return {

            success:
                false,

            error:
                "Worker not found."

        };

    }


    if (
        worker.status ===
            WORKER_STATES.RUNNING ||
        worker.activeTaskId
    ) {

        return {

            success:
                false,

            error:
                "Running worker cannot be deleted."

        };

    }


    workers.delete(
        id
    );


    return {

        success:
            true,

        workerId:
            id,

        status:
            "deleted"

    };

}


// ============================================================
// RESET
// ============================================================

function reset() {

    workers.clear();

    workerSequence =
        0;


    return {

        success:
            true,

        version:
            AGENT_WORKER_VERSION,

        status:
            "reset"

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    AGENT_WORKER_VERSION,

    WORKER_STATES,

    createWorker,

    getWorker,

    listWorkers,

    ensureDefaultWorker,

    getDefaultWorker,

    assignTask,

    enqueueTask,

    runAssignedTask,

    runQueue,

    pauseWorker,

    resumeWorker,

    stopWorker,

    cancelWorkerTask,

    getQueue,

    getStatus,

    deleteWorker,

    reset

};
