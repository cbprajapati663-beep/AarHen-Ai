"use strict";

const assert = require("node:assert/strict");
const engine = require("../core/checkpointEngine");

engine.reset();

const task = {
  id: "read-isolation-task",
  agentId: "read-isolation-agent",
  request: "Verify checkpoint read isolation",
  status: "running",
  currentStepIndex: 0,
  steps: [
    { id: "read-step-1", index: 0, name: "Original step", status: "pending", metadata: { keep: true } }
  ]
};

const saved = engine.saveCheckpoint(task);
assert.equal(saved.success, true);

const latest = engine.getLatestCheckpoint(task.id);
assert.equal(latest.success, true);
latest.checkpoint.task.request = "tampered through latest getter";
latest.checkpoint.task.steps[0].metadata.keep = false;

const listed = engine.listCheckpoints(task.id);
assert.equal(listed.success, true);
listed.checkpoints[0].task.steps[0].name = "tampered through list getter";

const reread = engine.getLatestCheckpoint(task.id);
assert.equal(reread.success, true);
assert.equal(reread.checkpoint.task.request, "Verify checkpoint read isolation");
assert.equal(reread.checkpoint.task.steps[0].metadata.keep, true);
assert.equal(reread.checkpoint.task.steps[0].name, "Original step");

console.log("Checkpoint read isolation tests passed.");
