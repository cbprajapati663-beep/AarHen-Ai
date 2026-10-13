"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-lease-inspection-"));
process.env.AARHEN_RECOVERY_LEASE_DIR = directory;

const recovery = require("./checkpointRecoveryController");
const { createRecoveryLeaseStore } = require("./recoveryLeaseStore");
const store = createRecoveryLeaseStore({ directory });

test.after(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

test("recovery lease inspection reports an unlocked task without creating a lease", () => {
  const result = recovery.inspectRecoveryLease("task-unlocked");
  assert.equal(result.success, true);
  assert.equal(result.locked, false);
  assert.equal(result.lease, null);
  assert.equal(fs.existsSync(path.join(directory, "task-unlocked.json")), false);
});

test("recovery lease inspection redacts ownership token and exposes safe metadata only", () => {
  const claim = store.claim("task-locked", { source: "inspection-test" });
  assert.equal(claim.success, true);

  const result = recovery.inspectRecoveryLease("task-locked");
  assert.equal(result.success, true);
  assert.equal(result.locked, true);
  assert.equal(result.staleLease, false);
  assert.equal(result.lease.pid, process.pid);
  assert.equal(result.ownershipTokenRedacted, true);
  assert.equal(JSON.stringify(result).includes(claim.token), false);

  const status = recovery.getStatus();
  assert.equal(status.recoveryLease.storage, "file-system");
  assert.equal(status.recoveryLease.sharedFilesystemOnly, true);
  assert.equal(status.recoveryLease.staleLeaseAutoReclaim, false);
  assert.equal(JSON.stringify(status).includes(claim.token), false);

  assert.equal(store.release("task-locked", claim.token).released, true);
});

test("expired recovery lease is reported as stale but is not automatically cleared", () => {
  const claim = store.claim("task-stale");
  assert.equal(claim.success, true);
  const file = path.join(directory, "task-stale.json");
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  saved.expiresAt = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(file, JSON.stringify(saved), "utf8");

  const result = recovery.inspectRecoveryLease("task-stale");
  assert.equal(result.success, true);
  assert.equal(result.locked, true);
  assert.equal(result.expired, true);
  assert.equal(result.staleLease, true);
  assert.equal(fs.existsSync(file), true);
  assert.equal(store.release("task-stale", claim.token).released, true);
});

test("invalid task IDs fail closed during lease inspection", () => {
  const result = recovery.inspectRecoveryLease("../outside");
  assert.equal(result.success, false);
  assert.equal(result.locked, true);
  assert.match(result.error, /rejected/i);
});
