// ============================================================
// AARHEN CORE V5
// CHECKPOINT ENGINE
// ============================================================
// Version: 5.13.0
//
// Purpose:
// - Capture controlled task execution checkpoints
// - Preserve task / step / worker recovery state
// - Track latest checkpoint for long-running work
// - Support checkpoint history
// - Detect resumable task states
// - Prepare AarHen for crash/restart recovery
//
// IMPORTANT:
// - This engine does NOT execute tasks.
// - This engine does NOT bypass Agent Manager.
// - This engine does NOT bypass Agent Runner.
// - This engine does NOT bypass Autonomous Guard.
// - Checkpoints are in-memory in this version.
// - Persistent disk/database checkpoint storage will be added
//   in a later persistence layer.
// ============================================================


const agentManager =
    require("./agentManager");


// ============================================================
// VERSION
// ============================================================

const CHECKPOINT_ENGINE_VERSION =
    "5.13.0";


// ============================================================
// CHECKPOINT STATES
// ============================================================

const CHECKPOINT_STATES = Object.freeze({

    ACTIVE:
        "active",

    COMPLETED:
        "completed",

    PAUSED:
        "paused",

    STOPPED:
        "stopped",

    WAITING_APPROVAL:
        "waiting_approval",

    FAILED:
        "failed",

    CANCELLED:
        "cancelled",

    UNKNOWN:
        "unknown"

});


// ============================================================
// INTERNAL STORE
// ============================================================

const checkpoints =
    new Map();


// taskId -> ordered checkpoint ids
const taskCheckpointIndex =
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
        typeof value ===
        "object"
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


function now() {

    return new Date()
        .toISOString();

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
            .slice(
                2,
                10
            )

    );

}


// ============================================================
// NORMALIZE CHECKPOINT STATE
// ============================================================

function normalizeCheckpointState(
    task
) {

    const status =
        safeString(
            task?.status
        );


    switch (
        status
    ) {

        case agentManager
            .TASK_STATES
            .COMPLETED:

            return CHECKPOINT_STATES.COMPLETED;


        case agentManager
            .TASK_STATES
            .PAUSED:

            return CHECKPOINT_STATES.PAUSED;


        case agentManager
            .TASK_STATES
            .STOPPED:

            return CHECKPOINT_STATES.STOPPED;


        case agentManager
            .TASK_STATES
            .WAITING_APPROVAL:

            return CHECKPOINT_STATES.WAITING_APPROVAL;


        case agentManager
            .TASK_STATES
            .FAILED:

            return CHECKPOINT_STATES.FAILED;


        case agentManager
            .TASK_STATES
            .CANCELLED:

            return CHECKPOINT_STATES.CANCELLED;


        case agentManager
            .TASK_STATES
            .RUNNING:

            return CHECKPOINT_STATES.ACTIVE;


        case agentManager
            .TASK_STATES
            .READY:

            return CHECKPOINT_STATES.ACTIVE;


        case agentManager
            .TASK_STATES
            .PLANNING:

            return CHECKPOINT_STATES.ACTIVE;


        case agentManager
            .TASK_STATES
            .CREATED:

            return CHECKPOINT_STATES.ACTIVE;


        default:

            return CHECKPOINT_STATES.UNKNOWN;

    }

}


// ============================================================
// BUILD STEP SNAPSHOT
// ============================================================

function buildStepSnapshot(
    step
) {

    const input =
        safeObject(
            step
        );


    return {

        id:
            safeString(
                input.id
            ) ||
            null,

        index:
            Number.isFinite(
                Number(
                    input.index
                )
            )
                ? Number(
                    input.index
                )
                : null,

        name:
            safeString(
                input.name
            ),

        description:
            safeString(
                input.description
            ),

        action:
            safeString(
                input.action
            ),

        status:
            safeString(
                input.status
            ),

        approved:
            input.approved ===
            true,

        requiresApproval:
            input.requiresApproval ===
            true,

        retries:
            Number(
                input.retries
            ) || 0,

        maxRetries:
            Number(
                input.maxRetries
            ) || 0,

        startedAt:
            input.startedAt ||
            null,

        completedAt:
            input.completedAt ||
            null,

        error:
            safeString(
                input.error
            ) ||
            null,

        result:
            clone(
                input.result
            ) || null

    };

}


