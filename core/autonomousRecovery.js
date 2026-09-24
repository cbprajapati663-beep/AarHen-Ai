// ============================================================
// AARHEN CORE V5
// AUTONOMOUS RECOVERY CONTROLLER
// ============================================================
// Version: 5.12.3
//
// Purpose:
// - Connect Autonomous Worker with Recovery Worker
// - Provide recovery-aware autonomous request execution
// - Preserve Worker Provider / Agent Worker / Agent Runner flow
// - Preserve Autonomous Safety Guard
// - Provide a controlled high-level recovery entry point
//
// Architecture:
//
// Autonomous Request
//       ↓
// Autonomous Recovery Controller
//       ↓
// Autonomous Worker
//       ↓
// Worker Provider
//       ↓
// Agent Worker
//       ↓
// Recovery Worker
//       ↓
// Recovery Bridge
//       ↓
// Recovery Engine
//       ↓
// Agent Runner
//       ↓
// Autonomous Guard
//       ↓
// Permission
//       ↓
// Controlled Executor
//
// IMPORTANT:
// - This controller does not execute arbitrary code.
// - It does not bypass Autonomous Worker.
// - It does not bypass Worker Provider.
// - It does not bypass Agent Worker.
// - It does not bypass Agent Runner.
// - Recovery remains controlled by Recovery Worker / Engine.
// - Protected actions remain approval-controlled.
// ============================================================


const autonomousWorker =
    require("./autonomousWorker");


const recoveryWorker =
    require("./recoveryWorker");


const recoveryBridge =
    require("./recoveryBridge");


const recoveryEngine =
    require("./recoveryEngine");


const agentRunner =
    require("./agentRunner");


const autonomousGuard =
    require("./autonomousGuard");


// ============================================================
// VERSION
// ============================================================

const AUTONOMOUS_RECOVERY_VERSION =
    "5.12.3";


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
// CREATE RECOVERY RUNNER
// ============================================================
//
// The recovery runner wraps Agent Runner.
//
// The resulting runner is passed through Autonomous Worker.
//
// Autonomous Worker then passes it through Worker Provider
// and Agent Worker before Agent Runner execution.
//
// ============================================================

function createRecoveryRunner(
    options = {}
) {

    const config =
        safeObject(
            options
        );


    return recoveryWorker.createRecoveryRunner({

        ...config,

        source:
            config.source ||
            "autonomous-recovery"

    });

}


// ============================================================
// BUILD EXECUTION OPTIONS
// ============================================================
//
// This keeps all existing Autonomous Worker options.
//
// Only the runner is injected.
//
// ============================================================

function buildExecutionOptions(
    options = {}
) {

    const config =
        safeObject(
            options
        );


    // --------------------------------------------------------
    // Explicit recovery disable
    // --------------------------------------------------------

    if (
        config.recovery ===
        false
    ) {

        return {

            ...config

        };

    }


    const recoveryOptions = {

        maxAttempts:
            config.maxAttempts,

        baseDelayMs:
            config.baseDelayMs,

        maxDelayMs:
            config.maxDelayMs,

        retryableClasses:
            config.retryableClasses,

        source:
            config.source ||
            "autonomous-recovery"

    };


    // --------------------------------------------------------
    // Use caller-provided runner when available.
    // Otherwise Recovery Worker creates the standard Agent
    // Runner underneath.
    // --------------------------------------------------------

    if (
        typeof config.runner ===
        "function"
    ) {

        recoveryOptions.runner =
            config.runner;

    }


    const recoveryRunner =
        createRecoveryRunner(
            recoveryOptions
        );


    return {

        ...config,

        runner:
            recoveryRunner,

        recovery:
            true

    };

}


// ============================================================
// EXECUTE AUTONOMOUS REQUEST
// ============================================================
//
// This is the main high-level API.
//
// Existing Autonomous Worker handles:
// - Autonomous Agent
// - Planner
// - Agent Manager
// - Worker
// - Worker Provider
//
// Recovery Controller only injects the recovery-aware runner.
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

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION

        };

    }


    const executionOptions =
        buildExecutionOptions(
            options
        );


    try {

        const result =
            await autonomousWorker.executeRequest(

                cleanRequest,

                executionOptions

            );


        return {

            success:
                result?.success ===
                true,

            stage:
                result?.stage ||
                "execution",

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION,

            request:
                cleanRequest,

            task:
                result?.task ||
                null,

            worker:
                result?.worker ||
                null,

            provider:
                result?.provider ||
                null,

            workerStatus:
                result?.workerStatus ||
                null,

            execution:
                result?.execution ||
                null,

            recovery:
                result?.execution?.recovery ||
                result?.execution?.result?.recovery ||
                result?.task?.steps?.find(
                    step =>
                        step.status ===
                        "completed"
                )?.result?.recovery ||
                null,

            assignment:
                result?.assignment ||
                null,

            result:
                result || null

        };

    } catch (error) {

        return {

            success:
                false,

            stage:
                "autonomous-recovery-execution",

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION,

            request:
                cleanRequest,

            error:
                error?.message ||
                "Autonomous recovery execution failed.",

            task:
                null,

            worker:
                null,

            provider:
                null,

            workerStatus:
                null,

            execution:
                null,

            recovery:
                null

        };

    }

}


