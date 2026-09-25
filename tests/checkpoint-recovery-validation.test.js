"use strict";

const assert = require("node:assert/strict");
const engine = require("../core/checkpointEngine");
const manager = require("../core/agentManager");
const controller = require("../core/checkpointRecoveryController");
const bridge = require("../core/checkpointBridge");
const bridge = require("../core/checkpointBridge");

function checkpoint(overrides = {}) {
  const task = {
    id: "validation-task",
    agentId: "validation-agent",
    status: manager.TASK_STATES.RUNNING,
    currentStepIndex: 0,
    steps: [{ id: "step-1", index: 0, status: manager.STEP_STATES.PENDING }],
    ...overrides
  };
  return engine.buildCheckpoint(task, { id: "validation-checkpoint" });
}

const valid = checkpoint();
assert.equal(engine.validateCheckpointForRecovery(valid).valid, true);

const badSummary = structuredClone(valid);
badSummary.pendingSteps = 0;
assert.equal(engine.validateCheckpointForRecovery(badSummary).valid, false);

const badTaskCounter = structuredClone(valid);
badTaskCounter.task.pendingSteps = 0;
assert.equal(engine.validateCheckpointForRecovery(badTaskCounter).valid, false);

const stop = checkpoint({ stopRequested: true });
assert.equal(engine.validateCheckpointForRecovery(stop).valid, false);

const approval = checkpoint({ status: manager.TASK_STATES.WAITING_APPROVAL });
assert.equal(engine.validateCheckpointForRecovery(approval).valid, false);

const completed = checkpoint({ status: manager.TASK_STATES.COMPLETED });
assert.equal(engine.validateCheckpointForRecovery(completed).valid, false);


const wrongTaskIdentity = structuredClone(valid);
wrongTaskIdentity.task.id = "different-task";
assert.equal(engine.validateCheckpointForRecovery(wrongTaskIdentity).valid, false);

const missingSteps = structuredClone(valid);
missingSteps.task.steps = null;
assert.equal(engine.validateCheckpointForRecovery(missingSteps).valid, false);

const notEligible = structuredClone(valid);
notEligible.recoveryEligible = false;
assert.equal(engine.validateCheckpointForRecovery(notEligible).valid, false);

const noPendingSteps = checkpoint({
  steps: [{ id: "step-1", index: 0, status: manager.STEP_STATES.COMPLETED }]
});
assert.equal(engine.validateCheckpointForRecovery(noPendingSteps).valid, false);

const invalidStepIndex = structuredClone(valid);
invalidStepIndex.task.steps[0].index = 4;
assert.equal(engine.validateCheckpointForRecovery(invalidStepIndex).valid, false);

const missingStepId = structuredClone(valid);
missingStepId.task.steps[0].id = null;
assert.equal(engine.validateCheckpointForRecovery(missingStepId).valid, false);

const unknownStepStatus = structuredClone(valid);
unknownStepStatus.task.steps[0].status = "mystery";
assert.equal(engine.validateCheckpointForRecovery(unknownStepStatus).valid, false);

const duplicateStepIds = checkpoint({
  steps: [
    { id: "same-step", index: 0, status: manager.STEP_STATES.PENDING },
    { id: "same-step", index: 1, status: manager.STEP_STATES.PENDING }
  ]
});
assert.equal(engine.validateCheckpointForRecovery(duplicateStepIds).valid, false);

const stopped = checkpoint({ status: manager.TASK_STATES.STOPPED });
assert.equal(engine.validateCheckpointForRecovery(stopped).valid, false);

const cancelled = checkpoint({ status: manager.TASK_STATES.CANCELLED });
assert.equal(engine.validateCheckpointForRecovery(cancelled).valid, false);

// Recovery plans are descriptive only and must not mutate live task state.
const before = structuredClone(valid.task);
const plan = engine.buildRecoveryPlan(valid.task.id);
assert.equal(plan.success, true);
assert.equal(plan.recoverable, true);
assert.equal(plan.plan.executable, false);
assert.equal(plan.plan.executionMode, "inspection-only");
assert.equal(plan.plan.requiresControlledExecution, true);
assert.deepEqual(valid.task, before);

const capabilities = controller.getStatus().capabilities;
assert.equal(capabilities.recoveryPlanInspectionOnly, true);
assert.equal(capabilities.automaticCheckpointRestore, false);
assert.equal(capabilities.automaticTaskResume, false);
assert.equal(capabilities.controlledExecutionRequired, true);


// Inspection endpoints must fail closed for missing or unknown task IDs.
assert.equal(controller.inspectTask("").success, false);
assert.equal(controller.buildRecoveryPlan("").success, false);
assert.equal(controller.getRecoveryCandidate("").success, false);
assert.equal(controller.inspectTask("unknown-validation-task").success, false);
assert.equal(controller.buildRecoveryPlan("unknown-validation-task").success, false);
assert.equal(controller.getRecoveryCandidate("unknown-validation-task").success, false);


// Recovery inspection remains read-only: it must not change Agent Manager task state.
manager.reset();
const createdAgent = manager.createAgent({ id: "inspection-agent" });
assert.equal(createdAgent.success, true);
const createdTask = manager.createTask("inspection-agent", "Inspect recovery safely", { id: "inspection-task" });
assert.equal(createdTask.success, true);
assert.equal(manager.addSteps("inspection-task", [{ id: "inspection-step", name: "Step", action: "inspect" }]).success, true);
const saved = bridge.saveTaskCheckpoint("inspection-task");
assert.equal(saved.success, true);
const beforeInspectSnapshot = structuredClone(manager.getTask("inspection-task").task);
const inspection = controller.inspectTask("inspection-task");
assert.equal(inspection.success, true);
assert.equal(inspection.taskId, "inspection-task");
assert.equal(inspection.checkpointExists, true);
assert.equal(inspection.latestCheckpoint.taskId, "inspection-task");
assert.equal(inspection.comparison.success, true);
assert.equal(inspection.comparison.changed, false);
assert.equal(inspection.recoveryPlan.success, true);
assert.equal(inspection.recoveryPlan.plan.executable, false);
assert.equal(inspection.recoveryPlan.plan.executionMode, "inspection-only");
assert.deepEqual(manager.getTask("inspection-task").task, beforeInspectSnapshot);

console.log("Checkpoint recovery validation tests passed.");