// ============================================================
// BUILD TASK SNAPSHOT
// ============================================================

function buildTaskSnapshot(
    task
) {

    const input =
        safeObject(
            task
        );


    const steps =
        safeArray(
            input.steps
        );


    const completedSteps =
        steps.filter(
            step =>
                step.status ===
                agentManager.STEP_STATES
                    .COMPLETED
        ).length;


    const failedSteps =
        steps.filter(
            step =>
                step.status ===
                agentManager.STEP_STATES
                    .FAILED
        ).length;


    const pendingSteps =
        steps.filter(
            step =>
                step.status ===
                agentManager.STEP_STATES
                    .PENDING
        ).length;


    return {

        id:
            safeString(
                input.id
            ) ||
            null,

        agentId:
            safeString(
                input.agentId
            ) ||
            null,

        request:
            safeString(
                input.request
            ),

        description:
            safeString(
                input.description
            ),

        status:
            safeString(
                input.status
            ),

        checkpointState:
            normalizeCheckpointState(
                input
            ),

        priority:
            safeString(
                input.priority
            ) ||
            "normal",

        autonomy:
            input.autonomy !==
            false,

        approvalRequired:
            input.approvalRequired ===
            true,

        approved:
            input.approved ===
            true,

        stopRequested:
            input.stopRequested ===
            true,

        pauseRequested:
            input.pauseRequested ===
            true,

        currentStepIndex:
            Number(
                input.currentStepIndex
            ),

        currentStepId:
            safeString(
                input.currentStepId
            ) ||
            null,

        totalSteps:
            steps.length,

        completedSteps,

        failedSteps,

        pendingSteps,

        retries:
            Number(
                input.retries
            ) || 0,

        maxRetries:
            Number(
                input.maxRetries
            ) || 0,

        startedAt:
            input.startedAt ||
            null,

        completedAt:
            input.completedAt ||
            null,

        stoppedAt:
            input.stoppedAt ||
            null,

        error:
            safeString(
                input.error
            ) ||
            null,

        warnings:
            clone(
                input.warnings
            ) || [],

        steps:
            steps.map(
                buildStepSnapshot
            )

    };

}


// ============================================================
// CREATE CHECKPOINT OBJECT
// ============================================================

function buildCheckpoint(
    task,
    options = {}
) {

    const config =
        safeObject(
            options
        );


    const snapshot =
        buildTaskSnapshot(
            task
        );


    const checkpointId =
        safeString(
            config.id
        ) ||
        createId(
            "checkpoint"
        );


    return {

        id:
            checkpointId,

        taskId:
            snapshot.id,

        agentId:
            snapshot.agentId,

        createdAt:
            now(),

        reason:
            safeString(
                config.reason
            ) ||
            "Task state checkpoint.",

        source:
            safeString(
                config.source
            ) ||
            "checkpoint-engine",

        state:
            snapshot.checkpointState,

        currentStepIndex:
            snapshot.currentStepIndex,

        currentStepId:
            snapshot.currentStepId,

        completedSteps:
            snapshot.completedSteps,

        failedSteps:
            snapshot.failedSteps,

        pendingSteps:
            snapshot.pendingSteps,

        totalSteps:
            snapshot.totalSteps,

        recoveryEligible:
            isRecoveryEligible(
                snapshot
            ),

        task:
            snapshot,

        metadata:
            clone(
                config.metadata
            ) || {}

    };

}


// ============================================================
// RECOVERY ELIGIBILITY
// ============================================================
//
// A checkpoint is considered resumable when the task has
// unfinished controlled work and is not permanently stopped,
// cancelled or completed.
//
// ============================================================

