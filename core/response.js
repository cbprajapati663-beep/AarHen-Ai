// ============================================================
// AARHEN CORE V5
// RESPONSE ENGINE
// ============================================================
//
// Version: 5.5.6
//
// Improvements:
// - Fixed research source count display
// - Supports sources/results across all research layers
// - Supports executor + orchestrator research objects
// - Displays verification correctly
// - Displays verified learning correctly
// - Avoids unnecessary re-processing
// - Keeps existing public exports
// ============================================================


const RESPONSE_VERSION =
    "5.5.6";


// ============================================================
// GENERAL HELPERS
// ============================================================

function safeObject(
    value
) {

    return (
        value &&
        typeof value ===
            "object"
    )
        ? value
        : {};
}


function safeArray(
    value
) {

    return Array.isArray(
        value
    )
        ? value
        : [];
}


function normalize(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }

    return String(
        value
    ).trim();
}


function firstNonEmpty(
    ...values
) {

    for (
        const value of
        values
    ) {

        if (
            value !== null &&
            value !== undefined &&
            String(
                value
            ).trim() !== ""
        ) {

            return value;
        }
    }

    return "";
}


// ============================================================
// NUMBER FORMAT
// ============================================================

function formatNumber(
    value
) {

    const number =
        Number(
            value
        );

    if (
        !Number.isFinite(
            number
        )
    ) {

        return String(
            value ?? ""
        );
    }

    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits:
                2
        }
    );
}


// ============================================================
// CONFIDENCE FORMAT
// ============================================================

function formatConfidence(
    value
) {

    const number =
        Number(
            value
        );

    if (
        !Number.isFinite(
            number
        )
    ) {

        return "";
    }

    return `${Math.round(
        Math.max(
            0,
            Math.min(
                1,
                number
            )
        ) * 100
    )}%`;
}


// ============================================================
// FINANCE RESPONSES
// ============================================================

function formatEMI(
    result
) {

    if (
        !result ||
        !result.success
    ) {

        return (
            "EMI calculation complete nahi ho saki."
        );
    }

    return (

        `Loan amount ₹${formatNumber(
            result.principal
        )}, ` +

        `${result.annualRate}% annual interest aur ` +

        `${result.years} years tenure ke hisaab se ` +

        `estimated EMI ₹${formatNumber(
            result.emi
        )} ` +

        `per month hai.`

    );
}


function formatSimpleInterest(
    result
) {

    if (
        !result ||
        !result.success
    ) {

        return (
            "Simple interest calculation complete nahi ho saki."
        );
    }

    return (

        `Principal ₹${formatNumber(
            result.principal
        )}, ` +

        `${result.annualRate}% interest aur ` +

        `${result.years} years ke hisaab se ` +

        `simple interest ₹${formatNumber(
            result.interest
        )} ` +

        `aur total amount ₹${formatNumber(
            result.totalAmount
        )} hai.`

    );
}


// ============================================================
// MISSING INPUT
// ============================================================

function formatMissingInput(
    missing = []
) {

    if (

        !Array.isArray(
            missing
        ) ||

        missing.length === 0

    ) {

        return (
            "Mujhe calculation complete karne ke liye required information chahiye."
        );
    }


    return (

        "Mujhe calculation complete karne ke liye " +

        missing.join(
            ", "
        ) +

        " chahiye."

    );
}


// ============================================================
// RESEARCH OBJECT RESOLVER
// ============================================================
//
// Research data may come from:
//
// execution.research
// execution.result
// execution.result.research
// result.research
// result.execution.research
//
// This resolver keeps the response layer independent
// from the exact upstream nesting.
// ============================================================

function resolveResearchObject(
    input = {}
) {

    const root =
        safeObject(
            input
        );


    const execution =
        safeObject(
            root.execution
        );


    const candidates = [

        root.research,

        execution.research,

        execution.result?.research,

        root.result?.research,

        root.result,

        execution.result

    ];


    for (
        const candidate of
        candidates
    ) {

        if (
            !candidate ||
            typeof candidate !==
                "object"
        ) {

            continue;
        }


        const hasResearchData =

            Array.isArray(
                candidate.sources
            ) ||

            Array.isArray(
                candidate.results
            ) ||

            typeof candidate.answer ===
                "string" ||

            typeof candidate.summary ===
                "string" ||

            candidate.verification ||

            typeof candidate.verified ===
                "boolean";


        if (
            hasResearchData
        ) {

            return candidate;
        }
    }


    return {};
}


