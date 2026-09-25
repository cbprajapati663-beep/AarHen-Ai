// ============================================================
// AARHEN CORE V5
// CHECKPOINT RECOVERY CONTROLLER
// ============================================================
// Version: 5.14.0
//
// Purpose:
// - Connect Checkpoint Bridge with Autonomous Recovery
// - Save task state before controlled execution
// - Execute through existing Autonomous Recovery flow
// - Save task state after execution
// - Expose unified recovery inspection
// - Preserve Autonomous Worker
// - Preserve Recovery Worker
// - Preserve Recovery Engine
// - Preserve Agent Runner
// - Preserve Autonomous Safety Guard
//
// IMPORTANT:
// - Does NOT bypass Autonomous Worker.
// - Does NOT bypass Recovery system.
// - Does NOT bypass Agent Runner.
// - Does NOT bypass Autonomous Guard.
// - Does NOT execute arbitrary code itself.
// - Checkpoint storage is currently in-memory.
// ============================================================


const autonomousWorker =
    require("./autonomousWorker");


const autonomousRecovery =
    require("./autonomousRecovery");


const checkpointBridge =
    require("./checkpointBridge");


const agentManager =
    require("./agentManager");


// ============================================================
// VERSION
// ============================================================

const CHECKPOINT_RECOVERY_CONTROLLER_VERSION =
    "5.14.0";


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


// ============================================================
// NORMALIZE EXECUTION METADATA
// ============================================================
//
// Autonomous Worker commonly returns:
//
// {
//     success: true,
//     stage: "worker-execution"
// }
//
// Some lower layers may instead expose:
//
// {
//     status: "completed"
// }
//
// The checkpoint layer should preserve both when available.
//
// ============================================================

function buildCheckpointExecutionResult(
    executionResult
) {

    const execution =
        safeObject(
            executionResult
        );


    const stage =
        safeString(
            execution.stage
        );


    const status =
        safeString(
            execution.status
        );


    return {

        ...execution,

        // Preserve original status when available.
        // Otherwise use execution stage as the execution status.
        status:
            status ||
            stage ||
            null,

        // Explicitly preserve the execution stage.
        stage:
            stage ||
            status ||
            null

    };

}


// ============================================================
// GET CURRENT TASK
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
// BUILD EXECUTION OPTIONS
// ============================================================

function buildExecutionOptions(
    options = {}
) {

    const config =
        safeObject(
            options
        );


    if (
        autonomousRecovery &&
        typeof autonomousRecovery
            .buildExecutionOptions !==
        "function"
    ) {

        return {

            ...config

        };

    }


    return autonomousRecovery
        .buildExecutionOptions(
            config
        );

}


// ============================================================
// SAVE BEFORE EXECUTION
// ============================================================

function saveBeforeExecution(
    taskId,
    options = {}
) {

    const config =
        safeObject(
            options
        );


    return checkpointBridge
        .saveBeforeExecution(

            taskId,

            {

                ...config,

                source:
                    config.source ||
                    "checkpoint-recovery-controller"

            }

        );

}


// ============================================================
// SAVE AFTER EXECUTION
// ============================================================

function saveAfterExecution(
    taskId,
    executionResult,
    options = {}
) {

    const config =
        safeObject(
            options
        );


    const normalizedExecution =
        buildCheckpointExecutionResult(
            executionResult
        );


    return checkpointBridge
        .saveAfterExecution(

            taskId,

            normalizedExecution,

            {

                ...config,

                source:
                    config.source ||
                    "checkpoint-recovery-controller"

            }

        );

}