function isRecoveryEligible(
    task
) {

    const input =
        safeObject(
            task
        );


    if (
        input.status ===
            agentManager.TASK_STATES
                .COMPLETED ||

        input.status ===
            agentManager.TASK_STATES
                .CANCELLED ||

        input.status ===
            agentManager.TASK_STATES
                .WAITING_APPROVAL
    ) {

        return false;

    }


    if (
        input.status ===
        agentManager.TASK_STATES
            .STOPPED
    ) {

        return false;

    }


    if (
        input.failedSteps >
        0 &&
        input.pendingSteps ===
        0
    ) {

        return false;

    }


    return (
        input.pendingSteps >
        0
    );

}


// ============================================================
// SAVE CHECKPOINT
// ============================================================

function saveCheckpoint(
    task,
    options = {}
) {

    if (
        !task ||
        typeof task !==
        "object"
    ) {

        return {

            success:
                false,

            error:
                "A valid task object is required.",

            checkpoint:
                null

        };

    }


    if (
        !safeString(
            task.id
        )
    ) {

        return {

            success:
                false,

            error:
                "Task ID is required to save a checkpoint.",

            checkpoint:
                null

        };

    }


    const checkpoint =
        buildCheckpoint(

            task,

            options

        );


    if (
        checkpoints.has(
            checkpoint.id
        )
    ) {

        return {

            success:
                false,

            error:
                "Checkpoint ID already exists.",

            checkpoint:
                null

        };

    }


    checkpoints.set(
        checkpoint.id,
        checkpoint
    );


    const taskId =
        checkpoint.taskId;


    if (
        !taskCheckpointIndex.has(
            taskId
        )
    ) {

        taskCheckpointIndex.set(
            taskId,
            []
        );

    }


    taskCheckpointIndex
        .get(
            taskId
        )
        .push(
            checkpoint.id
        );


    return {

        success:
            true,

        checkpoint:
            clone(
                checkpoint
            )

    };

}


// ============================================================
// SAVE TASK CHECKPOINT
// ============================================================
//
// Reads the latest task directly from Agent Manager.
//
// ============================================================

function saveTaskCheckpoint(
    taskId,
    options = {}
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
                "Task ID is required.",

            checkpoint:
                null

        };

    }


    const taskResult =
        agentManager.getTask(
            id
        );


    if (
        !taskResult.success
    ) {

        return {

            success:
                false,

            error:
                taskResult.error ||
                "Task could not be loaded.",

            checkpoint:
                null

        };

    }


    return saveCheckpoint(

        taskResult.task,

        options

    );

}


// ============================================================
// GET CHECKPOINT
// ============================================================

function getCheckpoint(
    checkpointId
) {

    const id =
        safeString(
            checkpointId
        );


    if (
        !id
    ) {

        return {

            success:
                false,

            error:
                "Checkpoint ID is required.",

            checkpoint:
                null

        };

    }


    const checkpoint =
        checkpoints.get(
            id
        );


    if (
        !checkpoint
    ) {

        return {

            success:
                false,

            error:
                "Checkpoint not found.",

            checkpoint:
                null

        };

    }


    return {

        success:
            true,

        checkpoint:
            clone(
                checkpoint
            )

    };

}


// ============================================================
// GET LATEST CHECKPOINT
// ============================================================

function getLatestCheckpoint(
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
                "Task ID is required.",

            checkpoint:
                null

        };

    }


    const ids =
        taskCheckpointIndex.get(
            id
        );


    if (
        !ids ||
        ids.length ===
        0
    ) {

        return {

            success:
                false,

            error:
                "No checkpoint exists for this task.",

            checkpoint:
                null

        };

    }


    const latestId =
        ids[
            ids.length - 1
        ];


    return getCheckpoint(
        latestId
    );

}


// ============================================================
// LIST CHECKPOINTS
// ============================================================

function listCheckpoints(
    taskId = null
) {

    const filterTaskId =
        safeString(
            taskId
        );


    let list =
        Array.from(
            checkpoints.values()
        );


    if (
        filterTaskId
    ) {

        list =
            list.filter(
                checkpoint =>
                    checkpoint.taskId ===
                    filterTaskId
            );

    }


    return {

        success:
            true,

        count:
            list.length,

        checkpoints:
            list.map(
                clone
            )

    };

}


