// ============================================================
// AARHEN CORE V5
// RESPONSE ENGINE
// ============================================================
// Version: 5.7.6
//
// Improvements:
// - Existing research response handling preserved
// - Research source count display preserved
// - Research verification display preserved
// - Research learning display preserved
// - Document knowledge response support
// - Document RAG context support
// - Document answer context support
// - Document source display
// - Safe nested document context resolution
// - Existing public exports preserved
// ============================================================


const RESPONSE_VERSION =
    "5.7.6";


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
// DOCUMENT OBJECT RESOLVER
// ============================================================
// Document data can arrive from:
//
// result.executionContext
// result.execution.documentContext
// result.documentContext
// result.requestContext
// result.brain.knowledge
// result.executionContext.brain.knowledge
//
// The response engine searches these locations without
// changing the upstream data model.
// ============================================================

function resolveDocumentObject(
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


    const executionContext =
        safeObject(
            root.executionContext
        );


    const requestContext =
        safeObject(
            root.requestContext
        );


    const brain =
        safeObject(
            root.brain
        );


    const brainKnowledge =
        safeObject(
            brain.knowledge
        );


    const executionBrain =
        safeObject(
            executionContext.brain
        );


    const executionBrainKnowledge =
        safeObject(
            executionBrain.knowledge
        );


    const candidates = [

        root.documentContext,

        requestContext.documentContext,

        executionContext.documentContext,

        execution.documentContext,

        root.documentKnowledge,

        requestContext.documentKnowledge,

        executionContext.documentKnowledge,

        execution.documentKnowledge,

        brainKnowledge.documentKnowledge,

        executionBrainKnowledge.documentKnowledge,

        executionBrain.documentKnowledge

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


        const hasDocumentData =

            Array.isArray(
                candidate.documentKnowledge
            ) ||

            Array.isArray(
                candidate.results
            ) ||

            Array.isArray(
                candidate.documents
            ) ||

            candidate.rag ||

            candidate.answerContext ||

            candidate.knowledgeContext ||

            candidate.documentDetected ===
                true;


        if (
            hasDocumentData
        ) {

            return candidate;
        }
    }


    return {};
}


// ============================================================
// DOCUMENT KNOWLEDGE RESOLVER
// ============================================================

function resolveDocumentKnowledge(
    input = {}
) {

    const root =
        safeObject(
            input
        );


    const executionContext =
        safeObject(
            root.executionContext
        );


    const documentObject =
        resolveDocumentObject(
            root
        );


    const candidates = [

        documentObject.documentKnowledge,

        root.documentKnowledge,

        root.requestContext?.documentKnowledge,

        executionContext.documentKnowledge,

        executionContext.brain
            ?.knowledge
            ?.documentKnowledge,

        documentObject.knowledge
            ?.documentKnowledge

    ];


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

            return normalizeDocumentKnowledge(
                candidate
            );
        }
    }


    for (
        const candidate of
        candidates
    ) {

        if (
            Array.isArray(
                candidate
            )
        ) {

            return normalizeDocumentKnowledge(
                candidate
            );
        }
    }


    return [];
}


// ============================================================
// NORMALIZE DOCUMENT KNOWLEDGE
// ============================================================

function normalizeDocumentKnowledge(
    items = []
) {

    return safeArray(
        items
    )

        .map(
            (
                item,
                index
            ) => {

                const source =
                    safeObject(
                        item
                    );


                return {

                    id:
                        firstNonEmpty(

                            source.id,

                            source.memoryId,

                            `document-knowledge-${index + 1}`

                        ),

                    title:
                        firstNonEmpty(

                            source.title,

                            source.name,

                            source.documentName,

                            `Document Knowledge ${index + 1}`

                        ),

                    content:
                        firstNonEmpty(

                            source.content,

                            source.text,

                            source.snippet,

                            source.answer,

                            ""

                        ),

                    source:
                        firstNonEmpty(

                            source.source,

                            source.documentSource,

                            source.documentName,

                            source.fileName,

                            ""

                        ),

                    documentType:
                        firstNonEmpty(

                            source.documentType,

                            source.type,

                            ""

                        ),

                    verified:
                        source.verified === true,

                    confidence:
                        Number.isFinite(
                            Number(
                                source.confidence
                            )
                        )

                            ? Number(
                                source.confidence
                            )

                            : null

                };
            }
        )

        .filter(
            item =>
                item.title ||
                item.content ||
                item.source
        );
}


