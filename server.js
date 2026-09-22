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

const memoryApi =
    require("./core/memoryApi");

const researchApi =
    require("./core/researchApi");

const PORT =
    process.env.PORT || 3000;

// ============================================================
// SEND JSON
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
// READ BODY
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
// AUTH
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
            // CORS
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
            // AUTHENTICATION
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
            // URL OBJECT
            // ==================================================

            const url =
                new URL(
                    req.url,
                    `http://localhost:${PORT}`
                );

            const pathname =
                url.pathname;

            // ==================================================
            // ROOT
            // ==================================================

            if (
                req.method === "GET" &&
                pathname === "/"
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

                            "memory-api",

                            "memory-history",

                            "memory-health",

                            "learning",

                            "feedback",

                            "correction",

                            "web-research",

                            "research-api",

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
                pathname === "/ask"
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
            // RESEARCH - LIVE WEB SEARCH
            // ==================================================

            if (
                req.method === "POST" &&
                pathname === "/research"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        await researchApi.searchWeb(
                            body
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // RESEARCH - VERIFY
            // ==================================================

            if (
                req.method === "POST" &&
                pathname === "/research/verify"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        researchApi.verify(
                            body
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // RESEARCH - LEARN VERIFIED
            // ==================================================

            if (
                req.method === "POST" &&
                pathname === "/research/learn"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        researchApi.learnVerified(
                            body
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // RESEARCH - STATUS
            // ==================================================

            if (
                req.method === "GET" &&
                pathname === "/research/status"
            ) {

                try {

                    const result =
                        researchApi.getApiStatus();

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
                pathname === "/learn"
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
                pathname === "/feedback"
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
                pathname === "/correct"
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
                pathname ===
                    "/learning-history"
            ) {

                try {

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
            // MEMORY API - REMEMBER
            // ==================================================

            if (
                req.method === "POST" &&
                pathname ===
                    "/memory/remember"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        memoryApi.remember(
                            body
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // MEMORY API - SEARCH
            // ==================================================

            if (
                req.method === "GET" &&
                pathname ===
                    "/memory/search"
            ) {

                try {

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
                        memoryApi.search(
                            query,
                            limit
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // MEMORY API - GET
            // ==================================================

            if (
                req.method === "GET" &&
                pathname ===
                    "/memory/get"
            ) {

                try {

                    const memoryId =
                        url.searchParams.get(
                            "memoryId"
                        );

                    const result =
                        memoryApi.get(
                            memoryId
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 404,
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
            // MEMORY API - UPDATE
            // ==================================================

            if (
                req.method === "POST" &&
                pathname ===
                    "/memory/update"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        memoryApi.update(
                            body.memoryId,
                            body.changes || {}
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // MEMORY API - FORGET
            // ==================================================

            if (
                req.method === "POST" &&
                pathname ===
                    "/memory/forget"
            ) {

                try {

                    const body =
                        await readBody(req);

                    const result =
                        memoryApi.forget(
                            body.memoryId
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // MEMORY API - VERIFIED
            // ==================================================

            if (
                req.method === "GET" &&
                pathname ===
                    "/memory/verified"
            ) {

                try {

                    const limit =
                        Number(
                            url.searchParams.get(
                                "limit"
                            )
                        ) || 10;

                    const result =
                        memoryApi.getVerified(
                            limit
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // MEMORY API - KNOWLEDGE SEARCH
            // ==================================================

            if (
                req.method === "GET" &&
                pathname ===
                    "/memory/knowledge"
            ) {

                try {

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
                        memoryApi.searchKnowledge(
                            query,
                            limit
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // MEMORY API - VERIFIED KNOWLEDGE
            // ==================================================

            if (
                req.method === "GET" &&
                pathname ===
                    "/memory/verified-knowledge"
            ) {

                try {

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
                        memoryApi.searchVerifiedKnowledge(
                            query,
                            limit
                        );

                    sendJSON(
                        res,
                        result.success
                            ? 200
                            : 400,
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
            // MEMORY API - CONTROL STATUS
            // ==================================================

            if (
                req.method === "GET" &&
                pathname ===
                    "/memory/control-status"
            ) {

                try {

                    sendJSON(
                        res,
                        200,
                        memoryApi.getControlStatus()
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
                pathname === "/memory"
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
                pathname ===
                    "/memory-status"
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
                pathname ===
                    "/memory-history"
            ) {

                try {

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
                pathname ===
                    "/memory-health"
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
                pathname ===
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
                pathname === "/learning"
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
                pathname ===
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
            // 404
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
            "----------------------------------------------"
        );

        console.log(
            "CORE ROUTES"
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
            "GET  /learning"
        );

        console.log(
            "GET  /learning-status"
        );

        console.log(
            "----------------------------------------------"
        );

        console.log(
            "RESEARCH ROUTES"
        );

        console.log(
            "POST /research"
        );

        console.log(
            "POST /research/verify"
        );

        console.log(
            "POST /research/learn"
        );

        console.log(
            "GET  /research/status"
        );

        console.log(
            "----------------------------------------------"
        );

        console.log(
            "MEMORY ROUTES"
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
            "----------------------------------------------"
        );

        console.log(
            "MEMORY CONTROL API"
        );

        console.log(
            "POST /memory/remember"
        );

        console.log(
            "GET  /memory/search?q=..."
        );

        console.log(
            "GET  /memory/get?memoryId=..."
        );

        console.log(
            "POST /memory/update"
        );

        console.log(
            "POST /memory/forget"
        );

        console.log(
            "GET  /memory/verified"
        );

        console.log(
            "GET  /memory/knowledge?q=..."
        );

        console.log(
            "GET  /memory/verified-knowledge?q=..."
        );

        console.log(
            "GET  /memory/control-status"
        );

        console.log(
            "----------------------------------------------"
        );

        console.log(
            "Web Research: Tavily"
        );

        console.log(
            "Learning: Continuous Feedback Loop"
        );

        console.log(
            "Memory: Long-Term + History + Control API"
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
