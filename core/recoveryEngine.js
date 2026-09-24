// ============================================================
// AARHEN CORE V5
// RECOVERY / RETRY ENGINE
// ============================================================
// Version: 5.12.0
//
// Purpose:
// - Controlled retry handling for temporary execution failures
// - Classify failures before retry
// - Retry only safe/retryable failures
// - Never retry approval / STOP / safety blocks
// - Preserve Agent Runner safety checks
// - Work together with Agent Manager built-in retries
// - Provide recovery metadata for debugging and verification
//
// IMPORTANT:
// - This module does NOT bypass Agent Runner.
// - Every retry re-enters the original runner.
// - Autonomous Guard remains active through Agent Runner.
// - Permission checks remain active through Agent Runner.
// - STOP and approval states are never retried.
// ============================================================


const agentManager =
    require("./agentManager");


const agentRunner =
    require("./agentRunner");


const autonomousGuard =
    require("./autonomousGuard");


// ============================================================
// VERSION
// ============================================================

const RECOVERY_ENGINE_VERSION =
    "5.12.0";


// ============================================================
// FAILURE CLASSES
// ============================================================

const FAILURE_CLASSES = Object.freeze({

    TRANSIENT:
        "transient",

    NETWORK:
        "network",

    PROVIDER:
        "provider",

    TIMEOUT:
        "timeout",

    APPROVAL:
        "approval",

    SAFETY:
        "safety",

    STOP:
        "stop",

    PAUSE:
        "pause",

    PERMANENT:
        "permanent",

    UNKNOWN:
        "unknown"

});


// ============================================================
// DEFAULT POLICY
// ============================================================

const DEFAULT_POLICY = Object.freeze({

    maxAttempts:
        3,

    baseDelayMs:
        0,

    maxDelayMs:
        2000,

    retryableClasses: [

        FAILURE_CLASSES.TRANSIENT,

        FAILURE_CLASSES.NETWORK,

        FAILURE_CLASSES.PROVIDER,

        FAILURE_CLASSES.TIMEOUT

    ]

});


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


function now() {

    return new Date()
        .toISOString();

}


function normalizeNumber(
    value,
    fallback,
    minimum = 0
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return fallback;

    }


    return Math.max(
        minimum,
        Math.floor(
            number
        )
    );

}


function normalizePolicy(
    options = {}
) {

    const config =
        safeObject(
            options
        );


    const maxAttempts =
        normalizeNumber(
            config.maxAttempts,
            DEFAULT_POLICY.maxAttempts,
            1
        );


    const baseDelayMs =
        normalizeNumber(
            config.baseDelayMs,
            DEFAULT_POLICY.baseDelayMs,
            0
        );


    const maxDelayMs =
        Math.max(

            baseDelayMs,

            normalizeNumber(
                config.maxDelayMs,
                DEFAULT_POLICY.maxDelayMs,
                0
            )

        );


    const retryableClasses =
        safeArray(
            config.retryableClasses
        )
            .map(
                safeString
            )
            .filter(
                Boolean
            );


    return {

        maxAttempts,

        baseDelayMs,

        maxDelayMs,

        retryableClasses:
            retryableClasses.length > 0

                ? [
                    ...new Set(
                        retryableClasses
                    )
                ]

                : [
                    ...DEFAULT_POLICY.retryableClasses
                ]

    };

}


// ============================================================
// FAILURE EXTRACTION
// ============================================================

function getFailureMessage(
    failure
) {

    const input =
        safeObject(
            failure
        );


    return (
        safeString(
            input.error
        ) ||

        safeString(
            input.reason
        ) ||

        safeString(
            input.message
        ) ||

        "Execution failed."
    );

}


// ============================================================
// FAILURE CLASSIFIER
// ============================================================
//
// Classification is intentionally deterministic.
//
// Recovery only uses this classification to decide whether
// another controlled attempt is allowed.
// ============================================================