// ============================================================
// DOCUMENT SOURCE RESOLVER
// ============================================================

function resolveDocumentSources(
    input = {}
) {

    const root =
        safeObject(
            input
        );


    const documentObject =
        resolveDocumentObject(
            root
        );


    const executionContext =
        safeObject(
            root.executionContext
        );


    const candidates = [

        documentObject.documents,

        documentObject.results,

        root.documentDocuments,

        root.requestContext?.documentDocuments,

        executionContext.documentDocuments,

        executionContext.brain
            ?.knowledge
            ?.documentDocuments

    ];


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

            return normalizeDocumentSources(
                candidate
            );
        }
    }


    for (
        const candidate of
        candidates
    ) {

        if (
            Array.isArray(
                candidate
            )
        ) {

            return normalizeDocumentSources(
                candidate
            );
        }
    }


    return [];
}


// ============================================================
// NORMALIZE DOCUMENT SOURCES
// ============================================================

function normalizeDocumentSources(
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
                        firstNonEmpty(

                            item.id,

                            `document-source-${index + 1}`

                        ),

                    title:
                        firstNonEmpty(

                            item.title,

                            item.name,

                            item.documentName,

                            item.fileName,

                            `Document ${index + 1}`

                        ),

                    source:
                        firstNonEmpty(

                            item.source,

                            item.documentSource,

                            item.documentName,

                            item.fileName,

                            ""

                        ),

                    type:
                        firstNonEmpty(

                            item.documentType,

                            item.type,

                            ""

                        ),

                    count:
                        Number(
                            item.count
                        ) || 0

                };
            }
        )

        .filter(
            item =>
                item.title ||
                item.source
        );
}


// ============================================================
// DOCUMENT ANSWER CONTEXT RESOLVER
// ============================================================

function resolveDocumentAnswerContext(
    input = {}
) {

    const root =
        safeObject(
            input
        );


    const documentObject =
        resolveDocumentObject(
            root
        );


    const executionContext =
        safeObject(
            root.executionContext
        );


    const execution =
        safeObject(
            root.execution
        );


    return normalize(

        firstNonEmpty(

            root.answerContext,

            documentObject.answerContext,

            executionContext.answerContext,

            executionContext
                .brain
                ?.knowledge
                ?.documentAnswerContext,

            execution.documentContext
                ?.answerContext,

            ""

        )

    );
}


// ============================================================
// DOCUMENT RAG RESOLVER
// ============================================================

function resolveDocumentRag(
    input = {}
) {

    const root =
        safeObject(
            input
        );


    const documentObject =
        resolveDocumentObject(
            root
        );


    const executionContext =
        safeObject(
            root.executionContext
        );


    return (

        documentObject.rag ||

        root.documentRag ||

        root.requestContext
            ?.documentRag ||

        executionContext.documentRag ||

        executionContext
            .brain
            ?.knowledge
            ?.documentRag ||

        null

    );
}


// ============================================================
// DOCUMENT STATUS RESOLVER
// ============================================================

