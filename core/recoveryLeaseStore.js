"use strict";

// File-backed recovery claims. Exclusive file creation is atomic on a single
// local/shared filesystem. This is not a distributed lock for hosts that do
// not share the same filesystem. Stale claims fail closed and require explicit
// operator confirmation after verifying no executor remains active.

const fs = require("node:fs");
const os = require("node:os");
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

  function mutationRecoveryPath(taskId) {
    return mutationPath(taskId) + ".recovery";
  }

  function fingerprint(raw) {
    return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  }

  // Serialize claim/release/operator-clear operations across processes that
  // share this filesystem. Recovery inspection/cleanup uses a separate marker
  // so a live mutation cannot be mistaken for an orphaned guard.
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
      const metadata = {
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: new Date().toISOString(),
        token: crypto.randomUUID()
      };
      fs.writeFileSync(guardFd, JSON.stringify(metadata), "utf8");
      fs.fsyncSync(guardFd);

      // If operator recovery is inspecting/clearing a guard, back out before
      // mutating lease state. The finally block removes only this call's guard.
      if (recoveryMarkerPresent(id)) {
        return {
          success: false,
          taskId: id,
          mutationInProgress: true,
          error: "Recovery-guard inspection or cleanup is in progress; retry after it finishes."
        };
      }
      return operation(id, leasePath(id));
    } finally {
      try { fs.closeSync(guardFd); } catch {}
      try { fs.unlinkSync(mutationPath(id)); } catch {}
    }
  }

  function recoveryMarkerPresent(taskId) {
    try {
      fs.statSync(mutationRecoveryPath(taskId));
      return true;
    } catch (error) {
      if (error && error.code === "ENOENT") return false;
      throw error;
    }
  }

  // Treat permission errors and uncertain process state as alive. A PID from
  // another host cannot be safely verified from this process.
  function isProcessAlive(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return null;
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if (error && error.code === "ESRCH") return false;
      return true;
    }
  }

  // Report safe metadata only; never return the guard's private token/content.
  // Legacy/unknown guards remain blocked and cannot be cleared automatically.
  function inspectMutationGuard(taskId) {
    const id = validateTaskId(taskId);
    const file = mutationPath(id);
    try {
      const raw = fs.readFileSync(file, "utf8");
      const stat = fs.statSync(file);
      let metadata = null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Number.isSafeInteger(parsed.pid) && typeof parsed.hostname === "string" &&
            typeof parsed.startedAt === "string" && typeof parsed.token === "string") {
          metadata = parsed;
        }
      } catch {}

      const sameHost = Boolean(metadata && metadata.hostname === os.hostname());
      const processAlive = sameHost ? isProcessAlive(metadata.pid) : null;
      const ownerStatus = !metadata ? "unknown" :
        !sameHost ? "different-host" :
        processAlive === false ? "not-running" :
        processAlive === true ? "active-or-pid-reused" : "unknown";

      return {
        success: true,
        taskId: id,
        present: true,
        requiresOperatorReview: true,
        createdAt: stat.mtime.toISOString(),
        fingerprint: fingerprint(raw),
        owner: metadata ? {
          pid: metadata.pid,
          hostname: metadata.hostname,
          startedAt: metadata.startedAt
        } : null,
        ownerStatus,
        safeToClear: ownerStatus === "not-running",
        error: "Mutation guard exists; it may be active or left by a crashed mutation. Clear it only after verifying the recorded local process is no longer active."
      };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { success: true, taskId: id, present: false, requiresOperatorReview: false, safeToClear: false };
      }
      return {
        success: false,
        taskId: id,
        present: true,
        requiresOperatorReview: true,
        safeToClear: false,
        error: "Mutation guard cannot be inspected; recovery remains blocked."
      };
    }
  }

  // Clear only a guard whose exact inspected fingerprint still matches and
  // whose recorded process is verifiably gone on this same host. The explicit
  // operator confirmation is necessary but never overrides a live/unknown PID.
  function clearStaleMutationGuard(taskId, options = {}) {
    const id = validateTaskId(taskId);
    const config = options && typeof options === "object" ? options : {};
    if (config.confirmNoActiveMutation !== true) {
      return { success: false, cleared: false, taskId: id, error: "Explicit confirmation that no mutation is active is required." };
    }
    if (typeof config.expectedFingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(config.expectedFingerprint)) {
      return { success: false, cleared: false, taskId: id, error: "The inspected mutation-guard fingerprint is required." };
    }

    fs.mkdirSync(directory, { recursive: true });
    let recoveryFd;
    const recoveryFile = mutationRecoveryPath(id);
    try {
      recoveryFd = fs.openSync(recoveryFile, "wx", 0o600);
    } catch (error) {
      if (error && error.code === "EEXIST") {
        return { success: false, cleared: false, taskId: id, mutationInProgress: true, error: "Another mutation-guard recovery is in progress." };
      }
      return { success: false, cleared: false, taskId: id, error: "Could not acquire the mutation-guard recovery marker; guard remains blocked." };
    }

    try {
      let raw;
      try {
        raw = fs.readFileSync(mutationPath(id), "utf8");
      } catch {
        return { success: false, cleared: false, taskId: id, error: "Mutation guard is missing or unreadable." };
      }
      const actualFingerprint = fingerprint(raw);
      if (actualFingerprint !== config.expectedFingerprint) {
        return { success: false, cleared: false, taskId: id, error: "Mutation guard changed since inspection; inspect it again before cleanup." };
      }

      let metadata;
      try { metadata = JSON.parse(raw); } catch {}
      if (!metadata || !Number.isSafeInteger(metadata.pid) || typeof metadata.hostname !== "string" ||
          typeof metadata.startedAt !== "string" || typeof metadata.token !== "string") {
        return { success: false, cleared: false, taskId: id, error: "Mutation guard owner metadata is unknown; it remains blocked for manual investigation." };
      }
      if (metadata.hostname !== os.hostname()) {
        return { success: false, cleared: false, taskId: id, error: "Mutation guard belongs to another host; local cleanup is unsafe." };
      }
      if (isProcessAlive(metadata.pid) !== false) {
        return { success: false, cleared: false, taskId: id, error: "Recorded mutation process is active or cannot be verified; guard remains blocked." };
      }

      // Re-read immediately before unlinking to avoid deleting a changed guard.
      let latestRaw;
      try { latestRaw = fs.readFileSync(mutationPath(id), "utf8"); } catch {
        return { success: false, cleared: false, taskId: id, error: "Mutation guard changed during cleanup; inspect again." };
      }
      if (fingerprint(latestRaw) !== actualFingerprint) {
        return { success: false, cleared: false, taskId: id, error: "Mutation guard changed during cleanup; inspect again." };
      }

      fs.unlinkSync(mutationPath(id));
      return {
        success: true,
        cleared: true,
        taskId: id,
        clearedGuardFingerprint: actualFingerprint,
        requiresNewOwnerDecision: true,
        executionStarted: false
      };
    } catch {
      return { success: false, cleared: false, taskId: id, error: "Mutation-guard cleanup failed safely; execution remains blocked." };
    } finally {
      try { fs.closeSync(recoveryFd); } catch {}
      try { fs.unlinkSync(recoveryFile); } catch {}
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

  return Object.freeze({ claim, inspect, inspectMutationGuard, clearStaleMutationGuard, release, clearStale, directory });
}

module.exports = { createRecoveryLeaseStore, validateTaskId };