function classifyFailure(
    failure
) {

    const input =
        safeObject(
            failure
        );


    const executionStatus =
        safeString(
            input.executionStatus
        )
            .toLowerCase();


    const message =
        getFailureMessage(
            input
        )
            .toLowerCase();


    // --------------------------------------------------------
    // Explicit control / safety states
    // --------------------------------------------------------

    if (
        executionStatus ===
            "approval-required" ||

        input.requiresApproval ===
            true ||

        message.includes(
            "requires approval"
        ) ||

        message.includes(
            "approval"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.APPROVAL,

            retryable:
                false,

            reason:
                "Explicit approval is required."

        };

    }


    if (
        executionStatus ===
            "autonomous-stop" ||

        executionStatus ===
            "task-stopped" ||

        input.stopped ===
            true ||

        message.includes(
            "emergency stop"
        ) ||

        message.includes(
            "task stop"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.STOP,

            retryable:
                false,

            reason:
                "Execution was stopped."

        };

    }


    if (
        executionStatus ===
            "task-paused" ||

        input.paused ===
            true ||

        message.includes(
            "task is paused"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.PAUSE,

            retryable:
                false,

            reason:
                "Execution is paused."

        };

    }


    if (
        executionStatus ===
            "autonomous-guard-blocked" ||

        executionStatus ===
            "autonomous-guard-error" ||

        input.blocked ===
            true ||

        input.safetyGuard
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.SAFETY,

            retryable:
                false,

            reason:
                "Autonomous safety controls blocked execution."

        };

    }


    // --------------------------------------------------------
    // Timeout
    // --------------------------------------------------------

    if (
        executionStatus.includes(
            "timeout"
        ) ||

        message.includes(
            "timeout"
        ) ||

        message.includes(
            "timed out"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.TIMEOUT,

            retryable:
                true,

            reason:
                "Temporary timeout detected."

        };

    }


    // --------------------------------------------------------
    // Network
    // --------------------------------------------------------

    if (
        executionStatus.includes(
            "network"
        ) ||

        message.includes(
            "network"
        ) ||

        message.includes(
            "connection reset"
        ) ||

        message.includes(
            "connection refused"
        ) ||

        message.includes(
            "econnreset"
        ) ||

        message.includes(
            "econnrefused"
        ) ||

        message.includes(
            "enotfound"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.NETWORK,

            retryable:
                true,

            reason:
                "Temporary network failure detected."

        };

    }


    // --------------------------------------------------------
    // Provider
    // --------------------------------------------------------

    if (
        executionStatus.includes(
            "provider"
        ) ||

        message.includes(
            "provider"
        ) ||

        message.includes(
            "rate limit"
        ) ||

        message.includes(
            "temporarily unavailable"
        ) ||

        message.includes(
            "service unavailable"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.PROVIDER,

            retryable:
                true,

            reason:
                "Temporary provider failure detected."

        };

    }


    // --------------------------------------------------------
    // Transient
    // --------------------------------------------------------

    if (
        executionStatus.includes(
            "transient"
        ) ||

        message.includes(
            "temporary"
        ) ||

        message.includes(
            "try again"
        ) ||

        message.includes(
            "retry"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.TRANSIENT,

            retryable:
                true,

            reason:
                "Temporary execution failure detected."

        };

    }


    // --------------------------------------------------------
    // Permanent failures
    // --------------------------------------------------------

    if (
        executionStatus.includes(
            "unknown-action"
        ) ||

        executionStatus.includes(
            "invalid"
        ) ||

        executionStatus.includes(
            "unsupported"
        ) ||

        message.includes(
            "not registered"
        ) ||

        message.includes(
            "unsupported"
        ) ||

        message.includes(
            "invalid action"
        )
    ) {

        return {

            success:
                true,

            classification:
                FAILURE_CLASSES.PERMANENT,

            retryable:
                false,

            reason:
                "Failure does not appear recoverable by retry."

        };

    }


    // --------------------------------------------------------
    // Unknown
    // --------------------------------------------------------

    return {

        success:
            true,

        classification:
            FAILURE_CLASSES.UNKNOWN,

        retryable:
            false,

        reason:
            "Failure could not be classified as safely retryable."

    };

}


// ============================================================
// RECOVERY DECISION
// ============================================================

function getRecoveryDecision(
    failure,
    attempt = 1,
    options = {}
) {

    const policy =
        normalizePolicy(
            options
        );


    const currentAttempt =
        normalizeNumber(
            attempt,
            1,
            1
        );


    const classification =
        classifyFailure(
            failure
        );


    const attemptsRemaining =
        Math.max(

            policy.maxAttempts -
            currentAttempt,

            0

        );


    const classAllowed =
        policy.retryableClasses.includes(
            classification.classification
        );


    const retryable =
        classification.retryable ===
        true &&
        classAllowed &&
        attemptsRemaining >
            0;


    const nextAttempt =
        currentAttempt + 1;


    const delay =
        retryable

            ? Math.min(

                policy.maxDelayMs,

                policy.baseDelayMs *
                Math.pow(
                    2,
                    Math.max(
                        currentAttempt - 1,
                        0
                    )
                )

            )

            : 0;


    return {

        success:
            true,

        retry:
            retryable,

        retryable,

        attempt:
            currentAttempt,

        nextAttempt:
            retryable
                ? nextAttempt
                : null,

        attemptsRemaining,

        maxAttempts:
            policy.maxAttempts,

        classification:
            classification.classification,

        reason:
            classification.reason,

        delayMs:
            delay,

        exhausted:
            attemptsRemaining ===
            0

    };

}


// ============================================================
// DELAY
// ============================================================

async function wait(
    milliseconds
) {

    const delay =
        normalizeNumber(
            milliseconds,
            0,
            0
        );


    if (
        delay <=
        0
    ) {

        return;

    }


    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                delay
            )
    );

}


