// ============================================================
// AARHEN CORE V5
// RECOVERY WORKER
// ============================================================
// Version: 5.12.2
//
// Purpose:
// - Connect Agent Worker with Recovery Bridge
// - Inject controlled recovery runner into Agent Worker
// - Preserve Agent Runner as final execution boundary
// - Preserve Autonomous Safety Guard
// - Preserve Permission Brain
// - Support recovery-aware worker task execution
// - Support recovery-aware queue execution
//
// Architecture:
//
// Agent Worker
//      ↓
// Recovery Worker
//      ↓
// Recovery Bridge
//      ↓
// Recovery Engine
//      ↓
// Agent Runner
//      ↓
// Autonomous Safety Guard
//      ↓
// Permission
//      ↓
// Controlled Executor
//
// IMPORTANT:
// - Does not bypass Agent Worker.
// - Does not bypass Agent Runner.
// - Does not bypass Autonomous Guard.
// - Does not execute arbitrary code itself.
// - Recovery retries remain controlled by Recovery Engine.
// ============================================================


const agentWorker =
    require("./agentWorker");


const recoveryBridge =
    require("./recoveryBridge");


const agentRunner =
    require("./agentRunner");


const autonomousGuard =
    require("./autonomousGuard");


// ============================================================
// VERSION
// ============================================================

const RECOVERY_WORKER_VERSION =
    "5.12.2";


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
// CREATE RECOVERY-AWARE RUNNER
// ============================================================
//
// Recovery Bridge creates the retry layer.
//
// Every attempt still enters Agent Runner.
//
// ============================================================

function createRecoveryRunner(
    options = {}
) {

    const config =
        safeObject(
            options
        );


    const runner =
        typeof config.runner ===
        "function"

            ? config.runner

            : agentRunner.createRunner({

                source:
                    config.source ||
                    "recovery-worker",

                context:
                    safeObject(
                        config.context
                    )

            });


    return recoveryBridge.createRunner({

        ...config,

        runner,

        source:
            config.source ||
            "recovery-worker"

    });

}


// ============================================================
// RUN ASSIGNED TASK WITH RECOVERY
// ============================================================
//
// Agent Worker remains responsible for:
//
// - worker state
// - queue
// - task assignment
// - worker lifecycle
//
// Recovery Worker only injects a recovery-aware runner.
//
// ============================================================

async function runAssignedTask(
    workerId,
    options = {}
) {

    const cleanWorkerId =
        safeString(
            workerId
        );


    if (
        !cleanWorkerId
    ) {

        return {

            success:
                false,

            error:
                "Worker ID is required.",

            recoveryWorkerVersion:
                RECOVERY_WORKER_VERSION

        };

    }


    const config =
        safeObject(
            options
        );


    const recoveryRunner =
        createRecoveryRunner({

            ...config,

            source:
                config.source ||
                "recovery-worker-assigned-task"

        });


    try {

        const result =
            await agentWorker.runAssignedTask(

                cleanWorkerId,

                {

                    ...config,

                    runner:
                        recoveryRunner

                }

            );


        return {

            success:
                result?.success ===
                true,

            recoveryWorkerVersion:
                RECOVERY_WORKER_VERSION,

            stage:
                result?.stage ||
                "worker-execution",

            worker:
                result?.worker ||
                null,

            task:
                result?.task ||
                null,

            execution:
                result?.execution ||
                null,

            workerStatus:
                result?.workerStatus ||
                null,

            recovery:
                result?.execution
                    ?.recovery ||
                null,

            result:
                result || null

        };

    } catch (error) {

        return {

            success:
                false,

            recoveryWorkerVersion:
                RECOVERY_WORKER_VERSION,

            stage:
                "recovery-worker-execution",

            error:
                error?.message ||
                "Recovery-aware worker execution failed.",

            worker:
                null,

            task:
                null,

            execution:
                null,

            workerStatus:
                null,

            recovery:
                null

        };

    }

}


