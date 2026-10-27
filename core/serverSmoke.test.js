const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");
const path = require("node:path");
const { createRecoveryLeaseStore } = require("./recoveryLeaseStore");

const API_KEY = "aarhen-test-key-for-http-smoke";
const OWNER_API_KEY = "aarhen-owner-test-key-for-http-smoke";

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
    const leaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aarhen-server-lease-api-"));
    const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
        cwd: path.join(__dirname, ".."),
        env: {
            ...process.env,
            PORT: String(port),
            AARHEN_API_KEY: API_KEY,
            AARHEN_OWNER_API_KEY: OWNER_API_KEY,
            AARHEN_RECOVERY_LEASE_DIR: leaseDirectory
        },
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
        fs.rmSync(leaseDirectory, { recursive: true, force: true });
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

    await t.test("oversized JSON request is rejected with 413 without parsing the body", async () => {
        const oversized = "x".repeat(20 * 1024 * 1024 + 1);
        const response = await fetch(baseUrl + "/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Aarhen-API-Key": API_KEY },
            body: oversized
        });
        const body = await response.json();
        assert.equal(response.status, 413);
        assert.match(body.error, /20 MiB limit/i);
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

    await t.test("provider recovery endpoint requires the configured owner API key", async () => {
        const response = await fetch(baseUrl + "/checkpoint/provider-failure/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taskId: "unknown-task",
                decision: "abort",
                ownerAuthorized: true
            })
        });
        const body = await response.json();
        assert.equal(response.status, 401);
        assert.equal(body.authenticated, false);
    });

    await t.test("general API key cannot authorize owner recovery even when body claims ownerAuthorized", async () => {
        const response = await fetch(baseUrl + "/checkpoint/provider-failure/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
            body: JSON.stringify({
                taskId: "unknown-task",
                decision: "abort",
                ownerAuthorized: true
            })
        });
        const body = await response.json();
        assert.equal(response.status, 401);
        assert.equal(body.authenticated, false);
    });

    await t.test("provider recovery endpoint validates owner decision input", async () => {
        const response = await fetch(baseUrl + "/checkpoint/provider-failure/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY },
            body: JSON.stringify({
                taskId: "unknown-task",
                decision: "unknown",
                ownerAuthorized: false
            })
        });
        const body = await response.json();
        assert.equal(response.status, 400);
        assert.match(body.error, /decision must be/i);
    });

    await t.test("provider recovery endpoint returns conflict for unresolved task lookup", async () => {
        const response = await fetch(baseUrl + "/checkpoint/provider-failure/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY },
            body: JSON.stringify({
                taskId: "unknown-task",
                decision: "abort",
                ownerAuthorized: false
            })
        });
        const body = await response.json();
        assert.equal(response.status, 409);
        assert.equal(body.success, false);
        assert.equal(body.executionStarted, false);
    });

    await t.test("provider recovery resume requires explicit execution confirmation", async () => {
        const response = await fetch(baseUrl + "/checkpoint/provider-failure/resume", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY },
            body: JSON.stringify({ taskId: "unknown-task", confirmExecution: false })
        });
        const body = await response.json();
        assert.equal(response.status, 400);
        assert.equal(body.requiresConfirmation, true);
        assert.equal(body.executionStarted, undefined);
    });

    await t.test("stale recovery lease cleanup requires the configured owner key", async () => {
        const response = await fetch(baseUrl + "/checkpoint/recovery-lease/clear-stale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taskId: "task-stale",
                confirmNoActiveExecutor: true,
                leaseFingerprint: "0".repeat(64)
            })
        });
        const body = await response.json();
        assert.equal(response.status, 401);
        assert.equal(body.authenticated, false);
    });

    await t.test("stale recovery lease cleanup requires explicit no-executor confirmation", async () => {
        const response = await fetch(baseUrl + "/checkpoint/recovery-lease/clear-stale", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY },
            body: JSON.stringify({
                taskId: "task-stale",
                leaseFingerprint: "0".repeat(64)
            })
        });
        const body = await response.json();
        assert.equal(response.status, 400);
        assert.equal(body.requiresConfirmation, true);
    });

    await t.test("stale recovery lease cleanup requires a fresh inspected fingerprint", async () => {
        const response = await fetch(baseUrl + "/checkpoint/recovery-lease/clear-stale", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY },
            body: JSON.stringify({
                taskId: "task-stale",
                confirmNoActiveExecutor: true
            })
        });
        const body = await response.json();
        assert.equal(response.status, 400);
        assert.match(body.error, /fingerprint/i);
    });

    await t.test("recovery lease inspection endpoint requires the configured owner key", async () => {
        const response = await fetch(baseUrl + "/checkpoint/recovery-lease/inspect?taskId=task-private");
        const body = await response.json();
        assert.equal(response.status, 401);
        assert.equal(body.authenticated, false);
    });

    await t.test("owner can inspect and clear the exact expired lease snapshot", async () => {
        const store = createRecoveryLeaseStore({ directory: leaseDirectory });
        const claim = store.claim("task-api-stale");
        assert.equal(claim.success, true);

        const leaseFile = path.join(leaseDirectory, "task-api-stale.json");
        const lease = JSON.parse(fs.readFileSync(leaseFile, "utf8"));
        lease.expiresAt = new Date(Date.now() - 1000).toISOString();
        fs.writeFileSync(leaseFile, JSON.stringify(lease, null, 2), "utf8");

        const inspectResponse = await fetch(
            baseUrl + "/checkpoint/recovery-lease/inspect?taskId=task-api-stale",
            { headers: { Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY } }
        );
        const inspected = await inspectResponse.json();
        assert.equal(inspectResponse.status, 200);
        assert.equal(inspected.success, true);
        assert.equal(inspected.locked, true);
        assert.equal(inspected.staleLease, true);
        assert.equal(inspected.executionBlocked, true);
        assert.match(inspected.leaseFingerprint, /^[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(inspected).includes(claim.token), false);

        const clearResponse = await fetch(baseUrl + "/checkpoint/recovery-lease/clear-stale", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY },
            body: JSON.stringify({
                taskId: "task-api-stale",
                confirmNoActiveExecutor: true,
                leaseFingerprint: inspected.leaseFingerprint
            })
        });
        const cleared = await clearResponse.json();
        assert.equal(clearResponse.status, 200);
        assert.equal(cleared.success, true);
        assert.equal(cleared.cleared, true);
        assert.equal(cleared.executionStarted, false);
        assert.equal(store.inspect("task-api-stale").locked, false);
    });

    await t.test("owner inspection surfaces a stuck mutation guard and keeps execution blocked", async () => {
        const guardPath = path.join(leaseDirectory, "task-guard-inspect.json.mutation");
        fs.writeFileSync(guardPath, "do-not-expose-this-content", { flag: "wx" });
        try {
            const response = await fetch(
                baseUrl + "/checkpoint/recovery-lease/inspect?taskId=task-guard-inspect",
                { headers: { Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY } }
            );
            const body = await response.json();
            assert.equal(response.status, 200);
            assert.equal(body.success, true);
            assert.equal(body.locked, false);
            assert.equal(body.executionBlocked, true);
            assert.equal(body.mutationGuard.present, true);
            assert.equal(body.mutationGuard.requiresOperatorReview, true);
            assert.equal(JSON.stringify(body).includes("do-not-expose-this-content"), false);
        } finally {
            fs.rmSync(guardPath, { force: true });
        }
    });

    await t.test("corrupt lease inspection still surfaces a mutation guard and fails closed", async () => {
        const leasePath = path.join(leaseDirectory, "task-corrupt-inspect.json");
        const guardPath = leasePath + ".mutation";
        fs.writeFileSync(leasePath, "{ malformed lease", "utf8");
        fs.writeFileSync(guardPath, "private guard payload", { flag: "wx" });
        try {
            const response = await fetch(
                baseUrl + "/checkpoint/recovery-lease/inspect?taskId=task-corrupt-inspect",
                { headers: { Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY } }
            );
            const body = await response.json();
            assert.equal(response.status, 409);
            assert.equal(body.success, false);
            assert.equal(body.executionBlocked, true);
            assert.equal(body.mutationGuard.present, true);
            assert.equal(body.mutationGuard.requiresOperatorReview, true);
            assert.equal(JSON.stringify(body).includes("private guard payload"), false);
        } finally {
            fs.rmSync(leasePath, { force: true });
            fs.rmSync(guardPath, { force: true });
        }
    });

    await t.test("owner can clear only a fingerprint-matched mutation guard whose local PID is gone", async () => {
        const guardPath = path.join(leaseDirectory, "task-api-stale-mutation.json.mutation");
        const exited = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
        assert.equal(exited.error, undefined);
        assert.ok(Number.isSafeInteger(exited.pid));
        fs.writeFileSync(guardPath, JSON.stringify({
            pid: exited.pid,
            hostname: os.hostname(),
            startedAt: new Date(Date.now() - 5000).toISOString(),
            token: "never-return-this-token"
        }), { flag: "wx" });

        const inspectResponse = await fetch(
            baseUrl + "/checkpoint/recovery-lease/inspect?taskId=task-api-stale-mutation",
            { headers: { Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY } }
        );
        const inspected = await inspectResponse.json();
        assert.equal(inspectResponse.status, 200);
        assert.equal(inspected.mutationGuard.present, true);
        assert.equal(inspected.mutationGuard.ownerStatus, "not-running");
        assert.equal(inspected.mutationGuard.safeToClear, true);
        assert.match(inspected.mutationGuard.fingerprint, /^[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(inspected).includes("never-return-this-token"), false);

        const unauthenticated = await fetch(baseUrl + "/checkpoint/recovery-lease/clear-stale-mutation-guard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taskId: "task-api-stale-mutation",
                confirmNoActiveMutation: true,
                mutationGuardFingerprint: inspected.mutationGuard.fingerprint
            })
        });
        assert.equal(unauthenticated.status, 401);
        assert.equal(fs.existsSync(guardPath), true);

        const cleanupResponse = await fetch(baseUrl + "/checkpoint/recovery-lease/clear-stale-mutation-guard", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, "X-Aarhen-Owner-Key": OWNER_API_KEY },
            body: JSON.stringify({
                taskId: "task-api-stale-mutation",
                confirmNoActiveMutation: true,
                mutationGuardFingerprint: inspected.mutationGuard.fingerprint
            })
        });
        const cleaned = await cleanupResponse.json();
        assert.equal(cleanupResponse.status, 200);
        assert.equal(cleaned.success, true);
        assert.equal(cleaned.cleared, true);
        assert.equal(cleaned.executionStarted, false);
        assert.equal(fs.existsSync(guardPath), false);
    });

    await t.test("all owner-only recovery routes reject an invalid owner key even with a valid general API key", async () => {
        const invalidOwnerKey = "not-the-configured-owner-key";
        const ownerRoutes = [
            {
                path: "/checkpoint/provider-failure/resolve",
                method: "POST",
                body: { taskId: "unknown-task", decision: "abort", ownerAuthorized: true }
            },
            {
                path: "/checkpoint/provider-failure/resume",
                method: "POST",
                body: { taskId: "unknown-task", confirmExecution: true, ownerAuthorized: true }
            },
            {
                path: "/checkpoint/recovery-lease/inspect?taskId=task-private",
                method: "GET"
            },
            {
                path: "/checkpoint/recovery-lease/clear-stale",
                method: "POST",
                body: { taskId: "task-private", confirmNoActiveExecutor: true, leaseFingerprint: "0".repeat(64), ownerAuthorized: true }
            },
            {
                path: "/checkpoint/recovery-lease/clear-stale-mutation-guard",
                method: "POST",
                body: { taskId: "task-private", confirmNoActiveMutation: true, mutationGuardFingerprint: "0".repeat(64), ownerAuthorized: true }
            }
        ];

        for (const route of ownerRoutes) {
            const headers = {
                Authorization: `Bearer ${API_KEY}`,
                "X-Aarhen-Owner-Key": invalidOwnerKey
            };
            if (route.body) headers["Content-Type"] = "application/json";
            const response = await fetch(baseUrl + route.path, {
                method: route.method,
                headers,
                ...(route.body ? { body: JSON.stringify(route.body) } : {})
            });
            const body = await response.json();
            assert.equal(response.status, 401, `${route.method} ${route.path} must reject an invalid owner key`);
            assert.equal(body.authenticated, false, `${route.method} ${route.path} must not authenticate the caller`);
        }
    });

    await t.test("unknown protected route cannot bypass authentication", async () => {
        const response = await fetch(baseUrl + "/does-not-exist");
        assert.equal(response.status, 401);
    });
});


test("production server fails closed when the general API key is missing", async t => {
    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
        cwd: path.join(__dirname, ".."),
        env: {
            ...process.env,
            NODE_ENV: "production",
            PORT: String(port),
            AARHEN_API_KEY: "",
            AARHEN_OWNER_API_KEY: ""
        },
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

    await t.test("health remains available for deployment monitoring", async () => {
        const response = await fetch(baseUrl + "/health");
        assert.equal(response.status, 200);
    });

    await t.test("API endpoints return 503 rather than running unauthenticated", async () => {
        const response = await fetch(baseUrl + "/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: "must not execute" })
        });
        const body = await response.json();
        assert.equal(response.status, 503);
        assert.equal(body.authenticated, false);
        assert.match(body.error, /not configured for production/i);
    });
});