// ============================================================
// RESEARCH SOURCE RESOLVER
// ============================================================
//
// IMPORTANT FIX:
//
// Old code only checked:
//     research.results
//
// Current AarHen pipeline commonly uses:
//     research.sources
//
// This resolver supports both.
// ============================================================

function resolveResearchSources(
    input = {}
) {

    const root =
        safeObject(
            input
        );


    const execution =
        safeObject(
            root.execution
        );


    const research =
        resolveResearchObject(
            root
        );


    const candidates = [

        research.sources,

        research.results,

        execution.research?.sources,

        execution.research?.results,

        execution.result?.sources,

        execution.result?.results,

        execution.result?.research?.sources,

        execution.result?.research?.results,

        root.research?.sources,

        root.research?.results,

        root.result?.sources,

        root.result?.results,

        root.result?.research?.sources,

        root.result?.research?.results

    ];


    /*
     * First valid non-empty source collection wins.
     */

    for (
        const candidate of
        candidates
    ) {

        if (
            Array.isArray(
                candidate
            ) &&
            candidate.length > 0
        ) {

            return normalizeResearchSources(
                candidate
            );
        }
    }


    /*
     * Explicit empty arrays are still normalized.
     */

    for (
        const candidate of
        candidates
    ) {

        if (
            Array.isArray(
                candidate
            )
        ) {

            return normalizeResearchSources(
                candidate
            );
        }
    }


    return [];
}


// ============================================================
// NORMALIZE RESEARCH SOURCES
// ============================================================

function normalizeResearchSources(
    sources = []
) {

    return safeArray(
        sources
    )

        .map(
            (
                source,
                index
            ) => {

                const item =
                    safeObject(
                        source
                    );


                return {

                    id:

                        normalize(
                            item.id
                        ) ||

                        `source-${index + 1}`,

                    title:

                        firstNonEmpty(

                            item.title,

                            item.name,

                            `Research Source ${index + 1}`

                        ),

                    url:

                        firstNonEmpty(

                            item.url,

                            item.link,

                            ""

                        ),

                    publisher:

                        firstNonEmpty(

                            item.publisher,

                            item.source,

                            item.domain,

                            ""

                        ),

                    publishedDate:

                        firstNonEmpty(

                            item.publishedDate,

                            item.publishedAt,

                            item.published_at,

                            item.date,

                            ""

                        ),

                    content:

                        firstNonEmpty(

                            item.content,

                            item.text,

                            item.description,

                            item.snippet,

                            ""

                        ),

                    snippet:

                        firstNonEmpty(

                            item.snippet,

                            item.description,

                            item.content,

                            ""

                        ),

                    score:

                        Number.isFinite(
                            Number(
                                item.score
                            )
                        )

                            ? Number(
                                item.score
                            )

                            : null

                };
            }
        )

        .filter(
            source =>

                source.title ||
                source.url ||
                source.content
        );
}


// ============================================================
// RESEARCH VERIFICATION RESOLVER
// ============================================================

function resolveResearchVerification(
    input = {}
) {

    const research =
        resolveResearchObject(
            input
        );


    const verification =
        research.verification ||
        research.verificationResult ||
        input.verification ||
        input.result?.verification ||
        null;


    let status =

        firstNonEmpty(

            research.verificationStatus,

            verification?.verificationStatus,

            verification?.status,

            research.status,

            ""

        );


    const verified =

        research.verified ===
            true ||

        verification?.verified ===
            true ||

        status ===
            "verified";


    if (
        verified
    ) {

        status =
            "verified";

    } else if (
        !status
    ) {

        status =
            "review";
    }


    return {

        verified,

        status,

        confidence:

            Number.isFinite(
                Number(
                    research.confidence
                )
            )

                ? Number(
                    research.confidence
                )

                : Number.isFinite(
                    Number(
                        verification?.confidence
                    )
                )

                    ? Number(
                        verification
                            .confidence
                    )

                    : 0,

        sourceCount:

            Number(
                research.sourceCount
            ) ||

            Number(
                verification?.sourceCount
            ) ||

            0,

        details:
            verification
    };
}


// ============================================================
// RESEARCH LEARNING RESOLVER
// ============================================================

