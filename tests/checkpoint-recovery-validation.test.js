"use strict";

const assert = require("node:assert/strict");
const engine = require("../core/checkpointEngine");
const manager = require("../core/agentManager");
const controller = require("../core/checkpointRecoveryController");
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

// Checkpoint snapshots must preserve step execution inputs and metadata.
const metadataTask = {
  id: "step-metadata-snapshot",
  agentId: "validation-agent",
  status: manager.TASK_STATES.RUNNING,
  currentStepIndex: 0,
  steps: [{
    id: "metadata-step",
    index: 0,
    name: "Metadata step",
    description: "Test snapshot fields",
    action: "inspect",
    policy: { scope: "read-only" },
    input: { prompt: "safe inspection" },
    metadata: { source: "validation" },
    createdAt: "2026-01-01T00:00:00.000Z",
    status: manager.STEP_STATES.PENDING
  }]
};
const metadataCheckpoint = engine.buildCheckpoint(metadataTask, { id: "metadata-checkpoint" });
assert.deepEqual(metadataCheckpoint.task.steps[0].policy, { scope: "read-only" });
assert.deepEqual(metadataCheckpoint.task.steps[0].input, { prompt: "safe inspection" });
assert.deepEqual(metadataCheckpoint.task.steps[0].metadata, { source: "validation" });
assert.equal(metadataCheckpoint.task.steps[0].createdAt, "2026-01-01T00:00:00.000Z");

// Step-level edits must be detected even when aggregate counters are unchanged.
engine.reset();
const stepSnapshotTask = {
  id: "step-drift-task",
  agentId: "validation-agent",
  status: manager.TASK_STATES.RUNNING,
  currentStepIndex: 0,
  steps: [{ id: "step-drift", index: 0, name: "Original", action: "inspect", status: manager.STEP_STATES.PENDING }]
};
assert.equal(engine.saveCheckpoint(stepSnapshotTask).success, true);
const changedStepTask = structuredClone(stepSnapshotTask);
changedStepTask.steps[0].name = "Modified";
const stepComparison = engine.compareWithLatestCheckpoint(changedStepTask);
assert.equal(stepComparison.success, true);
assert.equal(stepComparison.changed, true);
assert.equal(stepComparison.differences.some(item => item.field === "steps"), true);
engine.reset();

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

// Drift comparison must notice step-level edits even when aggregate counters stay equal.
const preInspectChangedStepSnapshot = structuredClone(manager.getTask("inspection-task").task);
preInspectChangedStepSnapshot.steps[0].name = "Edited step name";
const preInspectStepDrift = engine.compareWithLatestCheckpoint(preInspectChangedStepSnapshot);
assert.equal(preInspectStepDrift.success, true);
assert.equal(preInspectStepDrift.changed, true);
assert.equal(preInspectStepDrift.differences.some(item => item.field === "steps"), true);

const beforeInspectSnapshot = structuredClone(manager.getTask("inspection-task").task);
const checkpointBeforeInspection = structuredClone(saved.checkpoint);
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

// Detect changes inside step metadata even when aggregate counters remain equal.
const changedStepSnapshot = structuredClone(beforeInspectSnapshot);
changedStepSnapshot.steps[0].name = "Changed step metadata";
const stepDrift = engine.compareWithLatestCheckpoint(changedStepSnapshot);
assert.equal(stepDrift.success, true);
assert.equal(stepDrift.changed, true);
assert.equal(stepDrift.differences.some(item => item.field === "steps"), true);
assert.deepEqual(manager.getTask("inspection-task").task, beforeInspectSnapshot);

// A live task change after checkpointing must be reported as drift, not restored.
assert.equal(manager.startTask("inspection-task").success, true);
const afterStart = manager.getTask("inspection-task").task;
const driftInspection = controller.inspectTask("inspection-task");
assert.equal(driftInspection.success, true);
assert.equal(driftInspection.comparison.changed, true);
assert.equal(
  driftInspection.comparison.differences.some(item => item.field === "status"),
  true
);
assert.deepEqual(manager.getTask("inspection-task").task, afterStart);
assert.deepEqual(bridge.getLatestCheckpoint("inspection-task").checkpoint, checkpointBeforeInspection);
assert.equal(driftInspection.recoveryPlan.recoverable, false);
assert.equal(driftInspection.recoveryPlan.reason, "live-task-drift");
assert.equal(driftInspection.recoveryCandidate.recoverable, false);
assert.equal(driftInspection.recoveryCandidate.reason, "live-task-drift");
assert.equal(Array.isArray(driftInspection.recoveryCandidate.differences), true);
assert.equal(driftInspection.recoveryPlan.plan.executable, false);
assert.equal(driftInspection.recoveryPlan.plan.executionMode, "inspection-only");
assert.equal(Array.isArray(driftInspection.recoveryPlan.plan.differences), true);
assert.equal(
  driftInspection.recoveryPlan.plan.differences.some(item => item.field === "status"),
  true
);

