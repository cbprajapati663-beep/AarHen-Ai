// ============================================================
// AARHEN CORE V5
// WORKER PROVIDER CONTROLLER
// ============================================================
// Version: 5.10.2
//
// Purpose:
// - Connect Agent Worker with Provider Bridge
// - Automatically prepare research context for worker tasks
// - Keep provider selection outside Agent Runner
// - Preserve Worker safety and queue controls
// - Support provider-backed task execution
// - Support provider-aware queue execution
// - Refresh task state before provider detection to avoid
//   stale task snapshots
//
// Architecture:
//
// Autonomous Agent
//       ↓
// Agent Worker
//       ↓
// Worker Provider Controller
//       ↓
// Provider Bridge
//       ↓
// Provider Manager
//       ↓
// Research Provider
//
// IMPORTANT:
// - This layer does NOT bypass Agent Worker.
// - This layer does NOT bypass Agent Runner.
// - This layer does NOT directly call provider implementations.
// - Provider access always goes through Provider Bridge.
// - Protected external actions remain protected.
// ============================================================


const agentWorker =
    require("./agentWorker");


const agentManager =
    require("./agentManager");


const providerBridge =
    require("./providerBridge");


// ============================================================
// VERSION
// ============================================================

const WORKER_PROVIDER_VERSION =
    "5.10.2";


// ============================================================
// ACTIONS THAT REQUIRE PROVIDER CONTEXT
// ============================================================

const PROVIDER_RESEARCH_ACTIONS =
    Object.freeze([

        "read_public_information"

    ]);


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


function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(
            value
        );

    return Number.isFinite(
        number
    )
        ? number
        : fallback;

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


    if (
        typeof agentManager.getTask !==
        "function"
    ) {

        return {

            success:
                false,

            error:
                "Agent Manager does not expose getTask()."

        };

    }


    try {

        return agentManager.getTask(
            id
        );

    } catch (error) {

        return {

            success:
                false,

            error:
                error.message ||
                "Unable to read task."

        };

    }

}


// ============================================================
// FIND PROVIDER-RESEARCH STEPS
// ============================================================

function getProviderSteps(
    task
) {

    const steps =
        safeArray(
            task?.steps
        );


    return steps.filter(
        step =>
            PROVIDER_RESEARCH_ACTIONS
                .includes(
                    safeString(
                        step?.action
                    )
                )
    );

}


// ============================================================
// CHECK WHETHER TASK NEEDS PROVIDER
// ============================================================

function taskNeedsProvider(
    task
) {

    return getProviderSteps(
        task
    ).length > 0;

}


// ============================================================
// GET RESEARCH REQUEST FROM TASK
// ============================================================

function getResearchRequest(
    task,
    step
) {

    const stepInput =
        safeObject(
            step?.input
        );


    const taskContext =
        safeObject(
            task?.context
        );


    const request =
        safeString(

            stepInput.request ||

            stepInput.query ||

            taskContext.request ||

            task?.request ||

            ""

        );


    return request;

}


// ============================================================
// BUILD PROVIDER REQUIREMENT
// ============================================================

function buildProviderRequirement(
    task,
    step
) {

    const request =
        getResearchRequest(
            task,
            step
        );


    return {

        action:
            safeString(
                step?.action
            ),

        request,

        providerRequired:
            true,

        reason:
            "Task action requires live public-information research.",

        taskId:
            task?.id ||
            null,

        agentId:
            task?.agentId ||
            null,

        stepId:
            step?.id ||
            null

    };

}


// ============================================================
// REFRESH TASK SNAPSHOT
// ============================================================
//
// Agent Manager methods return cloned task snapshots.
//
// Example:
//
// createTask() → snapshot
// addStep()    → internal task changes
//
// The old snapshot may therefore not contain the new step.
//
// This helper always prefers the latest Agent Manager state
// when a task ID is available.
// ============================================================

function refreshTaskSnapshot(
    task
) {

    const original =
        safeObject(
            task
        );


    const taskId =
        safeString(
            original.id
        );


    if (
        !taskId
    ) {

        return {

            success:
                true,

            refreshed:
                false,

            task:
                original

        };

    }


    const latest =
        getTask(
            taskId
        );


    if (
        latest.success &&
        latest.task
    ) {

        return {

            success:
                true,

            refreshed:
                true,

            task:
                latest.task

        };

    }


    return {

        success:
            true,

        refreshed:
            false,

        task:
            original

    };

}


// ============================================================
// PREPARE TASK PROVIDER CONTEXT
// ============================================================
//
// Existing context is preserved.
//
// If the task already contains research context, Provider
// Bridge returns it without doing another search.
//
// Otherwise Provider Bridge performs provider-backed search.
//
// IMPORTANT:
// The task is refreshed from Agent Manager first so a stale
// createTask() snapshot cannot hide newly-added research
// steps.
// ============================================================