function resolveDocumentStatus(
    input = {}
) {

    const knowledge =
        resolveDocumentKnowledge(
            input
        );


    const sources =
        resolveDocumentSources(
            input
        );


    const answerContext =
        resolveDocumentAnswerContext(
            input
        );


    const rag =
        resolveDocumentRag(
            input
        );


    const root =
        safeObject(
            input
        );


    const executionContext =
        safeObject(
            root.executionContext
        );


    const documentAware =
        root.documentAware === true ||

        root.pipeline
            ?.documentAware === true ||

        root.requestContext
            ?.documentAware === true ||

        executionContext.documentAware ===
            true ||

        knowledge.length > 0 ||

        sources.length > 0;


    return {

        enabled:
            root.documentKnowledgeEnabled !== false &&
            root.requestContext
                ?.documentKnowledgeEnabled !== false &&
            executionContext
                .documentKnowledgeEnabled !== false,

        aware:
            documentAware,

        knowledgeCount:
            knowledge.length,

        sourceCount:
            sources.length,

        answerContextAvailable:
            Boolean(
                answerContext
            ),

        ragAvailable:
            Boolean(
                rag
            ),

        detected:
            documentAware ||
            Boolean(
                answerContext
            ) ||
            Boolean(
                rag
            ),

        knowledge,

        sources,

        answerContext,

        rag

    };
}


// ============================================================
// DOCUMENT RESPONSE FORMATTER
// ============================================================

function formatDocument(
    input = {}
) {

    const status =
        resolveDocumentStatus(
            input
        );


    if (
        !status.detected
    ) {

        return "";
    }


    let response =
        "";


    // --------------------------------------------------------
    // DOCUMENT HEADER
    // --------------------------------------------------------

    response +=
        "📄 Document Knowledge";


    // --------------------------------------------------------
    // ANSWER CONTEXT
    // --------------------------------------------------------

    if (
        status.answerContext
    ) {

        response +=

            `\n\n${status.answerContext}`;
    }


    // --------------------------------------------------------
    // KNOWLEDGE ITEMS
    // --------------------------------------------------------

    const knowledge =
        status.knowledge;


    if (
        knowledge.length > 0
    ) {

        response +=
            "\n\nRelevant document information:";


        const visibleKnowledge =
            knowledge.slice(
                0,
                5
            );


        visibleKnowledge.forEach(

            (
                item,
                index
            ) => {

                const content =
                    normalize(
                        item.content
                    );


                const title =
                    firstNonEmpty(

                        item.title,

                        `Document item ${index + 1}`

                    );


                response +=

                    `\n${index + 1}. ${title}`;


                if (
                    content
                ) {

                    response +=

                        ` — ${content}`;
                }

            }

        );
    }


    // --------------------------------------------------------
    // DOCUMENT SOURCES
    // --------------------------------------------------------

    const sources =
        status.sources;


    if (
        sources.length > 0
    ) {

        response +=
            "\n\n📚 Document sources:";


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

                const title =
                    firstNonEmpty(

                        source.title,

                        source.source,

                        `Document ${index + 1}`

                    );


                response +=

                    `\n${index + 1}. ${title}`;

            }

        );
    }


    // --------------------------------------------------------
    // RAG STATUS
    // --------------------------------------------------------

    if (
        status.ragAvailable
    ) {

        response +=
            "\n🧩 RAG context: available";
    }


    // --------------------------------------------------------
    // DOCUMENT VERIFICATION / COUNT INFO
    // --------------------------------------------------------

    if (
        status.knowledgeCount > 0 ||
        status.sourceCount > 0
    ) {

        response +=

            `\n📊 Document context: ${status.knowledgeCount} knowledge item(s), ${status.sourceCount} document source(s)`;
    }


    return response;
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


    // --------------------------------------------------------
    // ANSWER
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // SOURCE COUNT
    // --------------------------------------------------------

    response +=

        `\n\n📚 Sources: ${sources.length}`;


    // --------------------------------------------------------
    // VERIFICATION
    // --------------------------------------------------------

    response +=

        verification.verified

            ? "\n🔍 Verification: verified"

            : verification.status ===
                "partial"

                ? "\n🔍 Verification: partial"

                : "\n🔍 Verification: review required";


    // --------------------------------------------------------
    // CONFIDENCE
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // LEARNING
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // QUERY
    // --------------------------------------------------------

    if (
        query
    ) {

        // Query deliberately kept out of the main response
        // to keep normal output compact.
    }


    // --------------------------------------------------------
    // SOURCE DETAILS
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // GENERIC RESULT MESSAGE
    // --------------------------------------------------------

    let response =
        "";


    if (
        execution.result &&
        typeof execution.result.message ===
            "string"
    ) {

        response =
            execution.result.message;

    } else if (
        execution.message &&
        typeof execution.message ===
            "string"
    ) {

        response =
            execution.message;

    } else {

        response =
            "AarHen ne task successfully process kiya.";
    }


    return response;
}


