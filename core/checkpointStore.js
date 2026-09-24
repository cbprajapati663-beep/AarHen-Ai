// AarHen checkpoint persistence adapter (JSON file store).
// This adapter is intentionally standalone; checkpointEngine remains in-memory
// until a coordinator explicitly integrates this storage contract.
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

  function ensureDirectory() {
    fs.mkdirSync(directory, { recursive: true });
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
      fs.writeFileSync(temp, JSON.stringify(checkpoint, null, 2), { encoding: "utf8", flag: "wx" });
      fs.renameSync(temp, target);
    } catch (error) {
      try { fs.rmSync(temp, { force: true }); } catch {}
      throw error;
    }
    return { success: true, id };
  }

  function get(id) {
    const target = filePath(id);
    if (!fs.existsSync(target)) return null;
    const parsed = JSON.parse(fs.readFileSync(target, "utf8"));
    if (!parsed || parsed.id !== id || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Checkpoint file failed integrity validation.");
    }
    return parsed;
  }

  function list() {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory)
      .filter(name => name.endsWith(".json"))
      .sort()
      .map(name => get(name.slice(0, -5)))
      .filter(Boolean);
  }

  function remove(id) {
    const target = filePath(id);
    if (!fs.existsSync(target)) return { success: true, deleted: false, id };
    fs.unlinkSync(target);
    return { success: true, deleted: true, id };
  }

  return Object.freeze({ save, get, list, remove, directory });
}

module.exports = { createCheckpointStore, validateId };
