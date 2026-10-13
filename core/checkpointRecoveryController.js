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

const { createRecoveryLeaseStore } =
    require("./recoveryLeaseStore");

const recoveryLeaseStore =
    createRecoveryLeaseStore();


// ============================================================
// VERSION
// ============================================================

const CHECKPOINT_RECOVERY_CONTROLLER_VERSION =
    "5.14.0";

// Prevent duplicate provider-recovery executions racing in the same process.
// This is a local single-flight guard; durable/distributed deployments still
// need a shared lease or atomic claim in their persistence layer.
const activeProviderRecoveryResumes = new Set();


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


    const execution =
        safeObject(
            executionResult
        );


    const normalizedExecution =
        buildCheckpointExecutionResult(
            execution
        );


    // Preserve provider fallback diagnostics in the checkpoint.
    // The audit data is metadata only; it never starts execution.
    const nestedResult =
        safeObject(
            execution.result
        );


    const nestedExecution =
        safeObject(
            execution.execution
        );


    const provider =
        safeString(
            execution.provider ||
            nestedResult.provider ||
            nestedExecution.provider
        );


    const attemptedProviders =
        Array.isArray(
            execution.attemptedProviders
        )
            ? execution.attemptedProviders
            : Array.isArray(
                nestedResult.attemptedProviders
            )
                ? nestedResult.attemptedProviders
                : Array.isArray(
                    nestedExecution.attemptedProviders
                )
                    ? nestedExecution.attemptedProviders
                    : [];


    const fallbackUsed =
        execution.fallbackUsed === true ||
        nestedResult.fallbackUsed === true ||
        nestedExecution.fallbackUsed === true;


    const providerRequired =
        execution.providerRequired === true ||
        nestedResult.providerRequired === true ||
        nestedExecution.providerRequired === true;


    const metadata = {
        ...safeObject(config.metadata)
    };


    if (
        provider ||
        attemptedProviders.length > 0 ||
        fallbackUsed ||
        providerRequired
    ) {
        metadata.providerRecovery = {
            provider: provider || null,
            attemptedProviders: clone(attemptedProviders),
            fallbackUsed,
            outcome: normalizedExecution.success
                ? (fallbackUsed ? "fallback-succeeded" : "succeeded")
                : "failed",
            // A provider outage must never trigger an automatic retry.
            // Failed work is surfaced for an explicit owner decision.
            requiresOwnerDecision: normalizedExecution.success !== true,
            automaticRetryAllowed: false
        };
    }


    return checkpointBridge
        .saveAfterExecution(

            taskId,

            normalizedExecution,

            {

                ...config,

                metadata,

                // Mark failed-only checkpoints recoverable only when a
                // provider outage is recorded for an explicit owner decision.
                allowFailedStepRecovery:
                    metadata.providerRecovery?.requiresOwnerDecision === true,

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

function inspectRecoveryLease(taskId) {
    const id = safeString(taskId);
    if (!id) {
        return { success: false, taskId: null, locked: false, error: "Task ID is required." };
    }

    try {
        const result = recoveryLeaseStore.inspect(id);
        if (!result.success) {
            return {
                success: false,
                taskId: id,
                locked: result.locked === true,
                corrupt: result.corrupt === true,
                error: result.error || "Recovery lease inspection failed."
            };
        }

        const lease = safeObject(result.lease);
        return {
            success: true,
            taskId: id,
            locked: result.locked === true,
            expired: result.expired === true,
            staleLease: result.locked === true && result.expired === true,
            // Never expose the ownership token through status/inspection APIs.
            lease: result.locked === true ? {
                pid: Number.isInteger(lease.pid) ? lease.pid : null,
                createdAt: lease.createdAt || null,
                expiresAt: lease.expiresAt || null
            } : null,
            ownershipTokenRedacted: true,
            leaseFingerprint: result.locked === true ? result.leaseFingerprint || null : null
        };
    } catch {
        return {
            success: false,
            taskId: id,
            locked: true,
            error: "Recovery lease inspection rejected the task ID or could not access the lease."
        };
    }
}


// Clears only the exact expired lease snapshot inspected by an operator.
// Authentication must be established by the server before ownerAuthorized is set.
function clearStaleRecoveryLease(taskId, options = {}) {
    const id = safeString(taskId);
    const config = safeObject(options);

    if (!id) {
        return { success: false, cleared: false, taskId: null, error: "Task ID is required." };
    }
    if (config.ownerAuthorized !== true) {
        return { success: false, cleared: false, taskId: id, error: "Owner authorization is required." };
    }
    if (config.confirmNoActiveExecutor !== true) {
        return { success: false, cleared: false, taskId: id, error: "Explicit confirmation that no executor is active is required." };
    }
    if (typeof config.expectedFingerprint !== "string") {
        return { success: false, cleared: false, taskId: id, error: "The inspected lease fingerprint is required." };
    }

    try {
        return recoveryLeaseStore.clearStale(id, {
            confirmNoActiveExecutor: true,
            expectedFingerprint: config.expectedFingerprint
        });
    } catch {
        return { success: false, cleared: false, taskId: id, error: "Recovery lease cleanup rejected the task ID or failed safely." };
    }
}


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

        recoveryLease: {
            storage: "file-system",
            sharedFilesystemOnly: true,
            staleLeaseAutoReclaim: false,
            inspectionAvailable: true
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

            // Restore reconstructs state only; execution and resume remain controlled.
            recoveryPlanInspectionOnly:
                true,

            controlledCheckpointRestore:
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
// RESTORE FROM CHECKPOINT (STATE ONLY; NO EXECUTION)
// ============================================================

function restoreFromCheckpoint(taskId) {
    const id = safeString(taskId);
    if (!id) {
        return { success: false, restored: false, error: "Task ID is required.", task: null };
    }

    const latest = checkpointBridge.getLatestCheckpoint(id);
    if (!latest.success || !latest.checkpoint) {
        return { success: false, restored: false, error: latest.error || "Checkpoint not found.", task: null };
    }

    const checkpoint = latest.checkpoint;
    const checkpointMetadata = safeObject(checkpoint.metadata);
    const providerRecovery = safeObject(checkpointMetadata.providerRecovery);

    // A provider outage that requires an owner decision must not be
    // restored into an executable task through the generic restore path.
    // A dedicated, explicit resolution flow is required first.
    if (providerRecovery.requiresOwnerDecision === true) {
        return {
            success: false,
            restored: false,
            recoverable: true,
            requiresOwnerDecision: true,
            automaticRetryAllowed: false,
            error: "Provider failure requires an explicit owner decision before checkpoint restore.",
            checkpointId: checkpoint.id,
            task: null
        };
    }

    const validation = checkpointBridge.validateCheckpointForRecovery(checkpoint);
    if (!validation.valid) {
        return {
            success: false,
            restored: false,
            recoverable: false,
            error: validation.reason || "Checkpoint failed recovery validation.",
            checkpointId: checkpoint.id,
            task: null
        };
    }

    if (agentManager.getTask(id).success) {
        return {
            success: false,
            restored: false,
            error: "Task already exists; restore will not overwrite live state.",
            checkpointId: checkpoint.id,
            task: null
        };
    }

    const restored = agentManager.restoreTaskFromCheckpoint(checkpoint);
    return {
        ...restored,
        checkpointId: checkpoint.id,
        checkpointRecoveryControllerVersion: CHECKPOINT_RECOVERY_CONTROLLER_VERSION,
        executionStarted: false
    };
}


// ============================================================
// EXPLICITLY RESOLVE AN INTERRUPTED CHECKPOINT STEP
// ============================================================

function resolveInterruptedStep(taskId, stepId, resolution, options = {}) {
    const result = agentManager.resolveInterruptedStep(taskId, stepId, resolution, options);
    return {
        ...result,
        checkpointRecoveryControllerVersion: CHECKPOINT_RECOVERY_CONTROLLER_VERSION,
        executionStarted: false
    };
}


// ============================================================
// EXPLICITLY RESOLVE A PROVIDER FAILURE
// ============================================================
// This method records an explicit owner decision but never executes
// the task. The caller must set ownerAuthorized only after verifying
// the authenticated owner in a trusted server-side layer.
// ============================================================

function resolveProviderFailure(taskId, decision, options = {}) {
    const id = safeString(taskId);
    const action = safeString(decision).toLowerCase();
    const config = safeObject(options);

    if (!id) {
        return { success: false, resolved: false, error: "Task ID is required.", executionStarted: false };
    }

    if (config.ownerAuthorized !== true) {
        return {
            success: false,
            resolved: false,
            requiresOwnerAuthorization: true,
            error: "A verified owner authorization is required.",
            executionStarted: false
        };
    }

    if (!["retry", "abort"].includes(action)) {
        return {
            success: false,
            resolved: false,
            error: "Decision must be 'retry' or 'abort'.",
            executionStarted: false
        };
    }

    if (action === "retry" && config.confirmProviderRetry !== true) {
        return {
            success: false,
            resolved: false,
            requiresConfirmation: true,
            error: "Retry may repeat external side effects; explicit provider-retry confirmation is required.",
            executionStarted: false,
            automaticRetryAllowed: false
        };
    }

    const latest = checkpointBridge.getLatestCheckpoint(id);
    if (!latest.success || !latest.checkpoint) {
        return {
            success: false,
            resolved: false,
            error: latest.error || "Provider-failure checkpoint not found.",
            executionStarted: false
        };
    }

    const checkpoint = latest.checkpoint;
    const metadata = safeObject(checkpoint.metadata);
    const providerRecovery = safeObject(metadata.providerRecovery);

    if (providerRecovery.requiresOwnerDecision !== true ||
        providerRecovery.automaticRetryAllowed !== false) {
        return {
            success: false,
            resolved: false,
            error: "Latest checkpoint does not contain an unresolved, fail-closed provider failure.",
            executionStarted: false,
            automaticRetryAllowed: false
        };
    }

    // This exception is only reachable after trusted owner authorization
    // and a valid retry/abort decision. Generic restore remains fail-closed.
    const validation = checkpointBridge.validateCheckpointForRecovery(checkpoint, {
        allowFailedStepRecovery: true
    });
    if (!validation.valid) {
        return {
            success: false,
            resolved: false,
            error: validation.reason || "Checkpoint failed recovery validation.",
            executionStarted: false
        };
    }

    if (agentManager.getTask(id).success) {
        return {
            success: false,
            resolved: false,
            error: "Task already exists; provider-failure resolution will not overwrite live state.",
            executionStarted: false
        };
    }

    const decidedAt = new Date().toISOString();
    const resolvedMetadata = clone(metadata) || {};
    resolvedMetadata.providerRecovery = {
        ...clone(providerRecovery),
        requiresOwnerDecision: false,
        automaticRetryAllowed: false,
        ownerDecision: {
            decision: action,
            decidedAt,
            authorizedByOwner: true,
            retryConfirmed: action === "retry" && config.confirmProviderRetry === true
        }
    };

    // The original checkpoint remains unchanged. The modified copy is
    // only passed to the validated restore path after the owner decision.
    const resolvedCheckpoint = {
        ...clone(checkpoint),
        metadata: resolvedMetadata
    };

    // An explicitly confirmed owner retry must make the failed step runnable
    // again. Keep completed/skipped steps untouched, and fail closed if the
    // checkpoint cannot identify a single failed step to retry safely.
    if (action === "retry" && Array.isArray(resolvedCheckpoint.task?.steps)) {
        const failedSteps = resolvedCheckpoint.task.steps.filter(
            step => step && step.status === agentManager.STEP_STATES.FAILED
        );

        if (failedSteps.length > 0) {
            const currentStepId = safeString(resolvedCheckpoint.task.currentStepId);
            const targetStep = currentStepId
                ? failedSteps.find(step => safeString(step.id) === currentStepId)
                : (failedSteps.length === 1 ? failedSteps[0] : null);

            if (!targetStep) {
                return {
                    success: false,
                    resolved: false,
                    error: "Cannot safely identify the failed step for owner-approved retry.",
                    executionStarted: false,
                    automaticRetryAllowed: false
                };
            }

            targetStep.status = agentManager.STEP_STATES.PENDING;
            targetStep.error = null;
            targetStep.result = null;
            targetStep.completedAt = null;
        }
    }

    const restored = agentManager.restoreTaskFromCheckpoint(resolvedCheckpoint);
    if (!restored.success) {
        return {
            success: false,
            resolved: false,
            error: restored.error || "Unable to restore task after provider-failure decision.",
            checkpointId: checkpoint.id,
            executionStarted: false
        };
    }

    let task = restored.task;
    if (action === "abort") {
        const stopped = agentManager.stopTask(id, "Owner aborted provider-failure recovery.");
        if (!stopped.success) {
            return {
                success: false,
                resolved: false,
                error: stopped.error || "Owner decision was recorded but task could not be stopped.",
                task: agentManager.getTask(id).task || task,
                checkpointId: checkpoint.id,
                executionStarted: false
            };
        }
        task = stopped.task;
    }

    const audit = checkpointBridge.saveTaskCheckpoint(id, {
        reason: "Checkpoint after explicit owner resolution of provider failure.",
        source: "checkpoint-recovery-controller",
        metadata: resolvedMetadata
    });

    return {
        success: true,
        resolved: true,
        decision: action,
        taskRestored: true,
        task,
        checkpointId: checkpoint.id,
        auditCheckpoint: audit.success ? audit.checkpoint : null,
        auditCheckpointSaved: audit.success === true,
        auditWarning: audit.success ? null : (audit.error || "Owner decision was applied but audit checkpoint could not be saved."),
        executionStarted: false,
        automaticRetryAllowed: false,
        checkpointRecoveryControllerVersion: CHECKPOINT_RECOVERY_CONTROLLER_VERSION
    };
}


// ============================================================
// RESUME OWNER-APPROVED PROVIDER RETRY
// ============================================================
// Resolution and execution are separate operations. This method requires
// a recorded owner retry decision plus a second explicit execution
// confirmation, then uses the existing Worker/Runner path.
// ============================================================

async function resumeResolvedProviderFailure(taskId, options = {}) {
    const id = safeString(taskId);
    const config = safeObject(options);

    if (!id) {
        return { success: false, executionStarted: false, error: "Task ID is required." };
    }
    if (config.ownerAuthorized !== true) {
        return {
            success: false,
            executionStarted: false,
            requiresOwnerAuthorization: true,
            error: "A verified owner authorization is required."
        };
    }
    if (config.confirmExecution !== true) {
        return {
            success: false,
            executionStarted: false,
            requiresConfirmation: true,
            error: "Explicit execution confirmation is required to resume provider recovery."
        };
    }

    if (activeProviderRecoveryResumes.has(id)) {
        return {
            success: false,
            executionStarted: false,
            recoveryAlreadyInProgress: true,
            error: "Provider recovery execution is already in progress for this task."
        };
    }

    activeProviderRecoveryResumes.add(id);

    let leaseClaim;
    try {
        leaseClaim = recoveryLeaseStore.claim(id, {
            source: "checkpointRecoveryController.resumeResolvedProviderFailure"
        });
    } catch (error) {
        activeProviderRecoveryResumes.delete(id);
        return {
            success: false,
            executionStarted: false,
            error: "Unable to acquire persistent recovery lease: " + String(error.message || error)
        };
    }

    if (!leaseClaim.success) {
        activeProviderRecoveryResumes.delete(id);
        return {
            ...leaseClaim,
            success: false,
            executionStarted: false
        };
    }

    try {
    const latest = getLatestCheckpoint(id);
    if (!latest.success || !latest.checkpoint) {
        return { success: false, executionStarted: false, error: latest.error || "Recovery checkpoint not found." };
    }

    const providerRecovery = safeObject(safeObject(latest.checkpoint.metadata).providerRecovery);
    const ownerDecision = safeObject(providerRecovery.ownerDecision);
    if (providerRecovery.requiresOwnerDecision === true ||
        providerRecovery.automaticRetryAllowed !== false ||
        ownerDecision.decision !== "retry" ||
        ownerDecision.retryConfirmed !== true) {
        return {
            success: false,
            executionStarted: false,
            error: "A confirmed owner retry decision is required before execution."
        };
    }

    const current = getTask(id);
    if (!current.success || !current.task) {
        return { success: false, executionStarted: false, error: current.error || "Restored task not found." };
    }
    const task = current.task;

    if (task.stopRequested === true ||
        [agentManager.TASK_STATES.STOPPED, agentManager.TASK_STATES.CANCELLED,
         agentManager.TASK_STATES.COMPLETED, agentManager.TASK_STATES.FAILED].includes(task.status)) {
        return { success: false, executionStarted: false, error: "Task state blocks provider recovery execution." };
    }
    if (task.status === agentManager.TASK_STATES.WAITING_APPROVAL ||
        task.approvalRequired === true ||
        task.steps.some(step => step.status === agentManager.STEP_STATES.WAITING_APPROVAL &&
            step.approved !== true)) {
        return {
            success: false,
            executionStarted: false,
            requiresApproval: true,
            error: "Task has an unresolved approval gate."
        };
    }
    if (task.status !== agentManager.TASK_STATES.PAUSED) {
        return { success: false, executionStarted: false, error: "Task must be paused before controlled recovery execution." };
    }
    if (!task.steps.some(step => step.status === agentManager.STEP_STATES.PENDING)) {
        return { success: false, executionStarted: false, error: "Task has no pending step to execute." };
    }

    const workerResult = autonomousWorker.getWorkerForTask(task);
    if (!workerResult.success || !workerResult.worker) {
        return {
            success: false,
            executionStarted: false,
            error: workerResult.error || "Unable to prepare a worker for provider recovery."
        };
    }

    const assigned = autonomousWorker.assignTask(workerResult.worker.id, id);
    if (!assigned.success) {
        return {
            success: false,
            executionStarted: false,
            error: assigned.error || "Unable to assign the recovered task to its worker."
        };
    }

    const resumed = agentManager.resumeTask(id);
    if (!resumed.success) {
        return { success: false, executionStarted: false, error: resumed.error || "Unable to prepare task for execution." };
    }

    const execution = await executeAssignedTask(
        workerResult.worker.id,
        id,
        safeObject(config.executionOptions)
    );

    if (!execution.success && execution.stage === "checkpoint-before") {
        // The runner has not started; return the task to a safe paused state.
        const latestTask = agentManager.getTask(id);
        if (latestTask.success && latestTask.task.status === agentManager.TASK_STATES.RUNNING) {
            agentManager.pauseTask(id);
        }
        return { ...execution, executionStarted: false };
    }

    return {
        ...execution,
        resumedFromProviderFailure: true,
        executionStarted: true,
        workerId: workerResult.worker.id
    };
    } finally {
        activeProviderRecoveryResumes.delete(id);
        // A release failure leaves the persistent claim in place (fail-closed).
        recoveryLeaseStore.release(id, leaseClaim.token);
    }
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

    restoreFromCheckpoint,

    resolveInterruptedStep,

    resolveProviderFailure,

    resumeResolvedProviderFailure,

    inspectRecoveryLease,

    clearStaleRecoveryLease,

    getStatus,

    reset

};