// ============================================================
// APPEND DOCUMENT KNOWLEDGE
// ============================================================

function appendDocumentKnowledge(
    baseResponse,
    result
) {

    const documentResponse =
        formatDocument(
            result
        );


    if (
        !documentResponse
    ) {

        return baseResponse;
    }


    if (
        normalize(
            baseResponse
        )
    ) {

        return (

            `${baseResponse}\n\n` +

            documentResponse

        );
    }


    return documentResponse;
}


// ============================================================
// MAIN RESPONSE CREATOR
// ============================================================

function createResponse(
    result = {}
) {

    // --------------------------------------------------------
    // APPROVAL
    // --------------------------------------------------------

    if (
        result.status ===
        "approval-required"
    ) {

        let response =

            "Is action ko perform karne se pehle " +

            "aapki approval required hai.";


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // MISSING INFORMATION
    // --------------------------------------------------------

    if (
        result.status ===
        "needs-user-input"
    ) {

        let response =

            formatMissingInput(

                result.execution
                    ?.missingParameters

            );


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // RESEARCH
    // --------------------------------------------------------

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

        const response =
            formatResearch(
                result
            );


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    if (
        executionResearch
    ) {

        const response =
            formatResearch(
                result
            );


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // STANDARD EXECUTION
    // --------------------------------------------------------

    if (
        result.execution
    ) {

        const response =
            formatExecution(
                result.execution
            );


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // DIRECT RESEARCH RESULT
    // --------------------------------------------------------

    if (
        result.category ===
            "research" ||

        result.intent ===
            "web_research"
    ) {

        const response =
            formatResearch(
                result
            );


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // DIRECT DOCUMENT REQUEST
    // --------------------------------------------------------

    const documentStatus =
        resolveDocumentStatus(
            result
        );


    if (
        documentStatus.detected
    ) {

        return formatDocument(
            result
        );
    }


    // --------------------------------------------------------
    // GENERIC ERROR
    // --------------------------------------------------------

    if (
        result.error
    ) {

        return result.error;
    }


    // --------------------------------------------------------
    // DEFAULT
    // --------------------------------------------------------

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

            // ------------------------------------------------
            // FINANCE
            // ------------------------------------------------

            financeFormatting:
                true,


            // ------------------------------------------------
            // RESEARCH
            // ------------------------------------------------

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


            // ------------------------------------------------
            // DOCUMENT
            // ------------------------------------------------

            documentFormatting:
                true,

            documentKnowledgeDisplay:
                true,

            documentSourceDisplay:
                true,

            documentAnswerContextDisplay:
                true,

            documentRagStatusDisplay:
                true,

            nestedDocumentResolution:
                true,


            // ------------------------------------------------
            // OTHER
            // ------------------------------------------------

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

    resolveDocumentObject,

    resolveDocumentKnowledge,

    normalizeDocumentKnowledge,

    resolveDocumentSources,

    normalizeDocumentSources,

    resolveDocumentAnswerContext,

    resolveDocumentRag,

    resolveDocumentStatus,

    formatDocument,

    appendDocumentKnowledge,

    formatExecution,

    createResponse,

    getResponseStatus

};