// Changes to step metadata must be detected even when aggregate counters stay equal.
manager.reset();
const driftAgent = manager.createAgent({ id: "step-drift-agent" });
assert.equal(driftAgent.success, true);
const driftTask = manager.createTask("step-drift-agent", "Detect step metadata drift", { id: "step-drift-task" });
assert.equal(driftTask.success, true);
assert.equal(manager.addSteps("step-drift-task", [{ id: "step-drift-step", name: "Original step", action: "inspect" }]).success, true);
const stepCheckpoint = bridge.saveTaskCheckpoint("step-drift-task");
assert.equal(stepCheckpoint.success, true);
const liveDriftTask = manager.getTask("step-drift-task").task;
liveDriftTask.steps[0].action = "changed-action";
const stepActionDrift = engine.compareWithLatestCheckpoint(liveDriftTask);
assert.equal(stepActionDrift.success, true);
assert.equal(stepActionDrift.changed, true);
assert.equal(stepActionDrift.differences.some(item => item.field === "steps"), true);

// Verify drift detection covers key task metadata beyond status and steps.
for (const [field, value] of [
  ["agentId", "different-agent"],
  ["request", "Modified request"],
  ["description", "Changed description"],
  ["priority", "critical"],
  ["autonomy", false],
  ["warnings", ["new warning"]],
  ["retries", 2],
  ["maxRetries", 99],
  ["error", "changed error"]
]) {
  const alteredTask = structuredClone(beforeInspectSnapshot);
  alteredTask[field] = value;
  const metadataDrift = engine.compareWithLatestCheckpoint(alteredTask);
  assert.equal(metadataDrift.success, true, field);
  assert.equal(metadataDrift.changed, true, field);
  assert.equal(
    metadataDrift.differences.some(item => item.field === field),
    true,
    field
  );
}

// Verify nested step approval and result payload changes are included in drift checks.
for (const [field, value] of [
  ["requiresApproval", true],
  ["approved", true],
  ["result", { output: "altered result" }]
]) {
  const alteredTask = structuredClone(beforeInspectSnapshot);
  alteredTask.steps[0][field] = value;
  const nestedStepDrift = engine.compareWithLatestCheckpoint(alteredTask);
  assert.equal(nestedStepDrift.success, true, field);
  assert.equal(nestedStepDrift.changed, true, field);
  assert.equal(
    nestedStepDrift.differences.some(item => item.field === "steps"),
    true,
    field
  );
}

// Step-list changes must also be detected as checkpoint drift.
manager.reset();
assert.equal(manager.createAgent({ id: "step-drift-agent" }).success, true);
assert.equal(manager.createTask("step-drift-agent", "Detect step drift", { id: "step-drift-task" }).success, true);
assert.equal(manager.addSteps("step-drift-task", [
  { id: "step-drift-1", name: "First", action: "inspect" }
]).success, true);
assert.equal(bridge.saveTaskCheckpoint("step-drift-task").success, true);
assert.equal(manager.addSteps("step-drift-task", [
  { id: "step-drift-2", name: "Second", action: "inspect" }
]).success, true);
const stepDrift = controller.inspectTask("step-drift-task");
assert.equal(stepDrift.success, true);
assert.equal(stepDrift.comparison.changed, true);
assert.equal(stepDrift.comparison.differences.some(item => item.field === "steps"), true);
assert.equal(stepDrift.comparison.differences.some(item => item.field === "totalSteps"), true);

// Comparing a valid task with no saved checkpoint must be a safe no-op.
const noCheckpointComparison = engine.compareWithLatestCheckpoint({
  id: "no-checkpoint-comparison-task",
  status: manager.TASK_STATES.READY,
  steps: []
});
assert.equal(noCheckpointComparison.success, true);
assert.equal(noCheckpointComparison.checkpointExists, false);
assert.equal(noCheckpointComparison.changed, false);
assert.deepEqual(noCheckpointComparison.differences, []);

// Invalid comparison input must fail closed.
assert.equal(engine.compareWithLatestCheckpoint(null).success, false);
assert.equal(engine.compareWithLatestCheckpoint(undefined).success, false);

console.log("Checkpoint recovery validation tests passed.");
