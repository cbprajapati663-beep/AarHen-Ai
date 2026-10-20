"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function validateId(value) {
  if (typeof value !== "string" || !SAFE_ID.test(value) || value === "." || value === "..") {
    throw new TypeError("A valid checkpoint ID is required.");
  }
  return value;
}

function createCheckpointStore(options = {}) {
  const directory = path.resolve(options.directory || path.join(process.cwd(), "data", "checkpoints"));

  function filePath(id) {
    return path.join(directory, validateId(id) + ".json");
  }

  function assertDirectorySecure(allowMissing = false) {
    let stat;
    try {
      stat = fs.lstatSync(directory);
    } catch (error) {
      if (allowMissing && error && error.code === "ENOENT") return false;
      throw error;
    }

    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error("Checkpoint storage path must be a real directory, not a symbolic link.");
    }
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
      throw new Error("Checkpoint storage directory permissions must be private (0700).");
    }
    return true;
  }

  function ensureDirectory() {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    assertDirectorySecure();
  }

  function save(checkpoint) {
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
      throw new TypeError("A checkpoint object is required.");
    }
    const id = validateId(checkpoint.id);
    const target = filePath(id);
    ensureDirectory();
    const temp = target + "." + process.pid + "." + Date.now() + ".tmp";
    try {
      fs.writeFileSync(temp, JSON.stringify(checkpoint, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
      fs.renameSync(temp, target);
    } catch (error) {
      try { fs.rmSync(temp, { force: true }); } catch {}
      throw error;
    }
    return { success: true, id };
  }

  function get(id) {
    const target = filePath(id);
    if (!assertDirectorySecure(true)) return null;

    // Check before opening for platforms without O_NOFOLLOW. On POSIX, O_NOFOLLOW
    // also closes the symlink-swap race between this check and open().
    try {
      const linkStat = fs.lstatSync(target);
      if (linkStat.isSymbolicLink()) {
        throw new Error("Checkpoint file must not be a symbolic link.");
      }
      if (!linkStat.isFile()) {
        throw new Error("Checkpoint path must refer to a regular file.");
      }
    } catch (error) {
      if (error && error.code === "ENOENT") return null;
      throw error;
    }

    let fd;
    try {
      const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
      fd = fs.openSync(target, flags);
      const stat = fs.fstatSync(fd);
      if (!stat.isFile()) {
        throw new Error("Checkpoint path must refer to a regular file.");
      }
      // Tighten legacy checkpoint files created before private file modes were
      // enforced. fchmod operates on the opened file descriptor, not a new path.
      if (process.platform !== "win32") fs.fchmodSync(fd, 0o600);
      const parsed = JSON.parse(fs.readFileSync(fd, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.id !== id) {
        throw new Error("Checkpoint file failed integrity validation.");
      }
      return parsed;
    } catch (error) {
      if (error && error.code === "ELOOP") {
        throw new Error("Checkpoint file must not be a symbolic link.");
      }
      throw error;
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch {}
      }
    }
  }

  function list() {
    if (!assertDirectorySecure(true)) return [];
    return fs.readdirSync(directory)
      .filter(name => name.endsWith(".json"))
      .sort()
      .map(name => get(name.slice(0, -5)))
      .filter(Boolean);
  }

  function remove(id) {
    const target = filePath(id);
    if (!assertDirectorySecure(true)) return { success: true, deleted: false, id };
    // Refuse to operate on a symbolic link, even though unlink would remove the
    // link itself, so the store consistently treats unexpected links as unsafe.
    const stat = (() => {
      try { return fs.lstatSync(target); } catch (error) {
        if (error && error.code === "ENOENT") return null;
        throw error;
      }
    })();
    if (!stat) return { success: true, deleted: false, id };
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error("Checkpoint path must refer to a regular file, not a symbolic link.");
    }
    fs.unlinkSync(target);
    return { success: true, deleted: true, id };
  }

  return Object.freeze({ save, get, list, remove, directory });
}

module.exports = { createCheckpointStore, validateId };