// ============================================================
// RUN QUEUE WITH RECOVERY
// ============================================================
//
// Executes queued work through the existing Agent Worker.
//
// Each task receives the same controlled recovery runner.
//
// ============================================================

async function runQueue(
    workerId,
    options = {}
) {

    const cleanWorkerId =
        safeString(
            workerId
        );


    if (
        !cleanWorkerId
    ) {

        return {

            success:
                false,

            error:
                "Worker ID is required.",

            recoveryWorkerVersion:
                RECOVERY_WORKER_VERSION

        };

    }


    const config =
        safeObject(
            options
        );


    const results =
        [];


    const maxTasks =
        Number(
            config.maxTasks
        ) > 0

            ? Math.floor(
                Number(
                    config.maxTasks
                )
            )

            : 100;


    for (
        let index = 0;
        index < maxTasks;
        index += 1
    ) {

        const workerStatus =
            agentWorker.getWorker(
                cleanWorkerId
            );


        if (
            !workerStatus.success
        ) {

            return {

                success:
                    false,

                recoveryWorkerVersion:
                    RECOVERY_WORKER_VERSION,

                error:
                    workerStatus.error ||
                    "Worker could not be loaded.",

                results

            };

        }


        const worker =
            workerStatus.worker;


        if (
            !safeArray(
                worker.queue
            ).length
        ) {

            return {

                success:
                    true,

                recoveryWorkerVersion:
                    RECOVERY_WORKER_VERSION,

                status:
                    "queue-completed",

                results,

                worker:
                    workerStatus.worker

            };

        }


        const result =
            await runAssignedTask(

                cleanWorkerId,

                config

            );


        results.push(
            result
        );


        if (
            result.success !==
            true
        ) {

            return {

                success:
                    false,

                recoveryWorkerVersion:
                    RECOVERY_WORKER_VERSION,

                status:
                    "queue-stopped-on-error",

                results,

                worker:
                    result.worker ||
                    null,

                task:
                    result.task ||
                    null

            };

        }

    }


    const finalWorker =
        agentWorker.getWorker(
            cleanWorkerId
        );


    return {

        success:
            true,

        recoveryWorkerVersion:
            RECOVERY_WORKER_VERSION,

        status:
            "queue-limit-reached",

        results,

        worker:
            finalWorker.success

                ? finalWorker.worker

                : null

    };

}


// ============================================================
// ANALYZE RECOVERY RESULT
// ============================================================
//
// This exposes recovery metadata without allowing a higher
// layer to bypass the Recovery Engine.
//
// ============================================================

function analyzeRecoveryResult(
    result
) {

    const input =
        safeObject(
            result
        );


    const execution =
        safeObject(
            input.execution
        );


    const recovery =
        safeObject(
            input.recovery ||
            execution.recovery
        );


    return {

        success:
            true,

        recoveryEnabled:
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
            safeArray(
                recovery.history
            )

    };

}


// ============================================================
// GET STATUS
// ============================================================

function getStatus(
    options = {}
) {

    const agentWorkerStatus =
        typeof agentWorker.getStatus ===
        "function"

            ? agentWorker.getStatus()

            : null;


    const bridgeStatus =
        typeof recoveryBridge.getStatus ===
        "function"

            ? recoveryBridge.getStatus(
                options
            )

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
            RECOVERY_WORKER_VERSION,

        status:
            "active",

        agentWorker: {

            connected:
                Boolean(
                    agentWorkerStatus &&
                    agentWorkerStatus.success ===
                    true
                ),

            version:
                agentWorkerStatus?.version ||
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

            worker:
                "Agent Worker",

            recovery:
                "Recovery Bridge",

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
            "recovery-worker-reset",

        version:
            RECOVERY_WORKER_VERSION

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    RECOVERY_WORKER_VERSION,

    createRecoveryRunner,

    runAssignedTask,

    runQueue,

    analyzeRecoveryResult,

    getStatus,

    reset

};