async function prepareTaskProviderContext(
    task,
    options = {}
) {

    const config =
        safeObject(
            options
        );


    // --------------------------------------------------------
    // Refresh task state
    // --------------------------------------------------------

    const refreshed =
        refreshTaskSnapshot(
            task
        );


    const workingTask =
        refreshed.task ||
        safeObject(
            task
        );


    // --------------------------------------------------------
    // Check provider requirement using latest task state
    // --------------------------------------------------------

    if (
        !taskNeedsProvider(
            workingTask
        )
    ) {

        return {

            success:
                true,

            required:
                false,

            searched:
                false,

            refreshed:
                refreshed.refreshed ===
                true,

            context:
                null,

            message:
                "Task does not require provider-backed research."

        };

    }


    const providerSteps =
        getProviderSteps(
            workingTask
        );


    const step =
        providerSteps[0] ||
        null;


    if (
        !step
    ) {

        return {

            success:
                true,

            required:
                false,

            searched:
                false,

            refreshed:
                refreshed.refreshed ===
                true,

            context:
                null

        };

    }


    const request =
        getResearchRequest(
            workingTask,
            step
        );


    if (
        !request
    ) {

        return {

            success:
                false,

            required:
                true,

            searched:
                false,

            refreshed:
                refreshed.refreshed ===
                true,

            context:
                null,

            error:
                "Research task does not contain a usable query/request.",

            requirement:
                buildProviderRequirement(
                    workingTask,
                    step
                )

        };

    }


    const existingContext =
        safeObject(
            config.context
        ).research ||
        workingTask?.context?.research ||
        null;


    const provider =
        safeString(
            config.provider
        ) ||
        null;


    const maxSources =
        Math.max(
            1,
            Math.min(
                10,
                safeNumber(
                    config.maxSources,
                    5
                )
            )
        );


    if (
        !providerBridge ||
        typeof providerBridge.prepareResearchContext !==
        "function"
    ) {

        return {

            success:
                false,

            required:
                true,

            searched:
                false,

            refreshed:
                refreshed.refreshed ===
                true,

            context:
                null,

            error:
                "Provider Bridge is not available."

        };

    }


    try {

        const prepared =
            await providerBridge
                .prepareResearchContext({

                    query:
                        request,

                    maxSources,

                    provider,

                    existingContext

                });


        if (
            !prepared ||
            prepared.success !==
            true
        ) {

            return {

                success:
                    false,

                required:
                    true,

                searched:
                    prepared?.searched ===
                    true,

                refreshed:
                    refreshed.refreshed ===
                    true,

                context:
                    null,

                provider:
                    prepared?.provider ||
                    provider ||
                    null,

                attemptedProviders:
                    safeArray(
                        prepared?.attemptedProviders
                    ),

                fallbackUsed:
                    prepared?.fallbackUsed ===
                    true,

                error:
                    prepared?.error ||
                    "Provider research preparation failed."

            };

        }


        return {

            success:
                true,

            required:
                true,

            searched:
                prepared.searched ===
                true,

            refreshed:
                refreshed.refreshed ===
                true,

            context:
                clone(
                    prepared.context
                ),

            query:
                prepared.query ||
                request,

            provider:
                prepared.provider ||
                null,

            providerType:
                prepared.providerType ||
                null,

            attemptedProviders:
                safeArray(
                    prepared.attemptedProviders
                ),

            fallbackUsed:
                prepared.fallbackUsed ===
                true,

            sourceCount:
                prepared.sourceCount ||
                0,

            bridgeVersion:
                providerBridge.PROVIDER_BRIDGE_VERSION ||
                null

        };

    } catch (error) {

        return {

            success:
                false,

            required:
                true,

            searched:
                false,

            refreshed:
                refreshed.refreshed ===
                true,

            context:
                null,

            provider:
                provider ||
                null,

            error:
                error.message ||
                "Provider research preparation failed."

        };

    }

}


// ============================================================
// BUILD WORKER CONTEXT
// ============================================================
//
// Provider research is merged with any context supplied by
// the caller.
//
// Caller context always remains available.
// ============================================================

function buildWorkerContext(
    options = {},
    providerContext = null
) {

    const config =
        safeObject(
            options
        );


    const baseContext =
        safeObject(
            config.context
        );


    const workerContext = {

        ...clone(
            baseContext
        )

    };


    if (
        providerContext
    ) {

        workerContext.research =
            clone(
                providerContext
            );

        workerContext.provider =
            {

                active:
                    true,

                source:
                    "provider-bridge",

                bridgeVersion:
                    providerBridge
                        .PROVIDER_BRIDGE_VERSION ||
                    null

            };

    }


    return workerContext;

}


// ============================================================
// GET WORKER
// ============================================================

