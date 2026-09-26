// ============================================================
// AARHEN CORE V5
// RESPONSE ENGINE
// ============================================================
// Version: 5.7.7
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
// - Safe nested document resolution
// - Document wrapper collection resolution
// - Supports results/documents/items/sources containers
// - Existing public exports preserved
// ============================================================


const RESPONSE_VERSION =
    "5.7.7";


// ============================================================
// GENERAL HELPERS
// ============================================================

function safeObject(
    value
) {

    return (
        value &&
        typeof value === "object"
    )
        ? value
        : {};
}


function safeArray(
    value
) {

    return Array.isArray(value)
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

    return String(value).trim();
}


function firstNonEmpty(
    ...values
) {

    for (
        const value of values
    ) {

        if (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        ) {

            return value;
        }
    }

    return "";
}


// ============================================================
// COLLECTION RESOLVER
// ============================================================
// Supports:
//
// [...]
// { results: [...] }
// { documents: [...] }
// { items: [...] }
// { sources: [...] }
// { knowledge: [...] }
//
// This fixes documentDocuments wrapper handling.
// ============================================================

function resolveArrayCollection(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value;
    }


    if (
        !value ||
        typeof value !== "object"
    ) {

        return [];
    }


    const candidates = [

        value.results,

        value.documents,

        value.items,

        value.sources,

        value.knowledge

    ];


    for (
        const candidate of
        candidates
    ) {

        if (
            Array.isArray(candidate)
        ) {

            return candidate;
        }
    }


    return [];
}


// ============================================================
// NUMBER FORMAT
// ============================================================

