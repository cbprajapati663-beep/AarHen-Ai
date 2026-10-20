"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createCheckpointStore, validateId } = require("./checkpointStore");

test("checkpoint store persists valid checkpoint objects and lists them", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-checkpoint-store-"));
  const directory = path.join(root, "private-checkpoints");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createCheckpointStore({ directory });
  const checkpoint = { id: "task-1-checkpoint-1", taskId: "task-1", steps: [], status: "paused" };

  assert.deepEqual(store.save(checkpoint), { success: true, id: checkpoint.id });
  assert.deepEqual(store.get(checkpoint.id), checkpoint);
  assert.deepEqual(store.list(), [checkpoint]);
  assert.equal(store.remove(checkpoint.id).deleted, true);
  assert.equal(store.get(checkpoint.id), null);
});

test("checkpoint IDs reject path traversal and unsafe characters", () => {
  for (const id of ["../escape", "..", ".", "/absolute", "has space", "", null]) {
    assert.throws(() => validateId(id), TypeError);
  }
});

test("checkpoint store rejects a file whose embedded ID does not match its filename", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-checkpoint-integrity-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createCheckpointStore({ directory: root });
  store.save({ id: "integrity-task", taskId: "integrity-task" });
  fs.writeFileSync(path.join(root, "integrity-task.json"), JSON.stringify({ id: "different-task" }));
  assert.throws(() => store.get("integrity-task"), /integrity validation/i);
});

test("new checkpoint directories and files use private permissions on POSIX", { skip: process.platform === "win32" }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-checkpoint-mode-"));
  const directory = path.join(root, "private-checkpoints");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createCheckpointStore({ directory });
  store.save({ id: "private-task", taskId: "private-task", prompt: "sensitive task context" });

  const directoryMode = fs.statSync(directory).mode & 0o777;
  const fileMode = fs.statSync(path.join(directory, "private-task.json")).mode & 0o777;
  assert.equal(directoryMode, 0o700);
  assert.equal(fileMode, 0o600);
});


test("existing checkpoint directories and files are hardened on read", { skip: process.platform === "win32" }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-checkpoint-legacy-mode-"));
  const directory = path.join(root, "legacy-checkpoints");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(directory, { mode: 0o755 });
  const file = path.join(directory, "legacy-task.json");
  const checkpoint = { id: "legacy-task", taskId: "legacy-task", steps: [], status: "paused" };
  fs.writeFileSync(file, JSON.stringify(checkpoint), { mode: 0o644 });
  fs.chmodSync(directory, 0o755);
  fs.chmodSync(file, 0o644);

  const store = createCheckpointStore({ directory });
  assert.deepEqual(store.get("legacy-task"), checkpoint);
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test("checkpoint store refuses symbolic links instead of reading outside files", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-checkpoint-symlink-"));
  const directory = path.join(root, "checkpoints");
  const outside = path.join(root, "outside.json");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(directory);
  fs.writeFileSync(outside, JSON.stringify({ id: "linked-task", taskId: "outside" }));
  fs.symlinkSync(outside, path.join(directory, "linked-task.json"));

  const store = createCheckpointStore({ directory });
  assert.throws(() => store.get("linked-task"), /regular file/i);
});