function getWorker(
    workerId
) {

    if (
        typeof agentWorker.getWorker !==
        "function"
    ) {

        return {

            success:
                false,

            error:
                "Agent Worker does not expose getWorker()."

        };

    }


    return agentWorker.getWorker(
        workerId
    );

}


// ============================================================
// GET TASK STATUS
// ============================================================

function getTaskStatus(
    taskId
) {

    const task =
        getTask(
            taskId
        );


    if (
        !task.success
    ) {

        return task;

    }


    const steps =
        safeArray(
            task.task?.steps
        );


    const providerSteps =
        steps.filter(
            step =>
                PROVIDER_RESEARCH_ACTIONS
                    .includes(
                        safeString(
                            step?.action
                        )
                    )
        );


    return {

        success:
            true,

        taskId:
            task.task.id,

        agentId:
            task.task.agentId,

        status:
            task.task.status,

        providerRequired:
            providerSteps.length >
            0,

        providerStepCount:
            providerSteps.length,

        providerActions:
            providerSteps.map(
                step =>
                    safeString(
                        step.action
                    )
            )

    };

}


// ============================================================
// RUN ONE TASK
// ============================================================
//
// This is the main Worker + Provider integration API.
//
// Flow:
//
// 1. Read task
// 2. Detect research action
// 3. Prepare Provider context
// 4. Pass merged context to Agent Worker
// 5. Agent Worker passes it to Agent Runner
//
// No direct provider call is performed here.
// ============================================================

async function runTask(
    workerId,
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


    const providerPreparation =
        await prepareTaskProviderContext(

            task,

            options

        );


    if (
        !providerPreparation.success
    ) {

        return {

            success:
                false,

            stage:
                "provider-preparation",

            task:
                clone(
                    task
                ),

            provider:
                providerPreparation,

            error:
                providerPreparation.error ||
                "Provider context preparation failed."

        };

    }


    const workerContext =
        buildWorkerContext(

            options,

            providerPreparation.context

        );


    const workerOptions = {

        ...safeObject(
            options
        ),

        context:
            workerContext

    };


    try {

        const result =
            await agentWorker.runAssignedTask(

                workerId,

                workerOptions

            );


        return {

            success:
                result?.success ===
                true,

            stage:
                "worker-execution",

            workerProviderVersion:
                WORKER_PROVIDER_VERSION,

            provider: {

                required:
                    providerPreparation.required,

                searched:
                    providerPreparation.searched,

                provider:
                    providerPreparation.provider ||
                    null,

                providerType:
                    providerPreparation.providerType ||
                    null,

                attemptedProviders:
                    safeArray(
                        providerPreparation
                            .attemptedProviders
                    ),

                fallbackUsed:
                    providerPreparation
                        .fallbackUsed ===
                    true,

                sourceCount:
                    providerPreparation
                        .sourceCount ||
                    0

            },

            worker:
                result?.worker ||
                null,

            task:
                result?.task ||
                clone(
                    task
                ),

            execution:
                result?.execution ||
                null,

            workerStatus:
                result?.workerStatus ||
                null

        };

    } catch (error) {

        return {

            success:
                false,

            stage:
                "worker-execution",

            workerProviderVersion:
                WORKER_PROVIDER_VERSION,

            provider:
                {

                    required:
                        providerPreparation.required,

                    searched:
                        providerPreparation.searched,

                    provider:
                        providerPreparation.provider ||
                        provider ||
                        null,

                    fallbackUsed:
                        providerPreparation
                            .fallbackUsed ===
                        true

                },

            task:
                clone(
                    task
                ),

            error:
                error.message ||
                "Provider-aware worker execution failed."

        };

    }

}


// ============================================================
// RUN QUEUE
// ============================================================
//
// Executes queued tasks one by one.
//
// Each task is independently checked for provider needs.
//
// This prevents one research task from forcing provider use
// for unrelated calculation / knowledge tasks.
// ============================================================

