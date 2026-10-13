"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createRecoveryLeaseStore } = require("./recoveryLeaseStore");

test("recovery lease is exclusive across independent store instances", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-lease-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const firstStore = createRecoveryLeaseStore({ directory });
  const secondStore = createRecoveryLeaseStore({ directory });

  const first = firstStore.claim("task-shared", { source: "test-one" });
  assert.equal(first.success, true);
  assert.equal(first.acquired, true);

  const second = secondStore.claim("task-shared", { source: "test-two" });
  assert.equal(second.success, false);
  assert.equal(second.recoveryAlreadyInProgress, true);

  assert.equal(secondStore.inspect("task-shared").locked, true);
  assert.equal(secondStore.release("task-shared", "wrong-token").released, false);
  assert.equal(firstStore.release("task-shared", first.token).released, true);

  const afterRelease = secondStore.claim("task-shared");
  assert.equal(afterRelease.success, true);
  assert.equal(secondStore.release("task-shared", afterRelease.token).released, true);
});

test("a separate Node.js process cannot claim a task already locked on the shared filesystem", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-process-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createRecoveryLeaseStore({ directory });
  const claim = store.claim("task-cross-process");
  assert.equal(claim.success, true);

  const script = [
    'const { createRecoveryLeaseStore } = require(' + JSON.stringify(path.resolve(__dirname, "recoveryLeaseStore")) + ');',
    'const store = createRecoveryLeaseStore({ directory: process.argv[1] });',
    'const result = store.claim("task-cross-process");',
    'process.stdout.write(JSON.stringify(result));',
    'process.exit(result.success ? 2 : 0);'
  ].join("\\n");
  const child = spawnSync(process.execPath, ["-e", script, directory], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.success, false);
  assert.equal(result.recoveryAlreadyInProgress, true);
  assert.equal(store.release("task-cross-process", claim.token).released, true);
});

test("a lease survives store reconstruction and an expired lease fails closed", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-crash-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const beforeRestart = createRecoveryLeaseStore({ directory, leaseDurationMs: 1000 });
  const claim = beforeRestart.claim("task-restart");
  assert.equal(claim.success, true);

  // Simulate a process restart by constructing a new store over the same disk.
  const afterRestart = createRecoveryLeaseStore({ directory });
  const blocked = afterRestart.claim("task-restart");
  assert.equal(blocked.success, false);
  assert.equal(blocked.recoveryAlreadyInProgress, true);

  // Even an expired claim is not stolen automatically: that could duplicate
  // a side effect if the original executor is merely slow or partitioned.
  const file = path.join(directory, "task-restart.json");
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  saved.expiresAt = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(file, JSON.stringify(saved), "utf8");
  const stale = afterRestart.claim("task-restart");
  assert.equal(stale.success, false);
  assert.equal(stale.staleLease, true);
  assert.equal(afterRestart.inspect("task-restart").locked, true);
  assert.equal(afterRestart.release("task-restart", claim.token).released, true);
});

test("invalid task IDs are rejected before filesystem access", () => {
  const store = createRecoveryLeaseStore({ directory: path.join(os.tmpdir(), "aarhen-unused-lease-test") });
  assert.throws(() => store.claim("../escape"), /valid task ID/i);
});
