"use strict";

// File-backed recovery claims. Exclusive file creation is atomic on a single
// local/shared filesystem. This is not a distributed lock for hosts that do
// not share the same filesystem. Stale claims fail closed and require operator
// cleanup after confirming that no executor is still running.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function validateTaskId(value) {
  if (typeof value !== "string" || !SAFE_ID.test(value) || value === "." || value === "..") {
    throw new TypeError("A valid task ID is required.");
  }
  return value;
}

function createRecoveryLeaseStore(options = {}) {
  const directory = path.resolve(
    options.directory ||
    process.env.AARHEN_RECOVERY_LEASE_DIR ||
    path.join(process.cwd(), "data", "recovery-leases")
  );
  const leaseDurationMs = Number.isFinite(Number(options.leaseDurationMs))
    ? Math.max(1000, Number(options.leaseDurationMs))
    : 24 * 60 * 60 * 1000;

  function leasePath(taskId) {
    return path.join(directory, validateTaskId(taskId) + ".json");
  }

  function inspect(taskId) {
    const id = validateTaskId(taskId);
    const file = leasePath(id);
    if (!fs.existsSync(file)) return { success: true, locked: false, taskId: id };
    try {
      const lease = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!lease || lease.taskId !== id || typeof lease.token !== "string") {
        return { success: false, locked: true, corrupt: true, taskId: id, error: "Recovery lease is corrupt; execution remains blocked." };
      }
      return {
        success: true,
        locked: true,
        taskId: id,
        lease: {
          token: lease.token,
          pid: lease.pid,
          createdAt: lease.createdAt,
          expiresAt: lease.expiresAt
        },
        expired: Number.isFinite(Date.parse(lease.expiresAt)) && Date.parse(lease.expiresAt) <= Date.now()
      };
    } catch {
      return { success: false, locked: true, corrupt: true, taskId: id, error: "Recovery lease cannot be read; execution remains blocked." };
    }
  }

  function claim(taskId, metadata = {}) {
    const id = validateTaskId(taskId);
    fs.mkdirSync(directory, { recursive: true });
    const file = leasePath(id);
    const now = Date.now();
    const lease = {
      taskId: id,
      token: crypto.randomUUID(),
      pid: process.pid,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + leaseDurationMs).toISOString(),
      metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}
    };
    let fd;
    try {
      fd = fs.openSync(file, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(lease, null, 2), "utf8");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      return { success: true, acquired: true, taskId: id, token: lease.token, expiresAt: lease.expiresAt };
    } catch (error) {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch {}
        try { fs.unlinkSync(file); } catch {}
      }
      if (error && error.code === "EEXIST") {
        const existing = inspect(id);
        return {
          success: false,
          acquired: false,
          recoveryAlreadyInProgress: true,
          staleLease: existing.expired === true,
          taskId: id,
          error: existing.expired
            ? "An expired recovery lease remains; execution is blocked until an operator verifies no executor is active and clears the stale lease."
            : "Recovery execution is already claimed for this task."
        };
      }
      throw error;
    }
  }

  function release(taskId, token) {
    const id = validateTaskId(taskId);
    if (typeof token !== "string" || !token) {
      return { success: false, released: false, error: "The recovery lease token is required." };
    }
    const file = leasePath(id);
    let current;
    try {
      current = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return { success: false, released: false, error: "Recovery lease is missing or unreadable." };
    }
    if (current.taskId !== id || current.token !== token) {
      return { success: false, released: false, error: "Recovery lease token does not match." };
    }
    try {
      fs.unlinkSync(file);
      return { success: true, released: true, taskId: id };
    } catch (error) {
      return { success: false, released: false, error: error.message };
    }
  }

  return Object.freeze({ claim, inspect, release, directory });
}

module.exports = { createRecoveryLeaseStore, validateTaskId };