// ============================================================
// GET RECOVERY CANDIDATE
// ============================================================

function getRecoveryCandidate(
    taskId
) {

    const latest =
        getLatestCheckpoint(
            taskId
        );


    if (
        !latest.success
    ) {

        return {

            success:
                false,

            recoverable:
                false,

            error:
                latest.error,

            checkpoint:
                null

        };

    }


    const checkpoint =
        latest.checkpoint;


    return {

        success:
            true,

        recoverable:
            checkpoint.recoveryEligible ===
            true,

        checkpoint:
            clone(
                checkpoint
            ),

        reason:
            checkpoint.recoveryEligible ===
            true

                ? "Latest checkpoint contains unfinished recoverable task state."

                : "Latest checkpoint does not contain a recoverable task state."

    };

}


// ============================================================
// COMPARE TASK WITH CHECKPOINT
// ============================================================
//
// Used to detect whether current task state has diverged from
// the last checkpoint.
//
// ============================================================

function compareWithLatestCheckpoint(
    task
) {

    if (
        !task ||
        typeof task !==
        "object"
    ) {

        return {

            success:
                false,

            error:
                "A valid task object is required."

        };

    }


    const latest =
        getLatestCheckpoint(
            task.id
        );


    if (
        !latest.success
    ) {

        return {

            success:
                true,

            checkpointExists:
                false,

            changed:
                false,

            differences:
                []

        };

    }


    const checkpointTask =
        safeObject(
            latest
                .checkpoint
                .task
        );


    const currentTask =
        buildTaskSnapshot(
            task
        );


    const differences =
        [];


    const fields = [

        "status",

        "checkpointState",

        "currentStepIndex",

        "currentStepId",

        "completedSteps",

        "failedSteps",

        "pendingSteps",

        "retries",

        "approvalRequired",

        "approved",

        "stopRequested",

        "pauseRequested"

    ];


    for (
        const field of fields
    ) {

        if (
            JSON.stringify(
                checkpointTask[field]
            ) !==
            JSON.stringify(
                currentTask[field]
            )
        ) {

            differences.push({

                field,

                checkpoint:
                    checkpointTask[field],

                current:
                    currentTask[field]

            });

        }

    }


    return {

        success:
            true,

        checkpointExists:
            true,

        checkpointId:
            latest
                .checkpoint
                .id,

        changed:
            differences.length >
            0,

        differences

    };

}


// ============================================================
// RECOVERY PLAN
// ============================================================
//
// This does not mutate the task.
//
// It only describes what a future Recovery Coordinator should
// do when restoring from the checkpoint.
//
// ============================================================

function buildRecoveryPlan(
    taskId
) {

    const candidate =
        getRecoveryCandidate(
            taskId
        );


    if (
        !candidate.success
    ) {

        return {

            success:
                false,

            error:
                candidate.error,

            plan:
                null

        };

    }


    const checkpoint =
        candidate.checkpoint;


    if (
        !candidate.recoverable
    ) {

        return {

            success:
                true,

            recoverable:
                false,

            plan: {

                action:
                    "no-recovery",

                reason:
                    candidate.reason,

                taskId

            }

        };

    }


    const task =
        safeObject(
            checkpoint.task
        );


    return {

        success:
            true,

        recoverable:
            true,

        plan: {

            action:
                "resume-from-checkpoint",

            taskId:
                checkpoint.taskId,

            agentId:
                checkpoint.agentId,

            checkpointId:
                checkpoint.id,

            currentStepIndex:
                checkpoint.currentStepIndex,

            currentStepId:
                checkpoint.currentStepId,

            completedSteps:
                checkpoint.completedSteps,

            pendingSteps:
                checkpoint.pendingSteps,

            retries:
                task.retries,

            approvalRequired:
                task.approvalRequired,

            paused:
                task.pauseRequested ===
                true,

            stopRequested:
                task.stopRequested ===
                true

        }

    };

}


// ============================================================
// DELETE CHECKPOINT
// ============================================================

