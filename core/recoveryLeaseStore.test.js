"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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
  ].join("\n");
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


test("stale lease cleanup requires explicit confirmation and an inspected fingerprint", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-clear-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createRecoveryLeaseStore({ directory });
  const claim = store.claim("task-stale-clear");
  assert.equal(claim.success, true);

  const file = path.join(directory, "task-stale-clear.json");
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  saved.expiresAt = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(file, JSON.stringify(saved), "utf8");

  const inspection = store.inspect("task-stale-clear");
  assert.equal(inspection.success, true);
  assert.equal(inspection.expired, true);
  assert.match(inspection.leaseFingerprint, /^[a-f0-9]{64}$/);

  const unconfirmed = store.clearStale("task-stale-clear", {
    expectedFingerprint: inspection.leaseFingerprint
  });
  assert.equal(unconfirmed.cleared, false);
  assert.equal(fs.existsSync(file), true);

  const wrongSnapshot = store.clearStale("task-stale-clear", {
    confirmNoActiveExecutor: true,
    expectedFingerprint: "0".repeat(64)
  });
  assert.equal(wrongSnapshot.cleared, false);
  assert.equal(fs.existsSync(file), true);

  const cleared = store.clearStale("task-stale-clear", {
    confirmNoActiveExecutor: true,
    expectedFingerprint: inspection.leaseFingerprint
  });
  assert.equal(cleared.success, true);
  assert.equal(cleared.cleared, true);
  assert.equal(cleared.executionStarted, false);
  assert.equal(cleared.requiresNewOwnerDecision, true);
  assert.equal(fs.existsSync(file), false);
});

test("stale lease cleanup refuses active leases and fails closed on a busy mutation guard", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-clear-guard-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createRecoveryLeaseStore({ directory });
  const claim = store.claim("task-active-clear");
  assert.equal(claim.success, true);

  const inspection = store.inspect("task-active-clear");
  const active = store.clearStale("task-active-clear", {
    confirmNoActiveExecutor: true,
    expectedFingerprint: inspection.leaseFingerprint
  });
  assert.equal(active.cleared, false);
  assert.match(active.error, /expired/i);

  fs.writeFileSync(path.join(directory, "task-active-clear.json.mutation"), "operator guard", { flag: "wx" });
  const guarded = store.clearStale("task-active-clear", {
    confirmNoActiveExecutor: true,
    expectedFingerprint: inspection.leaseFingerprint
  });
  assert.equal(guarded.cleared, undefined);
  assert.equal(guarded.mutationInProgress, true);
  assert.equal(store.inspect("task-active-clear").locked, true);
});


test("mutation guard inspection reports active-or-orphaned guards without exposing contents", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-mutation-inspect-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createRecoveryLeaseStore({ directory });

  const clear = store.inspectMutationGuard("task-guard-inspect");
  assert.equal(clear.success, true);
  assert.equal(clear.present, false);
  assert.equal(clear.requiresOperatorReview, false);

  const guardPath = path.join(directory, "task-guard-inspect.json.mutation");
  fs.writeFileSync(guardPath, "private guard contents", { flag: "wx" });
  const present = store.inspectMutationGuard("task-guard-inspect");
  assert.equal(present.success, true);
  assert.equal(present.present, true);
  assert.equal(present.requiresOperatorReview, true);
  assert.equal(JSON.stringify(present).includes("private guard contents"), false);
  assert.match(present.error, /active or left by a crashed mutation/i);
});


test("stale mutation guard cleanup requires owner confirmation, exact fingerprint, and a dead local PID", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-mutation-clear-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createRecoveryLeaseStore({ directory });
  const guardPath = path.join(directory, "task-guard-stale.json.mutation");
  const exited = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
  assert.equal(exited.error, undefined);
  assert.ok(Number.isSafeInteger(exited.pid));

  fs.writeFileSync(guardPath, JSON.stringify({
    pid: exited.pid,
    hostname: os.hostname(),
    startedAt: new Date(Date.now() - 5000).toISOString(),
    token: "private-guard-token"
  }), { flag: "wx" });

  const inspection = store.inspectMutationGuard("task-guard-stale");
  assert.equal(inspection.present, true);
  assert.equal(inspection.ownerStatus, "not-running");
  assert.equal(inspection.safeToClear, true);
  assert.match(inspection.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(inspection).includes("private-guard-token"), false);

  const unconfirmed = store.clearStaleMutationGuard("task-guard-stale", {
    expectedFingerprint: inspection.fingerprint
  });
  assert.equal(unconfirmed.cleared, false);
  assert.equal(fs.existsSync(guardPath), true);

  const wrongSnapshot = store.clearStaleMutationGuard("task-guard-stale", {
    confirmNoActiveMutation: true,
    expectedFingerprint: "0".repeat(64)
  });
  assert.equal(wrongSnapshot.cleared, false);
  assert.equal(fs.existsSync(guardPath), true);

  const cleared = store.clearStaleMutationGuard("task-guard-stale", {
    confirmNoActiveMutation: true,
    expectedFingerprint: inspection.fingerprint
  });
  assert.equal(cleared.success, true);
  assert.equal(cleared.cleared, true);
  assert.equal(cleared.executionStarted, false);
  assert.equal(cleared.requiresNewOwnerDecision, true);
  assert.equal(fs.existsSync(guardPath), false);
});

test("stale mutation guard cleanup refuses a live PID and unknown legacy guards", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-recovery-mutation-live-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createRecoveryLeaseStore({ directory });
  const guardPath = path.join(directory, "task-guard-live.json.mutation");

  fs.writeFileSync(guardPath, JSON.stringify({
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: new Date().toISOString(),
    token: "do-not-return"
  }), { flag: "wx" });
  const active = store.inspectMutationGuard("task-guard-live");
  assert.equal(active.ownerStatus, "active-or-pid-reused");
  assert.equal(active.safeToClear, false);
  const refused = store.clearStaleMutationGuard("task-guard-live", {
    confirmNoActiveMutation: true,
    expectedFingerprint: active.fingerprint
  });
  assert.equal(refused.cleared, false);
  assert.match(refused.error, /active or cannot be verified/i);
  assert.equal(fs.existsSync(guardPath), true);

  fs.rmSync(guardPath);
  fs.writeFileSync(guardPath, "legacy-unknown-guard", { flag: "wx" });
  const legacy = store.inspectMutationGuard("task-guard-live");
  const unknown = store.clearStaleMutationGuard("task-guard-live", {
    confirmNoActiveMutation: true,
    expectedFingerprint: legacy.fingerprint
  });
  assert.equal(unknown.cleared, false);
  assert.match(unknown.error, /owner metadata is unknown/i);
  assert.equal(fs.existsSync(guardPath), true);
});
