// ============================================================
// AARHEN CORE V5
// CHECKPOINT BRIDGE
// ============================================================
// Version: 5.13.1
//
// Purpose:
// - Connect Checkpoint Engine with Agent Manager
// - Provide one controlled checkpoint interface
// - Save task checkpoints
// - Inspect latest checkpoint
// - Detect task/checkpoint drift
// - Prepare recovery plans
// - Preserve Agent Manager as task-state authority
//
// Architecture:
//
// Agent Manager
//      ↓
// Checkpoint Bridge
//      ↓
// Checkpoint Engine
//
// IMPORTANT:
// - Does NOT execute tasks.
// - Does NOT bypass Agent Manager.
// - Does NOT bypass Recovery Engine.
// - Does NOT bypass Agent Runner.
// - Does NOT bypass Autonomous Guard.
// - Does NOT mutate task execution state.
// - Checkpoint storage remains in-memory in this version.
// ============================================================


const agentManager =
    require("./agentManager");


const checkpointEngine =
    require("./checkpointEngine");


// ============================================================
// VERSION
// ============================================================

const CHECKPOINT_BRIDGE_VERSION =
    "5.13.1";


// ============================================================
// HELPERS
// ============================================================

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


function safeString(
    value
) {

    return String(
        value ?? ""
    ).trim();

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


function safeBoolean(
    value
) {

    return value === true;

}


// ============================================================
// GET TASK
// ============================================================
//
// Agent Manager remains the source of truth for task state.
//
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
                "Task ID is required.",

            task:
                null

        };

    }


    if (
        !agentManager ||
        typeof agentManager.getTask !==
        "function"
    ) {

        return {

            success:
                false,

            error:
                "Agent Manager is unavailable.",

            task:
                null

        };

    }


    return agentManager.getTask(
        id
    );

}


// ============================================================
// SAVE CHECKPOINT
// ============================================================
//
// Saves the current Agent Manager task state.
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


    const config =
        safeObject(
            options
        );


    const result =
        checkpointEngine.saveTaskCheckpoint(

            id,

            {

                ...config,

                source:
                    config.source ||
                    "checkpoint-bridge"

            }

        );


    return {

        ...result,

        checkpointBridgeVersion:
            CHECKPOINT_BRIDGE_VERSION

    };

}


// ============================================================
// SAVE BEFORE EXECUTION
// ============================================================
//
// Used before a higher-level worker starts controlled work.
//
// ============================================================

function saveBeforeExecution(
    taskId,
    options = {}
) {

    const config =
        safeObject(
            options
        );


    return saveTaskCheckpoint(

        taskId,

        {

            ...config,

            reason:
                config.reason ||
                "Checkpoint before controlled task execution.",

            source:
                config.source ||
                "checkpoint-bridge:before-execution"

        }

    );

}


// ============================================================
// SAVE AFTER EXECUTION
// ============================================================
//
// Captures the current Agent Manager state after an execution
// attempt.
//
// executionResult is metadata only and is not executed here.
//
// ============================================================

function saveAfterExecution(
    taskId,
    executionResult = null,
    options = {}
) {

    const config =
        safeObject(
            options
        );


    const execution =
        safeObject(
            executionResult
        );


    const metadata = {

        ...(safeObject(
            config.metadata
        )),

        execution: {

            success:
                safeBoolean(
                    execution.success
                ),

            status:
                safeString(
                    execution.status
                ) || null,

            error:
                safeString(
                    execution.error
                ) || null,

            needsApproval:
                safeBoolean(
                    execution.needsApproval
                ),

            needsInput:
                safeBoolean(
                    execution.needsInput
                )

        }

    };


    return saveTaskCheckpoint(

        taskId,

        {

            ...config,

            reason:
                config.reason ||
                "Checkpoint after controlled task execution.",

            source:
                config.source ||
                "checkpoint-bridge:after-execution",

            metadata

        }

    );

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


    return checkpointEngine
        .getLatestCheckpoint(
            id
        );

}


// ============================================================
// GET RECOVERY CANDIDATE
// ============================================================

function getRecoveryCandidate(
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

            recoverable:
                false,

            error:
                "Task ID is required.",

            checkpoint:
                null

        };

    }


    return checkpointEngine
        .getRecoveryCandidate(
            id
        );

}


// ============================================================
// BUILD RECOVERY PLAN
// ============================================================
//
// This creates a plan only.
// It does not resume the task.
//
// ============================================================

function buildRecoveryPlan(
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

            recoverable:
                false,

            error:
                "Task ID is required.",

            plan:
                null

        };

    }


    const comparison = compareWithCheckpoint(id);

    if (!comparison.success) {
        return {
            success: false,
            recoverable: false,
            error: comparison.error || "Unable to compare live task with checkpoint.",
            plan: null
        };
    }

    if (comparison.checkpointExists && comparison.changed) {
        return {
            success: true,
            recoverable: false,
            reason: "live-task-drift",
            plan: {
                action: "no-recovery",
                taskId: id,
                reason: "Live task differs from the latest checkpoint; inspect and reconcile before recovery.",
                differences: clone(comparison.differences || []),
                executable: false,
                executionMode: "inspection-only",
                requiresControlledExecution: true
            }
        };
    }

    return checkpointEngine
        .buildRecoveryPlan(
            id
        );

}


// ============================================================
// COMPARE CURRENT STATE
// ============================================================
//
// Compare the live Agent Manager task with latest checkpoint.
//
// ============================================================

