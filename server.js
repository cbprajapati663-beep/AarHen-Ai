const http = require("http");

const { orchestrate } = require("./core/orchestrator");
const auth = require("./core/auth");
const learningApi = require("./core/learningApi");
const memory = require("./core/memory");
const memoryHistory = require("./core/memoryHistory");
const memoryApi = require("./core/memoryApi");
const voiceApi = require("./core/voiceApi");
const visionApi = require("./core/visionApi");
const documentLearningApi = require("./core/documentLearningApi");
const checkpointRecovery = require("./core/checkpointRecoveryController");

const PORT = process.env.PORT || 3000;


/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Aarhen-API-Key"
    });

    res.end(JSON.stringify(data, null, 2));
}


function sendText(res, statusCode, text) {
    res.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(text);
}


/* =========================================================
   BODY PARSER
   ========================================================= */

// Base64 media payloads need room for their JSON encoding. The hard cap
// prevents unbounded memory growth while retaining support for 10 MiB audio.
const MAX_REQUEST_BODY_BYTES = 20 * 1024 * 1024;

function readBody(req, maxBytes = MAX_REQUEST_BODY_BYTES) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let receivedBytes = 0;
        let settled = false;

        req.on("data", chunk => {
            if (settled) return;
            receivedBytes += chunk.length;
            if (receivedBytes > maxBytes) {
                settled = true;
                const limitError = new Error("Request body exceeds the 20 MiB limit");
                limitError.statusCode = 413;
                reject(limitError);
                // Drain the rest without buffering it so the socket can close
                // cleanly and no additional request data is retained in memory.
                req.resume();
                return;
            }
            chunks.push(chunk);
        });

        req.on("end", () => {
            if (settled) return;
            settled = true;
            const body = Buffer.concat(chunks).toString("utf8");
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                const parseError = new Error("Invalid JSON request body");
                parseError.statusCode = 400;
                reject(parseError);
            }
        });

        req.on("error", error => {
            if (settled) return;
            settled = true;
            reject(error);
        });
    });
}


/* =========================================================
   AUTH HELPER
   ========================================================= */

function getAuthToken(req) {
    const header = req.headers.authorization || "";

    if (header.startsWith("Bearer ")) {
        return header.substring(7);
    }

    return req.headers["x-aarhen-api-key"] || null;
}


/* =========================================================
   SERVER
   ========================================================= */

