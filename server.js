// ============================================================
// AARHEN CORE V5
// MASTER SERVER
// ============================================================

const http =
    require("http");

const {
    orchestrate
} = require("./core/orchestrator");

const auth =
    require("./core/auth");

const learningApi =
    require("./core/learningApi");

const memory =
    require("./core/memory");

const memoryHistory =
    require("./core/memoryHistory");

const PORT =
    process.env.PORT || 3000;

// ============================================================
// SEND JSON RESPONSE
// ============================================================

function sendJSON(
    res,
    statusCode,
    data
) {
    res.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Methods":
                "GET,POST,OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type,X-AarHen-API-Key"
        }
    );

    res.end(
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

// ============================================================
// READ REQUEST BODY
// ============================================================

function readBody(req) {

    return new Promise(
        (resolve, reject) => {

            let body = "";

            req.on(
                "data",
                chunk => {
                    body += chunk;
                }
            );

            req.on(
                "end",
                () => {

                    if (!body) {

                        resolve({});

                        return;
                    }

                    try {

                        resolve(
                            JSON.parse(body)
                        );

                    } catch (error) {

                        reject(
                            new Error(
                                "Invalid JSON body."
                            )
                        );
                    }
                }
            );

            req.on(
                "error",
                reject
            );
        }
    );
}

// ============================================================
// AUTHENTICATION
// ============================================================

function authenticateRequest(req) {

    return auth.authenticate(req);
}

// ============================================================
// SERVER
// ============================================================

const server =
    http.createServer(
        async (req, res) => {

            // ==================================================
            // CORS PREFLIGHT
            // ==================================================

            if (
                req.method ===
                "OPTIONS"
            ) {

                res.writeHead(
                    204,
                    {
                        "Access-Control-Allow-Origin":
                            "*",

                        "Access-Control-Allow-Methods":
                            "GET,POST,OPTIONS",

                        "Access-Control-Allow-Headers":
                            "Content-Type,X-AarHen-API-Key"
                    }
                );

                res.end();

                return;
            }

            // ==================================================
            // AUTH
            // ==================================================

            const authentication =
                authenticateRequest(req);

            if (
                !authentication.authenticated &&
                authentication.configured
            ) {

                sendJSON(
                    res,
                    401,
                    {
                        success: false,

                        error:
                            "Unauthorized.",

                        message:
                            "Valid AarHen API key required."
                    }
                );

                return;
            }

            // ==================================================
            // HEALTH / ROOT
            // ==================================================

            if (
                req.method === "GET" &&
                req.url === "/"
            ) {

                sendJSON(
                    res,
                    200,
                    {
                        success: true,

                        name:
                            "AarHen",

                        version:
                            "5.0.0",

                        status:
                            "online",

                        authentication:
                            authentication.configured
                                ? "protected"
                                : "development-mode",

                        capabilities: [

                            "reasoning",

                            "memory",

                            "long-term-memory",

                            "learning",

                            "feedback",

                            "correction",

                            "memory-history",

                            "memory-health",

                            "web-research",

                            "knowledge",

                            "rag",

                            "verification",

                            "finance",

                            "coding",

                            "cybersecurity",

                            "business",

                            "documents",

                            "data-analysis"
                        ]
                    }
                );

                return;
            }

            // ==================================================
            // ASK
            // ==================================================

            if (
                req.method === "POST" &&
                req.url === "/ask"
            ) {

                try {

                    const body =
                        await readBody(req);

                    if (
                        !body.input ||
                        typeof body.input !==
                            "string"
                    ) {

                        sendJSON(
                            res,
                            400,
                            {
                                success: false,

                                error:
                                    "Input is required."
                            }
                        );

                        return;
                    }

                    const result =
                        await orchestrate(
                            body.input,
                            body.context || {}
                        );

                    sendJSON(
                        res,
                        200,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // LEARN
            // ==================================================

            if (
                req.method === "POST" &&
                req.url === "/learn"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        learningApi.learnFromUser({

                            title:
                                body.title,

                            content:
                                body.content,

                            category:
                                body.category ||
                                "general",

                            source:
                                body.source ||
                                "user"
                        });

                    if (!result.success) {

                        sendJSON(
                            res,
                            400,
                            result
                        );

                        return;
                    }

                    sendJSON(
                        res,
                        200,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // FEEDBACK
            // ==================================================

            if (
                req.method === "POST" &&
                req.url === "/feedback"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        learningApi.addKnowledgeFeedback({

                            memoryId:
                                body.memoryId,

                            feedback:
                                body.feedback,

                            helpful:
                                body.helpful,

                            reason:
                                body.reason || ""
                        });

                    if (!result.success) {

                        sendJSON(
                            res,
                            400,
                            result
                        );

                        return;
                    }

                    sendJSON(
                        res,
                        200,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // CORRECT
            // ==================================================

            if (
                req.method === "POST" &&
                req.url === "/correct"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        learningApi.correctKnowledge({

                            memoryId:
                                body.memoryId,

                            correction:
                                body.correction,

                            reason:
                                body.reason || ""
                        });

                    if (!result.success) {

                        sendJSON(
                            res,
                            400,
                            result
                        );

                        return;
                    }

                    sendJSON(
                        res,
                        200,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // LEARNING HISTORY
            // ==================================================

            if (
                req.method === "GET" &&
                req.url.startsWith(
                    "/learning-history"
                )
            ) {

                try {

                    const url =
                        new URL(
                            req.url,
                            `http://localhost:${PORT}`
                        );

                    const memoryId =
                        url.searchParams.get(
                            "memoryId"
                        );

                    const result =
                        learningApi.getLearningHistory(
                            memoryId
                        );

                    if (!result.success) {

                        sendJSON(
                            res,
                            400,
                            result
                        );

                        return;
                    }

                    sendJSON(
                        res,
                        200,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // ALL MEMORY
            // ==================================================

            if (
                req.method === "GET" &&
                req.url === "/memory"
            ) {

                try {

                    sendJSON(
                        res,
                        200,
                        {
                            success: true,

                            memories:
                                memory.getAll()
                        }
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // MEMORY STATUS
            // ==================================================

            if (
                req.method === "GET" &&
                req.url === "/memory-status"
            ) {

                try {

                    sendJSON(
                        res,
                        200,
                        memory.getStats()
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // MEMORY HISTORY
            // ==================================================

            if (
                req.method === "GET" &&
                req.url.startsWith(
                    "/memory-history"
                )
            ) {

                try {

                    const url =
                        new URL(
                            req.url,
                            `http://localhost:${PORT}`
                        );

                    const memoryId =
                        url.searchParams.get(
                            "memoryId"
                        );

                    const limit =
                        Number(
                            url.searchParams.get(
                                "limit"
                            )
                        ) || 50;

                    const result =
                        memoryHistory.getHistory(
                            memoryId,
                            limit
                        );

                    if (!result.success) {

                        sendJSON(
                            res,
                            400,
                            result
                        );

                        return;
                    }

                    sendJSON(
                        res,
                        200,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // MEMORY HEALTH
            // ==================================================

            if (
                req.method === "GET" &&
                req.url === "/memory-health"
            ) {

                try {

                    const result =
                        memory.healthCheck();

                    sendJSON(
                        res,
                        result.healthy
                            ? 200
                            : 500,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            healthy: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // MEMORY HISTORY STATUS
            // ==================================================

            if (
                req.method === "GET" &&
                req.url ===
                    "/memory-history-status"
            ) {

                try {

                    const result =
                        memoryHistory.getHistoryStats();

                    sendJSON(
                        res,
                        200,
                        result
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // LEARNING
            // ==================================================

            if (
                req.method === "GET" &&
                req.url === "/learning"
            ) {

                try {

                    sendJSON(
                        res,
                        200,
                        learningApi.getLearnedKnowledge()
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // LEARNING STATUS
            // ==================================================

            if (
                req.method === "GET" &&
                req.url ===
                    "/learning-status"
            ) {

                try {

                    sendJSON(
                        res,
                        200,
                        learningApi.getLearningStatus()
                    );

                } catch (error) {

                    sendJSON(
                        res,
                        500,
                        {
                            success: false,

                            error:
                                error.message
                        }
                    );
                }

                return;
            }

            // ==================================================
            // FINAL 404
            // ==================================================

            sendJSON(
                res,
                404,
                {
                    success: false,

                    error:
                        "Route not found.",

                    path:
                        req.url
                }
            );
        }
    );

// ============================================================
// START SERVER
// ============================================================

server.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "=============================================="
        );

        console.log(
            "        AARHEN CORE V5 SERVER"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `AarHen running on port ${PORT}`
        );

        console.log(
            "Status: ONLINE"
        );

        console.log(
            "Routes:"
        );

        console.log(
            "GET  /"
        );

        console.log(
            "POST /ask"
        );

        console.log(
            "POST /learn"
        );

        console.log(
            "POST /feedback"
        );

        console.log(
            "POST /correct"
        );

        console.log(
            "GET  /learning-history?memoryId=..."
        );

        console.log(
            "GET  /memory"
        );

        console.log(
            "GET  /memory-status"
        );

        console.log(
            "GET  /memory-history?memoryId=..."
        );

        console.log(
            "GET  /memory-health"
        );

        console.log(
            "GET  /memory-history-status"
        );

        console.log(
            "GET  /learning"
        );

        console.log(
            "GET  /learning-status"
        );

        console.log(
            "Web Research: Tavily"
        );

        console.log(
            "Learning: Continuous Feedback Loop"
        );

        console.log(
            "Memory: Long-Term + History + Health"
        );

        console.log(
            "=============================================="
        );
    }
);

// ============================================================
// EXPORT
// ============================================================

module.exports =
    server;