// ============================================================
// CREATE RECOVERY RUNNER
// ============================================================
//
// Each retry calls the original runner again.
//
// This is important because Agent Runner continues to enforce:
// - permissions
// - Autonomous Guard
// - STOP
// - approval
// - controlled action mapping
//
// ============================================================

function createRecoveryRunner(
    runner,
    options = {}
) {

    if (
        typeof runner !==
        "function"
    ) {

        throw new TypeError(
            "Recovery runner requires a runner function."
        );

    }


    const policy =
        normalizePolicy(
            options
        );


    return async function recoveryRunner(
        executionContext
    ) {

        let attempt =
            1;


        const recoveryHistory =
            [];


        while (
            attempt <=
            policy.maxAttempts
        ) {

            let result;


            try {

                result =
                    await runner(
                        executionContext
                    );

            } catch (error) {

                result = {

                    success:
                        false,

                    error:
                        error?.message ||
                        "Runner threw an execution error.",

                    executionStatus:
                        "runner-error"

                };

            }


            if (
                result &&
                result.success ===
                true
            ) {

                return {

                    ...result,

                    recovery: {

                        enabled:
                            true,

                        recovered:
                            attempt >
                            1,

                        attempts:
                            attempt,

                        maxAttempts:
                            policy.maxAttempts,

                        history:
                            recoveryHistory

                    }

                };

            }


            const decision =
                getRecoveryDecision(

                    result || {

                        success:
                            false,

                        error:
                            "Runner returned no result."

                    },

                    attempt,

                    policy

                );


            recoveryHistory.push({

                attempt,

                classification:
                    decision.classification,

                retry:
                    decision.retry,

                reason:
                    decision.reason,

                error:
                    getFailureMessage(
                        result
                    ),

                delayMs:
                    decision.delayMs

            });


            if (
                !decision.retry
            ) {

                return {

                    ...(result || {

                        success:
                            false

                    }),

                    success:
                        false,

                    recovery: {

                        enabled:
                            true,

                        recovered:
                            false,

                        attempts:
                            attempt,

                        maxAttempts:
                            policy.maxAttempts,

                        finalClassification:
                            decision.classification,

                        exhausted:
                            decision.exhausted,

                        history:
                            recoveryHistory

                    }

                };

            }


            await wait(
                decision.delayMs
            );


            attempt =
                decision.nextAttempt;

        }


        return {

            success:
                false,

            error:
                "Recovery retry attempts exhausted.",

            executionStatus:
                "recovery-exhausted",

            recovery: {

                enabled:
                    true,

                recovered:
                    false,

                attempts:
                    policy.maxAttempts,

                maxAttempts:
                    policy.maxAttempts,

                finalClassification:
                    FAILURE_CLASSES.UNKNOWN,

                exhausted:
                    true,

                history:
                    recoveryHistory

            }

        };

    };

}


// ============================================================
// RUN TASK WITH RECOVERY
// ============================================================

async function runTask(
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

            error:
                "A runner function is required."

        };

    }


    const config =
        safeObject(
            options
        );


    const recoveryRunner =
        createRecoveryRunner(

            runner,

            config

        );


    try {

        const result =
            await agentManager.runTask(

                taskId,

                recoveryRunner,

                {

                    maxIterations:
                        normalizeNumber(

                            config.maxIterations,

                            100,

                            1

                        )

                }

            );


        return {

            success:
                result.success ===
                true,

            recoveryEngineVersion:
                RECOVERY_ENGINE_VERSION,

            result,

            task:
                result.task ||
                null

        };

    } catch (error) {

        return {

            success:
                false,

            recoveryEngineVersion:
                RECOVERY_ENGINE_VERSION,

            error:
                error?.message ||
                "Recovery task execution failed.",

            result:
                null,

            task:
                null

        };

    }

}


// ============================================================
// RUN TASK WITH DEFAULT AGENT RUNNER
// ============================================================

async function runWithAgentRunner(
    taskId,
    options = {}
) {

    const runner =
        agentRunner.createRunner({

            source:
                "recovery-engine"

        });


    return runTask(

        taskId,

        runner,

        options

    );

}


// ============================================================
// STATUS
// ============================================================

function getStatus(
    options = {}
) {

    const config =
        normalizePolicy(
            options
        );


    const managerStatus =
        typeof agentManager.getStatus ===
        "function"

            ? agentManager.getStatus()

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
            RECOVERY_ENGINE_VERSION,

        status:
            "active",

        policy:
            clone(
                config
            ),

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
                    typeof guardStatus ===
                    "object"
                ),

            version:
                guardStatus?.version ||
                null,

            status:
                guardStatus?.status ||
                null

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
            "recovery-engine-reset",

        version:
            RECOVERY_ENGINE_VERSION

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    RECOVERY_ENGINE_VERSION,

    FAILURE_CLASSES,

    DEFAULT_POLICY,

    classifyFailure,

    getRecoveryDecision,

    createRecoveryRunner,

    runTask,

    runWithAgentRunner,

    getStatus,

    reset

};