function resolveResearchLearning(
    input = {}
) {

    const research =
        resolveResearchObject(
            input
        );


    return (

        research.learning ||

        input.learning ||

        input.execution?.learning ||

        null

    );
}


// ============================================================
// RESEARCH QUERY RESOLVER
// ============================================================

function resolveResearchQuery(
    input = {}
) {

    const research =
        resolveResearchObject(
            input
        );


    return firstNonEmpty(

        research.query,

        input.query,

        input.request,

        input.execution?.query,

        ""

    );
}


// ============================================================
// RESEARCH ANSWER RESOLVER
// ============================================================

function resolveResearchAnswer(
    input = {}
) {

    const research =
        resolveResearchObject(
            input
        );


    return normalize(

        firstNonEmpty(

            research.answer,

            research.summary,

            input.answer,

            input.result?.answer,

            input.result?.summary,

            ""

        )

    );
}


// ============================================================
// RESEARCH ERROR CHECK
// ============================================================

function isResearchError(
    input = {}
) {

    const root =
        safeObject(
            input
        );


    const research =
        resolveResearchObject(
            root
        );


    return (

        root.executionStatus ===
            "research-error" ||

        root.status ===
            "research-error" ||

        research.status ===
            "research-error" ||

        research.researchStatus ===
            "research-error"

    );
}


// ============================================================
// WEB RESEARCH RESPONSE
// ============================================================

function formatResearch(
    result
) {

    if (
        !result
    ) {

        return (
            "Research result available nahi hai."
        );
    }


    /*
     * Handle both:
     *
     * formatResearch(researchObject)
     * formatResearch(orchestrationResult)
     */

    const research =
        resolveResearchObject(
            result
        );


    if (
        isResearchError(
            result
        )
    ) {

        const error =
            firstNonEmpty(

                research.error,

                result.error,

                result.result?.error,

                "Research provider error."

            );


        return (

            "Web research complete nahi ho saki. " +

            error

        );
    }


    const answer =
        resolveResearchAnswer(
            result
        );


    const sources =
        resolveResearchSources(
            result
        );


    const verification =
        resolveResearchVerification(
            result
        );


    const learning =
        resolveResearchLearning(
            result
        );


    const query =
        resolveResearchQuery(
            result
        );


    let response =
        "";


    /* --------------------------------------------------------
       ANSWER
    -------------------------------------------------------- */

    if (
        answer
    ) {

        response +=

            `🌐 Web Research Result\n\n${answer}`;

    } else {

        response +=

            "🌐 Web research complete hui, " +

            "lekin provider ne direct summary nahi di.";
    }


    /* --------------------------------------------------------
       SOURCE COUNT
    --------------------------------------------------------

       FIX:
       Use actual normalized sources length.
    */

    response +=

        `\n\n📚 Sources: ${sources.length}`;


    /* --------------------------------------------------------
       VERIFICATION
    -------------------------------------------------------- */

    response +=

        verification.verified

            ? "\n🔍 Verification: verified"

            : verification.status ===
                "partial"

                ? "\n🔍 Verification: partial"

                : "\n🔍 Verification: review required";


    /* --------------------------------------------------------
       CONFIDENCE
    -------------------------------------------------------- */

    if (
        Number.isFinite(
            Number(
                verification.confidence
            )
        ) &&
        verification.confidence > 0
    ) {

        response +=

            `\n📊 Confidence: ${formatConfidence(
                verification.confidence
            )}`;
    }


    /* --------------------------------------------------------
       LEARNING
    -------------------------------------------------------- */

    if (
        learning
    ) {

        const learned =
            learning.learned ===
                true;


        const learningSuccess =
            learning.success ===
                true;


        if (
            learned
        ) {

            response +=

                "\n🧠 Verified information AarHen ki knowledge memory me learn ho gayi.";

        } else if (
            learningSuccess
        ) {

            response +=

                "\n🧠 Verified research learning process complete hui.";

        } else if (
            learning.status
        ) {

            response +=

                `\n🧠 Learning: ${learning.status}`;
        }
    }


    /* --------------------------------------------------------
       QUERY
    -------------------------------------------------------- */

    if (
        query
    ) {

        /*
         * Query deliberately not displayed as a separate line
         * to keep normal user responses compact.
         */
    }


    /* --------------------------------------------------------
       SOURCE DETAILS
    -------------------------------------------------------- */

    if (
        sources.length > 0
    ) {

        response +=
            "\n\nTop sources:";


        const visibleSources =
            sources.slice(
                0,
                5
            );


        visibleSources.forEach(

            (
                source,
                index
            ) => {

                response +=

                    `\n${index + 1}. ${
                        source.title ||
                        "Untitled source"
                    }`;


                if (
                    source.url
                ) {

                    response +=

                        ` — ${source.url}`;
                }
            }

        );
    }


    return response;
}