function formatNumber(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return String(
            value ?? ""
        );
    }


    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 2
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
        Number(value);


    if (
        !Number.isFinite(number)
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
// FINANCE
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
        )} per month hai.`

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
        )} aur total amount ₹${formatNumber(
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
        !Array.isArray(missing) ||
        missing.length === 0
    ) {

        return (
            "Mujhe calculation complete karne ke liye required information chahiye."
        );
    }


    return (

        "Mujhe calculation complete karne ke liye " +

        missing.join(", ") +

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
        safeObject(input);


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
        const candidate of candidates
    ) {

        if (
            !candidate ||
            typeof candidate !== "object"
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
        safeObject(input);


    const execution =
        safeObject(
            root.execution
        );


    const research =
        resolveResearchObject(root);


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
        const candidate of candidates
    ) {

        const collection =
            resolveArrayCollection(
                candidate
            );


        if (
            collection.length > 0
        ) {

            return normalizeResearchSources(
                collection
            );
        }
    }


    for (
        const candidate of candidates
    ) {

        const collection =
            resolveArrayCollection(
                candidate
            );


        if (
            Array.isArray(collection)
        ) {

            return normalizeResearchSources(
                collection
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

    return safeArray(sources)
        .map(
            (
                source,
                index
            ) => {

                const item =
                    safeObject(source);


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
                            Number(item.score)
                        )
                            ? Number(item.score)
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
// RESEARCH VERIFICATION
// ============================================================

function resolveResearchVerification(
    input = {}
) {

    const research =
        resolveResearchObject(input);


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

        research.verified === true ||

        verification?.verified === true ||

        status === "verified";


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
                        verification.confidence
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
// RESEARCH LEARNING
// ============================================================

function resolveResearchLearning(
    input = {}
) {

    const research =
        resolveResearchObject(input);


    return (

        research.learning ||

        input.learning ||

        input.execution?.learning ||

        null

    );
}


// ============================================================
// RESEARCH QUERY
// ============================================================

function resolveResearchQuery(
    input = {}
) {

    const research =
        resolveResearchObject(input);


    return firstNonEmpty(

        research.query,

        input.query,

        input.request,

        input.execution?.query,

        ""

    );
}


// ============================================================
// RESEARCH ANSWER
// ============================================================

function resolveResearchAnswer(
    input = {}
) {

    const research =
        resolveResearchObject(input);


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
// RESEARCH ERROR
// ============================================================

function isResearchError(
    input = {}
) {

    const root =
        safeObject(input);


    const research =
        resolveResearchObject(root);


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

function resolveDocumentObject(
    input = {}
) {

    const root =
        safeObject(input);


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

        requestContext.documentDocuments,

        requestContext.documentKnowledge,

        requestContext.documentRag,

        executionContext.documentContext,

        executionContext.documentDocuments,

        executionContext.documentKnowledge,

        executionContext.documentRag,

        execution.documentContext,

        execution.documentDocuments,

        execution.documentKnowledge,

        root.documentKnowledge,

        root.documentDocuments,

        root.documentRag,

        brainKnowledge.documentKnowledge,

        brainKnowledge.documentDocuments,

        brainKnowledge.documentRag,

        executionBrainKnowledge.documentKnowledge,

        executionBrainKnowledge.documentDocuments,

        executionBrainKnowledge.documentRag,

        executionBrain.documentKnowledge,

        executionBrain.documentDocuments,

        executionBrain.documentRag

    ];


    for (
        const candidate of candidates
    ) {

        if (
            !candidate
        ) {

            continue;
        }


        if (
            Array.isArray(candidate)
        ) {

            return {

                results:
                    candidate,

                documentKnowledge:
                    candidate,

                documentDetected:
                    candidate.length > 0

            };
        }


        if (
            typeof candidate !== "object"
        ) {

            continue;
        }


        const collection =
            resolveArrayCollection(
                candidate
            );


        const hasDocumentData =

            collection.length > 0 ||

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
        safeObject(input);


    const executionContext =
        safeObject(
            root.executionContext
        );


    const documentObject =
        resolveDocumentObject(root);


    const candidates = [

        documentObject.documentKnowledge,

        documentObject.knowledge
            ?.documentKnowledge,

        root.documentKnowledge,

        root.requestContext?.documentKnowledge,

        executionContext.documentKnowledge,

        executionContext
            .brain
            ?.knowledge
            ?.documentKnowledge,

        documentObject.results,

        documentObject.documents

    ];


    for (
        const candidate of candidates
    ) {

        const collection =
            resolveArrayCollection(
                candidate
            );


        if (
            collection.length > 0
        ) {

            return normalizeDocumentKnowledge(
                collection
            );
        }
    }


    for (
        const candidate of candidates
    ) {

        const collection =
            resolveArrayCollection(
                candidate
            );


        if (
            Array.isArray(collection)
        ) {

            return normalizeDocumentKnowledge(
                collection
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

    return safeArray(items)
        .map(
            (
                item,
                index
            ) => {

                const source =
                    safeObject(item);


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
                            Number(source.confidence)
                        )
                            ? Number(source.confidence)
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
// IMPORTANT FIX:
//
// Supports:
//
// documentDocuments = {
//     results: [...]
// }
//
// documentDocuments = {
//     documents: [...]
// }
//
// documentDocuments = {
//     items: [...]
// }
//
// documentDocuments = [...]
// ============================================================

function resolveDocumentSources(
    input = {}
) {

    const root =
        safeObject(input);


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

        // Direct root
        root.documentDocuments,

        root.documentSources,

        root.documents,

        // Request context
        requestContext.documentDocuments,

        requestContext.documentSources,

        requestContext.documents,

        // Execution context
        executionContext.documentDocuments,

        executionContext.documentSources,

        executionContext.documents,

        // Execution
        execution.documentDocuments,

        execution.documentSources,

        execution.documents,

        // Brain knowledge
        brainKnowledge.documentDocuments,

        brainKnowledge.documentSources,

        brainKnowledge.documents,

        brainKnowledge.knowledgeDocuments,

        brainKnowledge.knowledgeSources,

        // Execution brain
        executionBrainKnowledge.documentDocuments,

        executionBrainKnowledge.documentSources,

        executionBrainKnowledge.documents,

        executionBrainKnowledge.knowledgeDocuments,

        executionBrainKnowledge.knowledgeSources,

        executionBrain.documentDocuments,

        executionBrain.documentSources,

        executionBrain.documents,

        // Generic document object
        root.documentContext,

        requestContext.documentContext,

        executionContext.documentContext,

        execution.documentContext

    ];


    for (
        const candidate of candidates
    ) {

        const collection =
            resolveArrayCollection(
                candidate
            );


        if (
            collection.length > 0
        ) {

            return normalizeDocumentSources(
                collection
            );
        }
    }


    for (
        const candidate of candidates
    ) {

        const collection =
            resolveArrayCollection(
                candidate
            );


        if (
            Array.isArray(collection)
        ) {

            return normalizeDocumentSources(
                collection
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

    return safeArray(sources)
        .map(
            (
                source,
                index
            ) => {

                const item =
                    safeObject(source);


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
                        Number(item.count) || 0

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
// DOCUMENT ANSWER CONTEXT
// ============================================================

function resolveDocumentAnswerContext(
    input = {}
) {

    const root =
        safeObject(input);


    const documentObject =
        resolveDocumentObject(root);


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

            root.brain
                ?.knowledge
                ?.documentAnswerContext,

            execution.documentContext
                ?.answerContext,

            execution.context
                ?.answerContext,

            execution.context
                ?.brain
                ?.knowledge
                ?.documentAnswerContext,

            root.requestContext
                ?.answerContext,

            ""

        )

    );
}


// ============================================================
// DOCUMENT RAG
// ============================================================

function resolveDocumentRag(
    input = {}
) {

    const root =
        safeObject(input);


    const documentObject =
        resolveDocumentObject(root);


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
// DOCUMENT STATUS
// ============================================================

function resolveDocumentStatus(
    input = {}
) {

    const knowledge =
        resolveDocumentKnowledge(input);


    const sources =
        resolveDocumentSources(input);


    const answerContext =
        resolveDocumentAnswerContext(input);


    const rag =
        resolveDocumentRag(input);


    const root =
        safeObject(input);


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

        sources.length > 0 ||

        Boolean(answerContext) ||

        Boolean(rag);


    return {

        enabled:

            root.documentKnowledgeEnabled !==
                false &&

            root.requestContext
                ?.documentKnowledgeEnabled !==
                false &&

            executionContext
                .documentKnowledgeEnabled !==
                false &&

            root.execution
                ?.documentKnowledgeEnabled !==
                false &&

            root.execution
                ?.context
                ?.brain
                ?.knowledge
                ?.documentKnowledgeEnabled !==
                false &&

            root.executionContext
                ?.brain
                ?.knowledge
                ?.documentKnowledgeEnabled !==
                false,

        aware:
            documentAware,

        knowledgeCount:
            knowledge.length,

        sourceCount:
            sources.length,

        answerContextAvailable:
            Boolean(answerContext),

        ragAvailable:
            Boolean(rag),

        detected:
            documentAware ||
            Boolean(answerContext) ||
            Boolean(rag),

        knowledge,

        sources,

        answerContext,

        rag

    };
}


// ============================================================
// DOCUMENT RESPONSE
// ============================================================

function formatDocument(
    input = {}
) {

    const status =
        resolveDocumentStatus(input);


    // Respect explicit document-knowledge disable flags before
    // rendering any stale document context or evidence.
    if (
        !status.enabled ||
        !status.detected
    ) {

        return "";
    }


    let response =
        "";


    response +=
        "📄 Document Knowledge";


    if (
        status.answerContext
    ) {

        response +=

            `\n\n${status.answerContext}`;
    }


    const knowledge =
        status.knowledge;


    if (
        knowledge.length > 0
    ) {

        response +=
            "\n\nRelevant document information:";


        knowledge
            .slice(0, 5)
            .forEach(
                (
                    item,
                    index
                ) => {

                    const title =
                        firstNonEmpty(
                            item.title,
                            `Document item ${index + 1}`
                        );


                    const content =
                        normalize(
                            item.content
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


    const evidenceCandidates = [
        input.documentEvidence,
        input.requestContext?.documentEvidence,
        input.executionContext?.documentEvidence,
        input.executionContext?.brain?.knowledge?.documentEvidence,
        input.execution?.documentEvidence,
        input.execution?.context?.documentEvidence,
        input.execution?.context?.brain?.knowledge?.documentEvidence,
        input.brain?.knowledge?.documentEvidence,
        input.brain?.knowledge?.evidence,
        input.executionContext?.brain?.knowledge?.evidence,
        input.execution?.context?.brain?.knowledge?.evidence
    ];

    const evidence =
        evidenceCandidates.find(
            candidate =>
                Array.isArray(candidate) &&
                candidate.length > 0
        ) || [];

    if (evidence.length > 0) {
        response += "\n\n📌 Evidence references:";

        evidence
            .slice(0, 5)
            .forEach((item, index) => {
                const evidenceItem = safeObject(item);
                const reference =
                    firstNonEmpty(
                        evidenceItem.reference,
                        evidenceItem.ref,
                        evidenceItem.id,
                        `DOC-${index + 1}`
                    );

                const title =
                    firstNonEmpty(
                        evidenceItem.title,
                        evidenceItem.source,
                        `Document evidence ${index + 1}`
                    );

                response += `\n${reference} — ${title}`;
            });
    }


    const sources =
        status.sources;


    if (
        sources.length > 0
    ) {

        response +=
            "\n\n📚 Document sources:";


        sources
            .slice(0, 5)
            .forEach(
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


    if (
        status.ragAvailable
    ) {

        response +=
            "\n🧩 RAG context: available";
    }


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
// RESEARCH RESPONSE
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
        resolveResearchObject(result);


    if (
        isResearchError(result)
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
        resolveResearchAnswer(result);


    const sources =
        resolveResearchSources(result);


    const verification =
        resolveResearchVerification(result);


    const learning =
        resolveResearchLearning(result);


    const query =
        resolveResearchQuery(result);


    let response =
        "";


    if (
        answer
    ) {

        response +=

            `🌐 Web Research Result\n\n${answer}`;

    } else {

        response +=

            "🌐 Web research complete hui, lekin provider ne direct summary nahi di.";
    }


    response +=

        `\n\n📚 Sources: ${sources.length}`;


    response +=

        verification.verified

            ? "\n🔍 Verification: verified"

            : verification.status ===
                "partial"

                ? "\n🔍 Verification: partial"

                : "\n🔍 Verification: review required";


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


    if (
        learning
    ) {

        if (
            learning.learned === true
        ) {

            response +=

                "\n🧠 Verified information AarHen ki knowledge memory me learn ho gayi.";

        } else if (
            learning.success === true
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


    if (
        query
    ) {

        // Query intentionally not displayed separately.
    }


    if (
        sources.length > 0
    ) {

        response +=
            "\n\nTop sources:";


        sources
            .slice(0, 5)
            .forEach(
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
// GENERIC EXECUTION
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
        execution.success === false
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
// APPEND DOCUMENT KNOWLEDGE
// ============================================================

function appendDocumentKnowledge(
    baseResponse,
    result
) {

    const documentResponse =
        formatDocument(result);


    if (
        !documentResponse
    ) {

        return baseResponse;
    }


    if (
        normalize(baseResponse)
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

        const response =
            "Is action ko perform karne se pehle aapki approval required hai.";


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // MISSING INPUT
    // --------------------------------------------------------

    if (
        result.status ===
        "needs-user-input"
    ) {

        const response =
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
            formatResearch(result);


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    if (
        executionResearch
    ) {

        const response =
            formatResearch(result);


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // EXECUTION
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
    // DIRECT RESEARCH
    // --------------------------------------------------------

    if (
        result.category ===
            "research" ||

        result.intent ===
            "web_research"
    ) {

        const response =
            formatResearch(result);


        return appendDocumentKnowledge(
            response,
            result
        );
    }


    // --------------------------------------------------------
    // DIRECT DOCUMENT
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
    // ERROR
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

            documentCollectionResolution:
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

    safeObject,

    safeArray,

    normalize,

    firstNonEmpty,

    resolveArrayCollection,

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

    isResearchError,

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
