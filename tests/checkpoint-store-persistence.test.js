"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createCheckpointStore } = require("../core/checkpointStore");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-checkpoint-store-"));
try {
  const store = createCheckpointStore({ directory });
  assert.equal(store.get("cp-1"), null);

  const checkpoint = {
    id: "cp-1",
    taskId: "task-1",
    state: "active",
    task: { id: "task-1", status: "running", steps: [{ id: "s1", status: "completed" }] }
  };
  assert.deepEqual(store.save(checkpoint), { success: true, id: "cp-1" });
  assert.deepEqual(store.get("cp-1"), checkpoint);
  assert.deepEqual(store.list(), [checkpoint]);

  // Simulate a process restart by creating a fresh store instance.
  const restartedStore = createCheckpointStore({ directory });
  assert.deepEqual(restartedStore.get("cp-1"), checkpoint);
  assert.deepEqual(restartedStore.list(), [checkpoint]);

  // Returned values are detached from persisted JSON; caller edits must not leak back.
  const readCopy = restartedStore.get("cp-1");
  readCopy.task.steps[0].status = "caller-mutated";
  readCopy.task.extra = true;
  assert.deepEqual(restartedStore.get("cp-1"), checkpoint);

  const listCopy = restartedStore.list();
  listCopy[0].task.steps[0].status = "list-mutated";
  assert.deepEqual(restartedStore.get("cp-1"), checkpoint);

  assert.throws(() => store.get("../outside"), /valid checkpoint ID/);
  assert.throws(() => store.save({ id: "../escape", taskId: "task-1" }), /valid checkpoint ID/);
  assert.equal(store.remove("cp-1").deleted, true);
  assert.equal(store.get("cp-1"), null);
  assert.equal(store.remove("cp-1").deleted, false);

  store.save(checkpoint);
  fs.writeFileSync(path.join(directory, "broken.json"), "{invalid", "utf8");
  assert.throws(() => store.get("broken"), /JSON/);
  console.log("Checkpoint store persistence tests passed.");
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