async function runQueue(
    workerId,
    options = {}
) {

    const workerResult =
        getWorker(
            workerId
        );


    if (
        !workerResult.success
    ) {

        return workerResult;

    }


    const worker =
        workerResult.worker;


    const config =
        safeObject(
            options
        );


    const maxTasks =
        Math.max(
            1,
            safeNumber(
                config.maxTasks,
                100
            )
        );


    const results =
        [];


    let processed =
        0;


    while (
        processed <
        maxTasks
    ) {

        const currentWorker =
            getWorker(
                worker.id
            );


        if (
            !currentWorker.success
        ) {

            break;

        }


        const queue =
            safeArray(
                currentWorker.worker
                    ?.queue
            );


        if (
            queue.length ===
            0
        ) {

            break;

        }


        const nextTaskId =
            queue[0];


        const result =
            await runTask(

                worker.id,

                nextTaskId,

                config

            );


        results.push(
            clone(
                result
            )
        );


        processed +=
            1;


        if (
            !result.success
        ) {

            break;

        }


        if (
            result.workerStatus ===
            agentWorker.WORKER_STATES
                .WAITING_APPROVAL
        ) {

            break;

        }


        if (
            result.workerStatus ===
            agentWorker.WORKER_STATES
                .PAUSED
        ) {

            break;

        }


        if (
            result.workerStatus ===
            agentWorker.WORKER_STATES
                .STOPPED
        ) {

            break;

        }


        if (
            result.workerStatus ===
            agentWorker.WORKER_STATES
                .ERROR
        ) {

            break;

        }

    }


    const finalWorker =
        getWorker(
            worker.id
        );


    return {

        success:
            true,

        workerProviderVersion:
            WORKER_PROVIDER_VERSION,

        worker:
            finalWorker.worker ||
            null,

        processed,

        results

    };

}


// ============================================================
// PREVIEW PROVIDER PLAN
// ============================================================
//
// Gives higher layers a safe preview without running the task.
//
// ============================================================

async function previewTask(
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


    const providerSteps =
        getProviderSteps(
            task
        );


    if (
        providerSteps.length ===
        0
    ) {

        return {

            success:
                true,

            taskId:
                task.id,

            providerRequired:
                false,

            steps:
                [],

            message:
                "No provider-backed action detected."

        };

    }


    const preparation =
        await prepareTaskProviderContext(

            task,

            {

                ...safeObject(
                    options
                )

            }

        );


    return {

        success:
            preparation.success,

        taskId:
            task.id,

        providerRequired:
            true,

        searched:
            preparation.searched,

        provider:
            preparation.provider ||
            null,

        providerType:
            preparation.providerType ||
            null,

        sourceCount:
            preparation.sourceCount ||
            0,

        fallbackUsed:
            preparation.fallbackUsed ===
            true,

        attemptedProviders:
            safeArray(
                preparation.attemptedProviders
            ),

        error:
            preparation.error ||
            null

    };

}


// ============================================================
// PROVIDER STATUS
// ============================================================

function getProviderStatus() {

    if (
        !providerBridge ||
        typeof providerBridge.getStatus !==
        "function"
    ) {

        return {

            success:
                false,

            error:
                "Provider Bridge status is unavailable."

        };

    }


    return {

        success:
            true,

        workerProviderVersion:
            WORKER_PROVIDER_VERSION,

        workerConnected:
            Boolean(
                agentWorker &&
                typeof agentWorker
                    .runAssignedTask ===
                "function"
            ),

        providerBridge:
            providerBridge.getStatus()

    };

}


// ============================================================
// SYSTEM STATUS
// ============================================================

function getStatus() {

    const workerStatus =
        typeof agentWorker.getStatus ===
        "function"

            ? agentWorker.getStatus()

            : null;


    const providerStatus =
        getProviderStatus();


    return {

        success:
            true,

        version:
            WORKER_PROVIDER_VERSION,

        status:
            "active",

        providerResearchActions:
            [
                ...PROVIDER_RESEARCH_ACTIONS
            ],

        worker: {

            connected:
                Boolean(
                    workerStatus &&
                    workerStatus.success ===
                    true
                ),

            version:
                workerStatus?.version ||
                null,

            status:
                workerStatus?.status ||
                null

        },

        providerBridge: {

            connected:
                Boolean(
                    providerStatus &&
                    providerStatus.success ===
                    true &&
                    providerStatus
                        .providerBridge
                        ?.success ===
                    true
                ),

            version:
                providerStatus
                    ?.providerBridge
                    ?.version ||
                null,

            status:
                providerStatus
                    ?.providerBridge
                    ?.status ||
                null

        },

        integration:

            Boolean(

                workerStatus &&
                workerStatus.success ===
                true &&

                providerStatus &&
                providerStatus.success ===
                true

            )

    };

}


// ============================================================
// RESET
// ============================================================
//
// This controller is stateless.
// Worker and Provider Manager own their respective state.
//

function reset() {

    return {

        success:
            true,

        version:
            WORKER_PROVIDER_VERSION,

        status:
            "worker-provider-reset",

        workerStatePreserved:
            true,

        providerStatePreserved:
            true

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    WORKER_PROVIDER_VERSION,

    PROVIDER_RESEARCH_ACTIONS,

    getTask,

    getWorker,

    getTaskStatus,

    getProviderSteps,

    taskNeedsProvider,

    getResearchRequest,

    buildProviderRequirement,

    refreshTaskSnapshot,

    prepareTaskProviderContext,

    buildWorkerContext,

    runTask,

    runQueue,

    previewTask,

    getProviderStatus,

    getStatus,

    reset

};
