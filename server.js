const http = require("http");

const { orchestrate } = require("./core/orchestrator");
const auth = require("./core/auth");
const learningApi = require("./core/learningApi");
const memory = require("./core/memory");
const memoryHistory = require("./core/memoryHistory");
const memoryApi = require("./core/memoryApi");
const documentLearningApi = require("./core/documentLearningApi");

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
            "Content-Type, Authorization"
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

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(
                    new Error(
                        "Invalid JSON request body"
                    )
                );
            }
        });

        req.on("error", reject);
    });
}


/* =========================================================
   AUTH HELPER
   ========================================================= */

function getAuthToken(req) {
    const header =
        req.headers.authorization || "";

    if (header.startsWith("Bearer ")) {
        return header.substring(7);
    }

    return null;
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
                        "Content-Type, Authorization"
                });

                res.end();
                return;
            }


            const url = new URL(
                req.url,
                `http://${req.headers.host || "localhost"}`
            );

            const pathname = url.pathname;


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

                const token =
                    getAuthToken(req);

                return sendJson(res, 200, {
                    success: true,
                    authenticated: !!token,
                    hasToken: !!token
                });
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

                const normalized = encoded.replace(/^data:.*?;base64,/i, "").replace(/\\s/g, "");
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

            return sendJson(res, 500, {
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
