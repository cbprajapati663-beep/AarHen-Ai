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