const server = http.createServer(
    async (req, res) => {

        try {

            /* -------------------------------------------------
               CORS PREFLIGHT
               ------------------------------------------------- */

            if (req.method === "OPTIONS") {
                res.writeHead(204, {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods":
                        "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers":
                        "Content-Type, Authorization, X-Aarhen-API-Key"
                });

                res.end();
                return;
            }


            const url = new URL(
                req.url,
                `http://${req.headers.host || "localhost"}`
            );

            const pathname = url.pathname;

            // In protected mode, every API route except the health/status
            // probes requires a verified API key. Keep development mode
            // backward-compatible when AARHEN_API_KEY is not configured.
            const publicPaths = new Set(["/", "/health", "/auth/status"]);
            if (auth.isConfigured() && !publicPaths.has(pathname)) {
                const authentication = auth.authenticate(req);
                if (!authentication.authenticated) {
                    return sendJson(res, 401, {
                        success: false,
                        authenticated: false,
                        error: "Valid API key required."
                    });
                }
            }


            /* =================================================
               ROOT
               ================================================= */

            if (
                pathname === "/" &&
                req.method === "GET"
            ) {

                return sendJson(res, 200, {
                    success: true,
                    name: "AarHen AI",
                    version: "5.0.0",
                    system: "AarHen Core v5",
                    status: "online",
                    message:
                        "AarHen AI Core is running.",
                    timestamp:
                        new Date().toISOString()
                });
            }


            /* =================================================
               HEALTH
               ================================================= */

            if (
                pathname === "/health" &&
                req.method === "GET"
            ) {

                return sendJson(res, 200, {
                    success: true,
                    status: "healthy",
                    timestamp:
                        new Date().toISOString()
                });
            }


            /* =================================================
               AUTH
               ================================================= */

            if (
                pathname === "/auth/status" &&
                req.method === "GET"
            ) {
                const token = getAuthToken(req);
                const authentication = auth.verifyApiKey(token);
                const statusCode =
                    auth.isConfigured() && !authentication.authenticated
                        ? 401
                        : 200;

                return sendJson(res, statusCode, {
                    ...authentication,
                    hasToken: !!token
                });
            }


            /* =================================================
               OWNER-APPROVED PROVIDER FAILURE RECOVERY
               ================================================= */

            if (
                pathname === "/checkpoint/provider-failure/resolve" &&
                req.method === "POST"
            ) {
                // Provider recovery decisions are owner-only. In development
                // mode there is no authenticated owner identity, so fail closed.
                if (!auth.isConfigured()) {
                    return sendJson(res, 503, {
                        success: false,
                        error: "Owner authentication must be configured before provider recovery can be resolved."
                    });
                }

                const authentication = auth.authenticate(req);
                if (!authentication.authenticated) {
                    return sendJson(res, 401, {
                        success: false,
                        authenticated: false,
                        error: "Valid owner API key required."
                    });
                }

                const body = await readBody(req);
                const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
                const decision = typeof body.decision === "string" ? body.decision.trim().toLowerCase() : "";

                if (!taskId) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "taskId is required"
                    });
                }

                if (!["retry", "abort"].includes(decision)) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "decision must be 'retry' or 'abort'"
                    });
                }

                const result = checkpointRecovery.resolveProviderFailure(
                    taskId,
                    decision,
                    {
                        // Never accept ownerAuthorized from request data.
                        // Only this server-side authentication check can set it.
                        ownerAuthorized: true,
                        confirmProviderRetry: body.confirmProviderRetry === true
                    }
                );

                return sendJson(res, result.success ? 200 : 409, result);
            }


            /* =================================================
               RESUME OWNER-APPROVED PROVIDER RECOVERY
               ================================================= */

            if (
                pathname === "/checkpoint/provider-failure/resume" &&
                req.method === "POST"
            ) {
                if (!auth.isConfigured()) {
                    return sendJson(res, 503, {
                        success: false,
                        error: "Owner authentication must be configured before provider recovery can execute."
                    });
                }

                const authentication = auth.authenticate(req);
                if (!authentication.authenticated) {
                    return sendJson(res, 401, {
                        success: false,
                        authenticated: false,
                        error: "Valid owner API key required."
                    });
                }

                const body = await readBody(req);
                const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
                if (!taskId) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "taskId is required"
                    });
                }
                if (body.confirmExecution !== true) {
                    return sendJson(res, 400, {
                        success: false,
                        requiresConfirmation: true,
                        error: "confirmExecution: true is required to start the recovered task."
                    });
                }

                const result = await checkpointRecovery.resumeResolvedProviderFailure(taskId, {
                    ownerAuthorized: true,
                    confirmExecution: true
                });
                return sendJson(res, result.success ? 200 : 409, result);
            }


            /* =================================================
               OWNER-ONLY RECOVERY LEASE INSPECTION
               ================================================= */

            if (
                pathname === "/checkpoint/recovery-lease/inspect" &&
                req.method === "GET"
            ) {
                if (!auth.isConfigured()) {
                    return sendJson(res, 503, {
                        success: false,
                        error: "Owner authentication must be configured before recovery lease inspection."
                    });
                }

                const authentication = auth.authenticate(req);
                if (!authentication.authenticated) {
                    return sendJson(res, 401, {
                        success: false,
                        authenticated: false,
                        error: "Valid owner API key required."
                    });
                }

                const taskId = url.searchParams.get("taskId");
                if (!taskId || !taskId.trim()) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "taskId query parameter is required."
                    });
                }

                const result = checkpointRecovery.inspectRecoveryLease(taskId.trim());
                return sendJson(res, result.success ? 200 : 409, result);
            }


            /* =================================================
               OWNER-CONFIRMED STALE RECOVERY LEASE CLEANUP
               ================================================= */

            if (
                pathname === "/checkpoint/recovery-lease/clear-stale" &&
                req.method === "POST"
            ) {
                if (!auth.isConfigured()) {
                    return sendJson(res, 503, {
                        success: false,
                        error: "Owner authentication must be configured before stale recovery leases can be cleared."
                    });
                }

                const authentication = auth.authenticate(req);
                if (!authentication.authenticated) {
                    return sendJson(res, 401, {
                        success: false,
                        authenticated: false,
                        error: "Valid owner API key required."
                    });
                }

                const body = await readBody(req);
                const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
                if (!taskId) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "taskId is required"
                    });
                }
                if (body.confirmNoActiveExecutor !== true) {
                    return sendJson(res, 400, {
                        success: false,
                        requiresConfirmation: true,
                        error: "confirmNoActiveExecutor: true is required after verifying no executor is active."
                    });
                }
                if (typeof body.leaseFingerprint !== "string") {
                    return sendJson(res, 400, {
                        success: false,
                        error: "leaseFingerprint from a fresh lease inspection is required."
                    });
                }

                const result = checkpointRecovery.clearStaleRecoveryLease(taskId, {
                    ownerAuthorized: true,
                    confirmNoActiveExecutor: true,
                    expectedFingerprint: body.leaseFingerprint
                });
                return sendJson(res, result.success ? 200 : 409, result);
            }


            /* =================================================
               OWNER-CONFIRMED STALE MUTATION-GUARD CLEANUP
               ================================================= */

            if (
                pathname === "/checkpoint/recovery-lease/clear-stale-mutation-guard" &&
                req.method === "POST"
            ) {
                if (!auth.isConfigured()) {
                    return sendJson(res, 503, {
                        success: false,
                        error: "Owner authentication must be configured before mutation guards can be cleared."
                    });
                }

                const authentication = auth.authenticate(req);
                if (!authentication.authenticated) {
                    return sendJson(res, 401, {
                        success: false,
                        authenticated: false,
                        error: "Valid owner API key required."
                    });
                }

                const body = await readBody(req);
                const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
                if (!taskId) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "taskId is required."
                    });
                }
                if (body.confirmNoActiveMutation !== true) {
                    return sendJson(res, 400, {
                        success: false,
                        requiresConfirmation: true,
                        error: "confirmNoActiveMutation: true is required after verifying the mutation is no longer active."
                    });
                }
                if (typeof body.mutationGuardFingerprint !== "string") {
                    return sendJson(res, 400, {
                        success: false,
                        error: "mutationGuardFingerprint from a fresh owner inspection is required."
                    });
                }

                const result = checkpointRecovery.clearStaleMutationGuard(taskId, {
                    ownerAuthorized: true,
                    confirmNoActiveMutation: true,
                    expectedFingerprint: body.mutationGuardFingerprint
                });
                return sendJson(res, result.success ? 200 : 409, result);
            }


            /* =================================================
               ASK
               ================================================= */

            if (
                pathname === "/ask" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                if (
                    !body.input ||
                    !String(body.input).trim()
                ) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "input is required"
                    });
                }

                const result =
                    await orchestrate(
                        String(body.input),
                        body.context || {}
                    );

                return sendJson(res, 200, {
                    success: true,
                    result
                });
            }


            /* =================================================
               VOICE ENGINE API
               ================================================= */

            if (
                pathname === "/voice/status" &&
                req.method === "GET"
            ) {
                return sendJson(res, 200, {
                    success: true,
                    ...voiceApi.getVoiceStatus()
                });
            }

            if (
                pathname === "/voice/transcribe" &&
                req.method === "POST"
            ) {
                const body = await readBody(req);
                const raw = body.base64 || body.data;

                if (typeof raw !== "string" || !raw.trim()) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "base64 audio data is required"
                    });
                }

                let encoded = raw.trim();
                let mimeType = body.mimeType || "audio/mpeg";
                const dataUrl = encoded.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
                if (dataUrl) {
                    mimeType = dataUrl[1].toLowerCase();
                    encoded = dataUrl[2];
                }

                if (!/^audio\/[a-zA-Z0-9.+-]+$/i.test(mimeType)) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "A valid audio MIME type is required"
                    });
                }

                if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "Invalid base64 audio data"
                    });
                }

                const audio = Buffer.from(encoded, "base64");
                const maxBytes = 10 * 1024 * 1024;
                if (!audio.length || audio.length > maxBytes) {
                    return sendJson(res, 413, {
                        success: false,
                        error: "Audio must be between 1 byte and 10 MiB"
                    });
                }

                const result = await voiceApi.transcribeAudio(audio, {
                    language: body.language,
                    mimeType
                });
                const statusCode = result.success ? 200 :
                    result.code === "STT_UNAVAILABLE" ? 503 : 422;
                return sendJson(res, statusCode, result);
            }

            if (
                pathname === "/voice/synthesize" &&
                req.method === "POST"
            ) {
                const body = await readBody(req);
                if (typeof body.text !== "string" || !body.text.trim()) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "text is required"
                    });
                }
                if (body.text.length > 10000) {
                    return sendJson(res, 413, {
                        success: false,
                        error: "Text must not exceed 10000 characters"
                    });
                }

                const result = await voiceApi.synthesizeSpeech(body.text, {
                    language: body.language,
                    voice: body.voice,
                    format: body.format
                });
                const statusCode = result.success ? 200 :
                    result.code === "TTS_UNAVAILABLE" ? 503 : 422;
                return sendJson(res, statusCode, result);
            }


            /* =================================================
               VISION ENGINE API
               ================================================= */

            if (
                pathname === "/vision/status" &&
                req.method === "GET"
            ) {
                return sendJson(res, 200, {
                    success: true,
                    ...visionApi.getVisionStatus()
                });
            }

            if (
                pathname === "/vision/analyze" &&
                req.method === "POST"
            ) {
                const body = await readBody(req);
                const raw = body.base64 || body.data;

                if (typeof raw !== "string" || !raw.trim()) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "base64 image data is required"
                    });
                }

                let encoded = raw.trim();
                let mimeType = body.mimeType || "image/jpeg";
                const dataUrl = encoded.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
                if (dataUrl) {
                    mimeType = dataUrl[1].toLowerCase();
                    encoded = dataUrl[2];
                }

                if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mimeType)) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "Unsupported image MIME type"
                    });
                }

                if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "Invalid base64 image data"
                    });
                }

                const image = Buffer.from(encoded, "base64");
                const maxBytes = 5 * 1024 * 1024;
                if (!image.length || image.length > maxBytes) {
                    return sendJson(res, 413, {
                        success: false,
                        error: "Image must be between 1 byte and 5 MiB"
                    });
                }

                const result = await visionApi.analyzeImage(image, {
                    prompt: body.prompt,
                    language: body.language,
                    detail: body.detail,
                    mimeType
                });

                const statusCode = result.success ? 200 :
                    result.code === "VISION_UNAVAILABLE" ? 503 : 422;
                return sendJson(res, statusCode, result);
            }


            /* =================================================
               LEARNING API
               ================================================= */

            if (
                pathname === "/learning" &&
                req.method === "GET"
            ) {

                const result =
                    await learningApi.getLearningStatus();

                return sendJson(res, 200, result);
            }


            if (
                pathname === "/learning-status" &&
                req.method === "GET"
            ) {

                const result =
                    await learningApi.getLearningStatus();

                return sendJson(res, 200, result);
            }


            /* =================================================
               LEARN
               ================================================= */

            if (
                pathname === "/learn" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                const input =
                    body.input ||
                    body.content ||
                    body.text ||
                    body.title ||
                    "";

                if (!String(input).trim()) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "Learning input is required"
                    });
                }

                const learningInput =
                    body.content ||
                    body.input ||
                    body.text ||
                    body.title;

                const result =
                    await learningApi.learnFromUser(
                        learningInput,
                        {
                            ...body,
                            source:
                                body.source ||
                                "api"
                        }
                    );

                return sendJson(res, 200, result);
            }


            /* =================================================
               DOCUMENT LEARNING
               ================================================= */

            if (pathname === "/learning/document/status" && req.method === "GET") {
                return sendJson(res, 200, documentLearningApi.getDocumentLearningStatus());
            }

            if (pathname === "/learn/document" && req.method === "POST") {
                const body = await readBody(req);
                const encoded = body.base64 || body.data;
                if (typeof encoded !== "string" || !encoded.trim()) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "base64 document content is required"
                    });
                }

                const normalized = encoded.replace(/^data:.*?;base64,/i, "").replace(/\s/g, "");
                if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "Invalid base64 document content"
                    });
                }

                const buffer = Buffer.from(normalized, "base64");
                const result = await documentLearningApi.learnDocument({
                    buffer,
                    fileName: body.fileName || body.filename || "",
                    extension: body.extension || "",
                    title: body.title,
                    source: body.source || "document-api",
                    category: body.category || "document",
                    learn: body.learn !== false
                });

                const statusCode = result && result.success ? 200 : 422;
                return sendJson(res, statusCode, result);
            }


            /* =================================================
               LEARNING SEARCH
               ================================================= */

            if (
                pathname === "/learning/search" &&
                req.method === "GET"
            ) {

                const query =
                    url.searchParams.get("q") ||
                    "";

                const limit =
                    Number(
                        url.searchParams.get(
                            "limit"
                        )
                    ) || 10;

                const result =
                    await learningApi
                        .searchLearnedKnowledge(
                            query,
                            limit
                        );

                return sendJson(res, 200, result);
            }


            /* =================================================
               LEARNING HISTORY
               ================================================= */

            if (
                pathname === "/learning-history" &&
                req.method === "GET"
            ) {

                const limitParam =
                    url.searchParams.get(
                        "limit"
                    );

                const memoryId =
                    url.searchParams.get(
                        "memoryId"
                    );

                const limit =
                    limitParam &&
                    Number.isFinite(
                        Number(limitParam)
                    )
                        ? Number(limitParam)
                        : 50;

                const result =
                    await learningApi
                        .getLearningHistory(
                            limit
                        );

                /*
                 * Compatibility:
                 * Automated tests may request
                 * /learning-history?memoryId=...
                 *
                 * Learning history is stored globally,
                 * therefore we filter the returned
                 * records when memoryId is supplied.
                 */

                if (
                    memoryId &&
                    result &&
                    Array.isArray(
                        result.history
                    )
                ) {

                    result.history =
                        result.history.filter(
                            item =>
                                item.memoryId ===
                                memoryId
                        );

                    result.count =
                        result.history.length;
                }

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               CORRECTION
               ================================================= */

            if (
                pathname === "/correct" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                const memoryId =
                    body.memoryId ||
                    body.id;

                const correction =
                    body.correction ||
                    body.content ||
                    body.text;

                if (!memoryId) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "memoryId is required"
                    });
                }

                if (!correction) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "correction is required"
                    });
                }

                const result =
                    await learningApi
                        .correctKnowledge(
                            memoryId,
                            correction,
                            body
                        );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               FEEDBACK
               ================================================= */

            if (
                pathname === "/feedback" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                if (!body.memoryId) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "memoryId is required"
                    });
                }

                const result =
                    await learningApi
                        .addKnowledgeFeedback(
                            body.memoryId,
                            body.feedback ||
                                body.reason ||
                                "",
                            body
                        );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               MEMORY - GENERAL
               ================================================= */

            if (
                pathname === "/memory" &&
                req.method === "GET"
            ) {

                const memories =
                    memory.getAll();

                return sendJson(res, 200, {
                    success: true,
                    count: memories.length,
                    memories
                });
            }


            /* =================================================
               MEMORY STATUS
               ================================================= */

            if (
                pathname === "/memory-status" &&
                req.method === "GET"
            ) {

                return sendJson(res, 200, {
                    success: true,
                    status:
                        memory.getStats()
                });
            }


            /* =================================================
               MEMORY HEALTH
               ================================================= */

            if (
                pathname === "/memory-health" &&
                req.method === "GET"
            ) {

                return sendJson(res, 200, {
                    success: true,
                    health:
                        memory.getStorageHealth()
                });
            }


            /* =================================================
               MEMORY HISTORY
               ================================================= */

            if (
                pathname === "/memory-history" &&
                req.method === "GET"
            ) {

                const memoryId =
                    url.searchParams.get(
                        "memoryId"
                    );

                if (!memoryId) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "memoryId is required"
                    });
                }

                const history =
                    memoryHistory.getHistory(
                        memoryId
                    );

                return sendJson(res, 200, {
                    success: true,
                    memoryId,
                    count: history.length,
                    history
                });
            }


            /* =================================================
               MEMORY HISTORY STATUS
               ================================================= */

            if (
                pathname ===
                    "/memory-history-status" &&
                req.method === "GET"
            ) {

                const history =
                    memoryHistory
                        .getHistoryStats();

                return sendJson(res, 200, {
                    success: true,
                    ...history
                });
            }


            /* =================================================
               MEMORY REMEMBER
               ================================================= */

            if (
                pathname ===
                    "/memory/remember" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                if (
                    !body.content &&
                    !body.title
                ) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "Memory content is required"
                    });
                }

                const result =
                    await memoryApi.remember(
                        body
                    );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               MEMORY SEARCH
               ================================================= */

            if (
                pathname ===
                    "/memory/search" &&
                req.method === "GET"
            ) {

                const query =
                    url.searchParams.get(
                        "q"
                    ) || "";

                const limit =
                    Number(
                        url.searchParams.get(
                            "limit"
                        )
                    ) || 10;

                const result =
                    await memoryApi.search(
                        query,
                        limit
                    );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               MEMORY GET
               ================================================= */

            if (
                pathname ===
                    "/memory/get" &&
                req.method === "GET"
            ) {

                const memoryId =
                    url.searchParams.get(
                        "memoryId"
                    );

                if (!memoryId) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "memoryId is required"
                    });
                }

                const result =
                    await memoryApi.get(
                        memoryId
                    );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               MEMORY UPDATE
               ================================================= */

            if (
                pathname ===
                    "/memory/update" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                if (!body.memoryId) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "memoryId is required"
                    });
                }

                const result =
                    await memoryApi.update(
                        body.memoryId,
                        body.changes ||
                            body
                    );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               MEMORY FORGET
               ================================================= */

            if (
                pathname ===
                    "/memory/forget" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                if (!body.memoryId) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "memoryId is required"
                    });
                }

                const result =
                    await memoryApi.forget(
                        body.memoryId
                    );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               VERIFIED MEMORY
               ================================================= */

            if (
                pathname ===
                    "/memory/verified" &&
                req.method === "GET"
            ) {

                const limit =
                    Number(
                        url.searchParams.get(
                            "limit"
                        )
                    ) || 10;

                const result =
                    await memoryApi.getVerified(
                        limit
                    );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               KNOWLEDGE SEARCH
               ================================================= */

            if (
                pathname ===
                    "/memory/knowledge" &&
                req.method === "GET"
            ) {

                const query =
                    url.searchParams.get(
                        "q"
                    ) || "";

                const limit =
                    Number(
                        url.searchParams.get(
                            "limit"
                        )
                    ) || 10;

                const result =
                    await memoryApi
                        .searchKnowledge(
                            query,
                            limit
                        );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               VERIFIED KNOWLEDGE
               ================================================= */

            if (
                pathname ===
                    "/memory/verified-knowledge" &&
                req.method === "GET"
            ) {

                const query =
                    url.searchParams.get(
                        "q"
                    ) || "";

                const limit =
                    Number(
                        url.searchParams.get(
                            "limit"
                        )
                    ) || 10;

                const result =
                    await memoryApi
                        .searchVerifiedKnowledge(
                            query,
                            limit
                        );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               MEMORY CONTROL STATUS
               ================================================= */

            if (
                pathname ===
                    "/memory/control-status" &&
                req.method === "GET"
            ) {

                const result =
                    await memoryApi
                        .getControlStatus();

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               RESEARCH
               ================================================= */

            if (
                pathname ===
                    "/research/status" &&
                req.method === "GET"
            ) {

                return sendJson(res, 200, {
                    success: true,
                    status: "available",
                    provider:
                        process.env.TAVILY_API_KEY
                            ? "tavily"
                            : "not-configured"
                });
            }


            if (
                pathname === "/research" &&
                req.method === "POST"
            ) {

                const body =
                    await readBody(req);

                if (
                    !body.query ||
                    !String(
                        body.query
                    ).trim()
                ) {

                    return sendJson(res, 400, {
                        success: false,
                        error:
                            "query is required"
                    });
                }

                /*
                 * Research is handled through
                 * the normal AarHen orchestrator.
                 */

                const result =
                    await orchestrate(
                        String(body.query),
                        {
                            ...body,
                            intent:
                                "research"
                        }
                    );

                return sendJson(
                    res,
                    200,
                    result
                );
            }


            /* =================================================
               404
               ================================================= */

            return sendJson(res, 404, {
                success: false,
                error: "Route not found",
                path: pathname,
                method: req.method
            });

        } catch (error) {

            console.error(
                "SERVER ERROR:",
                error
            );

            return sendJson(res, error.statusCode || 500, {
                success: false,
                error:
                    error.message ||
                    "Internal server error"
            });
        }
    }
);


/* =========================================================
   START SERVER
   ========================================================= */

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "=========================================="
        );

        console.log(
            "        AARHEN AI CORE v5"
        );

        console.log(
            "=========================================="
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            "Status: ONLINE"
        );

        console.log(
            "Learning API: CONNECTED"
        );

        console.log(
            "Memory API: CONNECTED"
        );

        console.log(
            "Memory History: CONNECTED"
        );

        console.log(
            "Research API: CONNECTED"
        );

        console.log(
            "=========================================="
        );

        console.log("");
    }
);


/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

function shutdown(signal) {

    console.log(
        `Received ${signal}. Shutting down...`
    );

    server.close(() => {

        console.log(
            "AarHen server stopped."
        );

        process.exit(0);
    });
}


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);
