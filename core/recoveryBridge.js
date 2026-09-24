// ============================================================
// AARHEN CORE V5
// RECOVERY BRIDGE
// ============================================================
// Version: 5.12.1
//
// Purpose:
// - Connect Recovery Engine with controlled execution
// - Connect Recovery Engine with Agent Runner
// - Preserve Autonomous Safety Guard
// - Provide one controlled recovery-aware execution interface
// - Prepare Agent Worker for recovery-enabled execution
//
// IMPORTANT:
// - This bridge does NOT bypass Agent Runner.
// - Every attempt still passes through Agent Runner.
// - Autonomous Guard remains active.
// - Permission checks remain active.
// - STOP / approval / safety blocks are never retried.
// - This module does not execute arbitrary code by itself.
// ============================================================


const recoveryEngine =
    require("./recoveryEngine");


const agentRunner =
    require("./agentRunner");


const autonomousGuard =
    require("./autonomousGuard");


// ============================================================
// VERSION
// ============================================================

const RECOVERY_BRIDGE_VERSION =
    "5.12.1";


// ============================================================
// HELPERS
// ============================================================

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
// CREATE CONTROLLED RUNNER
// ============================================================
//
// The default runner comes directly from Agent Runner.
//
// Recovery wraps this runner.
// Therefore every retry still goes through:
//
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
// ============================================================

function createRunner(
    options = {}
) {

    const config =
        safeObject(
            options
        );


    let baseRunner;


    if (
        typeof config.runner ===
        "function"
    ) {

        baseRunner =
            config.runner;

    } else {

        baseRunner =
            agentRunner.createRunner({

                source:
                    config.source ||
                    "recovery-bridge",

                ...safeObject(
                    config.context
                )

            });

    }


    return recoveryEngine.createRecoveryRunner(

        baseRunner,

        {

            maxAttempts:
                config.maxAttempts,

            baseDelayMs:
                config.baseDelayMs,

            maxDelayMs:
                config.maxDelayMs,

            retryableClasses:
                config.retryableClasses

        }

    );

}


// ============================================================
// EXECUTE ONE RECOVERY-AWARE REQUEST
// ============================================================
//
// This API is useful when a higher-level worker already has
// task + step execution context.
//
// ============================================================

async function execute(
    executionContext = {},
    options = {}
) {

    const context =
        safeObject(
            executionContext
        );


    const config =
        safeObject(
            options
        );


    const runner =
        createRunner({

            ...config,

            source:
                config.source ||
                "recovery-bridge-execution"

        });


    try {

        const result =
            await runner(
                context
            );


        return {

            success:
                result?.success ===
                true,

            bridgeVersion:
                RECOVERY_BRIDGE_VERSION,

            recoveryEngineVersion:
                recoveryEngine.RECOVERY_ENGINE_VERSION,

            result:
                result || null,

            recovery:
                result?.recovery ||
                null

        };

    } catch (error) {

        return {

            success:
                false,

            bridgeVersion:
                RECOVERY_BRIDGE_VERSION,

            recoveryEngineVersion:
                recoveryEngine.RECOVERY_ENGINE_VERSION,

            error:
                error?.message ||
                "Recovery-aware execution failed.",

            result:
                null,

            recovery:
                null

        };

    }

}


// ============================================================
// RUN FULL AGENT TASK WITH RECOVERY
// ============================================================
//
// This is the high-level task API.
//
// Agent Manager remains responsible for task lifecycle.
// Recovery Engine controls retry classification.
// Agent Runner remains the controlled execution boundary.
//
// ============================================================

async function runTask(
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

            bridgeVersion:
                RECOVERY_BRIDGE_VERSION,

            error:
                "Task ID is required."

        };

    }


    const config =
        safeObject(
            options
        );


    const runner =
        agentRunner.createRunner({

            source:
                config.source ||
                "recovery-bridge-task"

        });


    const result =
        await recoveryEngine.runTask(

            cleanTaskId,

            runner,

            {

                ...config

            }

        );


    return {

        success:
            result.success ===
            true,

        bridgeVersion:
            RECOVERY_BRIDGE_VERSION,

        recoveryEngineVersion:
            recoveryEngine.RECOVERY_ENGINE_VERSION,

        result,

        task:
            result.task ||
            null

    };

}


// ============================================================
// RUN TASK WITH CUSTOM RUNNER
// ============================================================
//
// Useful for controlled integration tests and future worker
// adapters.
//
// ============================================================

async function runTaskWithRunner(
    taskId,
    runner,
    options = {}
) {

    if (
        typeof runner !==
        "function"
    ) {

        return {

            success:
                false,

            bridgeVersion:
                RECOVERY_BRIDGE_VERSION,

            error:
                "A runner function is required."

        };

    }


    const result =
        await recoveryEngine.runTask(

            taskId,

            runner,

            safeObject(
                options
            )

        );


    return {

        success:
            result.success ===
            true,

        bridgeVersion:
            RECOVERY_BRIDGE_VERSION,

        recoveryEngineVersion:
            recoveryEngine.RECOVERY_ENGINE_VERSION,

        result,

        task:
            result.task ||
            null

    };

}


// ============================================================
// FAILURE ANALYSIS
// ============================================================
//
// Exposes Recovery Engine classification to higher layers
// without allowing them to bypass the recovery policy.
//
// ============================================================

function analyzeFailure(
    failure
) {

    const classification =
        recoveryEngine.classifyFailure(
            failure
        );


    const decision =
        recoveryEngine.getRecoveryDecision(

            failure,

            1

        );


    return {

        success:
            true,

        classification:
            classification.classification,

        retryable:
            classification.retryable,

        reason:
            classification.reason,

        decision:
            clone(
                decision
            )

    };

}


// ============================================================
// CHECK SAFE RETRY
// ============================================================
//
// This function is intentionally conservative.
//
// STOP, PAUSE, APPROVAL and SAFETY failures can never become
// retryable through this bridge.
//
// ============================================================

function canRetry(
    failure,
    attempt = 1,
    options = {}
) {

    const decision =
        recoveryEngine.getRecoveryDecision(

            failure,

            attempt,

            safeObject(
                options
            )

        );


    return {

        success:
            true,

        retry:
            decision.retry ===
            true,

        classification:
            decision.classification,

        attempt:
            decision.attempt,

        nextAttempt:
            decision.nextAttempt,

        attemptsRemaining:
            decision.attemptsRemaining,

        reason:
            decision.reason,

        delayMs:
            decision.delayMs

    };

}


// ============================================================
// STATUS
// ============================================================

function getStatus(
    options = {}
) {

    const recoveryStatus =
        recoveryEngine.getStatus(
            options
        );


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
            RECOVERY_BRIDGE_VERSION,

        status:
            "active",

        recoveryEngine: {

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

            recovery:
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
            "recovery-bridge-reset",

        version:
            RECOVERY_BRIDGE_VERSION

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    RECOVERY_BRIDGE_VERSION,

    createRunner,

    execute,

    runTask,

    runTaskWithRunner,

    analyzeFailure,

    canRetry,

    getStatus,

    reset

};
