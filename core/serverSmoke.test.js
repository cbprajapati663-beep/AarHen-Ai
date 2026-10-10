const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const API_KEY = "aarhen-test-key-for-http-smoke";

async function getFreePort() {
    const socket = net.createServer();
    await new Promise((resolve, reject) => {
        socket.once("error", reject);
        socket.listen(0, "127.0.0.1", resolve);
    });
    const { port } = socket.address();
    await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
    return port;
}

async function waitForServer(baseUrl, child) {
    const deadline = Date.now() + 8000;
    let lastError;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Server exited before becoming ready (code ${child.exitCode})`);
        }
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.ok) return;
            lastError = new Error(`Health endpoint returned ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw lastError || new Error("Server did not become ready in time");
}

test("HTTP server smoke tests: health, validation, routing, and API-key protection", async t => {
    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, PORT: String(port), AARHEN_API_KEY: API_KEY },
        stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => { stderr += chunk; });
    t.after(async () => {
        if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
        await new Promise(resolve => {
            if (child.exitCode !== null) return resolve();
            const timer = setTimeout(resolve, 1500);
            child.once("exit", () => { clearTimeout(timer); resolve(); });
        });
    });

    await waitForServer(baseUrl, child);

    await t.test("GET / returns service identity", async () => {
        const response = await fetch(baseUrl + "/");
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.success, true);
        assert.equal(body.name, "AarHen AI");
    });

    await t.test("GET /health remains publicly available in protected mode", async () => {
        const response = await fetch(baseUrl + "/health");
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.status, "healthy");
    });

    await t.test("protected route rejects missing API key", async () => {
        const response = await fetch(baseUrl + "/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: "smoke test" })
        });
        const body = await response.json();
        assert.equal(response.status, 401);
        assert.equal(body.authenticated, false);
    });

    await t.test("protected route accepts the configured key and validates input", async () => {
        const response = await fetch(baseUrl + "/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
            body: JSON.stringify({})
        });
        const body = await response.json();
        assert.equal(response.status, 400);
        assert.match(body.error, /input is required/i);
    });

    await t.test("malformed JSON returns 400 instead of 500", async () => {
        const response = await fetch(baseUrl + "/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Aarhen-API-Key": API_KEY },
            body: "{ invalid json"
        });
        const body = await response.json();
        assert.equal(response.status, 400);
        assert.match(body.error, /invalid json/i);
    });

    await t.test("unknown protected route cannot bypass authentication", async () => {
        const response = await fetch(baseUrl + "/does-not-exist");
        assert.equal(response.status, 401);
    });
});
