// ============================================================
// AARHEN CORE V5
// API SERVER
// ============================================================

const http = require("http");

const {
    orchestrate
} = require("./core/orchestrator");


// ------------------------------------------------------------
// Server configuration
// ------------------------------------------------------------

const PORT =
    process.env.PORT || 3000;


// ------------------------------------------------------------
// Send JSON response
// ------------------------------------------------------------

function sendJSON(
    response,
    statusCode,
    data
) {

    response.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json",

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Methods":
                "GET,POST,OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type"
        }
    );


    response.end(
        JSON.stringify(
            data,
            null,
            2
        )
    );

}


// ------------------------------------------------------------
// Read request body
// ------------------------------------------------------------

function readBody(request) {

    return new Promise(
        (resolve, reject) => {

            let body = "";


            request.on(
                "data",
                chunk => {

                    body +=
                        chunk.toString();

                }
            );


            request.on(
                "end",
                () => {

                    try {

                        resolve(
                            body
                                ? JSON.parse(body)
                                : {}
                        );

                    }
                    catch (error) {

                        reject(error);

                    }

                }
            );


            request.on(
                "error",
                reject
            );

        }
    );

}


// ------------------------------------------------------------
// Create HTTP server
// ------------------------------------------------------------

const server =
    http.createServer(
        async (
            request,
            response
        ) => {


            // ------------------------------------------------
            // CORS preflight
            // ------------------------------------------------

            if (
                request.method === "OPTIONS"
            ) {

                sendJSON(
                    response,
                    200,
                    {
                        success: true
                    }
                );

                return;

            }


            // ------------------------------------------------
            // Health check
            // ------------------------------------------------

            if (
                request.method === "GET" &&
                request.url === "/"
            ) {

                sendJSON(
                    response,
                    200,
                    {

                        success: true,

                        name:
                            "AarHen",

                        version:
                            "5.0.0",

                        status:
                            "online",

                        message:
                            "AarHen API Server is running."

                    }
                );

                return;

            }


            // ------------------------------------------------
            // AarHen API
            // ------------------------------------------------

            if (
                request.method === "POST" &&
                request.url === "/ask"
            ) {

                try {

                    const body =
                        await readBody(
                            request
                        );


                    const input =
                        body.input;


                    const context =
                        body.context || {};


                    if (
                        !input ||
                        typeof input !== "string"
                    ) {

                        sendJSON(
                            response,
                            400,
                            {

                                success: false,

                                error:
                                    "input is required."

                            }
                        );

                        return;

                    }


                    const result =
                        orchestrate(
                            input,
                            context
                        );


                    sendJSON(
                        response,
                        200,
                        result
                    );

                }
                catch (error) {

                    sendJSON(
                        response,
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


            // ------------------------------------------------
            // 404
            // ------------------------------------------------

            sendJSON(
                response,
                404,
                {

                    success: false,

                    error:
                        "Endpoint not found."

                }
            );

        }
    );


// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

server.listen(
    PORT,
    () => {

        console.log(
            `AarHen API running on port ${PORT}`
        );

    }
);


// ------------------------------------------------------------
// Module export
// ------------------------------------------------------------

module.exports = server;