function deleteCheckpoint(
    checkpointId
) {

    const id =
        safeString(
            checkpointId
        );


    if (
        !id
    ) {

        return {

            success:
                false,

            error:
                "Checkpoint ID is required."

        };

    }


    const checkpoint =
        checkpoints.get(
            id
        );


    if (
        !checkpoint
    ) {

        return {

            success:
                false,

            error:
                "Checkpoint not found."

        };

    }


    checkpoints.delete(
        id
    );


    const taskIds =
        taskCheckpointIndex.get(
            checkpoint.taskId
        );


    if (
        Array.isArray(
            taskIds
        )
    ) {

        const filtered =
            taskIds.filter(
                value =>
                    value !==
                    id
            );


        if (
            filtered.length >
            0
        ) {

            taskCheckpointIndex.set(
                checkpoint.taskId,
                filtered
            );

        } else {

            taskCheckpointIndex.delete(
                checkpoint.taskId
            );

        }

    }


    return {

        success:
            true,

        checkpointId:
            id

    };

}


// ============================================================
// DELETE TASK CHECKPOINTS
// ============================================================

function deleteTaskCheckpoints(
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


    const ids =
        taskCheckpointIndex.get(
            id
        ) || [];


    for (
        const checkpointId of
        ids
    ) {

        checkpoints.delete(
            checkpointId
        );

    }


    taskCheckpointIndex.delete(
        id
    );


    return {

        success:
            true,

        taskId:
            id,

        deleted:
            ids.length

    };

}


// ============================================================
// CLEAR ALL CHECKPOINTS
// ============================================================

function reset() {

    const count =
        checkpoints.size;


    checkpoints.clear();

    taskCheckpointIndex.clear();


    return {

        success:
            true,

        status:
            "checkpoint-engine-reset",

        deleted:
            count,

        version:
            CHECKPOINT_ENGINE_VERSION

    };

}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    let recoverable =
        0;


    let completed =
        0;


    let paused =
        0;


    let failed =
        0;


    let stopped =
        0;


    for (
        const checkpoint of
        checkpoints.values()
    ) {

        if (
            checkpoint.recoveryEligible ===
            true
        ) {

            recoverable +=
                1;

        }


        if (
            checkpoint.state ===
            CHECKPOINT_STATES.COMPLETED
        ) {

            completed +=
                1;

        }


        if (
            checkpoint.state ===
            CHECKPOINT_STATES.PAUSED
        ) {

            paused +=
                1;

        }


        if (
            checkpoint.state ===
            CHECKPOINT_STATES.FAILED
        ) {

            failed +=
                1;

        }


        if (
            checkpoint.state ===
            CHECKPOINT_STATES.STOPPED
        ) {

            stopped +=
                1;

        }

    }


    const managerStatus =
        typeof agentManager.getStatus ===
        "function"

            ? agentManager.getStatus()

            : null;


    return {

        success:
            true,

        version:
            CHECKPOINT_ENGINE_VERSION,

        status:
            "active",

        storage:
            "in-memory",

        persistentStorage:
            false,

        checkpointCount:
            checkpoints.size,

        trackedTasks:
            taskCheckpointIndex.size,

        recoverableCheckpoints:
            recoverable,

        completedCheckpoints:
            completed,

        pausedCheckpoints:
            paused,

        failedCheckpoints:
            failed,

        stoppedCheckpoints:
            stopped,

        agentManager: {

            connected:
                Boolean(
                    managerStatus &&
                    managerStatus.success ===
                    true
                ),

            version:
                managerStatus?.version ||
                null

        }

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    CHECKPOINT_ENGINE_VERSION,

    CHECKPOINT_STATES,

    normalizeCheckpointState,

    buildTaskSnapshot,

    buildCheckpoint,

    isRecoveryEligible,

    saveCheckpoint,

    saveTaskCheckpoint,

    getCheckpoint,

    getLatestCheckpoint,

    listCheckpoints,

    getRecoveryCandidate,

    compareWithLatestCheckpoint,

    buildRecoveryPlan,

    deleteCheckpoint,

    deleteTaskCheckpoints,

    reset,

    getStatus

};