// ============================================================
// EXECUTE ASSIGNED TASK
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

            stage:
                "worker-validation",

            error:
                "Worker ID is required.",

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    if (
        !cleanTaskId
    ) {

        return {

            success:
                false,

            stage:
                "task-validation",

            error:
                "Task ID is required.",

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    const taskResult =
        getTask(
            cleanTaskId
        );


    if (
        !taskResult.success
    ) {

        return {

            success:
                false,

            stage:
                "task-load",

            error:
                taskResult.error,

            task:
                null,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    const task =
        taskResult.task;


    // --------------------------------------------------------
    // APPROVAL STATE
    // --------------------------------------------------------

    if (
        task.status ===
        agentManager.TASK_STATES
            .WAITING_APPROVAL
    ) {

        const checkpoint =
            saveBeforeExecution(

                cleanTaskId,

                {

                    reason:
                        "Checkpoint before approval-controlled autonomous task.",

                    metadata: {

                        mode:
                            "approval",

                        controller:
                            CHECKPOINT_RECOVERY_CONTROLLER_VERSION

                    }

                }

            );


        return {

            success:
                true,

            stage:
                "approval",

            waitingApproval:
                true,

            workerId:
                cleanWorkerId,

            task:
                task,

            checkpoint:
                checkpoint.success
                    ? checkpoint.checkpoint
                    : null,

            checkpointSave:
                checkpoint,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    // --------------------------------------------------------
    // PRE-EXECUTION CHECKPOINT
    // --------------------------------------------------------

    const beforeCheckpoint =
        saveBeforeExecution(

            cleanTaskId,

            {

                reason:
                    "Checkpoint before controlled autonomous recovery execution.",

                metadata: {

                    mode:
                        "autonomous-recovery",

                    controller:
                        CHECKPOINT_RECOVERY_CONTROLLER_VERSION

                }

            }

        );


    if (
        !beforeCheckpoint.success
    ) {

        return {

            success:
                false,

            stage:
                "checkpoint-before",

            error:
                beforeCheckpoint.error ||
                "Unable to save pre-execution checkpoint.",

            task:
                task,

            checkpoint:
                null,

            checkpointSave:
                beforeCheckpoint,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    // --------------------------------------------------------
    // BUILD RECOVERY-AWARE EXECUTION OPTIONS
    // --------------------------------------------------------

    const executionOptions =
        buildExecutionOptions(
            options
        );


    // --------------------------------------------------------
    // EXECUTE THROUGH AUTONOMOUS WORKER
    // --------------------------------------------------------

    let executionResult;


    try {

        executionResult =
            await autonomousWorker
                .executeAssignedTask(

                    cleanWorkerId,

                    cleanTaskId,

                    executionOptions

                );

    } catch (error) {

        executionResult = {

            success:
                false,

            stage:
                "autonomous-execution",

            status:
                "autonomous-execution",

            error:
                error?.message ||
                "Autonomous execution failed.",

            task:
                null,

            execution:
                null

        };

    }


    // --------------------------------------------------------
    // REFRESH TASK
    // --------------------------------------------------------

    const latestTaskResult =
        getTask(
            cleanTaskId
        );


    const latestTask =
        latestTaskResult.success
            ? latestTaskResult.task
            : executionResult?.task ||
              task;


    // --------------------------------------------------------
    // POST-EXECUTION CHECKPOINT
    // --------------------------------------------------------

    const afterCheckpoint =
        saveAfterExecution(

            cleanTaskId,

            executionResult,

            {

                reason:
                    "Checkpoint after controlled autonomous recovery execution.",

                metadata: {

                    mode:
                        "autonomous-recovery",

                    controller:
                        CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

                    beforeCheckpointId:
                        beforeCheckpoint
                            .checkpoint
                            ?.id ||
                        null

                }

            }

        );


    // --------------------------------------------------------
    // RECOVERY METADATA
    // --------------------------------------------------------

    const recovery =
        executionResult
            ?.execution
            ?.recovery ||

        executionResult
            ?.execution
            ?.result
            ?.recovery ||

        latestTask
            ?.steps
            ?.find(
                step =>
                    step.status ===
                    agentManager.STEP_STATES
                        .COMPLETED
            )
            ?.result
            ?.recovery ||

        null;


    return {

        success:
            executionResult?.success ===
            true,

        stage:
            executionResult?.stage ||
            "execution",

        checkpointRecoveryControllerVersion:
            CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

        workerId:
            cleanWorkerId,

        taskId:
            cleanTaskId,

        task:
            clone(
                latestTask
            ),

        worker:
            executionResult?.worker ||
            null,

        provider:
            executionResult?.provider ||
            null,

        workerStatus:
            executionResult?.workerStatus ||
            null,

        execution:
            executionResult?.execution ||
            null,

        recovery:
            recovery,

        beforeCheckpoint:
            beforeCheckpoint
                .checkpoint ||
            null,

        afterCheckpoint:
            afterCheckpoint
                .checkpoint ||
            null,

        checkpointSave: {

            before:
                beforeCheckpoint,

            after:
                afterCheckpoint

        },

        result:
            executionResult || null

    };

}


// ============================================================
// EXECUTE REQUEST
// ============================================================

async function executeRequest(
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

            stage:
                "request-validation",

            error:
                "Request is required.",

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    const config =
        safeObject(
            options
        );


    // --------------------------------------------------------
    // CREATE + ASSIGN
    // --------------------------------------------------------

    let assignment;


    try {

        assignment =
            autonomousWorker.createAndAssign(

                cleanRequest,

                config

            );

    } catch (error) {

        assignment = {

            success:
                false,

            stage:
                "create-and-assign",

            error:
                error?.message ||
                "Unable to create autonomous task."

        };

    }


    if (
        !assignment?.success
    ) {

        return {

            success:
                false,

            stage:
                assignment?.stage ||
                "create-and-assign",

            error:
                assignment?.error ||
                "Autonomous task creation failed.",

            task:
                assignment?.task ||
                null,

            worker:
                assignment?.worker ||
                null,

            assignment:
                assignment || null,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    const task =
        assignment.task;


    const worker =
        assignment.worker;


    // --------------------------------------------------------
    // APPROVAL FLOW
    // --------------------------------------------------------

    if (
        assignment.waitingApproval ===
        true
    ) {

        const checkpoint =
            saveBeforeExecution(

                task.id,

                {

                    reason:
                        "Checkpoint before approval-controlled autonomous request.",

                    metadata: {

                        mode:
                            "approval",

                        controller:
                            CHECKPOINT_RECOVERY_CONTROLLER_VERSION

                    }

                }

            );


        return {

            success:
                true,

            stage:
                "approval",

            waitingApproval:
                true,

            request:
                cleanRequest,

            task:
                task,

            worker:
                worker,

            assignment:
                assignment.assignment ||
                null,

            beforeCheckpoint:
                checkpoint.checkpoint ||
                null,

            checkpointSave:
                checkpoint,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    // --------------------------------------------------------
    // PRE-EXECUTION CHECKPOINT
    // --------------------------------------------------------

    const beforeCheckpoint =
        saveBeforeExecution(

            task.id,

            {

                reason:
                    "Checkpoint before autonomous request execution.",

                metadata: {

                    mode:
                        "autonomous-recovery",

                    controller:
                        CHECKPOINT_RECOVERY_CONTROLLER_VERSION

                }

            }

        );


    if (
        !beforeCheckpoint.success
    ) {

        return {

            success:
                false,

            stage:
                "checkpoint-before",

            request:
                cleanRequest,

            error:
                beforeCheckpoint.error ||
                "Unable to save pre-execution checkpoint.",

            task:
                task,

            worker:
                worker,

            assignment:
                assignment.assignment ||
                null,

            checkpoint:
                null,

            checkpointSave:
                beforeCheckpoint,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    // --------------------------------------------------------
    // BUILD RECOVERY OPTIONS
    // --------------------------------------------------------

    const executionOptions =
        buildExecutionOptions(
            config
        );


    // --------------------------------------------------------
    // EXECUTE
    // --------------------------------------------------------

    let execution;


    try {

        execution =
            await autonomousWorker
                .executeAssignedTask(

                    worker.id,

                    task.id,

                    executionOptions

                );

    } catch (error) {

        execution = {

            success:
                false,

            stage:
                "autonomous-execution",

            status:
                "autonomous-execution",

            error:
                error?.message ||
                "Autonomous execution failed.",

            task:
                null,

            execution:
                null,

            worker:
                worker

        };

    }


    // --------------------------------------------------------
    // REFRESH TASK
    // --------------------------------------------------------

    const latestTaskResult =
        getTask(
            task.id
        );


    const latestTask =
        latestTaskResult.success
            ? latestTaskResult.task
            : execution?.task ||
              task;


    // --------------------------------------------------------
    // SAVE AFTER EXECUTION
    // --------------------------------------------------------

    const afterCheckpoint =
        saveAfterExecution(

            task.id,

            execution,

            {

                reason:
                    "Checkpoint after autonomous request execution.",

                metadata: {

                    mode:
                        "autonomous-recovery",

                    controller:
                        CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

                    beforeCheckpointId:
                        beforeCheckpoint
                            .checkpoint
                            ?.id ||
                        null

                }

            }

        );


    // --------------------------------------------------------
    // RECOVERY METADATA
    // --------------------------------------------------------

    const recovery =
        execution
            ?.execution
            ?.recovery ||

        execution
            ?.execution
            ?.result
            ?.recovery ||

        latestTask
            ?.steps
            ?.find(
                step =>
                    step.status ===
                    agentManager.STEP_STATES
                        .COMPLETED
            )
            ?.result
            ?.recovery ||

        null;


    return {

        success:
            execution?.success ===
            true,

        stage:
            execution?.stage ||
            "execution",

        request:
            cleanRequest,

        checkpointRecoveryControllerVersion:
            CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

        task:
            clone(
                latestTask
            ),

        worker:
            execution?.worker ||
            worker,

        provider:
            execution?.provider ||
            null,

        workerStatus:
            execution?.workerStatus ||
            null,

        execution:
            execution?.execution ||
            null,

        recovery:
            recovery,

        assignment:
            assignment.assignment ||
            null,

        beforeCheckpoint:
            beforeCheckpoint
                .checkpoint ||
            null,

        afterCheckpoint:
            afterCheckpoint
                .checkpoint ||
            null,

        checkpointSave: {

            before:
                beforeCheckpoint,

            after:
                afterCheckpoint

        },

        error:
            execution?.error ||
            execution?.result?.error ||
            null,

        result:
            execution || null

    };

}


// ============================================================
// APPROVE + EXECUTE
// ============================================================

async function approveAndExecute(
    taskId,
    options = {}
) {

    const cleanTaskId =
        safeString(
            taskId
        );


    if (
        !cleanTaskId
    ) {

        return {

            success:
                false,

            stage:
                "task-validation",

            error:
                "Task ID is required.",

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    const taskResult =
        getTask(
            cleanTaskId
        );


    if (
        !taskResult.success
    ) {

        return {

            success:
                false,

            stage:
                "task-load",

            error:
                taskResult.error,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    const task =
        taskResult.task;


    // --------------------------------------------------------
    // CHECKPOINT BEFORE APPROVAL EXECUTION
    // --------------------------------------------------------

    const beforeCheckpoint =
        saveBeforeExecution(

            cleanTaskId,

            {

                reason:
                    "Checkpoint before approved autonomous execution.",

                metadata: {

                    mode:
                        "approved-execution",

                    controller:
                        CHECKPOINT_RECOVERY_CONTROLLER_VERSION

                }

            }

        );


    if (
        !beforeCheckpoint.success
    ) {

        return {

            success:
                false,

            stage:
                "checkpoint-before",

            error:
                beforeCheckpoint.error ||
                "Unable to save approval execution checkpoint.",

            task:
                task,

            checkpointSave:
                beforeCheckpoint,

            checkpointRecoveryControllerVersion:
                CHECKPOINT_RECOVERY_CONTROLLER_VERSION

        };

    }


    let result;


    try {

        result =
            await autonomousWorker
                .approveAndExecute(

                    cleanTaskId,

                    buildExecutionOptions(
                        options
                    )

                );

    } catch (error) {

        result = {

            success:
                false,

            stage:
                "approved-execution",

            status:
                "approved-execution",

            error:
                error?.message ||
                "Approved autonomous execution failed.",

            task:
                null,

            execution:
                null

        };

    }


    const latestTaskResult =
        getTask(
            cleanTaskId
        );


    const latestTask =
        latestTaskResult.success
            ? latestTaskResult.task
            : result?.task ||
              task;


    const afterCheckpoint =
        saveAfterExecution(

            cleanTaskId,

            result,

            {

                reason:
                    "Checkpoint after approved autonomous execution.",

                metadata: {

                    mode:
                        "approved-execution",

                    controller:
                        CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

                    beforeCheckpointId:
                        beforeCheckpoint
                            .checkpoint
                            ?.id ||
                        null

                }

            }

        );


    const normalizedRecoveryResult =
        buildCheckpointExecutionResult(
            result
        );


    return {

        success:
            result?.success ===
            true,

        stage:
            result?.stage ||
            "execution",

        task:
            clone(
                latestTask
            ),

        worker:
            result?.worker ||
            null,

        workerStatus:
            result?.workerStatus ||
            null,

        execution:
            result?.execution ||
            null,

        recovery:
            result
                ?.execution
                ?.recovery ||
            result
                ?.execution
                ?.result
                ?.recovery ||
            null,

        executionStatus:
            normalizedRecoveryResult
                .status,

        executionStage:
            normalizedRecoveryResult
                .stage,

        beforeCheckpoint:
            beforeCheckpoint
                .checkpoint ||
            null,

        afterCheckpoint:
            afterCheckpoint
                .checkpoint ||
            null,

        checkpointSave: {

            before:
                beforeCheckpoint,

            after:
                afterCheckpoint

        },

        result:
            result || null,

        checkpointRecoveryControllerVersion:
            CHECKPOINT_RECOVERY_CONTROLLER_VERSION

    };

}


// ============================================================
// INSPECT RECOVERY STATE
// ============================================================

function inspectTask(
    taskId
) {

    return checkpointBridge
        .inspectTask(
            taskId
        );

}


// ============================================================
// GET RECOVERY CANDIDATE
// ============================================================

function getRecoveryCandidate(
    taskId
) {

    return checkpointBridge
        .getRecoveryCandidate(
            taskId
        );

}


// ============================================================
// BUILD RECOVERY PLAN
// ============================================================

function buildRecoveryPlan(
    taskId
) {

    return checkpointBridge
        .buildRecoveryPlan(
            taskId
        );

}


// ============================================================
// GET LATEST CHECKPOINT
// ============================================================

function getLatestCheckpoint(
    taskId
) {

    return checkpointBridge
        .getLatestCheckpoint(
            taskId
        );

}


// ============================================================
// GET STATUS
// ============================================================

function getStatus() {

    const autonomousStatus =
        autonomousWorker &&
        typeof autonomousWorker.getStatus ===
        "function"

            ? autonomousWorker.getStatus()

            : null;


    const recoveryStatus =
        autonomousRecovery &&
        typeof autonomousRecovery.getStatus ===
        "function"

            ? autonomousRecovery.getStatus()

            : null;


    const checkpointStatus =
        checkpointBridge &&
        typeof checkpointBridge.getStatus ===
        "function"

            ? checkpointBridge.getStatus()

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
            "AarHen Checkpoint Recovery Controller",

        version:
            CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

        status:
            "active",

        autonomousWorker: {

            connected:
                Boolean(
                    autonomousStatus &&
                    autonomousStatus.success ===
                    true
                ),

            version:
                autonomousStatus?.version ||
                null

        },

        autonomousRecovery: {

            connected:
                Boolean(
                    recoveryStatus &&
                    recoveryStatus.success ===
                    true
                ),

            version:
                recoveryStatus?.version ||
                null

        },

        checkpointBridge: {

            connected:
                Boolean(
                    checkpointStatus &&
                    checkpointStatus.success ===
                    true
                ),

            version:
                checkpointStatus?.version ||
                null

        },

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

        capabilities: {

            checkpointBeforeExecution:
                true,

            checkpointAfterExecution:
                true,

            executionStageTracking:
                true,

            executionStatusTracking:
                true,

            recoveryAwareExecution:
                true,

            approvedExecution:
                true,

            recoveryCandidate:
                true,

            recoveryPlan:
                true,

            taskInspection:
                true,

            latestCheckpoint:
                true,

            // Recovery plans are inspection-only; task restoration is not implemented.
            recoveryPlanInspectionOnly:
                true,

            automaticCheckpointRestore:
                false,

            automaticTaskResume:
                false,

            controlledExecutionRequired:
                true

        },

        architecture: {

            request:
                "Checkpoint Recovery Controller",

            autonomous:
                "Autonomous Worker",

            recovery:
                "Autonomous Recovery",

            checkpoint:
                "Checkpoint Bridge",

            taskState:
                "Agent Manager"

        }

    };

}


// ============================================================
// RESET
// ============================================================

function reset() {

    return {

        success:
            true,

        status:
            "checkpoint-recovery-controller-reset",

        checkpointRecoveryControllerVersion:
            CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

        statePreserved:
            true

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    CHECKPOINT_RECOVERY_CONTROLLER_VERSION,

    getTask,

    buildExecutionOptions,

    saveBeforeExecution,

    saveAfterExecution,

    executeAssignedTask,

    executeRequest,

    approveAndExecute,

    inspectTask,

    getRecoveryCandidate,

    buildRecoveryPlan,

    getLatestCheckpoint,

    getStatus,

    reset

};