// ============================================================
// GENERIC EXECUTION RESPONSE
// ============================================================

function formatExecution(
    execution
) {

    if (
        !execution
    ) {

        return (
            "AarHen execution result available nahi hai."
        );
    }


    if (
        execution.needsInput
    ) {

        return formatMissingInput(

            execution.missingParameters

        );
    }


    if (
        execution.success ===
        false
    ) {

        return (

            "AarHen task complete nahi kar saka. " +

            (

                execution.error ||

                execution.result?.error ||

                "Unknown execution error."

            )

        );
    }


    if (
        execution.category ===
        "research"
    ) {

        return formatResearch(
            execution
        );
    }


    if (
        execution.intent ===
            "web_research"
    ) {

        return formatResearch(
            execution
        );
    }


    if (
        execution.category ===
            "finance" &&

        execution.intent ===
            "calculate_emi"

    ) {

        return formatEMI(
            execution.result
        );
    }


    if (
        execution.category ===
            "finance" &&

        execution.intent ===
            "simple_interest"

    ) {

        return formatSimpleInterest(
            execution.result
        );
    }


    if (
        execution.result &&

        typeof execution.result.message ===
            "string"
    ) {

        return execution.result.message;
    }


    if (
        execution.message &&
        typeof execution.message ===
            "string"
    ) {

        return execution.message;
    }


    return (
        "AarHen ne task successfully process kiya."
    );
}


// ============================================================
// MAIN RESPONSE CREATOR
// ============================================================

function createResponse(
    result = {}
) {

    /*
     * Highest priority:
     * approval
     */

    if (
        result.status ===
        "approval-required"
    ) {

        return (

            "Is action ko perform karne se pehle " +

            "aapki approval required hai."

        );
    }


    /*
     * Missing information.
     */

    if (
        result.status ===
        "needs-user-input"
    ) {

        return formatMissingInput(

            result.execution?.missingParameters

        );
    }


    /*
     * Research:
     *
     * Some execution wrappers may not retain the
     * category in the same place, so detect research
     * before generic execution formatting.
     */

    const hasResearch =

        result.research &&

        typeof result.research ===
            "object";


    const executionResearch =

        result.execution?.research &&

        typeof result.execution.research ===
            "object";


    if (
        hasResearch
    ) {

        return formatResearch(
            result
        );
    }


    if (
        executionResearch
    ) {

        return formatResearch(
            result
        );
    }


    /*
     * Standard execution flow.
     */

    if (
        result.execution
    ) {

        return formatExecution(
            result.execution
        );
    }


    /*
     * Direct result.
     */

    if (
        result.category ===
            "research" ||

        result.intent ===
            "web_research"
    ) {

        return formatResearch(
            result
        );
    }


    /*
     * Generic error.
     */

    if (
        result.error
    ) {

        return result.error;
    }


    return (
        "AarHen ne request process kar li hai."
    );
}


// ============================================================
// RESPONSE STATUS
// ============================================================

function getResponseStatus() {

    return {

        success:
            true,

        engine:
            "AarHen Response Engine",

        version:
            RESPONSE_VERSION,

        status:
            "ready",

        capabilities: {

            financeFormatting:
                true,

            researchFormatting:
                true,

            researchSourceDisplay:
                true,

            researchVerificationDisplay:
                true,

            researchConfidenceDisplay:
                true,

            researchLearningDisplay:
                true,

            nestedResearchResolution:
                true,

            approvalResponse:
                true,

            missingInputResponse:
                true,

            genericExecutionResponse:
                true,

            performanceOptimized:
                true
        }
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    RESPONSE_VERSION,

    formatNumber,

    formatConfidence,

    formatEMI,

    formatSimpleInterest,

    formatMissingInput,

    resolveResearchObject,

    resolveResearchSources,

    normalizeResearchSources,

    resolveResearchVerification,

    resolveResearchLearning,

    resolveResearchQuery,

    resolveResearchAnswer,

    formatResearch,

    formatExecution,

    createResponse,

    getResponseStatus

};
