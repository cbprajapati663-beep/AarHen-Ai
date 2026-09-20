// ============================================================
// AARHEN CORE V5
// Advanced Long-Term Memory Engine
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

// Create data folder/file automatically if needed
function ensureMemoryFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(MEMORY_FILE)) {
        fs.writeFileSync(MEMORY_FILE, "[]", "utf8");
    }
}

function readMemory() {
    ensureMemoryFile();

    try {
        const data = fs.readFileSync(MEMORY_FILE, "utf8");
        return JSON.parse(data || "[]");
    } catch (error) {
        return [];
    }
}

function writeMemory(memory) {
    ensureMemoryFile();

    fs.writeFileSync(
        MEMORY_FILE,
        JSON.stringify(memory, null, 2),
        "utf8"
    );
}

// Save a new memory
function remember(data) {
    const memories = readMemory();

    const memory = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
    };

    memories.push(memory);
    writeMemory(memories);

    return memory;
}

// Get all memories
function getAll() {
    return readMemory();
}

// Search memories
function search(query) {
    const memories = readMemory();

    const words = String(query)
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    return memories
        .map(memory => {
            const text = JSON.stringify(memory).toLowerCase();

            let score = 0;

            for (const word of words) {
                if (text.includes(word)) {
                    score++;
                }
            }

            return {
                memory,
                score
            };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.memory);
}

// Delete memory
function forget(id) {
    const memories = readMemory();

    const filtered = memories.filter(memory => memory.id !== id);

    writeMemory(filtered);

    return {
        deleted: memories.length !== filtered.length,
        remaining: filtered.length
    };
}

// Update existing memory
function update(id, changes) {
    const memories = readMemory();

    const index = memories.findIndex(memory => memory.id === id);

    if (index === -1) {
        return null;
    }

    memories[index] = {
        ...memories[index],
        ...changes,
        updatedAt: new Date().toISOString()
    };

    writeMemory(memories);

    return memories[index];
}

module.exports = {
    remember,
    getAll,
    search,
    forget,
    update
};
