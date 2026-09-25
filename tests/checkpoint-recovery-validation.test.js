"use strict";

const assert = require("node:assert/strict");
const engine = require("../core/checkpointEngine");
const manager = require("../core/agentManager");

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

const stopped = checkpoint({ status: manager.TASK_STATES.STOPPED });
assert.equal(engine.validateCheckpointForRecovery(stopped).valid, false);

const cancelled = checkpoint({ status: manager.TASK_STATES.CANCELLED });
assert.equal(engine.validateCheckpointForRecovery(cancelled).valid, false);

console.log("Checkpoint recovery validation tests passed.");