function compareWithCheckpoint(
    taskId
) {

    const taskResult =
        getTask(
            taskId
        );


    if (
        !taskResult.success
    ) {

        return {

            success:
                false,

            error:
                taskResult.error,

            task:
                null

        };

    }


    const comparison =
        checkpointEngine
            .compareWithLatestCheckpoint(

                taskResult.task

            );


    return {

        ...comparison,

        taskId:
            safeString(
                taskId
            ),

        checkpointBridgeVersion:
            CHECKPOINT_BRIDGE_VERSION

    };

}


// ============================================================
// INSPECT TASK RECOVERY STATE
// ============================================================
//
// Gives one combined view:
//
// - current task
// - latest checkpoint
// - recovery candidate
// - recovery plan
// - drift information
//
// ============================================================

function inspectTask(
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


    const taskResult =
        getTask(
            id
        );


    if (
        !taskResult.success
    ) {

        return {

            success:
                false,

            error:
                taskResult.error,

            task:
                null

        };

    }


    const latest =
        getLatestCheckpoint(
            id
        );


    const candidate =
        getRecoveryCandidate(
            id
        );


    const plan =
        buildRecoveryPlan(
            id
        );


    const comparison =
        compareWithCheckpoint(
            id
        );


    return {

        success:
            true,

        taskId:
            id,

        task:
            clone(
                taskResult.task
            ),

        latestCheckpoint:
            latest.success
                ? latest.checkpoint
                : null,

        checkpointExists:
            latest.success === true,

        recoveryCandidate:
            candidate.success
                ? candidate
                : {

                    success:
                        false,

                    recoverable:
                        false,

                    error:
                        candidate.error,

                    checkpoint:
                        null

                },

        recoveryPlan:
            plan.success
                ? plan
                : {

                    success:
                        false,

                    recoverable:
                        false,

                    error:
                        plan.error,

                    plan:
                        null

                },

        comparison:
            comparison.success
                ? comparison
                : {

                    success:
                        false,

                    error:
                        comparison.error

                },

        checkpointBridgeVersion:
            CHECKPOINT_BRIDGE_VERSION

    };

}


// ============================================================
// LIST CHECKPOINTS
// ============================================================

function listCheckpoints(
    taskId = null
) {

    return checkpointEngine
        .listCheckpoints(
            taskId
        );

}


// ============================================================
// GET CHECKPOINT
// ============================================================

function getCheckpoint(
    checkpointId
) {

    return checkpointEngine
        .getCheckpoint(
            checkpointId
        );

}


// ============================================================
// DELETE CHECKPOINT
// ============================================================
//
// Deleting a checkpoint is state-maintenance only.
// It does not delete or modify the real Agent Manager task.
//
// ============================================================

function deleteCheckpoint(
    checkpointId
) {

    return checkpointEngine
        .deleteCheckpoint(
            checkpointId
        );

}


// ============================================================
// DELETE ALL TASK CHECKPOINTS
// ============================================================

function deleteTaskCheckpoints(
    taskId
) {

    return checkpointEngine
        .deleteTaskCheckpoints(
            taskId
        );

}


// ============================================================
// RESET
// ============================================================
//
// Clears checkpoint storage only.
// Agent Manager tasks are untouched.
//
// ============================================================

function reset() {

    const result =
        checkpointEngine.reset();


    return {

        ...result,

        checkpointBridgeVersion:
            CHECKPOINT_BRIDGE_VERSION

    };

}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    const checkpointStatus =
        checkpointEngine &&
        typeof checkpointEngine.getStatus ===
        "function"

            ? checkpointEngine.getStatus()

            : null;


    const managerStatus =
        agentManager &&
        typeof agentManager.getStatus ===
        "function"

            ? agentManager.getStatus()

            : null;


    return {

        success:
            true,

        name:
            "AarHen Checkpoint Bridge",

        version:
            CHECKPOINT_BRIDGE_VERSION,

        status:
            "active",

        connectedLayers: [

            "Agent Manager",

            "Checkpoint Engine"

        ],

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

        },

        checkpointEngine: {

            connected:
                Boolean(
                    checkpointStatus &&
                    checkpointStatus.success ===
                    true
                ),

            version:
                checkpointStatus?.version ||
                null,

            storage:
                checkpointStatus?.storage ||
                "in-memory",

            persistentStorage:
                checkpointStatus
                    ?.persistentStorage ===
                true,

            checkpointCount:
                checkpointStatus
                    ?.checkpointCount ||
                0

        },

        capabilities: {

            saveCheckpoint:
                true,

            saveBeforeExecution:
                true,

            saveAfterExecution:
                true,

            latestCheckpoint:
                true,

            recoveryCandidate:
                true,

            recoveryPlan:
                true,

            stateComparison:
                true,

            taskInspection:
                true,

            checkpointListing:
                true,

            checkpointDeletion:
                true

        }

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    CHECKPOINT_BRIDGE_VERSION,

    getTask,

    saveTaskCheckpoint,

    saveBeforeExecution,

    saveAfterExecution,

    getLatestCheckpoint,

    getRecoveryCandidate,

    buildRecoveryPlan,

    compareWithCheckpoint,

    inspectTask,

    listCheckpoints,

    getCheckpoint,

    deleteCheckpoint,

    deleteTaskCheckpoints,

    reset,

    getStatus

};