// ============================================================
// EXECUTE ASSIGNED AUTONOMOUS TASK
// ============================================================
//
// This method works when a task has already been created and
// assigned by the Autonomous Worker.
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

            stage:
                "worker-validation",

            error:
                "Worker ID is required.",

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION

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

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION

        };

    }


    const executionOptions =
        buildExecutionOptions(
            options
        );


    try {

        const result =
            await autonomousWorker.executeAssignedTask(

                cleanWorkerId,

                cleanTaskId,

                executionOptions

            );


        return {

            success:
                result?.success ===
                true,

            stage:
                result?.stage ||
                "execution",

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION,

            workerId:
                cleanWorkerId,

            taskId:
                cleanTaskId,

            task:
                result?.task ||
                null,

            worker:
                result?.worker ||
                null,

            provider:
                result?.provider ||
                null,

            workerStatus:
                result?.workerStatus ||
                null,

            execution:
                result?.execution ||
                null,

            recovery:
                result?.execution?.recovery ||
                result?.execution?.result?.recovery ||
                result?.task?.steps?.find(
                    step =>
                        step.status ===
                        "completed"
                )?.result?.recovery ||
                null,

            result:
                result || null

        };

    } catch (error) {

        return {

            success:
                false,

            stage:
                "autonomous-assigned-recovery",

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION,

            workerId:
                cleanWorkerId,

            taskId:
                cleanTaskId,

            error:
                error?.message ||
                "Assigned autonomous recovery execution failed.",

            task:
                null,

            worker:
                null,

            provider:
                null,

            workerStatus:
                null,

            execution:
                null,

            recovery:
                null

        };

    }

}


// ============================================================
// APPROVAL-AWARE REQUEST TEST
// ============================================================
//
// Protected actions should remain in approval state before
// recovery runner execution begins.
//
// ============================================================

async function executeProtectedRequest(
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
                "Request is required.",

            autonomousRecoveryVersion:
                AUTONOMOUS_RECOVERY_VERSION

        };

    }


    const executionOptions =
        buildExecutionOptions({

            ...safeObject(
                options
            ),

            source:
                "autonomous-recovery-protected"

        });


    const result =
        await autonomousWorker.executeRequest(

            cleanRequest,

            executionOptions

        );


    return {

        success:
            result?.success ===
            true,

        stage:
            result?.stage ||
            "execution",

        autonomousRecoveryVersion:
            AUTONOMOUS_RECOVERY_VERSION,

        waitingApproval:
            result?.waitingApproval ===
            true,

        task:
            result?.task ||
            null,

        worker:
            result?.worker ||
            null,

        result:
            result || null

    };

}


// ============================================================
// RECOVERY ANALYSIS
// ============================================================

function analyzeRecovery(
    result
) {

    const input =
        safeObject(
            result
        );


    const directRecovery =
        safeObject(
            input.recovery
        );


    const nestedExecution =
        safeObject(
            input.execution
        );


    const nestedRecovery =
        safeObject(
            nestedExecution.recovery
        );


    const recovery =
        Object.keys(
            directRecovery
        ).length > 0

            ? directRecovery

            : nestedRecovery;


    return {

        success:
            true,

        enabled:
            recovery.enabled ===
            true,

        recovered:
            recovery.recovered ===
            true,

        attempts:
            Number(
                recovery.attempts
            ) || 0,

        maxAttempts:
            Number(
                recovery.maxAttempts
            ) || 0,

        exhausted:
            recovery.exhausted ===
            true,

        finalClassification:
            recovery.finalClassification ||
            null,

        history:
            Array.isArray(
                recovery.history
            )
                ? clone(
                    recovery.history
                )
                : []

    };

}


// ============================================================
// GET STATUS
// ============================================================

function getStatus() {

    const autonomousStatus =
        typeof autonomousWorker.getStatus ===
        "function"

            ? autonomousWorker.getStatus()

            : null;


    const recoveryStatus =
        typeof recoveryWorker.getStatus ===
        "function"

            ? recoveryWorker.getStatus()

            : null;


    const bridgeStatus =
        typeof recoveryBridge.getStatus ===
        "function"

            ? recoveryBridge.getStatus()

            : null;


    const recoveryEngineStatus =
        typeof recoveryEngine.getStatus ===
        "function"

            ? recoveryEngine.getStatus()

            : null;


    const runnerStatus =
        typeof agentRunner.getStatus ===
        "function"

            ? agentRunner.getStatus()

            : null;


    const guardStatus =
        typeof autonomousGuard.getStatus ===
        "function"

            ? autonomousGuard.getStatus()

            : null;


    return {

        success:
            true,

        version:
            AUTONOMOUS_RECOVERY_VERSION,

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

        recoveryWorker: {

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

        recoveryBridge: {

            connected:
                Boolean(
                    bridgeStatus &&
                    bridgeStatus.success ===
                    true
                ),

            version:
                bridgeStatus?.version ||
                null

        },

        recoveryEngine: {

            connected:
                Boolean(
                    recoveryEngineStatus &&
                    recoveryEngineStatus.success ===
                    true
                ),

            version:
                recoveryEngineStatus?.version ||
                null

        },

        agentRunner: {

            connected:
                Boolean(
                    runnerStatus &&
                    runnerStatus.success ===
                    true
                ),

            version:
                runnerStatus?.version ||
                null

        },

        autonomousSafetyGuard: {

            connected:
                Boolean(
                    guardStatus &&
                    guardStatus.status
                ),

            version:
                guardStatus?.version ||
                null,

            status:
                guardStatus?.status ||
                null

        },

        architecture: {

            autonomous:
                "Autonomous Worker",

            recovery:
                "Recovery Worker",

            bridge:
                "Recovery Bridge",

            engine:
                "Recovery Engine",

            execution:
                "Agent Runner",

            safety:
                "Autonomous Safety Guard"

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
            "autonomous-recovery-reset",

        version:
            AUTONOMOUS_RECOVERY_VERSION

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    AUTONOMOUS_RECOVERY_VERSION,

    createRecoveryRunner,

    buildExecutionOptions,

    executeRequest,

    executeAssignedTask,

    executeProtectedRequest,

    analyzeRecovery,

    getStatus,

    reset

};
