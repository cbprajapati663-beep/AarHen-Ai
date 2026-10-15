"use strict";

// File-backed recovery claims. Exclusive file creation is atomic on a single
// local/shared filesystem. This is not a distributed lock for hosts that do
// not share the same filesystem. Stale claims fail closed and require explicit
// operator confirmation after verifying no executor remains active.

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

  function mutationPath(taskId) {
    return leasePath(taskId) + ".mutation";
  }

  function fingerprint(raw) {
    return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  }

  // Serialize claim/release/operator-clear operations across processes that
  // share this filesystem. A crashed mutation leaves a guard behind; that
  // intentionally fails closed and requires separate operator investigation.
  function withMutationGuard(taskId, operation) {
    const id = validateTaskId(taskId);
    fs.mkdirSync(directory, { recursive: true });
    let guardFd;
    try {
      guardFd = fs.openSync(mutationPath(id), "wx", 0o600);
    } catch (error) {
      if (error && error.code === "EEXIST") {
        return {
          success: false,
          taskId: id,
          mutationInProgress: true,
          error: "Recovery lease mutation is already in progress or its guard requires operator investigation."
        };
      }
      throw error;
    }

    try {
      return operation(id, leasePath(id));
    } finally {
      try { fs.closeSync(guardFd); } catch {}
      try { fs.unlinkSync(mutationPath(id)); } catch {}
    }
  }

  // Report a mutation guard without exposing file contents. A present guard
  // may be active or orphaned after a crash; inspection cannot distinguish
  // those cases, so callers must treat it as blocked and require operator review.
  function inspectMutationGuard(taskId) {
    const id = validateTaskId(taskId);
    const file = mutationPath(id);
    try {
      const stat = fs.statSync(file);
      return {
        success: true,
        taskId: id,
        present: true,
        requiresOperatorReview: true,
        createdAt: stat.mtime.toISOString(),
        error: "Mutation guard exists; it may be active or left by a crashed mutation. Do not remove it until the executor state is verified."
      };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { success: true, taskId: id, present: false, requiresOperatorReview: false };
      }
      return {
        success: false,
        taskId: id,
        present: true,
        requiresOperatorReview: true,
        error: "Mutation guard cannot be inspected; recovery remains blocked."
      };
    }
  }

  function inspect(taskId) {
    const id = validateTaskId(taskId);
    const file = leasePath(id);
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") return { success: true, locked: false, taskId: id };
      return { success: false, locked: true, taskId: id, error: "Recovery lease cannot be read; execution remains blocked." };
    }

    try {
      const lease = JSON.parse(raw);
      if (!lease || lease.taskId !== id || typeof lease.token !== "string") {
        return { success: false, locked: true, corrupt: true, taskId: id, error: "Recovery lease is corrupt; execution remains blocked." };
      }
      const expired = Number.isFinite(Date.parse(lease.expiresAt)) && Date.parse(lease.expiresAt) <= Date.now();
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
        expired,
        // This digest identifies the exact observed lease snapshot. It is not
        // an authorization credential and does not reveal the ownership token.
        leaseFingerprint: fingerprint(raw)
      };
    } catch {
      return { success: false, locked: true, corrupt: true, taskId: id, error: "Recovery lease cannot be read; execution remains blocked." };
    }
  }

  function claim(taskId, metadata = {}) {
    const id = validateTaskId(taskId);
    return withMutationGuard(id, (cleanId, file) => {
      const now = Date.now();
      const lease = {
        taskId: cleanId,
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
        fd = undefined;
        return { success: true, acquired: true, taskId: cleanId, token: lease.token, expiresAt: lease.expiresAt };
      } catch (error) {
        if (fd !== undefined) {
          try { fs.closeSync(fd); } catch {}
          // Only remove a partial file created by this call while holding the
          // mutation guard. Never unlink a pre-existing lease.
          try { fs.unlinkSync(file); } catch {}
        }
        if (error && error.code === "EEXIST") {
          const existing = inspect(cleanId);
          return {
            success: false,
            acquired: false,
            recoveryAlreadyInProgress: true,
            staleLease: existing.expired === true,
            taskId: cleanId,
            error: existing.expired
              ? "An expired recovery lease remains; execution is blocked until an operator verifies no executor is active and clears the stale lease."
              : "Recovery execution is already claimed for this task."
          };
        }
        throw error;
      }
    });
  }

  function release(taskId, token) {
    const id = validateTaskId(taskId);
    if (typeof token !== "string" || !token) {
      return { success: false, released: false, error: "The recovery lease token is required." };
    }
    return withMutationGuard(id, (cleanId, file) => {
      let current;
      try {
        current = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        return { success: false, released: false, error: "Recovery lease is missing or unreadable." };
      }
      if (current.taskId !== cleanId || current.token !== token) {
        return { success: false, released: false, error: "Recovery lease token does not match." };
      }
      try {
        fs.unlinkSync(file);
        return { success: true, released: true, taskId: cleanId };
      } catch (error) {
        return { success: false, released: false, error: error.message };
      }
    });
  }

  function clearStale(taskId, options = {}) {
    const id = validateTaskId(taskId);
    const config = options && typeof options === "object" ? options : {};
    if (config.confirmNoActiveExecutor !== true) {
      return { success: false, cleared: false, taskId: id, error: "Explicit confirmation that no executor is active is required." };
    }
    if (typeof config.expectedFingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(config.expectedFingerprint)) {
      return { success: false, cleared: false, taskId: id, error: "The inspected lease fingerprint is required." };
    }

    return withMutationGuard(id, (cleanId, file) => {
      let raw;
      let lease;
      try {
        raw = fs.readFileSync(file, "utf8");
        lease = JSON.parse(raw);
      } catch {
        return { success: false, cleared: false, taskId: cleanId, error: "Recovery lease is missing, unreadable, or corrupt; it remains blocked." };
      }

      if (!lease || lease.taskId !== cleanId || typeof lease.token !== "string") {
        return { success: false, cleared: false, taskId: cleanId, error: "Recovery lease is corrupt; it remains blocked." };
      }

      const actualFingerprint = fingerprint(raw);
      if (actualFingerprint !== config.expectedFingerprint) {
        return { success: false, cleared: false, taskId: cleanId, error: "Recovery lease changed since inspection; inspect it again before retrying cleanup." };
      }

      const expiresAt = Date.parse(lease.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) {
        return { success: false, cleared: false, taskId: cleanId, error: "Only an expired recovery lease can be cleared by this operation." };
      }

      try {
        fs.unlinkSync(file);
        return {
          success: true,
          cleared: true,
          taskId: cleanId,
          clearedLeaseFingerprint: actualFingerprint,
          requiresNewOwnerDecision: true,
          executionStarted: false
        };
      } catch (error) {
        return { success: false, cleared: false, taskId: cleanId, error: error.message };
      }
    });
  }

  return Object.freeze({ claim, inspect, inspectMutationGuard, release, clearStale, directory });
}

module.exports = { createRecoveryLeaseStore, validateTaskId };
